-- Migration 391: private, account-owned Pokédex progress for verified game catalogs and
-- Pokémon HOME. Standard and shiny progress are stored independently.

begin;

create table public.pokedex_trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_key text not null check (catalog_key ~ '^[a-z0-9-]{1,64}$'),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  include_shiny boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.pokedex_tracker_entries (
  tracker_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  is_shiny boolean not null default false,
  caught_at timestamptz not null default now(),
  primary key (tracker_id, pokemon_id, is_shiny),
  foreign key (tracker_id, user_id)
    references public.pokedex_trackers(id, user_id) on delete cascade
);

create index pokedex_trackers_user_updated_idx
  on public.pokedex_trackers(user_id, updated_at desc);
create index pokedex_tracker_entries_user_tracker_idx
  on public.pokedex_tracker_entries(user_id, tracker_id);

alter table public.pokedex_trackers enable row level security;
alter table public.pokedex_tracker_entries enable row level security;

comment on table public.pokedex_trackers is
  'Private account-owned Pokédex tracker definitions. Browser table access is denied; authenticated RPCs enforce ownership.';
comment on table public.pokedex_tracker_entries is
  'Private caught and shiny-caught flags for account-owned Pokédex trackers.';

revoke all on table public.pokedex_trackers from public, anon, authenticated;
revoke all on table public.pokedex_tracker_entries from public, anon, authenticated;
grant all on table public.pokedex_trackers to service_role;
grant all on table public.pokedex_tracker_entries to service_role;

-- One canonical row per species. Game catalogs retain their reviewed import
-- order; HOME is the National Pokédex assembled from all verified catalogs.
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
    select
      entry.pokemon_id,
      entry.pokemon_name,
      entry.entry_number,
      entry.pokedex_key,
      entry.id,
      row_number() over (
        partition by entry.pokemon_id
        order by
          case when nullif(entry.form_name, '') is null then 0 else 1 end,
          entry.id
      ) as species_row
    from public.pokemon_game_pokedex_entries entry
    join public.pokemon_games game on game.game_key = entry.game_key
    where game.encounter_status = 'verified'
      and (
        (p_catalog_key = 'home' and entry.pokemon_id < 10000)
        or entry.game_key = p_catalog_key
      )
  )
  select
    available.pokemon_id,
    available.pokemon_name,
    case when p_catalog_key = 'home' then available.pokemon_id else available.entry_number end,
    case when p_catalog_key = 'home' then 'national' else available.pokedex_key end,
    case when p_catalog_key = 'home' then available.pokemon_id::bigint else available.id end
  from available
  where available.species_row = 1
  order by 5, 2;
$$;

create or replace function public.get_my_pokedex_trackers()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with game_catalogs as (
    select
      game.game_key as catalog_key,
      game.display_name,
      game.generation,
      game.family,
      game.release_order,
      count(distinct entry.pokemon_id)::integer as total
    from public.pokemon_games game
    join public.pokemon_game_pokedex_entries entry on entry.game_key = game.game_key
    where game.encounter_status = 'verified'
    group by game.game_key, game.display_name, game.generation, game.family, game.release_order
  ),
  catalogs as (
    select
      'home'::text as catalog_key,
      'Pokémon HOME National Dex'::text as display_name,
      10::smallint as generation,
      'Pokémon HOME'::text as family,
      0 as release_order,
      count(distinct entry.pokemon_id)::integer as total
    from public.pokemon_game_pokedex_entries entry
    join public.pokemon_games game on game.game_key = entry.game_key
    where game.encounter_status = 'verified' and entry.pokemon_id < 10000
    union all
    select catalog_key, display_name, generation, family, release_order, total from game_catalogs
  ),
  progress as (
    select
      entry.tracker_id,
      count(*) filter (where not entry.is_shiny)::integer as caught,
      count(*) filter (where entry.is_shiny)::integer as shiny_caught
    from public.pokedex_tracker_entries entry
    where entry.user_id = auth.uid()
    group by entry.tracker_id
  )
  select jsonb_build_object(
    'catalogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', catalog.catalog_key,
        'name', catalog.display_name,
        'generation', catalog.generation,
        'family', catalog.family,
        'total', catalog.total
      ) order by catalog.release_order, catalog.display_name)
      from catalogs catalog
    ), '[]'::jsonb),
    'trackers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tracker.id,
        'title', tracker.title,
        'catalog_key', tracker.catalog_key,
        'catalog_name', catalog.display_name,
        'include_shiny', tracker.include_shiny,
        'total', catalog.total,
        'caught', coalesce(progress.caught, 0),
        'shiny_caught', coalesce(progress.shiny_caught, 0),
        'created_at', tracker.created_at,
        'updated_at', tracker.updated_at
      ) order by tracker.updated_at desc)
      from public.pokedex_trackers tracker
      join catalogs catalog on catalog.catalog_key = tracker.catalog_key
      left join progress on progress.tracker_id = tracker.id
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

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();

  if not found then
    return null;
  end if;

  select case
    when v_tracker.catalog_key = 'home' then 'Pokémon HOME National Dex'
    else game.display_name
  end into v_catalog_name
  from (select 1) seed
  left join public.pokemon_games game on game.game_key = v_tracker.catalog_key;

  select jsonb_build_object(
    'tracker', jsonb_build_object(
      'id', v_tracker.id,
      'title', v_tracker.title,
      'catalog_key', v_tracker.catalog_key,
      'catalog_name', v_catalog_name,
      'include_shiny', v_tracker.include_shiny,
      'created_at', v_tracker.created_at,
      'updated_at', v_tracker.updated_at
    ),
    'pokemon', coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', catalog.pokemon_id,
      'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number,
      'pokedex_key', catalog.pokedex_key,
      'caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        where progress.tracker_id = v_tracker.id
          and progress.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id
          and not progress.is_shiny
      ),
      'shiny_caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        where progress.tracker_id = v_tracker.id
          and progress.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id
          and progress.is_shiny
      )
    ) order by catalog.sort_order, catalog.pokemon_name), '[]'::jsonb)
  ) into v_result
  from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog;

  return v_result;
end;
$$;

create or replace function public.create_my_pokedex_tracker(
  p_catalog_key text,
  p_title text default null,
  p_include_shiny boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_catalog_name text;
  v_title text;
  v_tracker public.pokedex_trackers%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sign in to create a Pokédex tracker.' using errcode = '42501';
  end if;

  if p_catalog_key = 'home' then
    v_catalog_name := 'Pokémon HOME National Dex';
  else
    select display_name into v_catalog_name
    from public.pokemon_games
    where game_key = p_catalog_key and encounter_status = 'verified';
  end if;

  if v_catalog_name is null then
    raise exception 'Choose a verified game or Pokémon HOME catalog.' using errcode = '22023';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), v_catalog_name);
  if char_length(v_title) > 80 then
    raise exception 'Tracker names must be 80 characters or fewer.' using errcode = '22023';
  end if;

  insert into public.pokedex_trackers(user_id, catalog_key, title, include_shiny)
  values(v_user_id, p_catalog_key, v_title, coalesce(p_include_shiny, false))
  returning * into v_tracker;

  return jsonb_build_object('id', v_tracker.id, 'title', v_tracker.title);
end;
$$;

create or replace function public.update_my_pokedex_tracker(
  p_tracker_id uuid,
  p_title text,
  p_include_shiny boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text := nullif(btrim(p_title), '');
  v_tracker public.pokedex_trackers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update a Pokédex tracker.' using errcode = '42501';
  end if;
  if v_title is null or char_length(v_title) > 80 then
    raise exception 'Tracker names must be between 1 and 80 characters.' using errcode = '22023';
  end if;

  update public.pokedex_trackers
  set title = v_title,
      include_shiny = include_shiny or coalesce(p_include_shiny, false),
      updated_at = now()
  where id = p_tracker_id and user_id = auth.uid()
  returning * into v_tracker;

  if not found then
    raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', v_tracker.id, 'title', v_tracker.title, 'include_shiny', v_tracker.include_shiny);
end;
$$;

create or replace function public.set_my_pokedex_tracker_entry(
  p_tracker_id uuid,
  p_pokemon_id integer,
  p_is_shiny boolean,
  p_caught boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_caught integer;
  v_shiny_caught integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save Pokédex progress.' using errcode = '42501';
  end if;

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002';
  end if;
  if coalesce(p_is_shiny, false) and not v_tracker.include_shiny then
    raise exception 'Enable the shiny dex before saving shiny progress.' using errcode = '22023';
  end if;
  if not exists(
    select 1 from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
    where catalog.pokemon_id = p_pokemon_id
  ) then
    raise exception 'That Pokémon is not part of this Pokédex.' using errcode = '22023';
  end if;

  if coalesce(p_caught, false) then
    insert into public.pokedex_tracker_entries(tracker_id, user_id, pokemon_id, is_shiny)
    values(v_tracker.id, auth.uid(), p_pokemon_id, coalesce(p_is_shiny, false))
    on conflict(tracker_id, pokemon_id, is_shiny) do nothing;
  else
    delete from public.pokedex_tracker_entries
    where tracker_id = v_tracker.id
      and user_id = auth.uid()
      and pokemon_id = p_pokemon_id
      and is_shiny = coalesce(p_is_shiny, false);
  end if;

  update public.pokedex_trackers
  set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();

  select
    count(*) filter (where not is_shiny)::integer,
    count(*) filter (where is_shiny)::integer
  into v_caught, v_shiny_caught
  from public.pokedex_tracker_entries
  where tracker_id = v_tracker.id and user_id = auth.uid();

  return jsonb_build_object('caught', v_caught, 'shiny_caught', v_shiny_caught);
end;
$$;

create or replace function public.delete_my_pokedex_tracker(p_tracker_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  with deleted as (
    delete from public.pokedex_trackers
    where id = p_tracker_id and user_id = auth.uid()
    returning id
  )
  select exists(select 1 from deleted);
$$;

create or replace function public.export_my_pokedex_trackers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_trackers jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to export Pokédex trackers.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tracker.id,
    'catalog_key', tracker.catalog_key,
    'title', tracker.title,
    'include_shiny', tracker.include_shiny,
    'created_at', tracker.created_at,
    'updated_at', tracker.updated_at,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pokemon_id', entry.pokemon_id,
        'is_shiny', entry.is_shiny,
        'caught_at', entry.caught_at
      ) order by entry.pokemon_id, entry.is_shiny)
      from public.pokedex_tracker_entries entry
      where entry.tracker_id = tracker.id
        and entry.user_id = auth.uid()
    ), '[]'::jsonb)
  ) order by tracker.updated_at desc), '[]'::jsonb)
  into v_trackers
  from public.pokedex_trackers tracker
  where tracker.user_id = auth.uid();

  return jsonb_build_object('trackers', v_trackers);
end;
$$;

revoke all on function public.pokedex_tracker_catalog(text) from public, anon, authenticated;
revoke all on function public.get_my_pokedex_trackers() from public, anon, authenticated;
revoke all on function public.get_my_pokedex_tracker(uuid) from public, anon, authenticated;
revoke all on function public.create_my_pokedex_tracker(text, text, boolean) from public, anon, authenticated;
revoke all on function public.update_my_pokedex_tracker(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.set_my_pokedex_tracker_entry(uuid, integer, boolean, boolean) from public, anon, authenticated;
revoke all on function public.delete_my_pokedex_tracker(uuid) from public, anon, authenticated;
revoke all on function public.export_my_pokedex_trackers() from public, anon, authenticated;

grant execute on function public.get_my_pokedex_trackers() to authenticated;
grant execute on function public.get_my_pokedex_tracker(uuid) to authenticated;
grant execute on function public.create_my_pokedex_tracker(text, text, boolean) to authenticated;
grant execute on function public.update_my_pokedex_tracker(uuid, text, boolean) to authenticated;
grant execute on function public.set_my_pokedex_tracker_entry(uuid, integer, boolean, boolean) to authenticated;
grant execute on function public.delete_my_pokedex_tracker(uuid) to authenticated;
grant execute on function public.export_my_pokedex_trackers() to authenticated;

grant execute on function public.get_my_pokedex_trackers() to service_role;
grant execute on function public.get_my_pokedex_tracker(uuid) to service_role;
grant execute on function public.create_my_pokedex_tracker(text, text, boolean) to service_role;
grant execute on function public.update_my_pokedex_tracker(uuid, text, boolean) to service_role;
grant execute on function public.set_my_pokedex_tracker_entry(uuid, integer, boolean, boolean) to service_role;
grant execute on function public.delete_my_pokedex_tracker(uuid) to service_role;
grant execute on function public.export_my_pokedex_trackers() to service_role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pokedex_trackers'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.pokedex_tracker_entries'::regclass) then
    raise exception 'Pokédex tracker RLS must be enabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('pokedex_trackers', 'pokedex_tracker_entries')
  ) then
    raise exception 'Pokédex tracker tables must not expose direct client policies';
  end if;

  if has_table_privilege('anon', 'public.pokedex_trackers', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_trackers', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_trackers', 'INSERT')
     or has_table_privilege('authenticated', 'public.pokedex_trackers', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pokedex_trackers', 'DELETE')
     or has_table_privilege('anon', 'public.pokedex_tracker_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entries', 'INSERT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entries', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entries', 'DELETE') then
    raise exception 'Pokédex tracker tables must remain inaccessible to browser roles';
  end if;

  if has_function_privilege('anon', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_pokedex_tracker(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_my_pokedex_tracker(text,text,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_my_pokedex_tracker(uuid,text,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.set_my_pokedex_tracker_entry(uuid,integer,boolean,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.delete_my_pokedex_tracker(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.export_my_pokedex_trackers()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_tracker(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_my_pokedex_tracker(text,text,boolean)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_my_pokedex_tracker(uuid,text,boolean)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.set_my_pokedex_tracker_entry(uuid,integer,boolean,boolean)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.delete_my_pokedex_tracker(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.export_my_pokedex_trackers()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_tracker_catalog(text)', 'EXECUTE') then
    raise exception 'Pokédex tracker function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
