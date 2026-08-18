-- Keep ordinary Daily Draft Brackets to one form per base species. Sunday
-- Super Brackets are intentionally exempt because their field is earned from
-- the six completed daily brackets and can contain distinct qualified forms.

begin;

create or replace function public.daily_bracket_species_key(p_pokemon text)
returns text
language plpgsql
immutable
strict
security invoker
set search_path = pg_catalog
as $$
declare
  v_key text := btrim(p_pokemon);
begin
  v_key := regexp_replace(v_key, '^Mega\s+', '', 'i');
  v_key := regexp_replace(v_key, '\s+[XYZ]$', '', 'i');
  v_key := regexp_replace(v_key, '^Primal\s+', '', 'i');
  v_key := regexp_replace(v_key, '^(Alolan|Galarian|Hisuian|Paldean)\s+', '', 'i');
  v_key := regexp_replace(v_key, '\s+\((Fire|Water)\)$', '', 'i');
  v_key := regexp_replace(v_key, '-(Female|Midday|Midnight|Dusk)$', '', 'i');
  v_key := regexp_replace(v_key, '-(Ice|Shadow)\s+Rider$', '', 'i');

  if lower(v_key) = 'floette-eternal' then
    v_key := 'Floette';
  elsif lower(v_key) = 'white-striped basculin' then
    v_key := 'Basculin';
  elsif lower(v_key) ~ '^rotom-(heat|wash|frost|fan|mow)$' then
    v_key := 'Rotom';
  end if;

  return lower(regexp_replace(v_key, '[^a-z0-9]+', '', 'gi'));
end;
$$;

create or replace function public.require_daily_bracket_species_variety()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entrant_count integer;
  v_species_count integer;
begin
  if new.bracket_kind <> 'daily' then
    return new;
  end if;

  select count(*), count(distinct public.daily_bracket_species_key(entry.value))
    into v_entrant_count, v_species_count
  from jsonb_array_elements_text(new.pokemon) entry(value);

  if v_entrant_count <> 8 or v_species_count <> 8 then
    raise exception 'Ordinary Daily Draft Brackets require eight different base Pokémon species. Use only one form of each species.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists require_daily_bracket_species_variety on public.daily_draft_brackets;
create trigger require_daily_bracket_species_variety
before insert or update of game_date, pokemon, bracket_kind
on public.daily_draft_brackets
for each row execute function public.require_daily_bracket_species_variety();

-- Repair only untouched future ordinary brackets. Historical brackets and any
-- bracket with a submission are immutable. Replacement species are chosen
-- deterministically and kept out of the surrounding seven-day window.
do $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_bracket record;
  v_entry record;
  v_seen_species text[];
  v_rebuilt jsonb;
  v_name text;
  v_species_key text;
  v_replacement text;
begin
  if exists (
    select 1
    from public.daily_draft_brackets bracket
    where bracket.bracket_kind = 'daily'
      and bracket.game_date > v_today
      and (
        select count(*)
        from jsonb_array_elements_text(bracket.pokemon) entrant(value)
      ) > (
        select count(distinct public.daily_bracket_species_key(entrant.value))
        from jsonb_array_elements_text(bracket.pokemon) entrant(value)
      )
      and exists (
        select 1
        from public.daily_bracket_matchups matchup
        where matchup.bracket_id = bracket.id
      )
  ) then
    raise exception 'A future Daily Draft Bracket with duplicate species already has submissions and was not changed.';
  end if;

  for v_bracket in
    select bracket.id, bracket.game_date, bracket.pokemon
    from public.daily_draft_brackets bracket
    where bracket.bracket_kind = 'daily'
      and bracket.game_date > v_today
      and (
        select count(*)
        from jsonb_array_elements_text(bracket.pokemon) entrant(value)
      ) > (
        select count(distinct public.daily_bracket_species_key(entrant.value))
        from jsonb_array_elements_text(bracket.pokemon) entrant(value)
      )
      and not exists (
        select 1
        from public.daily_bracket_matchups matchup
        where matchup.bracket_id = bracket.id
      )
    order by bracket.game_date
  loop
    v_seen_species := array[]::text[];
    v_rebuilt := '[]'::jsonb;

    for v_entry in
      select entrant.value, entrant.ordinality
      from jsonb_array_elements_text(v_bracket.pokemon) with ordinality entrant(value, ordinality)
      order by entrant.ordinality
    loop
      v_name := v_entry.value;
      v_species_key := public.daily_bracket_species_key(v_name);

      if v_species_key = any(v_seen_species) then
        select candidate.display_name
          into v_replacement
        from public.pokemon_catalogue candidate
        where nullif(btrim(candidate.display_name), '') is not null
          and public.daily_bracket_species_key(candidate.display_name) <> all(v_seen_species)
          and not exists (
            select 1
            from jsonb_array_elements_text(v_bracket.pokemon) original(value)
            where public.daily_bracket_species_key(original.value)
              = public.daily_bracket_species_key(candidate.display_name)
          )
          and not exists (
            select 1
            from public.daily_draft_brackets nearby
            cross join lateral jsonb_array_elements_text(nearby.pokemon) nearby_entrant(value)
            where nearby.id <> v_bracket.id
              and nearby.game_date between v_bracket.game_date - 7 and v_bracket.game_date + 7
              and public.daily_bracket_species_key(nearby_entrant.value)
                = public.daily_bracket_species_key(candidate.display_name)
          )
        order by md5(v_bracket.game_date::text || '|' || v_entry.value || '|' || candidate.display_name), candidate.display_name
        limit 1;

        if v_replacement is null then
          raise exception 'No collision-free replacement was available for Daily Draft Bracket %.', v_bracket.game_date;
        end if;
        v_name := v_replacement;
        v_species_key := public.daily_bracket_species_key(v_name);
      end if;

      v_seen_species := array_append(v_seen_species, v_species_key);
      v_rebuilt := v_rebuilt || jsonb_build_array(v_name);
    end loop;

    update public.daily_draft_brackets
    set pokemon = v_rebuilt
    where id = v_bracket.id;
  end loop;

  if exists (
    select 1
    from public.daily_draft_brackets bracket
    where bracket.bracket_kind = 'daily'
      and bracket.game_date > v_today
      and (
        select count(*)
        from jsonb_array_elements_text(bracket.pokemon) entrant(value)
      ) > (
        select count(distinct public.daily_bracket_species_key(entrant.value))
        from jsonb_array_elements_text(bracket.pokemon) entrant(value)
      )
  ) then
    raise exception 'Future Daily Draft Bracket species collisions remain after repair.';
  end if;
end;
$$;

revoke all on function public.daily_bracket_species_key(text) from public, anon, authenticated;
revoke all on function public.require_daily_bracket_species_variety() from public, anon, authenticated;
grant execute on function public.daily_bracket_species_key(text) to service_role;
grant execute on function public.require_daily_bracket_species_variety() to service_role;

notify pgrst, 'reload schema';

commit;
