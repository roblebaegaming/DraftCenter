-- Preview-only transactional matrix for migration 355.
-- Run only in a new isolated Supabase branch after migrations 340 and 350-355
-- exist. Every synthetic row is removed before commit; a failed assertion
-- aborts the transaction.

begin;

create temp table dc_double_elimination_results (
  result jsonb not null
) on commit preserve rows;

create function pg_temp.dc_forfeit(p_match_id uuid, p_loser_id uuid)
returns void
language plpgsql
as $$
declare
  v_tournament_revision bigint;
  v_match_revision bigint;
begin
  select tournament.revision, bracket_match.revision
  into v_tournament_revision, v_match_revision
  from public.tournament_matches bracket_match
  join public.tournaments tournament on tournament.id = bracket_match.tournament_id
  where bracket_match.id = p_match_id;
  perform public.forfeit_tournament_match(
    p_match_id,
    v_tournament_revision,
    v_match_revision,
    p_loser_id,
    'Synthetic double-elimination matrix'
  );
end;
$$;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_players uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_bye_players uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid()
  ];
  v_tournament_reset uuid;
  v_tournament_no_reset uuid;
  v_tournament_drop uuid;
  v_tournament_byes uuid;
  v_payload jsonb;
  v_match public.tournament_matches%rowtype;
  v_revision bigint;
  v_structure_ok boolean;
  v_routes_ok boolean;
  v_reset_ok boolean;
  v_no_reset_ok boolean;
  v_drop_ok boolean;
  v_bye_ok boolean;
  v_projection_ok boolean;
  v_grants_ok boolean;
  v_single_compatibility_ok boolean;
  v_cleanup_ok boolean;
begin
  select
    has_function_privilege(
      'authenticated',
      'public.create_tournament(text,text,text,integer,integer,text,text)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.lock_double_elimination_tournament(uuid)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.lock_double_elimination_tournament(uuid)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.advance_tournament_match_graph(uuid,uuid,uuid,uuid)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.advance_tournament_match_graph(uuid,uuid,uuid,uuid)',
      'execute'
    )
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Double-elimination grants do not match the browser boundary.';
  end if;

  select prosrc like '%bracket_stage, bracket_round%'
    and prosrc like '%entrant_a_source_resolved = true%'
    and prosrc like '%format <> ''single-elimination''%'
  into v_single_compatibility_ok
  from pg_proc
  where oid = 'public.lock_single_elimination_tournament(uuid)'::regprocedure;
  if v_single_compatibility_ok is distinct from true then
    raise exception 'Single-elimination locking was not upgraded for the graph columns.';
  end if;

  insert into auth.users(id, aud, role)
  select identity, 'authenticated', 'authenticated'
  from unnest(array[v_owner] || v_players || v_bye_players) identity;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_tournament(
    'Double Preview Reset', '', 'public', 1, 4, 'Synthetic reset matrix', 'double-elimination'
  ) into v_payload;
  select id into v_tournament_reset
  from public.tournaments where slug = v_payload ->> 'slug';
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  values
    (v_tournament_reset, v_players[1], 'Reset Seed One', 1),
    (v_tournament_reset, v_players[2], 'Reset Seed Two', 2),
    (v_tournament_reset, v_players[3], 'Reset Seed Three', 3),
    (v_tournament_reset, v_players[4], 'Reset Seed Four', 4);
  perform public.lock_double_elimination_tournament(v_tournament_reset);

  select count(*) = 7
    and count(*) filter (where bracket_stage = 'winners') = 3
    and count(*) filter (where bracket_stage = 'losers') = 2
    and count(*) filter (where bracket_stage = 'grand-final') = 2
    and count(*) filter (where status = 'ready') = 2
  into v_structure_ok
  from public.tournament_matches
  where tournament_id = v_tournament_reset;
  if v_structure_ok is distinct from true then
    raise exception 'The four-entrant graph did not create seven bounded matches.';
  end if;

  select
    count(*) filter (
      where bracket_stage = 'winners'
        and winner_to_match_id is not null
        and loser_to_match_id is not null
    ) = 3
    and count(*) filter (
      where bracket_stage = 'losers'
        and winner_to_match_id is not null
        and loser_to_match_id is null
    ) = 2
    and count(*) filter (
      where bracket_stage = 'grand-final'
        and bracket_round = 1
        and winner_to_match_id = loser_to_match_id
        and winner_to_slot = 'a'
        and loser_to_slot = 'b'
    ) = 1
  into v_routes_ok
  from public.tournament_matches
  where tournament_id = v_tournament_reset;
  if v_routes_ok is distinct from true then
    raise exception 'Winner, loser, or reset routes are incomplete.';
  end if;

  select public.create_tournament(
    'Double Preview Byes', '', 'private', 1, 5, 'Synthetic bye matrix', 'double-elimination'
  ) into v_payload;
  select id into v_tournament_byes
  from public.tournaments where slug = v_payload ->> 'slug';
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  select v_tournament_byes, v_bye_players[seed_number],
    format('Bye Seed %s', seed_number), seed_number
  from generate_series(1, 5) seed_number;
  perform public.lock_double_elimination_tournament(v_tournament_byes);

  select count(*) = 15
    and count(*) filter (where status = 'ready') = 2
    and count(*) filter (where status = 'bye') = 4
    and count(*) filter (
      where bracket_stage = 'winners'
        and bracket_round = 1
        and status in ('ready', 'bye')
    ) = 4
    and count(*) filter (
      where status = 'pending'
        and ((entrant_a_id is null) <> (entrant_b_id is null))
    ) = 1
  into v_bye_ok
  from public.tournament_matches
  where tournament_id = v_tournament_byes;
  if v_bye_ok is distinct from true then
    raise exception 'The five-entrant graph did not resolve its bounded byes.';
  end if;

  -- Resolve both opening winners matches, then the winners final, losers
  -- rounds, Grand Final 1, and the required reset.
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_reset and bracket_stage = 'winners'
    and bracket_round = 1 and match_number = 1;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_reset and bracket_stage = 'winners'
    and bracket_round = 1 and match_number = 2;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_reset and bracket_stage = 'winners'
    and bracket_round = 2;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_reset and bracket_stage = 'losers'
    and bracket_round = 1;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_reset and bracket_stage = 'losers'
    and bracket_round = 2;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_reset and bracket_stage = 'grand-final'
    and bracket_round = 1;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_a_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_reset and bracket_stage = 'grand-final'
    and bracket_round = 2;
  if v_match.status <> 'ready' then
    raise exception 'A losers-bracket Grand Final win did not activate the reset.';
  end if;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select tournament.status = 'complete'
    and reset_match.status = 'complete'
    and reset_match.winner_id is not null
  into v_reset_ok
  from public.tournaments tournament
  join public.tournament_matches reset_match
    on reset_match.tournament_id = tournament.id
   and reset_match.bracket_stage = 'grand-final'
   and reset_match.bracket_round = 2
  where tournament.id = v_tournament_reset;
  if v_reset_ok is distinct from true then
    raise exception 'The required bracket reset did not complete the tournament.';
  end if;

  -- Repeat the four-entrant path and let the winners-bracket champion win
  -- Grand Final 1. The reset stays visible as an immutable no-reset marker.
  select public.create_tournament(
    'Double Preview No Reset', '', 'public', 1, 4, 'Synthetic no-reset matrix', 'double-elimination'
  ) into v_payload;
  select id into v_tournament_no_reset
  from public.tournaments where slug = v_payload ->> 'slug';
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  values
    (v_tournament_no_reset, v_players[1], 'No Reset Seed One', 1),
    (v_tournament_no_reset, v_players[2], 'No Reset Seed Two', 2),
    (v_tournament_no_reset, v_players[3], 'No Reset Seed Three', 3),
    (v_tournament_no_reset, v_players[4], 'No Reset Seed Four', 4);
  perform public.lock_double_elimination_tournament(v_tournament_no_reset);
  for v_match in
    select * from public.tournament_matches
    where tournament_id = v_tournament_no_reset
      and bracket_stage = 'winners' and bracket_round = 1
    order by match_number
  loop
    perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  end loop;
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_no_reset and bracket_stage = 'winners' and bracket_round = 2;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_no_reset and bracket_stage = 'losers' and bracket_round = 1;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_no_reset and bracket_stage = 'losers' and bracket_round = 2;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_no_reset and bracket_stage = 'grand-final' and bracket_round = 1;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select tournament.status = 'complete'
    and reset_match.status = 'bye'
    and reset_match.winner_id = final_match.winner_id
    and exists (
      select 1 from public.tournament_audit_events audit
      where audit.tournament_id = tournament.id
        and audit.kind = 'bracket_reset_not_required'
    )
  into v_no_reset_ok
  from public.tournaments tournament
  join public.tournament_matches final_match
    on final_match.tournament_id = tournament.id
   and final_match.bracket_stage = 'grand-final'
   and final_match.bracket_round = 1
  join public.tournament_matches reset_match
    on reset_match.tournament_id = tournament.id
   and reset_match.bracket_stage = 'grand-final'
   and reset_match.bracket_round = 2
  where tournament.id = v_tournament_no_reset;
  if v_no_reset_ok is distinct from true then
    raise exception 'The no-reset Grand Final path did not complete safely.';
  end if;

  -- A dropped entrant first loses in the winners bracket, then is
  -- automatically forfeited when its losers-bracket opponent arrives.
  select public.create_tournament(
    'Double Preview Drop', '', 'public', 1, 4, 'Synthetic drop matrix', 'double-elimination'
  ) into v_payload;
  select id into v_tournament_drop
  from public.tournaments where slug = v_payload ->> 'slug';
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  values
    (v_tournament_drop, v_players[1], 'Drop Seed One', 1),
    (v_tournament_drop, v_players[2], 'Drop Seed Two', 2),
    (v_tournament_drop, v_players[3], 'Drop Seed Three', 3),
    (v_tournament_drop, v_players[4], 'Drop Seed Four', 4);
  perform public.lock_double_elimination_tournament(v_tournament_drop);
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_drop and bracket_stage = 'winners'
    and bracket_round = 1 and match_number = 1;
  select revision into v_revision from public.tournaments where id = v_tournament_drop;
  perform public.set_tournament_entrant_status(
    v_tournament_drop,
    v_match.entrant_b_id,
    v_revision,
    'dropped',
    'Synthetic double-elimination withdrawal'
  );
  select * into v_match from public.tournament_matches
  where tournament_id = v_tournament_drop and bracket_stage = 'winners'
    and bracket_round = 1 and match_number = 2;
  perform pg_temp.dc_forfeit(v_match.id, v_match.entrant_b_id);
  select loser_match.status = 'complete'
    and dropped.status = 'dropped'
    and loser_match.loser_id = dropped.id
    and exists (
      select 1 from public.tournament_audit_events audit
      where audit.tournament_id = v_tournament_drop
        and audit.kind = 'inactive_entrant_forfeited'
    )
  into v_drop_ok
  from public.tournament_matches loser_match
  join public.tournament_entrants dropped on dropped.id = loser_match.loser_id
  where loser_match.tournament_id = v_tournament_drop
    and loser_match.bracket_stage = 'losers'
    and loser_match.bracket_round = 1;
  if v_drop_ok is distinct from true then
    raise exception 'A dropped entrant was not safely eliminated after its second loss.';
  end if;

  select public.get_tournament_workspace(slug, null) into v_payload
  from public.tournaments where id = v_tournament_reset;
  v_projection_ok := v_payload is not null
    and v_payload #>> '{tournament,format}' = 'double-elimination'
    and v_payload::text like '%bracket_stage%'
    and v_payload::text like '%bracket_round%'
    and v_payload::text not like '%winner_to_match_id%'
    and v_payload::text not like '%loser_to_match_id%'
    and v_payload::text not like '%source_resolved%'
    and v_payload::text not like '%user_id%';
  if v_projection_ok is distinct from true then
    raise exception 'The double-elimination projection is missing labels or exposes graph internals.';
  end if;

  delete from public.tournaments
  where id in (
    v_tournament_reset, v_tournament_no_reset, v_tournament_drop,
    v_tournament_byes
  );
  delete from auth.users
  where id = any(array[v_owner] || v_players || v_bye_players);
  select not exists (
    select 1 from public.tournaments
    where id in (
      v_tournament_reset, v_tournament_no_reset, v_tournament_drop,
      v_tournament_byes
    )
  ) and not exists (
    select 1 from auth.users
    where id = any(array[v_owner] || v_players || v_bye_players)
  ) into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Synthetic double-elimination fixtures were not fully removed.';
  end if;

  insert into dc_double_elimination_results(result)
  values (jsonb_build_object(
    'grants', v_grants_ok,
    'single_compatibility', v_single_compatibility_ok,
    'structure', v_structure_ok,
    'routes', v_routes_ok,
    'bye_routing', v_bye_ok,
    'reset_required', v_reset_ok,
    'reset_not_required', v_no_reset_ok,
    'dropped_entrant_second_loss', v_drop_ok,
    'projection_safe', v_projection_ok,
    'cleanup', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_double_elimination_results;
