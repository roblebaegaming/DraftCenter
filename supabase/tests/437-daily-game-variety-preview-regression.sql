begin;

do $$
declare
  v_daily_id uuid := gen_random_uuid();
  v_sunday_id uuid := gen_random_uuid();
  v_blocked boolean := false;
begin
  if public.daily_bracket_species_key('Audino') <> public.daily_bracket_species_key('Mega Audino')
     or public.daily_bracket_species_key('Raichu') <> public.daily_bracket_species_key('Alolan Raichu')
     or public.daily_bracket_species_key('Tauros') <> public.daily_bracket_species_key('Paldean Tauros (Water)')
     or public.daily_bracket_species_key('Lycanroc-Midday') <> public.daily_bracket_species_key('Lycanroc-Dusk')
     or public.daily_bracket_species_key('Rotom') <> public.daily_bracket_species_key('Rotom-Mow') then
    raise exception 'Daily bracket form normalization did not preserve base-species identity.';
  end if;

  if has_function_privilege('anon', 'public.daily_bracket_species_key(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.daily_bracket_species_key(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.require_daily_bracket_species_variety()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.require_daily_bracket_species_variety()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.daily_bracket_species_key(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.require_daily_bracket_species_variety()', 'EXECUTE') then
    raise exception 'Daily bracket variety function grants are incorrect.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.daily_draft_brackets'::regclass
      and tgname = 'require_daily_bracket_species_variety'
      and tgenabled <> 'D'
  ) then
    raise exception 'Daily bracket variety trigger is missing or disabled.';
  end if;

  insert into public.daily_draft_brackets(id, game_date, pokemon, bracket_kind, qualification)
  values (
    v_daily_id,
    date '2099-01-05',
    '["Audino","Charizard","Gengar","Dragonite","Mewtwo","Umbreon","Scizor","Tyranitar"]'::jsonb,
    'daily',
    '{}'::jsonb
  );

  begin
    update public.daily_draft_brackets
    set pokemon = '["Audino","Mega Audino","Gengar","Dragonite","Mewtwo","Umbreon","Scizor","Tyranitar"]'::jsonb
    where id = v_daily_id;
  exception
    when sqlstate '22023' then
      v_blocked := position('one form of each species' in sqlerrm) > 0;
  end;
  if not v_blocked then
    raise exception 'An ordinary Daily Draft Bracket accepted two forms of Audino.';
  end if;

  insert into public.daily_draft_brackets(id, game_date, pokemon, bracket_kind, qualification)
  values (
    v_sunday_id,
    date '2099-01-11',
    '["Audino","Mega Audino","Gengar","Dragonite","Mewtwo","Umbreon","Scizor","Tyranitar"]'::jsonb,
    'weekly_final',
    jsonb_build_object('status', 'finalized')
  );

  if not exists (
    select 1
    from public.daily_draft_brackets
    where id = v_sunday_id
      and bracket_kind = 'weekly_final'
      and jsonb_array_length(pokemon) = 8
  ) then
    raise exception 'The Sunday Super Bracket form exception was not preserved.';
  end if;
end;
$$;

rollback;
