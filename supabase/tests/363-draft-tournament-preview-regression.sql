-- Preview-only transactional matrix for Draft Tournament migrations 362-363.
-- Run only in an isolated Supabase branch after the production baseline
-- through migration 360 exists. Every synthetic identity and event is removed
-- before commit; any failed assertion aborts the transaction.

begin;

create temp table dc_draft_tournament_results (
  result jsonb not null
) on commit preserve rows;

create function pg_temp.dc_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create function pg_temp.dc_forfeit(p_match_id uuid)
returns void
language plpgsql
as $$
declare
  v_tournament_revision bigint;
  v_match_revision bigint;
  v_loser_id uuid;
begin
  select tournament.revision, bracket_match.revision, bracket_match.entrant_b_id
  into v_tournament_revision, v_match_revision, v_loser_id
  from public.tournament_matches bracket_match
  join public.tournaments tournament on tournament.id = bracket_match.tournament_id
  where bracket_match.id = p_match_id;
  perform public.forfeit_tournament_match(
    p_match_id,
    v_tournament_revision,
    v_match_revision,
    v_loser_id,
    'Synthetic Draft Tournament matrix'
  );
end;
$$;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_players uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_player uuid;
  v_payload jsonb;
  v_projection jsonb;
  v_tournament_id uuid;
  v_cancel_tournament_id uuid;
  v_event_id uuid;
  v_event_revision bigint;
  v_league_id uuid;
  v_cancel_league_id uuid;
  v_session_id uuid;
  v_state jsonb;
  v_started_state jsonb;
  v_pokemon jsonb;
  v_league_pokemon_id uuid;
  v_match public.tournament_matches%rowtype;
  v_pick integer;
  v_denied boolean;
  v_grants_ok boolean;
  v_rls_ok boolean;
  v_field_ok boolean;
  v_identity_ok boolean;
  v_draft_ok boolean;
  v_roster_lock_ok boolean;
  v_correction_ok boolean;
  v_swiss_ok boolean;
  v_top_cut_ok boolean;
  v_projection_ok boolean;
  v_cancellation_ok boolean;
  v_cleanup_ok boolean;
begin
  select
    has_function_privilege(
      'authenticated',
      'public.create_draft_tournament(text,text,text,integer,integer,text,integer,integer,integer,boolean,integer,boolean)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.lock_draft_tournament_rosters(uuid,bigint)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.cancel_draft_tournament(uuid,bigint)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.lock_draft_tournament_rosters(uuid,bigint)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.create_draft_tournament_swiss_round(uuid,integer,uuid)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.create_draft_tournament_swiss_round(uuid,integer,uuid)',
      'execute'
    )
    and not has_table_privilege('authenticated', 'public.draft_tournament_events', 'select')
    and not has_table_privilege('anon', 'public.draft_tournament_seats', 'select')
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Draft Tournament grants do not match the RPC-only browser boundary.';
  end if;

  select count(*) = 6 and bool_and(relrowsecurity)
  into v_rls_ok
  from pg_class
  where oid in (
    'public.draft_tournament_events'::regclass,
    'public.draft_tournament_seats'::regclass,
    'public.draft_tournament_rounds'::regclass,
    'public.draft_tournament_pairings'::regclass,
    'public.draft_tournament_standing_snapshots'::regclass,
    'public.draft_tournament_top_cut_entries'::regclass
  );
  if v_rls_ok is distinct from true then
    raise exception 'Every Draft Tournament table must keep RLS enabled.';
  end if;

  insert into auth.users(id, aud, role)
  select identity, 'authenticated', 'authenticated'
  from unnest(array[v_owner] || v_players) identity;
  insert into public.profiles(id, display_name)
  select identity, 'Shared synthetic identity'
  from unnest(array[v_owner] || v_players) identity
  on conflict (id) do update
  set display_name = excluded.display_name;

  perform pg_temp.dc_auth(v_owner);
  select public.create_draft_tournament(
    'Draft Tournament Preview Matrix',
    '',
    'public',
    1,
    4,
    'Synthetic lifecycle matrix',
    4,
    0,
    2,
    false,
    null,
    true
  ) into v_payload;
  v_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_event_id := (v_payload ->> 'event_id')::uuid;

  foreach v_player in array v_players loop
    perform pg_temp.dc_auth(v_player);
    perform public.join_tournament(
      v_tournament_id,
      'Shared synthetic identity',
      null,
      null
    );
  end loop;

  perform pg_temp.dc_auth(v_owner);
  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.open_draft_tournament_check_in(v_tournament_id, v_event_revision);

  foreach v_player in array v_players loop
    perform pg_temp.dc_auth(v_player);
    perform public.set_draft_tournament_check_in(v_tournament_id, true);
  end loop;

  perform pg_temp.dc_auth(v_owner);
  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.lock_draft_tournament_field(v_tournament_id, v_event_revision);
  select draft_league_id into v_league_id
  from public.draft_tournament_events where id = v_event_id;

  select
    event.phase = 'draft-setup'
    and event.swiss_round_count = 3
    and event.pick_time_limit_minutes = 0
    and count(seat.*) = 4
    and count(seat.*) filter (where seat.status = 'active') = 4
    and count(distinct seat.user_id) = 4
    and snapshot.state #> '{settings,manualDraftOrder}' = '[0,1,2,3]'::jsonb
    and snapshot.state #>> '{settings,rosterMax}' = '4'
    and league.workspace_kind = 'draft-tournament'
    and not league.is_public
  into v_field_ok
  from public.draft_tournament_events event
  join public.draft_tournament_seats seat on seat.event_id = event.id
  join public.leagues league on league.id = event.draft_league_id
  join public.league_state_snapshots snapshot on snapshot.league_id = league.id
  where event.id = v_event_id
  group by event.phase, event.swiss_round_count, event.pick_time_limit_minutes,
    snapshot.state, league.workspace_kind, league.is_public;
  if v_field_ok is distinct from true then
    raise exception 'Field locking did not create four exact private draft seats.';
  end if;

  insert into public.pokemon_catalogue(
    id, display_name, primary_type, secondary_type, base_stat_total, sprite_url
  )
  select
    format('dc-draft-tournament-preview-%s', seed_number),
    format('Preview Pokemon %s', seed_number),
    'Normal',
    null,
    300,
    null
  from generate_series(1, 20) seed_number
  on conflict (id) do nothing;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pokemon.id,
    'name', pokemon.display_name,
    't1', pokemon.primary_type,
    't2', pokemon.secondary_type,
    'bst', pokemon.base_stat_total,
    'spriteUrl', pokemon.sprite_url,
    'cost', 1
  ) order by pokemon.id), '[]'::jsonb)
  into v_pokemon
  from (
    select * from public.pokemon_catalogue
    where id in (
      select format('dc-draft-tournament-preview-%s', seed_number)
      from generate_series(1, 20) seed_number
    )
    order by id
  ) pokemon;
  if jsonb_array_length(v_pokemon) < 16 then
    raise exception 'The Preview baseline does not contain enough Pokemon for the draft matrix.';
  end if;

  select state into v_state
  from public.league_state_snapshots where league_id = v_league_id;
  v_started_state := jsonb_set(v_state, '{pool}', v_pokemon, true);
  v_started_state := jsonb_set(
    v_started_state,
    '{liveDraft}',
    jsonb_build_object('basePool', v_pokemon),
    true
  );
  select (public.provision_live_snake_draft_v2(
    v_league_id,
    v_state -> 'teams',
    v_pokemon,
    array[0,1,2,3,3,2,1,0,0,1,2,3,3,2,1,0],
    v_state -> 'settings',
    '{}'::jsonb,
    v_started_state
  ) ->> 'draft_session_id')::uuid into v_session_id;

  select count(*) = 4 and bool_and(membership.user_id = seat.user_id)
  into v_identity_ok
  from public.teams team
  join public.league_memberships membership on membership.id = team.owner_membership_id
  join public.draft_tournament_seats seat
    on seat.event_id = v_event_id
   and seat.team_key = team.source_key::smallint
  where team.league_id = v_league_id;
  if v_identity_ok is distinct from true then
    raise exception 'Relational team ownership did not follow exact entrant account IDs.';
  end if;

  for v_pick in 1..16 loop
    select id into v_league_pokemon_id
    from public.league_pokemon
    where league_id = v_league_id and is_allowed and not is_drafted
    order by source_key
    limit 1;
    perform public.make_snake_pick(v_session_id, v_league_pokemon_id);
  end loop;

  select session.status = 'complete'
    and event.phase = 'roster-review'
    and count(entry.*) = 16
  into v_draft_ok
  from public.draft_sessions session
  join public.draft_tournament_events event on event.draft_session_id = session.id
  join public.teams team on team.league_id = session.league_id
  join public.roster_entries entry on entry.team_id = team.id and entry.released_at is null
  where session.id = v_session_id
  group by session.status, event.phase;
  if v_draft_ok is distinct from true then
    raise exception 'The hosted snake draft did not produce four complete rosters.';
  end if;

  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  v_denied := false;
  begin
    perform public.lock_draft_tournament_rosters(v_tournament_id, v_event_revision - 1);
  exception when others then
    if sqlerrm not like '%event changed%' then raise; end if;
    v_denied := true;
  end;
  if not v_denied then raise exception 'A stale roster-lock revision was accepted.'; end if;
  perform public.lock_draft_tournament_rosters(v_tournament_id, v_event_revision);

  select event.phase = 'swiss'
    and event.roster_locked_at is not null
    and event.current_swiss_round = 1
    and count(seat.*) filter (
      where jsonb_array_length(seat.roster_snapshot) = 4
        and seat.roster_hash ~ '^[0-9a-f]{64}$'
    ) = 4
  into v_roster_lock_ok
  from public.draft_tournament_events event
  join public.draft_tournament_seats seat on seat.event_id = event.id
  where event.id = v_event_id
  group by event.phase, event.roster_locked_at, event.current_swiss_round;
  if v_roster_lock_ok is distinct from true then
    raise exception 'Roster lock did not create four immutable hashed snapshots.';
  end if;

  v_denied := false;
  begin
    update public.league_state_snapshots
    set state = jsonb_set(state, '{rosters,0}', '[]'::jsonb, false)
    where league_id = v_league_id;
  exception when others then
    if sqlerrm not like '%rosters are locked%' then raise; end if;
    v_denied := true;
  end;
  if not v_denied then raise exception 'The JSON roster lock accepted a mutation.'; end if;

  v_denied := false;
  begin
    update public.roster_entries
    set acquisition_type = acquisition_type
    where id = (
      select entry.id
      from public.roster_entries entry
      join public.teams team on team.id = entry.team_id
      where team.league_id = v_league_id
      limit 1
    );
  exception when others then
    if sqlerrm not like '%rosters are locked%' then raise; end if;
    v_denied := true;
  end;
  if not v_denied then raise exception 'The relational roster lock accepted a mutation.'; end if;

  for v_match in
    select bracket_match.*
    from public.tournament_matches bracket_match
    where bracket_match.tournament_id = v_tournament_id
      and bracket_match.bracket_stage = 'swiss'
      and bracket_match.bracket_round = 1
      and bracket_match.status = 'ready'
    order by bracket_match.match_number
  loop
    perform pg_temp.dc_forfeit(v_match.id);
  end loop;
  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.start_next_draft_tournament_swiss_round(v_tournament_id, v_event_revision);

  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_id
    and bracket_stage = 'swiss'
    and bracket_round = 1
  order by match_number
  limit 1;
  perform public.correct_tournament_result(
    v_match.id,
    v_match.revision,
    0,
    1,
    '{}',
    null
  );
  select not exists (
    select 1 from public.draft_tournament_rounds
    where event_id = v_event_id and round_number = 2
  ) into v_correction_ok;
  if v_correction_ok is distinct from true then
    raise exception 'An untouched later Swiss round was not rolled back for correction.';
  end if;

  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.start_next_draft_tournament_swiss_round(v_tournament_id, v_event_revision);
  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_id
    and bracket_stage = 'swiss'
    and bracket_round = 2
    and status = 'ready'
  order by match_number
  limit 1;
  perform pg_temp.dc_forfeit(v_match.id);

  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_id
    and bracket_stage = 'swiss'
    and bracket_round = 1
  order by match_number
  limit 1;
  v_denied := false;
  begin
    perform public.correct_tournament_result(
      v_match.id,
      v_match.revision,
      1,
      0,
      '{}',
      null
    );
  exception when others then
    if sqlerrm not like '%later Swiss round has started%' then raise; end if;
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'An earlier correction was accepted after later Swiss play began.';
  end if;

  for v_match in
    select bracket_match.*
    from public.tournament_matches bracket_match
    where bracket_match.tournament_id = v_tournament_id
      and bracket_match.bracket_stage = 'swiss'
      and bracket_match.bracket_round = 2
      and bracket_match.status = 'ready'
    order by bracket_match.match_number
  loop
    perform pg_temp.dc_forfeit(v_match.id);
  end loop;
  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.start_next_draft_tournament_swiss_round(v_tournament_id, v_event_revision);
  for v_match in
    select bracket_match.*
    from public.tournament_matches bracket_match
    where bracket_match.tournament_id = v_tournament_id
      and bracket_match.bracket_stage = 'swiss'
      and bracket_match.bracket_round = 3
      and bracket_match.status = 'ready'
    order by bracket_match.match_number
  loop
    perform pg_temp.dc_forfeit(v_match.id);
  end loop;

  select event.phase = 'swiss-complete'
    and count(distinct least(pairing.entrant_a_id::text, pairing.entrant_b_id::text)
      || ':' || greatest(pairing.entrant_a_id::text, pairing.entrant_b_id::text)) = 6
    and count(*) = 6
    and (
      select count(*) from public.draft_tournament_standing_snapshots standing
      join public.draft_tournament_rounds final_round on final_round.id = standing.round_id
      where final_round.event_id = event.id and final_round.round_number = 3
    ) = 4
  into v_swiss_ok
  from public.draft_tournament_events event
  join public.draft_tournament_pairings pairing
    on pairing.event_id = event.id and not pairing.is_bye
  where event.id = v_event_id
  group by event.id, event.phase;
  if v_swiss_ok is distinct from true then
    raise exception 'Three-round Swiss play did not remain deterministic and rematch-free.';
  end if;

  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.start_draft_tournament_top_cut(v_tournament_id, v_event_revision);
  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_id
    and bracket_stage = 'top-cut'
    and status = 'ready';
  perform pg_temp.dc_forfeit(v_match.id);
  select tournament.status = 'complete'
    and event.phase = 'complete'
    and count(cut.*) = 2
    and exists (
      select 1 from public.tournament_audit_events audit
      where audit.tournament_id = tournament.id
        and audit.kind = 'draft_tournament_completed'
        and audit.payload ? 'winner_id'
    )
  into v_top_cut_ok
  from public.tournaments tournament
  join public.draft_tournament_events event on event.tournament_id = tournament.id
  join public.draft_tournament_top_cut_entries cut on cut.event_id = event.id
  where tournament.id = v_tournament_id
  group by tournament.status, tournament.id, event.phase;
  if v_top_cut_ok is distinct from true then
    raise exception 'The top cut did not retain two Swiss entrants and complete the event.';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  select public.get_draft_tournament_workspace(v_tournament_id) into v_projection;
  v_projection_ok := v_projection is not null
    and v_projection -> 'draft_room' = 'null'::jsonb
    and jsonb_array_length(v_projection -> 'seats') = 4
    and not (v_projection::text like '%user_id%')
    and not (v_projection::text like '%claimedByUserId%')
    and not (v_projection::text like '%owner_id%')
    and not (v_projection::text like '%draft_league_id%')
    and not exists (
      select 1
      from jsonb_array_elements(v_projection -> 'seats') seat
      where jsonb_typeof(seat -> 'roster') <> 'array'
    );
  if v_projection_ok is distinct from true then
    raise exception 'The public projection is missing published rosters or exposes private identity.';
  end if;

  perform pg_temp.dc_auth(v_owner);
  select public.create_draft_tournament(
    'Draft Tournament Cancellation Matrix', '', 'private', 1, 4, '',
    4, 5, 0, false, null, false
  ) into v_payload;
  v_cancel_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  foreach v_player in array v_players loop
    insert into public.tournament_entrants(
      tournament_id, user_id, display_name, checked_in_at
    ) values (
      v_cancel_tournament_id, v_player, 'Cancellation entrant', now()
    );
  end loop;
  select revision into v_event_revision
  from public.draft_tournament_events where tournament_id = v_cancel_tournament_id;
  perform public.open_draft_tournament_check_in(v_cancel_tournament_id, v_event_revision);
  select revision into v_event_revision
  from public.draft_tournament_events where tournament_id = v_cancel_tournament_id;
  perform public.lock_draft_tournament_field(v_cancel_tournament_id, v_event_revision);
  select draft_league_id, revision into v_cancel_league_id, v_event_revision
  from public.draft_tournament_events where tournament_id = v_cancel_tournament_id;
  perform public.cancel_draft_tournament(v_cancel_tournament_id, v_event_revision);
  select event.phase = 'cancelled'
    and tournament.status = 'archived'
    and event.draft_league_id is null
    and not exists (select 1 from public.leagues where id = v_cancel_league_id)
    and exists (
      select 1 from public.tournament_audit_events audit
      where audit.tournament_id = tournament.id
        and audit.kind = 'draft_tournament_cancelled'
    )
  into v_cancellation_ok
  from public.draft_tournament_events event
  join public.tournaments tournament on tournament.id = event.tournament_id
  where event.tournament_id = v_cancel_tournament_id;
  if v_cancellation_ok is distinct from true then
    raise exception 'Pre-roster-lock cancellation did not remove the hidden draft room.';
  end if;

  delete from public.tournaments
  where id in (v_tournament_id, v_cancel_tournament_id);
  delete from public.pokemon_catalogue
  where id in (
    select format('dc-draft-tournament-preview-%s', seed_number)
    from generate_series(1, 20) seed_number
  );
  delete from auth.users
  where id = any(array[v_owner] || v_players);
  select
    not exists (
      select 1 from public.tournaments
      where id in (v_tournament_id, v_cancel_tournament_id)
    )
    and not exists (
      select 1 from public.draft_tournament_events
      where tournament_id in (v_tournament_id, v_cancel_tournament_id)
    )
    and not exists (
      select 1 from public.leagues
      where id in (v_league_id, v_cancel_league_id)
    )
    and not exists (
      select 1 from auth.users
      where id = any(array[v_owner] || v_players)
    )
    and not exists (
      select 1 from public.pokemon_catalogue
      where id in (
        select format('dc-draft-tournament-preview-%s', seed_number)
        from generate_series(1, 20) seed_number
      )
    )
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Synthetic Draft Tournament fixtures were not fully removed.';
  end if;

  insert into dc_draft_tournament_results(result)
  values (jsonb_build_object(
    'grants', v_grants_ok,
    'rls', v_rls_ok,
    'field_lock', v_field_ok,
    'exact_identity', v_identity_ok,
    'shared_draft', v_draft_ok,
    'roster_lock', v_roster_lock_ok,
    'correction_rollback', v_correction_ok,
    'swiss', v_swiss_ok,
    'top_cut', v_top_cut_ok,
    'public_projection', v_projection_ok,
    'cancellation', v_cancellation_ok,
    'cleanup', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_draft_tournament_results;
