-- Disposable 64-player tournament lifecycle and scale harness.
-- Run only in an isolated Supabase project. The transaction always rolls back.
begin;

set local statement_timeout = '120s';

create temporary table tournament_scale_result (
  players integer,
  rounds integer,
  swiss_rounds integer,
  top_cut_rounds integer,
  pairings integer,
  byes integer,
  confirmed_results integer,
  final_status text,
  champion_count integer,
  standings_rows integer,
  audit_events integer,
  elapsed_ms numeric
) on commit drop;

do $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_organizer uuid := gen_random_uuid();
  v_user uuid;
  v_tournament uuid;
  v_pairing record;
  v_round integer;
  v_status text;
  v_champion_count integer;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_organizer,
    'authenticated',
    'authenticated',
    'so-' || left(replace(v_organizer::text, '-', ''), 8) || '@example.invalid',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into public.profiles (id, display_name, username)
  values (v_organizer, 'Scale Organizer', 'scale_organizer_' || left(replace(v_organizer::text, '-', ''), 12))
  on conflict (id) do update set display_name = excluded.display_name;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_organizer, 'role', 'authenticated')::text,
    true
  );

  select (public.create_tournament(jsonb_build_object(
    'name', 'Rollback Scale Tournament',
    'slug', 'scale-' || left(replace(v_organizer::text, '-', ''), 20),
    'description', 'Disposable 64-player lifecycle test',
    'format_name', 'Singles',
    'structure', 'swiss_top_cut',
    'swiss_rounds', 6,
    'top_cut_size', 8,
    'best_of', 3,
    'max_players', 64,
    'team_sheet_policy', 'open_on_pairing'
  )) ->> 'tournament_id')::uuid
  into v_tournament;

  for v_round in 1..64 loop
    v_user := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user,
      'authenticated',
      'authenticated',
      'sp' || lpad(v_round::text, 3, '0') || '-' || left(replace(v_user::text, '-', ''), 8) || '@example.invalid',
      crypt(gen_random_uuid()::text, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

    insert into public.profiles (id, display_name, username)
    values (
      v_user,
      'Scale Player ' || lpad(v_round::text, 2, '0'),
      'scale_player_' || lpad(v_round::text, 2, '0') || '_' || left(replace(v_user::text, '-', ''), 8)
    )
    on conflict (id) do update set display_name = excluded.display_name;

    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_user, 'role', 'authenticated')::text,
      true
    );
    perform public.register_for_tournament(v_tournament);
    perform public.check_in_tournament_entrant(v_tournament);
    perform public.save_tournament_team_sheet(
      v_tournament,
      'Scale Team ' || lpad(v_round::text, 2, '0'),
      '["Pikachu","Charizard","Blastoise","Venusaur","Garchomp","Gholdengo"]'::jsonb,
      '{}'::jsonb
    );
  end loop;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_organizer, 'role', 'authenticated')::text,
    true
  );

  -- Six Swiss rounds, three top-cut rounds, then one completion call.
  for v_round in 1..10 loop
    -- The production UI starts each round in a separate transaction. This
    -- rollback-only harness clears the function's ON COMMIT DROP workspace
    -- so multiple UI-equivalent round calls can run in one transaction.
    drop table if exists pg_temp.pairing_pool;
    perform public.start_tournament_round(v_tournament);
    select status into v_status from public.tournaments where id = v_tournament;
    exit when v_status = 'complete';

    for v_pairing in
      select id, table_number
      from public.tournament_pairings
      where tournament_id = v_tournament
        and status = 'pending'
      order by table_number
    loop
      if mod(v_pairing.table_number + v_round, 2) = 0 then
        perform public.report_tournament_match(v_pairing.id, 2, 1, null);
      else
        perform public.report_tournament_match(v_pairing.id, 0, 2, null);
      end if;
    end loop;

    if exists (
      select 1
      from public.tournament_pairings
      where tournament_id = v_tournament
        and status not in ('confirmed', 'bye')
    ) then
      raise exception 'Round % retained unfinished pairings.', v_round;
    end if;
  end loop;

  select status into v_status from public.tournaments where id = v_tournament;
  if v_status <> 'complete' then
    raise exception 'Tournament did not complete; final status was %.', v_status;
  end if;

  select count(*)
  into v_champion_count
  from public.tournament_pairings
  where tournament_id = v_tournament
    and winner_entrant_id is not null
    and round_id = (
      select id
      from public.tournament_rounds
      where tournament_id = v_tournament
      order by round_number desc
      limit 1
    );

  insert into tournament_scale_result
  select
    (select count(*) from public.tournament_entrants where tournament_id = v_tournament),
    (select count(*) from public.tournament_rounds where tournament_id = v_tournament),
    (select count(*) from public.tournament_rounds where tournament_id = v_tournament and stage = 'swiss'),
    (select count(*) from public.tournament_rounds where tournament_id = v_tournament and stage = 'top_cut'),
    (select count(*) from public.tournament_pairings where tournament_id = v_tournament),
    (select count(*) from public.tournament_pairings where tournament_id = v_tournament and status = 'bye'),
    (select count(*) from public.tournament_pairings where tournament_id = v_tournament and status = 'confirmed'),
    v_status,
    v_champion_count,
    (select count(*) from public.get_tournament_standings(v_tournament)),
    (select count(*) from public.tournament_events where tournament_id = v_tournament),
    round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000, 2);
end
$$;

select * from tournament_scale_result;

rollback;
