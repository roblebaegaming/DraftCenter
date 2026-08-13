-- Preview-only rollback matrix for migration 388.
-- Run only in an isolated Supabase branch after migrations through 388 exist.

begin;

create temp table dc_sunday_super_bracket_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_sunday date := date '2000-01-09';
  v_pending_sunday date := date '2000-01-16';
  v_source_id uuid;
  v_sunday_id uuid := gen_random_uuid();
  v_pending_id uuid := gen_random_uuid();
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_day integer;
  v_champions text[] := array['Venusaur','Charizard','Blastoise','Pikachu','Eevee','Dragonite'];
  v_pokemon text[];
  v_result jsonb;
  v_second jsonb;
begin
  if has_function_privilege('anon', 'public.finalize_sunday_super_bracket(date)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.finalize_sunday_super_bracket(date)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.finalize_sunday_super_bracket(date)', 'EXECUTE') then
    raise exception 'Sunday Super Bracket finalizer grants are incorrect.';
  end if;
  if not has_function_privilege('anon', 'public.get_daily_bracket_context(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_daily_bracket_context(uuid)', 'EXECUTE') then
    raise exception 'Sunday Super Bracket context grants are incorrect.';
  end if;
  if has_table_privilege('anon', 'public.daily_draft_brackets', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_draft_brackets', 'SELECT')
     or has_table_privilege('anon', 'public.daily_bracket_matchups', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_bracket_matchups', 'SELECT') then
    raise exception 'Daily bracket tables exposed direct client reads.';
  end if;
  insert into dc_sunday_super_bracket_results values (jsonb_build_object('check', 'grants_and_rls', 'ok', true));

  insert into auth.users(id, aud, role)
  values
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');

  for v_day in 1..6 loop
    v_source_id := gen_random_uuid();
    v_pokemon := array[
      v_champions[v_day],
      'Gengar',
      'Lucario',
      'Tyranitar',
      'Scizor',
      'Umbreon',
      'Garchomp',
      'Metagross'
    ];
    insert into public.daily_draft_brackets(id, game_date, pokemon)
    values (v_source_id, v_sunday - (7 - v_day), to_jsonb(v_pokemon));

    -- The intended champion wins both completed brackets. Gengar and Lucario
    -- take the strongest repeatable non-winning paths; every other entrant
    -- has a lower semifinal rate.
    insert into public.daily_bracket_matchups(bracket_id, user_id, round_number, match_number, winner, loser) values
      (v_source_id, v_user_one, 1, 1, v_champions[v_day], 'Gengar'),
      (v_source_id, v_user_one, 1, 2, 'Lucario', 'Tyranitar'),
      (v_source_id, v_user_one, 1, 3, 'Scizor', 'Umbreon'),
      (v_source_id, v_user_one, 1, 4, 'Garchomp', 'Metagross'),
      (v_source_id, v_user_one, 2, 1, v_champions[v_day], 'Scizor'),
      (v_source_id, v_user_one, 2, 2, 'Lucario', 'Umbreon'),
      (v_source_id, v_user_one, 3, 1, v_champions[v_day], 'Lucario');

    insert into public.daily_bracket_matchups(bracket_id, user_id, round_number, match_number, winner, loser) values
      (v_source_id, v_user_two, 1, 1, 'Gengar', v_champions[v_day]),
      (v_source_id, v_user_two, 1, 2, 'Lucario', 'Tyranitar'),
      (v_source_id, v_user_two, 1, 3, 'Umbreon', 'Scizor'),
      (v_source_id, v_user_two, 1, 4, 'Metagross', 'Garchomp'),
      (v_source_id, v_user_two, 2, 1, 'Gengar', 'Lucario'),
      (v_source_id, v_user_two, 2, 2, 'Umbreon', 'Metagross'),
      (v_source_id, v_user_two, 3, 1, v_champions[v_day], 'Gengar');
  end loop;

  insert into public.daily_draft_brackets(id, game_date, pokemon, bracket_kind, qualification)
  values (
    v_sunday_id,
    v_sunday,
    '["Pikachu","Charizard","Gengar","Dragonite","Mewtwo","Umbreon","Scizor","Tyranitar"]'::jsonb,
    'weekly_final',
    '{"status":"pending"}'::jsonb
  );

  select public.finalize_sunday_super_bracket(v_sunday) into v_result;
  if v_result ->> 'status' <> 'finalized'
     or jsonb_array_length(v_result -> 'qualifiers') <> 8 then
    raise exception 'Sunday Super Bracket did not finalize eight qualifiers: %', v_result;
  end if;
  select array_agg(value order by value)
  into v_pokemon
  from jsonb_array_elements_text((select pokemon from public.daily_draft_brackets where id = v_sunday_id));
  if cardinality(v_pokemon) <> 8
     or cardinality(array(select distinct unnest(v_pokemon))) <> 8
     or not v_champions <@ v_pokemon
     or not array['Gengar','Lucario'] <@ v_pokemon then
    raise exception 'Sunday qualifier field is incorrect: %', v_pokemon;
  end if;
  if (select qualification ->> 'status' from public.daily_draft_brackets where id = v_sunday_id) <> 'finalized' then
    raise exception 'Finalized qualification provenance was not stored.';
  end if;
  insert into dc_sunday_super_bracket_results values (jsonb_build_object('check', 'qualification', 'ok', true));

  select public.finalize_sunday_super_bracket(v_sunday) into v_second;
  if v_second -> 'qualifiers' <> v_result -> 'qualifiers' then
    raise exception 'Sunday finalization was not idempotent.';
  end if;
  insert into dc_sunday_super_bracket_results values (jsonb_build_object('check', 'idempotent', 'ok', true));

  insert into public.daily_draft_brackets(id, game_date, pokemon, bracket_kind, qualification)
  values (
    v_pending_id,
    v_pending_sunday,
    '["Pikachu","Charizard","Gengar","Dragonite","Mewtwo","Umbreon","Scizor","Tyranitar"]'::jsonb,
    'weekly_final',
    '{"status":"pending"}'::jsonb
  );
  begin
    insert into public.daily_bracket_matchups(bracket_id, user_id, round_number, match_number, winner, loser)
    values (v_pending_id, v_user_one, 1, 1, 'Pikachu', 'Charizard');
    raise exception 'Pending Sunday matchup insert unexpectedly succeeded.';
  exception
    when others then
      if sqlerrm = 'Pending Sunday matchup insert unexpectedly succeeded.' then raise; end if;
      if position('qualifiers are still being finalized' in sqlerrm) = 0 then raise; end if;
  end;
  insert into dc_sunday_super_bracket_results values (jsonb_build_object('check', 'pending_gate', 'ok', true));
end;
$validation$;

select result from dc_sunday_super_bracket_results order by result ->> 'check';

rollback;
