-- Preview-only transactional matrix for migration 385.
-- Run only in an isolated Supabase branch after migrations through 385 exist.
-- The transaction always rolls back; any failed assertion aborts the run.

begin;

create temp table dc_draft_first_results (
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

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_double_players uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_single_players uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_player uuid;
  v_payload jsonb;
  v_projection jsonb;
  v_double_tournament_id uuid;
  v_double_event_id uuid;
  v_single_tournament_id uuid;
  v_single_event_id uuid;
  v_swiss_tournament_id uuid;
  v_swiss_event_id uuid;
  v_double_match_count integer;
  v_single_match_count integer;
  v_grants_ok boolean;
  v_rls_ok boolean;
  v_double_ok boolean;
  v_single_ok boolean;
  v_swiss_ok boolean;
  v_completion_ok boolean;
  v_cleanup_ok boolean;
begin
  if array_length(v_double_players, 1) <> 8 then
    raise exception 'The double-elimination fixture must contain eight managers.';
  end if;

  select
    has_function_privilege(
      'authenticated',
      'public.create_draft_first_tournament(text,text,text,integer,integer,text,integer,integer,boolean,integer,boolean,text)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.create_draft_first_tournament(text,text,text,integer,integer,text,integer,integer,boolean,integer,boolean,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.build_draft_first_elimination_bracket(uuid,uuid)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.build_draft_first_elimination_bracket(uuid,uuid)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.lock_draft_tournament_rosters(uuid,bigint)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.enforce_draft_first_competition_settings()',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.enrich_draft_first_audit_payload()',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.sync_draft_first_tournament_completion()',
      'execute'
    )
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Draft-first grants do not match the RPC-only browser boundary.';
  end if;
  insert into dc_draft_first_results values (jsonb_build_object('check', 'grants', 'ok', true));

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
  insert into dc_draft_first_results values (jsonb_build_object('check', 'rls', 'ok', true));

  insert into auth.users(id, aud, role)
  select identity, 'authenticated', 'authenticated'
  from unnest(array[v_owner] || v_double_players || v_single_players) identity;
  insert into public.profiles(id, display_name)
  select identity, 'Draft-first synthetic identity'
  from unnest(array[v_owner] || v_double_players || v_single_players) identity
  on conflict (id) do update set display_name = excluded.display_name;

  perform pg_temp.dc_auth(v_owner);
  select public.create_draft_first_tournament(
    'Eight Manager Draft Double Elimination',
    '',
    'public',
    3,
    8,
    'Synthetic draft-first bracket matrix',
    6,
    5,
    false,
    null,
    true,
    'double-elimination'
  ) into v_payload;
  v_double_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_double_event_id := (v_payload ->> 'event_id')::uuid;

  foreach v_player in array v_double_players loop
    perform pg_temp.dc_auth(v_player);
    perform public.join_tournament(
      v_double_tournament_id,
      'Draft-first double manager ' || array_position(v_double_players, v_player),
      null,
      null
    );
  end loop;

  perform pg_temp.dc_auth(v_owner);
  update public.tournaments
  set status = 'active'
  where id = v_double_tournament_id;
  update public.draft_tournament_events
  set phase = 'roster-review'
  where id = v_double_event_id;
  perform public.build_draft_first_elimination_bracket(v_double_event_id, v_owner);

  select count(*) into v_double_match_count
  from public.tournament_matches
  where tournament_id = v_double_tournament_id;
  if v_double_match_count <> 15 then
    raise exception 'An eight-manager double-elimination bracket must reserve 15 matches.';
  end if;
  select
    tournament.format = 'draft-tournament'
    and tournament.status = 'active'
    and event.competition_format = 'double-elimination'
    and event.swiss_round_count is null
    and event.current_swiss_round = 0
    and event.top_cut_size = 0
    and (select count(*) from public.tournament_matches bracket_match
         where bracket_match.tournament_id = tournament.id and bracket_match.bracket_stage = 'winners') = 7
    and (select count(*) from public.tournament_matches bracket_match
         where bracket_match.tournament_id = tournament.id and bracket_match.bracket_stage = 'losers') = 6
    and (select count(*) from public.tournament_matches bracket_match
         where bracket_match.tournament_id = tournament.id and bracket_match.bracket_stage = 'grand-final') = 2
  into v_double_ok
  from public.tournaments tournament
  join public.draft_tournament_events event on event.tournament_id = tournament.id
  where tournament.id = v_double_tournament_id;
  if v_double_ok is distinct from true then
    raise exception 'The draft-first double-elimination graph or event settings are invalid.';
  end if;
  select public.list_tournaments() into v_projection;
  if not exists (
    select 1 from jsonb_array_elements(v_projection) listed
    where listed ->> 'id' = v_double_tournament_id::text
      and listed ->> 'competition_format' = 'double-elimination'
  ) then
    raise exception 'The tournament directory did not expose the selected competition format.';
  end if;
  insert into dc_draft_first_results values (jsonb_build_object('check', 'double_elimination_graph', 'ok', true));

  perform pg_temp.dc_auth(v_owner);
  select public.create_draft_first_tournament(
    'Four Manager Draft Single Elimination',
    '',
    'public',
    1,
    4,
    'Synthetic draft-first single bracket matrix',
    4,
    0,
    false,
    null,
    false,
    'single-elimination'
  ) into v_payload;
  v_single_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_single_event_id := (v_payload ->> 'event_id')::uuid;
  foreach v_player in array v_single_players loop
    perform pg_temp.dc_auth(v_player);
    perform public.join_tournament(
      v_single_tournament_id,
      'Draft-first single manager ' || array_position(v_single_players, v_player),
      null,
      null
    );
  end loop;
  perform pg_temp.dc_auth(v_owner);
  update public.tournaments set status = 'active' where id = v_single_tournament_id;
  update public.draft_tournament_events set phase = 'roster-review' where id = v_single_event_id;
  perform public.build_draft_first_elimination_bracket(v_single_event_id, v_owner);
  select count(*) into v_single_match_count
  from public.tournament_matches
  where tournament_id = v_single_tournament_id and bracket_stage = 'single';
  select v_single_match_count = 3
    and not exists (
      select 1 from public.tournament_matches
      where tournament_id = v_single_tournament_id and bracket_stage <> 'single'
    )
  into v_single_ok;
  if v_single_ok is distinct from true then
    raise exception 'The four-manager draft-first single-elimination graph is invalid.';
  end if;
  insert into dc_draft_first_results values (jsonb_build_object('check', 'single_elimination_graph', 'ok', true));

  perform pg_temp.dc_auth(v_owner);
  select public.create_draft_first_tournament(
    'Eight Manager Draft Swiss',
    '',
    'public',
    3,
    8,
    'Synthetic draft-first Swiss creation matrix',
    6,
    5,
    false,
    null,
    false,
    'swiss'
  ) into v_payload;
  v_swiss_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_swiss_event_id := (v_payload ->> 'event_id')::uuid;
  select
    tournament.format = 'draft-tournament'
    and event.competition_format = 'swiss'
    and event.phase = 'registration'
    and event.swiss_round_count is null
    and event.current_swiss_round = 0
    and event.top_cut_size = 0
  into v_swiss_ok
  from public.tournaments tournament
  join public.draft_tournament_events event on event.tournament_id = tournament.id
  where tournament.id = v_swiss_tournament_id and event.id = v_swiss_event_id;
  if v_swiss_ok is distinct from true then
    raise exception 'The draft-first Swiss event settings are invalid.';
  end if;
  insert into dc_draft_first_results values (jsonb_build_object('check', 'swiss_creation', 'ok', true));

  update public.draft_tournament_events set phase = 'bracket' where id = v_double_event_id;
  update public.tournaments set status = 'complete' where id = v_double_tournament_id;
  select event.phase = 'complete' and event.completed_at is not null
  into v_completion_ok
  from public.draft_tournament_events event
  where event.id = v_double_event_id;
  if v_completion_ok is distinct from true then
    raise exception 'Draft-first completion did not propagate to the event.';
  end if;
  insert into dc_draft_first_results values (jsonb_build_object('check', 'completion', 'ok', true));

  delete from public.tournaments
  where id in (v_double_tournament_id, v_single_tournament_id, v_swiss_tournament_id);
  delete from public.profiles
  where id = any(array[v_owner] || v_double_players || v_single_players);
  delete from auth.users
  where id = any(array[v_owner] || v_double_players || v_single_players);
  select
    not exists (select 1 from public.tournaments where id in (v_double_tournament_id, v_single_tournament_id, v_swiss_tournament_id))
    and not exists (select 1 from auth.users where id = any(array[v_owner] || v_double_players || v_single_players))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Synthetic draft-first fixtures were not fully removed.';
  end if;
  insert into dc_draft_first_results values (jsonb_build_object('check', 'cleanup', 'ok', true));
end;
$validation$;

select result from dc_draft_first_results order by result ->> 'check';

rollback;
