-- Preview-only regression for 4-32 entrant snake Draft Tournaments.
-- Run only in an isolated Supabase Preview branch. Every identity, tournament,
-- entrant, draft room, and audit event is contained in this rolled-back
-- transaction.

begin;

create temp table dc_snake_32_results (
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
  v_payload jsonb;
  v_tournament_id uuid;
  v_event_id uuid;
  v_league_id uuid;
  v_event_revision bigint;
  v_tournament_revision bigint;
  v_rejected boolean := false;
  v_field_ok boolean;
begin
  if position(
       'p_entrant_limit not between 4 and 32' in pg_get_functiondef(
         'public.create_draft_tournament(text,text,text,integer,integer,text,integer,integer,integer,boolean,integer,boolean)'::regprocedure
       )
     ) = 0
     or position(
       'v_count not between 4 and 32 or v_count > v_tournament.entrant_limit' in pg_get_functiondef(
         'public.lock_draft_tournament_field(uuid,bigint)'::regprocedure
       )
     ) = 0
     or position(
       '''leagueScaleMode'', ''expanded''' in pg_get_functiondef(
         'public.lock_draft_tournament_field(uuid,bigint)'::regprocedure
       )
     ) = 0
     or position(
       'case when v_count <= 8 then 3 when v_count <= 16 then 4 else 5 end' in pg_get_functiondef(
         'public.lock_draft_tournament_field(uuid,bigint)'::regprocedure
       )
     ) = 0
     or position(
       'v_maximum := 32;' in pg_get_functiondef(
         'public.build_draft_first_elimination_bracket(uuid,uuid)'::regprocedure
       )
     ) = 0 then
    raise exception 'The 32-seat snake function definitions are incomplete.';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.create_draft_tournament(text,text,text,integer,integer,text,integer,integer,integer,boolean,integer,boolean)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.lock_draft_tournament_field(uuid,bigint)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.lock_draft_tournament_field(uuid,bigint)',
       'execute'
     ) then
    raise exception 'The snake Draft Tournament RPC grants changed unexpectedly.';
  end if;
  insert into dc_snake_32_results values
    (jsonb_build_object('check', 'function_definitions', 'ok', true));

  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values (v_owner, 'Snake 32 Operator')
  on conflict (id) do update set display_name = excluded.display_name;
  perform pg_temp.dc_auth(v_owner);

  begin
    perform public.create_draft_first_tournament(
      p_regulation_id => 'reg-mb',
      p_registration_closes_at => null,
      p_check_in_opens_at => null,
      p_starts_at => null,
      p_name => 'Rejected 33 Seat Snake',
      p_description => '',
      p_visibility => 'private',
      p_best_of => 3,
      p_entrant_limit => 33,
      p_rules => 'Preview-only capacity rejection',
      p_roster_size => 4,
      p_pick_time_limit_minutes => 0,
      p_snake_budget_enabled => false,
      p_draft_budget => null,
      p_publish_rosters => false,
      p_competition_format => 'swiss'
    );
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected
     or exists (
       select 1 from public.tournaments tournament
       where tournament.name = 'Rejected 33 Seat Snake'
     ) then
    raise exception 'A snake Draft Tournament accepted a 33-seat capacity.';
  end if;
  insert into dc_snake_32_results values
    (jsonb_build_object('check', 'capacity_guard', 'ok', true));

  v_payload := public.create_draft_first_tournament(
    p_regulation_id => 'reg-mb',
    p_registration_closes_at => null,
    p_check_in_opens_at => null,
    p_starts_at => null,
    p_name => 'Snake 32 Preview Matrix',
    p_description => '',
    p_visibility => 'private',
    p_best_of => 3,
    p_entrant_limit => 32,
    p_rules => 'Preview-only 32-seat snake field',
    p_roster_size => 4,
    p_pick_time_limit_minutes => 0,
    p_snake_budget_enabled => false,
    p_draft_budget => null,
    p_publish_rosters => false,
    p_competition_format => 'swiss'
  );
  v_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_event_id := (v_payload ->> 'event_id')::uuid;

  perform public.join_tournament(v_tournament_id, 'Snake 32 Operator', null, null);
  select revision into v_tournament_revision
  from public.tournaments where id = v_tournament_id;
  perform public.add_tournament_practice_entrants(
    v_tournament_id, v_tournament_revision, 31, 'Snake Practice Player'
  );

  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.open_draft_tournament_check_in(v_tournament_id, v_event_revision);
  perform public.set_draft_tournament_check_in(v_tournament_id, true);
  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.lock_draft_tournament_field(v_tournament_id, v_event_revision);
  select draft_league_id into v_league_id
  from public.draft_tournament_events where id = v_event_id;

  select
    tournament.entrant_limit = 32
    and tournament.status = 'active'
    and tournament.is_practice
    and event.draft_type = 'snake'
    and event.phase = 'draft-setup'
    and event.swiss_round_count = 5
    and count(distinct entrant.id) = 32
    and count(distinct seat.id) = 32
    and count(distinct seat.id) filter (where seat.status = 'active') = 32
    and jsonb_array_length(snapshot.state -> 'teams') = 32
    and jsonb_array_length(snapshot.state -> 'rosters') = 32
    and jsonb_array_length(snapshot.state #> '{settings,manualDraftOrder}') = 32
    and snapshot.state #>> '{settings,leagueSize}' = '32'
    and snapshot.state #>> '{settings,leagueScaleMode}' = 'expanded'
    and snapshot.state #>> '{settings,draftType}' = 'snake'
    and league.workspace_kind = 'draft-tournament'
    and not league.is_public
  into v_field_ok
  from public.tournaments tournament
  join public.draft_tournament_events event on event.tournament_id = tournament.id
  join public.draft_tournament_seats seat on seat.event_id = event.id
  join public.tournament_entrants entrant on entrant.id = seat.entrant_id
  join public.leagues league on league.id = event.draft_league_id
  join public.league_state_snapshots snapshot on snapshot.league_id = league.id
  where tournament.id = v_tournament_id and event.id = v_event_id
  group by tournament.entrant_limit, tournament.status, tournament.is_practice,
    event.draft_type, event.phase, event.swiss_round_count,
    snapshot.state, league.workspace_kind, league.is_public;
  if v_field_ok is distinct from true then
    raise exception 'The 32-seat snake field did not provision the expanded draft room safely.';
  end if;
  insert into dc_snake_32_results values (
    jsonb_build_object(
      'check', 'snake_field_32', 'ok', true,
      'entrants', 32, 'teams', 32, 'swiss_rounds', 5
    )
  );

  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.cancel_draft_tournament(v_tournament_id, v_event_revision);
  if exists (select 1 from public.leagues where id = v_league_id)
     or not exists (
       select 1 from public.draft_tournament_events event
       where event.id = v_event_id
         and event.phase = 'cancelled'
         and event.draft_league_id is null
     ) then
    raise exception 'Cancelling the 32-seat snake fixture did not remove its private draft room.';
  end if;
  insert into dc_snake_32_results values
    (jsonb_build_object('check', 'cleanup', 'ok', true));
end;
$validation$;

select result from dc_snake_32_results order by result ->> 'check';

rollback;
