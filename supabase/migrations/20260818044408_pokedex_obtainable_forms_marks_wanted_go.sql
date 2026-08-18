-- Migration 435: complete game-save catalog coverage, Pokémon GO, private marks, Alpha
-- specimens, cross-tracker collection search, and private hunt targets.

begin;

insert into public.pokemon_games(
  game_key, display_name, generation, family, release_order,
  source_commit, pokedex_source_commit, coverage_note,
  encounter_status, pokedex_status, starters, condition_groups
) values (
  'pokemon-go', 'Pokémon GO', 9, 'Pokémon GO', 39,
  '5064f1d72746b3a6a931616dae3fb6445c556d4f',
  '5064f1d72746b3a6a931616dae3fb6445c556d4f',
  '954 released or announced species through the August 18, 2026 Water Festival; National Dex identities use pinned PokéAPI 5064f1d72746b3a6a931616dae3fb6445c556d4f and availability was reviewed against Bulbapedia revision 4613872 dated 2026-08-17.',
  'unsupported', 'verified', '[]'::jsonb, '[]'::jsonb
)
on conflict(game_key) do update set
  display_name = excluded.display_name,
  generation = excluded.generation,
  family = excluded.family,
  release_order = excluded.release_order,
  pokedex_source_commit = excluded.pokedex_source_commit,
  coverage_note = excluded.coverage_note,
  encounter_status = 'unsupported',
  pokedex_status = 'verified',
  updated_at = now();

insert into public.pokemon_game_pokedex_entries(
  game_key, pokedex_key, entry_number, pokemon_id, pokemon_name,
  form_name, species_family, source_commit
)
select 'pokemon-go', 'go', home.pokemon_id, home.pokemon_id, home.pokemon_name,
  '', 'national-' || home.pokemon_id::text,
  '5064f1d72746b3a6a931616dae3fb6445c556d4f'
from public.pokedex_tracker_catalog('home') home
where home.pokemon_id <= 1025
  and home.pokemon_id <> all(array[
    489,490,493,746,771,772,773,774,801,833,834,868,869,871,875,878,879,
    880,881,882,883,896,897,898,902,942,943,946,947,951,952,953,954,963,
    964,967,976,981,984,985,986,987,988,989,990,991,992,993,994,995,1001,
    1002,1003,1004,1005,1006,1007,1008,1009,1010,1014,1015,1016,1017,
    1018,1020,1021,1022,1023,1024,1025
  ]::integer[])
on conflict(game_key, pokedex_key, entry_number, pokemon_id, form_name) do update set
  pokemon_name = excluded.pokemon_name,
  species_family = excluded.species_family,
  source_commit = excluded.source_commit;

alter table public.pokedex_tracker_entry_details
  add column mark_keys text[] not null default '{}',
  add constraint pokedex_tracker_entry_details_mark_count_check
    check (cardinality(mark_keys) <= 60),
  add constraint pokedex_tracker_entry_details_mark_shape_check
    check (array_position(mark_keys, null) is null);

alter table public.pokedex_collection_specimens
  add column mark_keys text[] not null default '{}',
  add column is_alpha boolean not null default false,
  add constraint pokedex_collection_specimens_mark_count_check
    check (cardinality(mark_keys) <= 60),
  add constraint pokedex_collection_specimens_mark_shape_check
    check (array_position(mark_keys, null) is null);

create table public.pokedex_tracker_wanted_entries (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  is_shiny boolean not null default false,
  form_label text not null default '' check (char_length(form_label) <= 80),
  mark_keys text[] not null default '{}',
  wants_alpha boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tracker_id, pokemon_id, is_shiny),
  foreign key(tracker_id, user_id)
    references public.pokedex_trackers(id, user_id) on delete cascade,
  constraint pokedex_tracker_wanted_mark_count_check check (cardinality(mark_keys) <= 60),
  constraint pokedex_tracker_wanted_mark_shape_check check (array_position(mark_keys, null) is null)
);

create index pokedex_tracker_wanted_user_tracker_idx
  on public.pokedex_tracker_wanted_entries(user_id, tracker_id, updated_at desc);
create index pokedex_collection_specimens_user_updated_idx
  on public.pokedex_collection_specimens(user_id, updated_at desc);
create index pokedex_collection_specimens_marks_gin_idx
  on public.pokedex_collection_specimens using gin(mark_keys);

alter table public.pokedex_tracker_wanted_entries enable row level security;
alter table public.pokedex_tracker_wanted_entries force row level security;
revoke all on table public.pokedex_tracker_wanted_entries from public, anon, authenticated;
grant all on table public.pokedex_tracker_wanted_entries to service_role;

comment on table public.pokedex_tracker_wanted_entries is
  'Private account-owned hunt targets. Browser table access is denied; authenticated RPCs enforce ownership.';
comment on column public.pokedex_collection_specimens.mark_keys is
  'Marks earned by this individual Pokémon, distinct from its game-origin symbol.';
comment on column public.pokedex_collection_specimens.is_alpha is
  'Whether this individual originated as an Alpha Pokémon in a Legends game.';

create or replace function public.pokedex_tracker_mark_key_is_known(p_key text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_key = any(array[
    'lunchtime','sleepy-time','dusk','dawn','cloudy','rainy','stormy','snowy',
    'blizzard','dry','sandstorm','misty','fishing','curry','destiny','rare',
    'uncommon','rowdy','absent-minded','jittery','excited','charismatic',
    'calmness','intense','zoned-out','joyful','angry','smiley','teary','upbeat',
    'peeved','intellectual','ferocious','crafty','scowling','kindly','flustered',
    'pumped-up','zero-energy','prideful','unsure','humble','thorny','vigor',
    'slump','jumbo','mini','itemfinder','gourmand','partner','alpha','mightiest','titan'
  ]::text[]);
$$;
revoke all on function public.pokedex_tracker_mark_key_is_known(text)
  from public, anon, authenticated;
grant execute on function public.pokedex_tracker_mark_key_is_known(text) to service_role;

create or replace function public.pokedex_tracker_catalog(p_catalog_key text)
returns table(
  pokemon_id integer,
  pokemon_name text,
  dex_number integer,
  pokedex_key text,
  sort_order bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with available as (
    select entry.pokemon_id, entry.pokemon_name, entry.entry_number,
      entry.pokedex_key, entry.id,
      row_number() over (
        partition by entry.pokemon_id,
          case when p_catalog_key = 'home' then 'national' else entry.pokedex_key end
        order by case when nullif(entry.form_name, '') is null then 0 else 1 end, entry.id
      ) as species_row
    from public.pokemon_game_pokedex_entries entry
    join public.pokemon_games game on game.game_key = entry.game_key
    where game.pokedex_status = 'verified'
      and ((p_catalog_key = 'home' and entry.pokemon_id < 10000) or entry.game_key = p_catalog_key)
  ),
  canonical as (
    select available.pokemon_id, available.pokemon_name,
      case when p_catalog_key = 'home' then available.pokemon_id else available.entry_number end,
      case when p_catalog_key = 'home' then 'national' else available.pokedex_key end,
      case when p_catalog_key = 'home' then available.pokemon_id::bigint else
        (case available.pokedex_key
          when 'kalos-coastal' then 1 when 'kalos-mountain' then 2
          when 'original-melemele' then 1 when 'updated-melemele' then 1
          when 'original-akala' then 2 when 'updated-akala' then 2
          when 'original-ulaula' then 3 when 'updated-ulaula' then 3
          when 'original-poni' then 4 when 'updated-poni' then 4
          when 'isle-of-armor' then 1 when 'crown-tundra' then 2
          when 'kitakami' then 1 when 'blueberry' then 2 when 'hyperspace' then 1
          else 0 end::bigint * 1000000) + available.entry_number::bigint
      end
    from available where available.species_row = 1
  ),
  species_identity as (
    select distinct on (lower(regexp_replace(entry.pokemon_name, '[^a-zA-Z0-9]+', '', 'g')))
      lower(regexp_replace(entry.pokemon_name, '[^a-zA-Z0-9]+', '', 'g')) as name_key,
      entry.pokemon_id, entry.pokemon_name
    from public.pokemon_game_pokedex_entries entry
    where entry.pokemon_id < 10000
    order by lower(regexp_replace(entry.pokemon_name, '[^a-zA-Z0-9]+', '', 'g')), entry.pokemon_id
  ),
  encounter_species as (
    select distinct
      coalesce(case when encounter.pokemon_id < 10000 then encounter.pokemon_id end, identity.pokemon_id) as pokemon_id,
      coalesce(identity.pokemon_name, encounter.pokemon_name) as pokemon_name
    from public.pokemon_game_encounters encounter
    join public.pokemon_games game on game.game_key = encounter.game_key
    left join species_identity identity
      on identity.name_key = lower(regexp_replace(encounter.pokemon_name, '[^a-zA-Z0-9]+', '', 'g'))
    where encounter.game_key = p_catalog_key and game.encounter_status = 'verified'
  ),
  extras as (
    select encounter.pokemon_id, encounter.pokemon_name, encounter.pokemon_id as dex_number,
      'obtainable'::text as pokedex_key, 90000000::bigint + encounter.pokemon_id as sort_order
    from encounter_species encounter
    where encounter.pokemon_id is not null
      and not exists (select 1 from canonical where canonical.pokemon_id = encounter.pokemon_id)
  ),
  home_supplement as (
    select supplement.pokemon_id, supplement.pokemon_name, supplement.pokemon_id,
      'national'::text, supplement.pokemon_id::bigint
    from (values (719, 'Diancie'::text), (720, 'Hoopa'::text), (721, 'Volcanion'::text))
      supplement(pokemon_id, pokemon_name)
    where p_catalog_key = 'home'
      and not exists (select 1 from canonical where canonical.pokemon_id = supplement.pokemon_id)
  )
  select * from canonical
  union all select * from extras
  union all select * from home_supplement
  order by sort_order, pokemon_name;
$$;

create or replace function public.get_my_pokedex_trackers()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with game_catalogs as (
    select game.game_key as catalog_key, game.display_name, game.generation,
      game.family, game.release_order,
      (select count(distinct catalog.pokemon_id)::integer
       from public.pokedex_tracker_catalog(game.game_key) catalog) as total
    from public.pokemon_games game
    where game.pokedex_status = 'verified'
      and exists (select 1 from public.pokemon_game_pokedex_entries entry where entry.game_key = game.game_key)
  ),
  alpha_catalogs as (
    select alpha.game_key as catalog_key, count(*)::integer as alpha_total
    from public.pokemon_game_alpha_species alpha group by alpha.game_key
  ),
  catalogs as (
    select 'home'::text as catalog_key, 'Pokémon HOME National Dex'::text as display_name,
      10::smallint as generation, 'Pokémon HOME'::text as family, 0 as release_order,
      (select count(*)::integer from public.pokedex_tracker_catalog('home')) as total
    union all
    select catalog_key, display_name, generation, family, release_order, total from game_catalogs
  ),
  direct_progress as (
    select entry.tracker_id,
      count(*) filter(where not entry.is_shiny)::integer as caught,
      count(*) filter(where entry.is_shiny)::integer as shiny_caught
    from public.pokedex_tracker_entries entry where entry.user_id = auth.uid()
    group by entry.tracker_id
  ),
  alpha_progress as (
    select entry.tracker_id, count(*)::integer as alpha_caught
    from public.pokedex_tracker_alpha_entries entry where entry.user_id = auth.uid()
    group by entry.tracker_id
  ),
  locations as (
    select location.tracker_id, count(*)::integer as location_count
    from public.pokedex_collection_locations location where location.user_id = auth.uid()
    group by location.tracker_id
  ),
  specimens as (
    select specimen.tracker_id, count(*)::integer as specimen_count
    from public.pokedex_collection_specimens specimen where specimen.user_id = auth.uid()
    group by specimen.tracker_id
  ),
  wanted as (
    select target.tracker_id, count(*)::integer as wanted_count
    from public.pokedex_tracker_wanted_entries target where target.user_id = auth.uid()
    group by target.tracker_id
  )
  select jsonb_build_object(
    'catalogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', catalog.catalog_key, 'name', catalog.display_name,
        'generation', catalog.generation, 'family', catalog.family, 'total', catalog.total,
        'supports_alpha', alpha_catalogs.catalog_key is not null,
        'alpha_total', coalesce(alpha_catalogs.alpha_total, 0)
      ) order by catalog.release_order, catalog.display_name)
      from catalogs catalog left join alpha_catalogs on alpha_catalogs.catalog_key = catalog.catalog_key
    ), '[]'::jsonb),
    'trackers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tracker.id, 'title', tracker.title, 'catalog_key', tracker.catalog_key,
        'catalog_name', catalog.display_name, 'include_shiny', tracker.include_shiny,
        'include_alpha', tracker.include_alpha,
        'supports_alpha', alpha_catalogs.catalog_key is not null,
        'total', catalog.total, 'alpha_total', coalesce(alpha_catalogs.alpha_total, 0),
        'caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
            and not progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (select 1 from public.pokedex_tracker_catalog('home') home_catalog
                        where home_catalog.pokemon_id = progress.pokemon_id)
        ) else coalesce(direct_progress.caught, 0) end,
        'shiny_caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
            and progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (select 1 from public.pokedex_tracker_catalog('home') home_catalog
                        where home_catalog.pokemon_id = progress.pokemon_id)
        ) else coalesce(direct_progress.shiny_caught, 0) end,
        'alpha_caught', coalesce(alpha_progress.alpha_caught, 0),
        'location_count', coalesce(locations.location_count, 0),
        'specimen_count', coalesce(specimens.specimen_count, 0),
        'wanted_count', coalesce(wanted.wanted_count, 0),
        'created_at', tracker.created_at, 'updated_at', tracker.updated_at
      ) order by tracker.updated_at desc)
      from public.pokedex_trackers tracker
      join catalogs catalog on catalog.catalog_key = tracker.catalog_key
      left join alpha_catalogs on alpha_catalogs.catalog_key = tracker.catalog_key
      left join direct_progress on direct_progress.tracker_id = tracker.id
      left join alpha_progress on alpha_progress.tracker_id = tracker.id
      left join locations on locations.tracker_id = tracker.id
      left join specimens on specimens.tracker_id = tracker.id
      left join wanted on wanted.tracker_id = tracker.id
      where tracker.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_my_pokedex_tracker(p_tracker_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_catalog_name text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to open a Pokédex tracker.' using errcode = '42501';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();
  if not found then return null; end if;
  select case when v_tracker.catalog_key = 'home' then 'Pokémon HOME National Dex' else game.display_name end
  into v_catalog_name from (select 1) seed
  left join public.pokemon_games game on game.game_key = v_tracker.catalog_key;

  select jsonb_build_object(
    'tracker', jsonb_build_object(
      'id', v_tracker.id, 'title', v_tracker.title, 'catalog_key', v_tracker.catalog_key,
      'catalog_name', v_catalog_name, 'include_shiny', v_tracker.include_shiny,
      'include_alpha', v_tracker.include_alpha,
      'supports_alpha', public.pokedex_catalog_supports_alpha(v_tracker.catalog_key),
      'created_at', v_tracker.created_at, 'updated_at', v_tracker.updated_at
    ),
    'pokemon', coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', catalog.pokemon_id, 'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number, 'pokedex_key', catalog.pokedex_key,
      'caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id and not progress.is_shiny
          and (progress.tracker_id = v_tracker.id
               or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home'))
      ),
      'shiny_caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id and progress.is_shiny
          and (progress.tracker_id = v_tracker.id
               or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home'))
      ),
      'alpha_eligible', exists(
        select 1 from public.pokemon_game_alpha_species alpha
        where alpha.game_key = v_tracker.catalog_key and alpha.pokemon_id = catalog.pokemon_id
      ),
      'alpha_available', exists(
        select 1 from public.pokemon_game_alpha_species alpha
        where alpha.pokemon_id = catalog.pokemon_id
      ),
      'alpha_caught', exists(
        select 1 from public.pokedex_tracker_alpha_entries alpha_progress
        where alpha_progress.tracker_id = v_tracker.id
          and alpha_progress.user_id = auth.uid()
          and alpha_progress.pokemon_id = catalog.pokemon_id
      ),
      'wanted', standard_wanted.id is not null,
      'wanted_form', coalesce(standard_wanted.form_label, ''),
      'wanted_marks', coalesce(standard_wanted.mark_keys, '{}'::text[]),
      'wanted_alpha', coalesce(standard_wanted.wants_alpha, false),
      'wanted_notes', coalesce(standard_wanted.notes, ''),
      'shiny_wanted', shiny_wanted.id is not null,
      'shiny_wanted_form', coalesce(shiny_wanted.form_label, ''),
      'shiny_wanted_marks', coalesce(shiny_wanted.mark_keys, '{}'::text[]),
      'shiny_wanted_alpha', coalesce(shiny_wanted.wants_alpha, false),
      'shiny_wanted_notes', coalesce(shiny_wanted.notes, ''),
      'pokeball', coalesce(standard_detail.pokeball_key, ''),
      'ribbons', coalesce(standard_detail.ribbon_keys, '{}'::text[]),
      'marks', coalesce(standard_detail.mark_keys, '{}'::text[]),
      'notes', coalesce(standard_detail.notes, ''),
      'shiny_pokeball', coalesce(shiny_detail.pokeball_key, ''),
      'shiny_ribbons', coalesce(shiny_detail.ribbon_keys, '{}'::text[]),
      'shiny_marks', coalesce(shiny_detail.mark_keys, '{}'::text[]),
      'shiny_notes', coalesce(shiny_detail.notes, '')
    ) order by catalog.sort_order, catalog.pokemon_name), '[]'::jsonb)
  ) into v_result
  from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
  left join public.pokedex_tracker_entry_details standard_detail
    on standard_detail.tracker_id = v_tracker.id and standard_detail.user_id = auth.uid()
   and standard_detail.pokemon_id = catalog.pokemon_id and not standard_detail.is_shiny
  left join public.pokedex_tracker_entry_details shiny_detail
    on shiny_detail.tracker_id = v_tracker.id and shiny_detail.user_id = auth.uid()
   and shiny_detail.pokemon_id = catalog.pokemon_id and shiny_detail.is_shiny
  left join public.pokedex_tracker_wanted_entries standard_wanted
    on standard_wanted.tracker_id = v_tracker.id and standard_wanted.user_id = auth.uid()
   and standard_wanted.pokemon_id = catalog.pokemon_id and not standard_wanted.is_shiny
  left join public.pokedex_tracker_wanted_entries shiny_wanted
    on shiny_wanted.tracker_id = v_tracker.id and shiny_wanted.user_id = auth.uid()
   and shiny_wanted.pokemon_id = catalog.pokemon_id and shiny_wanted.is_shiny;
  return v_result;
end;
$$;

create function public.set_my_pokedex_tracker_entry_details_v2(
  p_tracker_id uuid,
  p_pokemon_id integer,
  p_is_shiny boolean,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_is_shiny boolean := coalesce(p_is_shiny, false);
  v_pokeball_key text := nullif(lower(btrim(coalesce(p_payload ->> 'pokeball', ''))), '');
  v_ribbon_keys text[];
  v_mark_keys text[];
  v_notes text := coalesce(p_payload ->> 'notes', '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to save Pokédex details.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or (p_payload ? 'ribbons' and jsonb_typeof(p_payload -> 'ribbons') <> 'array')
     or (p_payload ? 'marks' and jsonb_typeof(p_payload -> 'marks') <> 'array') then
    raise exception 'Collection details must use the supported shape.' using errcode = '22023';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid() for update;
  if not found then raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002'; end if;
  if v_is_shiny and not v_tracker.include_shiny then
    raise exception 'Enable the shiny dex before saving shiny details.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
                 where catalog.pokemon_id = p_pokemon_id) then
    raise exception 'That Pokémon is not part of this Pokédex.' using errcode = '22023';
  end if;
  if char_length(v_notes) > 1000 then
    raise exception 'Pokémon notes must be 1,000 characters or fewer.' using errcode = '22023';
  end if;
  if v_pokeball_key is not null
     and not public.pokedex_tracker_detail_key_is_known('pokeball', v_pokeball_key) then
    raise exception 'Choose a supported Poké Ball.' using errcode = '22023';
  end if;
  select coalesce(array_agg(key order by key), '{}'::text[]) into v_ribbon_keys
  from (select distinct lower(btrim(raw_key)) as key
        from jsonb_array_elements_text(coalesce(p_payload -> 'ribbons', '[]'::jsonb)) raw(raw_key)
        where nullif(btrim(raw_key), '') is not null) normalized;
  select coalesce(array_agg(key order by key), '{}'::text[]) into v_mark_keys
  from (select distinct lower(btrim(raw_key)) as key
        from jsonb_array_elements_text(coalesce(p_payload -> 'marks', '[]'::jsonb)) raw(raw_key)
        where nullif(btrim(raw_key), '') is not null) normalized;
  if cardinality(v_ribbon_keys) > 100 or exists (
    select 1 from unnest(v_ribbon_keys) key
    where not public.pokedex_tracker_detail_key_is_known('ribbon', key)
  ) then raise exception 'Choose only supported ribbons.' using errcode = '22023'; end if;
  if cardinality(v_mark_keys) > 60 or exists (
    select 1 from unnest(v_mark_keys) key where not public.pokedex_tracker_mark_key_is_known(key)
  ) then raise exception 'Choose only supported marks.' using errcode = '22023'; end if;

  if v_pokeball_key is null and cardinality(v_ribbon_keys) = 0
     and cardinality(v_mark_keys) = 0 and v_notes = '' then
    delete from public.pokedex_tracker_entry_details
    where tracker_id = v_tracker.id and user_id = auth.uid()
      and pokemon_id = p_pokemon_id and is_shiny = v_is_shiny;
  else
    insert into public.pokedex_tracker_entry_details(
      tracker_id, user_id, pokemon_id, is_shiny, pokeball_key, ribbon_keys, mark_keys, notes
    ) values (
      v_tracker.id, auth.uid(), p_pokemon_id, v_is_shiny,
      v_pokeball_key, v_ribbon_keys, v_mark_keys, v_notes
    ) on conflict(tracker_id, pokemon_id, is_shiny) do update
      set pokeball_key = excluded.pokeball_key, ribbon_keys = excluded.ribbon_keys,
          mark_keys = excluded.mark_keys, notes = excluded.notes, updated_at = now()
      where pokedex_tracker_entry_details.user_id = auth.uid();
  end if;
  update public.pokedex_trackers set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();
  return jsonb_build_object('pokeball', coalesce(v_pokeball_key, ''),
    'ribbons', v_ribbon_keys, 'marks', v_mark_keys, 'notes', v_notes);
end;
$$;

create function public.set_my_pokedex_tracker_wanted_entry(
  p_tracker_id uuid,
  p_pokemon_id integer,
  p_is_shiny boolean,
  p_wanted boolean,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_is_shiny boolean := coalesce(p_is_shiny, false);
  v_form_label text := btrim(coalesce(p_payload ->> 'form_label', ''));
  v_mark_keys text[];
  v_wants_alpha boolean := lower(coalesce(p_payload ->> 'wants_alpha', 'false')) = 'true';
  v_notes text := coalesce(p_payload ->> 'notes', '');
  v_target public.pokedex_tracker_wanted_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save hunt targets.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or (p_payload ? 'marks' and jsonb_typeof(p_payload -> 'marks') <> 'array') then
    raise exception 'Hunt target details must use the supported shape.' using errcode = '22023';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid() for update;
  if not found then raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002'; end if;
  if v_is_shiny and not v_tracker.include_shiny then
    raise exception 'Enable the shiny dex before saving a shiny target.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
                 where catalog.pokemon_id = p_pokemon_id) then
    raise exception 'That Pokémon is not part of this Pokédex.' using errcode = '22023';
  end if;
  if char_length(v_form_label) > 80 or char_length(v_notes) > 500 then
    raise exception 'Hunt target form and notes are too long.' using errcode = '22023';
  end if;
  select coalesce(array_agg(key order by key), '{}'::text[]) into v_mark_keys
  from (select distinct lower(btrim(raw_key)) as key
        from jsonb_array_elements_text(coalesce(p_payload -> 'marks', '[]'::jsonb)) raw(raw_key)
        where nullif(btrim(raw_key), '') is not null) normalized;
  if cardinality(v_mark_keys) > 60 or exists (
    select 1 from unnest(v_mark_keys) key where not public.pokedex_tracker_mark_key_is_known(key)
  ) then raise exception 'Choose only supported marks.' using errcode = '22023'; end if;
  if v_wants_alpha and not (
    (v_tracker.catalog_key = 'home' and exists (
      select 1 from public.pokemon_game_alpha_species alpha where alpha.pokemon_id = p_pokemon_id
    )) or exists (
      select 1 from public.pokemon_game_alpha_species alpha
      where alpha.game_key = v_tracker.catalog_key and alpha.pokemon_id = p_pokemon_id
    )
  ) then raise exception 'That species cannot be an Alpha in this tracker.' using errcode = '22023'; end if;

  if not coalesce(p_wanted, false) then
    delete from public.pokedex_tracker_wanted_entries
    where tracker_id = v_tracker.id and user_id = auth.uid()
      and pokemon_id = p_pokemon_id and is_shiny = v_is_shiny;
    return jsonb_build_object('wanted', false);
  end if;
  insert into public.pokedex_tracker_wanted_entries(
    tracker_id, user_id, pokemon_id, is_shiny, form_label, mark_keys, wants_alpha, notes
  ) values (
    v_tracker.id, auth.uid(), p_pokemon_id, v_is_shiny,
    v_form_label, v_mark_keys, v_wants_alpha, v_notes
  ) on conflict(tracker_id, pokemon_id, is_shiny) do update
    set form_label = excluded.form_label, mark_keys = excluded.mark_keys,
        wants_alpha = excluded.wants_alpha, notes = excluded.notes, updated_at = now()
    where pokedex_tracker_wanted_entries.user_id = auth.uid()
  returning * into v_target;
  update public.pokedex_trackers set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();
  return jsonb_build_object('wanted', true, 'form_label', v_target.form_label,
    'marks', v_target.mark_keys, 'wants_alpha', v_target.wants_alpha, 'notes', v_target.notes);
end;
$$;

alter function public.save_my_pokedex_collection_specimen(uuid, uuid, jsonb)
  rename to save_my_pokedex_collection_specimen_v1;
revoke all on function public.save_my_pokedex_collection_specimen_v1(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_my_pokedex_collection_specimen_v1(uuid, uuid, jsonb) to service_role;

create function public.save_my_pokedex_collection_specimen(
  p_tracker_id uuid,
  p_specimen_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_mark_keys text[];
  v_is_alpha boolean := lower(coalesce(p_payload ->> 'is_alpha', 'false')) = 'true';
  v_tracker public.pokedex_trackers%rowtype;
  v_pokemon_id integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save an individual Pokémon.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or (p_payload ? 'marks' and jsonb_typeof(p_payload -> 'marks') <> 'array') then
    raise exception 'Individual Pokémon details must use the supported shape.' using errcode = '22023';
  end if;
  select coalesce(array_agg(key order by key), '{}'::text[]) into v_mark_keys
  from (select distinct lower(btrim(raw_key)) as key
        from jsonb_array_elements_text(coalesce(p_payload -> 'marks', '[]'::jsonb)) raw(raw_key)
        where nullif(btrim(raw_key), '') is not null) normalized;
  if cardinality(v_mark_keys) > 60 or exists (
    select 1 from unnest(v_mark_keys) key where not public.pokedex_tracker_mark_key_is_known(key)
  ) then raise exception 'Choose only supported marks.' using errcode = '22023'; end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();
  if not found then raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002'; end if;
  v_pokemon_id := nullif(p_payload ->> 'pokemon_id', '')::integer;
  if v_is_alpha and not (
    (v_tracker.catalog_key = 'home' and exists (
      select 1 from public.pokemon_game_alpha_species alpha where alpha.pokemon_id = v_pokemon_id
    )) or exists (
      select 1 from public.pokemon_game_alpha_species alpha
      where alpha.game_key = v_tracker.catalog_key and alpha.pokemon_id = v_pokemon_id
    )
  ) then raise exception 'That species cannot be an Alpha in this tracker.' using errcode = '22023'; end if;
  v_result := public.save_my_pokedex_collection_specimen_v1(p_tracker_id, p_specimen_id, p_payload);
  update public.pokedex_collection_specimens specimen
  set mark_keys = v_mark_keys, is_alpha = v_is_alpha, updated_at = now()
  where specimen.id = (v_result ->> 'id')::uuid
    and specimen.tracker_id = p_tracker_id and specimen.user_id = auth.uid();
  return v_result || jsonb_build_object('marks', v_mark_keys, 'is_alpha', v_is_alpha);
end;
$$;

create or replace function public.get_my_pokedex_collection_inventory(p_tracker_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_locations jsonb;
  v_specimens jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to open your collection inventory.' using errcode = '42501';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', location.id, 'kind', location.location_kind, 'name', location.name,
    'platform', location.platform, 'notes', location.notes,
    'created_at', location.created_at, 'updated_at', location.updated_at,
    'specimen_count', (select count(*)::integer from public.pokedex_collection_specimens specimen
      where specimen.location_id = location.id and specimen.tracker_id = v_tracker.id
        and specimen.user_id = auth.uid())
  ) order by location.name, location.created_at), '[]'::jsonb)
  into v_locations from public.pokedex_collection_locations location
  where location.tracker_id = v_tracker.id and location.user_id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', specimen.id, 'pokemon_id', specimen.pokemon_id,
    'pokemon', catalog.pokemon_name, 'dex_number', catalog.dex_number,
    'form_label', specimen.form_label, 'nickname', specimen.nickname,
    'is_shiny', specimen.is_shiny, 'is_alpha', specimen.is_alpha,
    'gender', specimen.gender, 'level', specimen.level,
    'original_trainer', specimen.original_trainer, 'origin_game', specimen.origin_game,
    'origin_mark', specimen.origin_mark, 'location_id', specimen.location_id,
    'location_name', coalesce(location.name, ''), 'location_kind', coalesce(location.location_kind, ''),
    'location_platform', coalesce(location.platform, ''),
    'box_label', specimen.box_label, 'box_position', specimen.box_position,
    'pokeball', coalesce(specimen.pokeball_key, ''), 'ribbons', specimen.ribbon_keys,
    'marks', specimen.mark_keys, 'is_event', specimen.is_event,
    'importance', specimen.importance, 'intended_destination', specimen.intended_destination,
    'transfer_state', specimen.transfer_state, 'transferred_on', specimen.transferred_on,
    'notes', specimen.notes, 'created_at', specimen.created_at, 'updated_at', specimen.updated_at
  ) order by specimen.updated_at desc, catalog.sort_order, specimen.id), '[]'::jsonb)
  into v_specimens
  from public.pokedex_collection_specimens specimen
  join lateral (
    select entry.* from public.pokedex_tracker_catalog(v_tracker.catalog_key) entry
    where entry.pokemon_id = specimen.pokemon_id order by entry.sort_order limit 1
  ) catalog on true
  left join public.pokedex_collection_locations location
    on location.id = specimen.location_id and location.tracker_id = specimen.tracker_id
   and location.user_id = specimen.user_id
  where specimen.tracker_id = v_tracker.id and specimen.user_id = auth.uid();
  return jsonb_build_object('tracker_id', v_tracker.id, 'catalog_key', v_tracker.catalog_key,
    'locations', v_locations, 'specimens', v_specimens);
end;
$$;

create function public.get_my_pokedex_collection_index()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'specimens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', specimen.id, 'tracker_id', tracker.id, 'tracker_title', tracker.title,
        'catalog_key', tracker.catalog_key,
        'catalog_name', case when tracker.catalog_key = 'home' then 'Pokémon HOME National Dex' else game.display_name end,
        'pokemon_id', specimen.pokemon_id, 'pokemon', catalog.pokemon_name,
        'dex_number', catalog.dex_number, 'form_label', specimen.form_label,
        'nickname', specimen.nickname, 'is_shiny', specimen.is_shiny,
        'is_alpha', specimen.is_alpha, 'gender', specimen.gender, 'level', specimen.level,
        'origin_game', specimen.origin_game, 'origin_mark', specimen.origin_mark,
        'location_name', coalesce(location.name, ''), 'box_label', specimen.box_label,
        'box_position', specimen.box_position, 'pokeball', coalesce(specimen.pokeball_key, ''),
        'ribbons', specimen.ribbon_keys, 'marks', specimen.mark_keys,
        'notes', specimen.notes, 'updated_at', specimen.updated_at
      ) order by specimen.updated_at desc)
      from public.pokedex_collection_specimens specimen
      join public.pokedex_trackers tracker on tracker.id = specimen.tracker_id
        and tracker.user_id = auth.uid() and specimen.user_id = auth.uid()
      left join public.pokemon_games game on game.game_key = tracker.catalog_key
      join lateral (
        select entry.* from public.pokedex_tracker_catalog(tracker.catalog_key) entry
        where entry.pokemon_id = specimen.pokemon_id order by entry.sort_order limit 1
      ) catalog on true
      left join public.pokedex_collection_locations location
        on location.id = specimen.location_id and location.tracker_id = specimen.tracker_id
       and location.user_id = specimen.user_id
    ), '[]'::jsonb),
    'wanted', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', target.id, 'tracker_id', tracker.id, 'tracker_title', tracker.title,
        'catalog_key', tracker.catalog_key,
        'catalog_name', case when tracker.catalog_key = 'home' then 'Pokémon HOME National Dex' else game.display_name end,
        'pokemon_id', target.pokemon_id, 'pokemon', catalog.pokemon_name,
        'dex_number', catalog.dex_number, 'form_label', target.form_label,
        'is_shiny', target.is_shiny, 'wants_alpha', target.wants_alpha,
        'marks', target.mark_keys, 'notes', target.notes, 'updated_at', target.updated_at
      ) order by target.updated_at desc)
      from public.pokedex_tracker_wanted_entries target
      join public.pokedex_trackers tracker on tracker.id = target.tracker_id
        and tracker.user_id = auth.uid() and target.user_id = auth.uid()
      left join public.pokemon_games game on game.game_key = tracker.catalog_key
      join lateral (
        select entry.* from public.pokedex_tracker_catalog(tracker.catalog_key) entry
        where entry.pokemon_id = target.pokemon_id order by entry.sort_order limit 1
      ) catalog on true
    ), '[]'::jsonb)
  );
$$;

alter function public.export_my_pokedex_trackers() rename to export_my_pokedex_trackers_v4;
revoke all on function public.export_my_pokedex_trackers_v4() from public, anon, authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers_v4() to service_role;

create function public.export_my_pokedex_trackers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_export jsonb;
  v_trackers jsonb := '[]'::jsonb;
  v_tracker jsonb;
  v_tracker_id uuid;
  v_entries jsonb;
  v_details jsonb;
  v_specimens jsonb;
  v_wanted jsonb;
begin
  v_export := public.export_my_pokedex_trackers_v4();
  for v_tracker in select value from jsonb_array_elements(v_export -> 'trackers') loop
    v_tracker_id := (v_tracker ->> 'id')::uuid;
    select coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', progress.pokemon_id, 'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number, 'is_shiny', progress.is_shiny,
      'is_alpha', progress.is_alpha, 'caught_at', progress.caught_at
    ) order by catalog.sort_order, progress.is_alpha, progress.is_shiny), '[]'::jsonb)
    into v_entries
    from (
      select entry.pokemon_id, entry.is_shiny, false as is_alpha, entry.caught_at
      from public.pokedex_tracker_entries entry
      where entry.tracker_id = v_tracker_id and entry.user_id = auth.uid()
      union all
      select alpha.pokemon_id, false, true, alpha.caught_at
      from public.pokedex_tracker_alpha_entries alpha
      where alpha.tracker_id = v_tracker_id and alpha.user_id = auth.uid()
    ) progress
    join lateral (
      select entry.* from public.pokedex_tracker_catalog(v_tracker ->> 'catalog_key') entry
      where entry.pokemon_id = progress.pokemon_id order by entry.sort_order limit 1
    ) catalog on true;

    select coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', detail.pokemon_id, 'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number, 'is_shiny', detail.is_shiny,
      'pokeball', coalesce(detail.pokeball_key, ''), 'ribbons', detail.ribbon_keys,
      'marks', detail.mark_keys, 'notes', detail.notes, 'updated_at', detail.updated_at
    ) order by catalog.sort_order, detail.is_shiny), '[]'::jsonb)
    into v_details
    from public.pokedex_tracker_entry_details detail
    join public.pokedex_trackers tracker on tracker.id = detail.tracker_id
    join lateral (
      select entry.* from public.pokedex_tracker_catalog(tracker.catalog_key) entry
      where entry.pokemon_id = detail.pokemon_id order by entry.sort_order limit 1
    ) catalog on true
    where detail.tracker_id = v_tracker_id and detail.user_id = auth.uid();

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', specimen.id, 'pokemon_id', specimen.pokemon_id, 'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number, 'form_label', specimen.form_label,
      'nickname', specimen.nickname, 'is_shiny', specimen.is_shiny, 'is_alpha', specimen.is_alpha,
      'gender', specimen.gender, 'level', specimen.level, 'original_trainer', specimen.original_trainer,
      'origin_game', specimen.origin_game, 'origin_mark', specimen.origin_mark,
      'location_id', specimen.location_id, 'box_label', specimen.box_label,
      'box_position', specimen.box_position, 'pokeball', coalesce(specimen.pokeball_key, ''),
      'ribbons', specimen.ribbon_keys, 'marks', specimen.mark_keys,
      'is_event', specimen.is_event, 'importance', specimen.importance,
      'intended_destination', specimen.intended_destination,
      'transfer_state', specimen.transfer_state, 'transferred_on', specimen.transferred_on,
      'notes', specimen.notes, 'created_at', specimen.created_at, 'updated_at', specimen.updated_at
    ) order by specimen.updated_at desc, specimen.id), '[]'::jsonb)
    into v_specimens
    from public.pokedex_collection_specimens specimen
    join public.pokedex_trackers tracker on tracker.id = specimen.tracker_id
    join lateral (
      select entry.* from public.pokedex_tracker_catalog(tracker.catalog_key) entry
      where entry.pokemon_id = specimen.pokemon_id order by entry.sort_order limit 1
    ) catalog on true
    where specimen.tracker_id = v_tracker_id and specimen.user_id = auth.uid();

    select coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', target.pokemon_id, 'is_shiny', target.is_shiny,
      'form_label', target.form_label, 'marks', target.mark_keys,
      'wants_alpha', target.wants_alpha, 'notes', target.notes, 'updated_at', target.updated_at
    ) order by target.updated_at desc), '[]'::jsonb)
    into v_wanted from public.pokedex_tracker_wanted_entries target
    where target.tracker_id = v_tracker_id and target.user_id = auth.uid();

    v_trackers := v_trackers || jsonb_build_array(v_tracker || jsonb_build_object(
      'total', (select count(distinct catalog.pokemon_id) from public.pokedex_tracker_catalog(v_tracker ->> 'catalog_key') catalog),
      'entries', v_entries, 'details', v_details, 'specimens', v_specimens, 'wanted', v_wanted
    ));
  end loop;
  return v_export || jsonb_build_object('version', 5, 'trackers', v_trackers);
end;
$$;

alter function public.restore_my_pokedex_trackers(jsonb) rename to restore_my_pokedex_trackers_v4;
revoke all on function public.restore_my_pokedex_trackers_v4(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.restore_my_pokedex_trackers_v4(jsonb) to service_role;

create function public.restore_my_pokedex_trackers(p_trackers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_tracker jsonb;
  v_detail jsonb;
  v_target jsonb;
  v_destination uuid;
  v_index integer := 0;
begin
  if p_trackers is null or jsonb_typeof(p_trackers) <> 'array' then
    raise exception 'Restore a list of Pokédex trackers.' using errcode = '22023';
  end if;
  v_result := public.restore_my_pokedex_trackers_v4(p_trackers);
  for v_tracker in select value from jsonb_array_elements(p_trackers) loop
    v_destination := (v_result -> 'tracker_ids' ->> v_index)::uuid;
    for v_detail in select value from jsonb_array_elements(coalesce(v_tracker -> 'details', '[]'::jsonb)) loop
      perform public.set_my_pokedex_tracker_entry_details_v2(
        v_destination, (v_detail ->> 'pokemon_id')::integer,
        coalesce((v_detail ->> 'is_shiny')::boolean, false),
        jsonb_build_object(
          'pokeball', coalesce(v_detail ->> 'pokeball', ''),
          'ribbons', coalesce(v_detail -> 'ribbons', '[]'::jsonb),
          'marks', coalesce(v_detail -> 'marks', '[]'::jsonb),
          'notes', coalesce(v_detail ->> 'notes', '')
        )
      );
    end loop;
    for v_target in select value from jsonb_array_elements(coalesce(v_tracker -> 'wanted', '[]'::jsonb)) loop
      perform public.set_my_pokedex_tracker_wanted_entry(
        v_destination, (v_target ->> 'pokemon_id')::integer,
        coalesce((v_target ->> 'is_shiny')::boolean, false), true,
        jsonb_build_object(
          'form_label', coalesce(v_target ->> 'form_label', ''),
          'marks', coalesce(v_target -> 'marks', '[]'::jsonb),
          'wants_alpha', coalesce((v_target ->> 'wants_alpha')::boolean, false),
          'notes', coalesce(v_target ->> 'notes', '')
        )
      );
    end loop;
    v_index := v_index + 1;
  end loop;
  return v_result || jsonb_build_object('version', 5);
end;
$$;

revoke all on function public.pokedex_tracker_catalog(text) from public, anon, authenticated, service_role;
revoke all on function public.get_my_pokedex_trackers() from public, anon, authenticated, service_role;
revoke all on function public.get_my_pokedex_tracker(uuid) from public, anon, authenticated, service_role;
revoke all on function public.set_my_pokedex_tracker_entry_details_v2(uuid,integer,boolean,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.set_my_pokedex_tracker_wanted_entry(uuid,integer,boolean,boolean,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.save_my_pokedex_collection_specimen(uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_pokedex_collection_inventory(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_pokedex_collection_index()
  from public, anon, authenticated, service_role;
revoke all on function public.export_my_pokedex_trackers() from public, anon, authenticated, service_role;
revoke all on function public.restore_my_pokedex_trackers(jsonb) from public, anon, authenticated, service_role;

grant execute on function public.pokedex_tracker_catalog(text) to service_role;
grant execute on function public.get_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.get_my_pokedex_tracker(uuid) to authenticated, service_role;
grant execute on function public.set_my_pokedex_tracker_entry_details_v2(uuid,integer,boolean,jsonb)
  to authenticated, service_role;
grant execute on function public.set_my_pokedex_tracker_wanted_entry(uuid,integer,boolean,boolean,jsonb)
  to authenticated, service_role;
grant execute on function public.save_my_pokedex_collection_specimen(uuid,uuid,jsonb)
  to authenticated, service_role;
grant execute on function public.get_my_pokedex_collection_inventory(uuid)
  to authenticated, service_role;
grant execute on function public.get_my_pokedex_collection_index()
  to authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.restore_my_pokedex_trackers(jsonb) to authenticated, service_role;

do $$
begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key = 'pokemon-go') <> 954
     or (select count(*) from public.pokedex_tracker_catalog('pokemon-go')) <> 954 then
    raise exception 'Pokémon GO tracker must expose exactly 954 reviewed species';
  end if;
  if (select count(*) from public.pokedex_tracker_catalog('firered')) <= 151
     or not exists (
       select 1 from public.pokedex_tracker_catalog('firered')
       where pokedex_key = 'obtainable' and pokemon_name = 'Sentret'
     )
     or not exists (
       select 1 from public.pokedex_tracker_catalog('brilliant-diamond')
       where pokedex_key = 'obtainable'
     ) then
    raise exception 'Verified postgame encounters must supplement numbered game Pokédexes';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class
          where oid = 'public.pokedex_tracker_wanted_entries'::regclass)
     or exists (
       select 1 from pg_policies where schemaname = 'public'
         and tablename = 'pokedex_tracker_wanted_entries'
     )
     or has_table_privilege('authenticated', 'public.pokedex_tracker_wanted_entries', 'SELECT') then
    raise exception 'Private hunt targets must keep forced RLS and no direct browser access';
  end if;
  if has_function_privilege('anon', 'public.get_my_pokedex_collection_index()', 'EXECUTE')
     or has_function_privilege('anon', 'public.set_my_pokedex_tracker_wanted_entry(uuid,integer,boolean,boolean,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_collection_index()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.set_my_pokedex_tracker_wanted_entry(uuid,integer,boolean,boolean,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_tracker_mark_key_is_known(text)', 'EXECUTE') then
    raise exception 'Pokédex search, wanted, and validation function grants are incorrect';
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
