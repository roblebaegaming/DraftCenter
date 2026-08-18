-- Preview-only lifecycle matrix for migration 439.
-- Run only in an isolated Supabase Preview branch. The transaction rolls back
-- every synthetic identity, catalogue row, tournament, room, roster, pairing,
-- standing, and result.

begin;

create temp table dc_tournament_demo_results (
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
  v_other uuid := gen_random_uuid();
  v_extra_a uuid := gen_random_uuid();
  v_extra_b uuid := gen_random_uuid();
  v_payload jsonb;
  v_tournament_id uuid;
  v_event_id uuid;
  v_league_id uuid;
  v_revision bigint;
  v_standard_id uuid;
  v_standard_event_id uuid;
  v_standard_rejected boolean := false;
  v_unauthorized boolean := false;
begin
  if not has_function_privilege(
       'authenticated',
       'public.create_demo_auction_draft_first_tournament(text,text,text,integer,integer,text,integer,integer,integer,integer,integer,boolean,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated', 'public.enable_tournament_demo(uuid,bigint)', 'execute'
     )
     or not has_function_privilege(
       'authenticated', 'public.fill_tournament_demo_auction(uuid,bigint)', 'execute'
     )
     or not has_function_privilege(
       'authenticated', 'public.complete_tournament_demo_swiss(uuid,bigint)', 'execute'
     )
     or not has_function_privilege(
       'authenticated', 'public.reset_tournament_demo(uuid,bigint)', 'execute'
     )
     or has_function_privilege(
       'anon', 'public.enable_tournament_demo(uuid,bigint)', 'execute'
     )
     or has_function_privilege(
       'authenticated', 'public.materialize_auction_draft_tournament_rosters(uuid)', 'execute'
     )
     or has_function_privilege(
       'authenticated', 'public.guard_demo_auction_team_identity()', 'execute'
     ) then
    raise exception 'Organizer demo grants do not match the RPC-only browser boundary.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'grants', 'ok', true));

  if (select count(*) = 8 and bool_and(relrowsecurity)
      from pg_class
      where oid in (
        'public.tournaments'::regclass,
        'public.tournament_entrants'::regclass,
        'public.draft_tournament_events'::regclass,
        'public.draft_tournament_seats'::regclass,
        'public.draft_tournament_rounds'::regclass,
        'public.draft_tournament_pairings'::regclass,
        'public.draft_tournament_standing_snapshots'::regclass,
        'public.draft_tournament_top_cut_entries'::regclass
      )) is distinct from true then
    raise exception 'Every organizer demo table must keep RLS enabled.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'rls', 'ok', true));

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated'),
    (v_extra_a, 'authenticated', 'authenticated'),
    (v_extra_b, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values
    (v_owner, 'Demo Commissioner'),
    (v_other, 'Unauthorized Viewer'),
    (v_extra_a, 'Standard Manager A'),
    (v_extra_b, 'Standard Manager B')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.pokemon_catalogue(
    id, display_name, primary_type, base_stat_total, is_mega, is_restricted
  )
  select
    'dc-demo-439-' || pokemon_number,
    'Demo Pokemon ' || pokemon_number,
    'normal',
    300 + pokemon_number,
    false,
    false
  from generate_series(1, 128) pokemon_number
  on conflict (id) do nothing;

  perform pg_temp.dc_auth(v_owner);
  select public.create_demo_auction_draft_first_tournament(
    'Private 32 Manager Organizer Demo',
    'Synthetic migration 439 lifecycle',
    'private',
    3,
    32,
    'Preview-only organizer sandbox',
    4,
    120,
    30,
    30,
    10,
    false,
    'swiss'
  ) into v_payload;
  v_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_event_id := (v_payload ->> 'event_id')::uuid;

  if not exists (
    select 1 from public.tournaments tournament
    where tournament.id = v_tournament_id
      and tournament.visibility = 'private'
      and tournament.is_demo
      and tournament.status = 'registration'
  )
     or not exists (
       select 1 from public.draft_tournament_events event
       where event.id = v_event_id
         and event.phase = 'check-in'
         and event.draft_type = 'auction'
         and event.competition_format = 'swiss'
     )
     or (select count(*) from public.tournament_entrants entrant
         where entrant.tournament_id = v_tournament_id) <> 32
     or (select count(*) from public.tournament_entrants entrant
         where entrant.tournament_id = v_tournament_id
           and entrant.is_demo_bot
           and entrant.user_id is null
           and entrant.checked_in_at is not null) <> 31
     or (select count(*) from public.tournament_entrants entrant
         where entrant.tournament_id = v_tournament_id
           and entrant.user_id = v_owner
           and not entrant.is_demo_bot
           and entrant.checked_in_at is not null) <> 1 then
    raise exception 'The organizer demo did not create one real owner and 31 labeled bot entrants.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'private_demo_field', 'ok', true, 'entrants', 32, 'bots', 31));

  perform pg_temp.dc_auth(v_other);
  begin
    perform public.enable_tournament_demo(v_tournament_id, 1);
  exception when others then
    if sqlerrm not ilike '%only an untouched private auction Swiss event%' then raise; end if;
    v_unauthorized := true;
  end;
  if not v_unauthorized then raise exception 'A non-owner could mutate the organizer demo.'; end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'authorization', 'ok', true));

  perform pg_temp.dc_auth(v_owner);
  select public.create_auction_draft_first_tournament(
    'Standard Null Seat Rejection', '', 'private', 3, 4, '', 4,
    120, 30, 30, 10, false, 'swiss'
  ) into v_payload;
  v_standard_id := (v_payload ->> 'tournament_id')::uuid;
  v_standard_event_id := (v_payload ->> 'event_id')::uuid;
  insert into public.tournament_entrants(
    tournament_id, user_id, display_name, status, checked_in_at
  ) values
    (v_standard_id, v_owner, 'Standard Owner', 'registered', now()),
    (v_standard_id, v_extra_a, 'Standard A', 'registered', now()),
    (v_standard_id, v_extra_b, 'Standard B', 'registered', now()),
    (v_standard_id, null, 'Unattached Entrant', 'registered', now());
  update public.draft_tournament_events
  set phase = 'check-in'
  where id = v_standard_event_id;
  begin
    perform public.lock_auction_draft_tournament_field(v_standard_id, 0);
  exception when others then
    if sqlerrm not ilike '%attached to an account%' then raise; end if;
    v_standard_rejected := true;
  end;
  if not v_standard_rejected then
    raise exception 'A normal auction tournament accepted an unattached entrant.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'non_demo_boundary', 'ok', true));

  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.lock_auction_draft_tournament_field(v_tournament_id, v_revision);
  select draft_league_id, revision into v_league_id, v_revision
  from public.draft_tournament_events where id = v_event_id;
  if (select count(*) from public.draft_tournament_seats seat
      where seat.event_id = v_event_id and seat.status = 'active') <> 32
     or (select count(*) from public.draft_tournament_seats seat
         where seat.event_id = v_event_id and seat.user_id is null) <> 31
     or (select count(*) from public.auction_team_owners owner_row
         where owner_row.league_id = v_league_id) <> 1
     or (select count(*) from public.league_memberships membership
         where membership.league_id = v_league_id) <> 1
     or coalesce((select (state #>> '{settings,demoMode}')::boolean
                  from public.league_state_snapshots
                  where league_id = v_league_id), false) is distinct from true then
    raise exception 'The locked organizer demo did not preserve one real owner and 31 unclaimed bot teams.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'bot_seat_lock', 'ok', true, 'seats', 32, 'real_owners', 1));

  perform pg_temp.dc_auth(v_other);
  v_unauthorized := false;
  begin
    perform public.fill_tournament_demo_auction(v_tournament_id, v_revision);
  exception when others then
    if sqlerrm not ilike '%only the owner%' then raise; end if;
    v_unauthorized := true;
  end;
  if not v_unauthorized then raise exception 'A non-owner generated the demo auction.'; end if;

  perform pg_temp.dc_auth(v_owner);
  perform public.fill_tournament_demo_auction(v_tournament_id, v_revision);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  if not exists (
    select 1 from public.draft_tournament_events event
    where event.id = v_event_id and event.phase = 'roster-review'
  )
     or (select count(*)
         from jsonb_array_elements(
           (select state -> 'rosters' from public.league_state_snapshots where league_id = v_league_id)
         ) roster(value)
         where jsonb_array_length(roster.value) = 4) <> 32 then
    raise exception 'The synthetic auction did not generate 32 complete unique rosters.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'generated_auction', 'ok', true, 'rosters', 32, 'pokemon', 128));

  perform public.lock_draft_tournament_rosters(v_tournament_id, v_revision);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  if not exists (
    select 1 from public.draft_tournament_events event
    where event.id = v_event_id
      and event.phase = 'swiss'
      and event.swiss_round_count = 5
      and event.current_swiss_round = 1
      and event.roster_locked_at is not null
  )
     or (select count(*) from public.teams team where team.league_id = v_league_id) <> 32
     or (select count(*) from public.teams team
         where team.league_id = v_league_id and team.owner_membership_id is null) <> 31
     or (select count(*) from public.roster_entries entry
         join public.teams team on team.id = entry.team_id
         where team.league_id = v_league_id and entry.released_at is null) <> 128
     or (select count(*) from public.draft_tournament_pairings pairing
         where pairing.event_id = v_event_id) <> 16
     or (select count(*) from public.draft_tournament_standing_snapshots standing
         where standing.event_id = v_event_id) <> 32 then
    raise exception 'The 32-seat demo did not materialize rosters and pair Swiss Round 1.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'roster_lock', 'ok', true, 'teams', 32, 'entries', 128, 'round_one_pairings', 16));

  perform pg_temp.dc_auth(v_other);
  v_unauthorized := false;
  begin
    perform public.complete_tournament_demo_swiss(v_tournament_id, v_revision);
  exception when others then
    if sqlerrm not ilike '%only the owner%' then raise; end if;
    v_unauthorized := true;
  end;
  if not v_unauthorized then raise exception 'A non-owner generated demo Swiss results.'; end if;

  perform pg_temp.dc_auth(v_owner);
  perform public.complete_tournament_demo_swiss(v_tournament_id, v_revision);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  if not exists (
    select 1 from public.draft_tournament_events event
    join public.tournaments tournament on tournament.id = event.tournament_id
    where event.id = v_event_id
      and event.phase = 'complete'
      and event.current_swiss_round = 5
      and event.completed_at is not null
      and tournament.status = 'complete'
      and tournament.is_demo
  )
     or (select count(*) from public.draft_tournament_rounds round_row
         where round_row.event_id = v_event_id and round_row.status = 'complete') <> 5
     or (select count(*) from public.tournament_matches bracket_match
         where bracket_match.tournament_id = v_tournament_id
           and bracket_match.bracket_stage = 'swiss'
           and bracket_match.status = 'complete') <> 80
     or (select count(*) from public.draft_tournament_standing_snapshots standing
         where standing.event_id = v_event_id) <> 160
     or (public.get_draft_tournament_workspace(v_tournament_id) #>> '{event,is_demo}') <> 'true'
     or (select count(*)
         from jsonb_array_elements(public.get_draft_tournament_workspace(v_tournament_id) -> 'seats') seat(value)
         where (seat.value ->> 'is_bot')::boolean) <> 31 then
    raise exception 'The demo Swiss generator did not complete five rounds, 80 matches, and final standings.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'swiss_completion', 'ok', true, 'rounds', 5, 'matches', 80, 'standings', 160));

  perform pg_temp.dc_auth(v_other);
  v_unauthorized := false;
  begin
    perform public.reset_tournament_demo(v_tournament_id, v_revision);
  exception when others then
    if sqlerrm not ilike '%only the owner%' then raise; end if;
    v_unauthorized := true;
  end;
  if not v_unauthorized then raise exception 'A non-owner reset the organizer demo.'; end if;

  perform pg_temp.dc_auth(v_owner);
  perform public.reset_tournament_demo(v_tournament_id, v_revision);
  if not exists (
    select 1 from public.draft_tournament_events event
    join public.tournaments tournament on tournament.id = event.tournament_id
    where event.id = v_event_id
      and event.phase = 'check-in'
      and event.draft_league_id is null
      and event.current_swiss_round = 0
      and event.field_locked_at is null
      and tournament.status = 'registration'
      and tournament.is_demo
  )
     or (select count(*) from public.tournament_entrants entrant
         where entrant.tournament_id = v_tournament_id
           and entrant.status = 'registered'
           and entrant.checked_in_at is not null) <> 32
     or exists (select 1 from public.draft_tournament_seats seat where seat.event_id = v_event_id)
     or exists (select 1 from public.tournament_matches bracket_match where bracket_match.tournament_id = v_tournament_id)
     or exists (select 1 from public.leagues league where league.id = v_league_id) then
    raise exception 'Reset did not return the private 32-seat demo to clean check-in.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'reset', 'ok', true, 'entrants', 32, 'phase', 'check-in'));

  delete from public.tournaments where id in (v_tournament_id, v_standard_id);
  delete from public.profiles where id in (v_owner, v_other, v_extra_a, v_extra_b);
  delete from auth.users where id in (v_owner, v_other, v_extra_a, v_extra_b);
  if exists (select 1 from public.tournaments where id in (v_tournament_id, v_standard_id))
     or exists (select 1 from auth.users where id in (v_owner, v_other, v_extra_a, v_extra_b)) then
    raise exception 'Synthetic organizer demo fixtures were not fully removed.';
  end if;
  insert into dc_tournament_demo_results values
    (jsonb_build_object('check', 'cleanup', 'ok', true));
end;
$validation$;

select result from dc_tournament_demo_results order by result ->> 'check';

rollback;
