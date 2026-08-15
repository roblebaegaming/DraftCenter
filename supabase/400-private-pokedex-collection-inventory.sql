-- Migration 400: private storage locations and individual Pokemon records for
-- account-owned Pokedex trackers. This is the inventory foundation for future
-- Bank Rescue planning; it does not infer forms or transfer availability.

begin;

create table public.pokedex_collection_locations (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  location_kind text not null check (
    location_kind in ('game_save', 'pokemon_bank', 'pokemon_home', 'cartridge', 'other')
  ),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  platform text not null default '' check (char_length(platform) <= 80),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tracker_id, user_id),
  foreign key (tracker_id, user_id)
    references public.pokedex_trackers(id, user_id) on delete cascade
);

create index pokedex_collection_locations_user_tracker_idx
  on public.pokedex_collection_locations(user_id, tracker_id, updated_at desc);

create table public.pokedex_collection_specimens (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  form_label text not null default '' check (char_length(form_label) <= 80),
  nickname text not null default '' check (char_length(nickname) <= 50),
  is_shiny boolean not null default false,
  gender text not null default 'unknown'
    check (gender in ('unknown', 'male', 'female', 'genderless')),
  level smallint check (level between 1 and 100),
  original_trainer text not null default '' check (char_length(original_trainer) <= 50),
  origin_game text not null default '' check (char_length(origin_game) <= 80),
  origin_mark text not null default '' check (char_length(origin_mark) <= 80),
  location_id uuid,
  box_label text not null default '' check (char_length(box_label) <= 80),
  box_position smallint check (box_position between 1 and 30),
  pokeball_key text check (pokeball_key is null or pokeball_key ~ '^[a-z0-9-]{1,40}$'),
  ribbon_keys text[] not null default '{}',
  is_event boolean not null default false,
  importance text not null default 'standard'
    check (importance in ('standard', 'important', 'irreplaceable')),
  intended_destination text not null default '' check (char_length(intended_destination) <= 120),
  transfer_state text not null default 'not_planned'
    check (transfer_state in ('not_planned', 'planned', 'ready', 'transferred', 'keep_original')),
  transferred_on date,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tracker_id, user_id)
    references public.pokedex_trackers(id, user_id) on delete cascade,
  foreign key (location_id, tracker_id, user_id)
    references public.pokedex_collection_locations(id, tracker_id, user_id),
  constraint pokedex_collection_specimens_ribbon_count_check
    check (cardinality(ribbon_keys) <= 100),
  constraint pokedex_collection_specimens_ribbon_shape_check
    check (array_position(ribbon_keys, null) is null),
  constraint pokedex_collection_specimens_transfer_date_check
    check (transfer_state = 'transferred' or transferred_on is null)
);

create index pokedex_collection_specimens_user_tracker_idx
  on public.pokedex_collection_specimens(user_id, tracker_id, updated_at desc);
create index pokedex_collection_specimens_tracker_pokemon_idx
  on public.pokedex_collection_specimens(tracker_id, pokemon_id);
create index pokedex_collection_specimens_location_idx
  on public.pokedex_collection_specimens(location_id)
  where location_id is not null;

alter table public.pokedex_collection_locations enable row level security;
alter table public.pokedex_collection_locations force row level security;
alter table public.pokedex_collection_specimens enable row level security;
alter table public.pokedex_collection_specimens force row level security;

revoke all on table public.pokedex_collection_locations from public, anon, authenticated;
revoke all on table public.pokedex_collection_specimens from public, anon, authenticated;
grant all on table public.pokedex_collection_locations to service_role;
grant all on table public.pokedex_collection_specimens to service_role;

comment on table public.pokedex_collection_locations is
  'Private named game-save, Pokemon Bank, Pokemon HOME, cartridge, or other storage locations. Browser table access is denied.';
comment on table public.pokedex_collection_specimens is
  'Private records for actual individual Pokemon and their current storage location. Browser table access is denied.';
comment on column public.pokedex_collection_specimens.form_label is
  'Owner-entered form description only. It is not an inferred or availability-reviewed form catalog.';

create or replace function public.pokedex_collection_location_kind_is_known(p_kind text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_kind = any(array[
    'game_save', 'pokemon_bank', 'pokemon_home', 'cartridge', 'other'
  ]::text[]);
$$;

create or replace function public.pokedex_collection_gender_is_known(p_gender text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_gender = any(array['unknown', 'male', 'female', 'genderless']::text[]);
$$;

create or replace function public.pokedex_collection_importance_is_known(p_importance text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_importance = any(array['standard', 'important', 'irreplaceable']::text[]);
$$;

create or replace function public.pokedex_collection_transfer_state_is_known(p_state text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_state = any(array[
    'not_planned', 'planned', 'ready', 'transferred', 'keep_original'
  ]::text[]);
$$;

revoke all on function public.pokedex_collection_location_kind_is_known(text)
  from public, anon, authenticated;
revoke all on function public.pokedex_collection_gender_is_known(text)
  from public, anon, authenticated;
revoke all on function public.pokedex_collection_importance_is_known(text)
  from public, anon, authenticated;
revoke all on function public.pokedex_collection_transfer_state_is_known(text)
  from public, anon, authenticated;

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

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', location.id,
    'kind', location.location_kind,
    'name', location.name,
    'platform', location.platform,
    'notes', location.notes,
    'created_at', location.created_at,
    'updated_at', location.updated_at,
    'specimen_count', (
      select count(*)::integer
      from public.pokedex_collection_specimens specimen
      where specimen.location_id = location.id
        and specimen.tracker_id = v_tracker.id
        and specimen.user_id = auth.uid()
    )
  ) order by location.name, location.created_at), '[]'::jsonb)
  into v_locations
  from public.pokedex_collection_locations location
  where location.tracker_id = v_tracker.id
    and location.user_id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', specimen.id,
    'pokemon_id', specimen.pokemon_id,
    'pokemon', catalog.pokemon_name,
    'dex_number', catalog.dex_number,
    'form_label', specimen.form_label,
    'nickname', specimen.nickname,
    'is_shiny', specimen.is_shiny,
    'gender', specimen.gender,
    'level', specimen.level,
    'original_trainer', specimen.original_trainer,
    'origin_game', specimen.origin_game,
    'origin_mark', specimen.origin_mark,
    'location_id', specimen.location_id,
    'location_name', coalesce(location.name, ''),
    'location_kind', coalesce(location.location_kind, ''),
    'box_label', specimen.box_label,
    'box_position', specimen.box_position,
    'pokeball', coalesce(specimen.pokeball_key, ''),
    'ribbons', specimen.ribbon_keys,
    'is_event', specimen.is_event,
    'importance', specimen.importance,
    'intended_destination', specimen.intended_destination,
    'transfer_state', specimen.transfer_state,
    'transferred_on', specimen.transferred_on,
    'notes', specimen.notes,
    'created_at', specimen.created_at,
    'updated_at', specimen.updated_at
  ) order by specimen.updated_at desc, catalog.sort_order, specimen.id), '[]'::jsonb)
  into v_specimens
  from public.pokedex_collection_specimens specimen
  join public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
    on catalog.pokemon_id = specimen.pokemon_id
  left join public.pokedex_collection_locations location
    on location.id = specimen.location_id
   and location.tracker_id = specimen.tracker_id
   and location.user_id = specimen.user_id
  where specimen.tracker_id = v_tracker.id
    and specimen.user_id = auth.uid();

  return jsonb_build_object(
    'tracker_id', v_tracker.id,
    'locations', v_locations,
    'specimens', v_specimens
  );
end;
$$;

create or replace function public.save_my_pokedex_collection_location(
  p_tracker_id uuid,
  p_location_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_location public.pokedex_collection_locations%rowtype;
  v_kind text := lower(btrim(coalesce(p_payload ->> 'kind', '')));
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_platform text := btrim(coalesce(p_payload ->> 'platform', ''));
  v_notes text := coalesce(p_payload ->> 'notes', '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a collection location.' using errcode = '42501';
  end if;

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'That Pokedex tracker was not found.' using errcode = 'P0002';
  end if;
  if not public.pokedex_collection_location_kind_is_known(v_kind) then
    raise exception 'Choose a supported collection location type.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'Location names must be between 1 and 80 characters.' using errcode = '22023';
  end if;
  if char_length(v_platform) > 80 or char_length(v_notes) > 500 then
    raise exception 'That collection location is too long.' using errcode = '22023';
  end if;

  if p_location_id is null then
    insert into public.pokedex_collection_locations(
      tracker_id, user_id, location_kind, name, platform, notes
    ) values (
      v_tracker.id, auth.uid(), v_kind, v_name, v_platform, v_notes
    ) returning * into v_location;
  else
    update public.pokedex_collection_locations
    set location_kind = v_kind,
        name = v_name,
        platform = v_platform,
        notes = v_notes,
        updated_at = now()
    where id = p_location_id
      and tracker_id = v_tracker.id
      and user_id = auth.uid()
    returning * into v_location;

    if not found then
      raise exception 'That collection location was not found.' using errcode = 'P0002';
    end if;
  end if;

  update public.pokedex_trackers
  set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();

  return jsonb_build_object(
    'id', v_location.id,
    'kind', v_location.location_kind,
    'name', v_location.name,
    'platform', v_location.platform,
    'notes', v_location.notes,
    'created_at', v_location.created_at,
    'updated_at', v_location.updated_at,
    'specimen_count', (
      select count(*)::integer
      from public.pokedex_collection_specimens specimen
      where specimen.location_id = v_location.id
        and specimen.tracker_id = v_tracker.id
        and specimen.user_id = auth.uid()
    )
  );
end;
$$;

create or replace function public.delete_my_pokedex_collection_location(
  p_tracker_id uuid,
  p_location_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete a collection location.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pokedex_trackers
    where id = p_tracker_id and user_id = auth.uid()
  ) then
    raise exception 'That Pokedex tracker was not found.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.pokedex_collection_specimens
    where tracker_id = p_tracker_id
      and user_id = auth.uid()
      and location_id = p_location_id
  ) then
    raise exception 'Move or delete the Pokemon stored here before deleting this location.'
      using errcode = '23503';
  end if;

  delete from public.pokedex_collection_locations
  where id = p_location_id
    and tracker_id = p_tracker_id
    and user_id = auth.uid();
  return found;
end;
$$;

create or replace function public.save_my_pokedex_collection_specimen(
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
  v_tracker public.pokedex_trackers%rowtype;
  v_specimen public.pokedex_collection_specimens%rowtype;
  v_pokemon_id integer;
  v_form_label text := btrim(coalesce(p_payload ->> 'form_label', ''));
  v_nickname text := btrim(coalesce(p_payload ->> 'nickname', ''));
  v_is_shiny boolean := lower(coalesce(p_payload ->> 'is_shiny', 'false')) = 'true';
  v_gender text := lower(btrim(coalesce(p_payload ->> 'gender', 'unknown')));
  v_level smallint;
  v_original_trainer text := btrim(coalesce(p_payload ->> 'original_trainer', ''));
  v_origin_game text := btrim(coalesce(p_payload ->> 'origin_game', ''));
  v_origin_mark text := btrim(coalesce(p_payload ->> 'origin_mark', ''));
  v_location_id uuid;
  v_box_label text := btrim(coalesce(p_payload ->> 'box_label', ''));
  v_box_position smallint;
  v_pokeball_key text := nullif(lower(btrim(coalesce(p_payload ->> 'pokeball', ''))), '');
  v_ribbon_keys text[];
  v_is_event boolean := lower(coalesce(p_payload ->> 'is_event', 'false')) = 'true';
  v_importance text := lower(btrim(coalesce(p_payload ->> 'importance', 'standard')));
  v_destination text := btrim(coalesce(p_payload ->> 'intended_destination', ''));
  v_transfer_state text := lower(btrim(coalesce(p_payload ->> 'transfer_state', 'not_planned')));
  v_transferred_on date;
  v_notes text := coalesce(p_payload ->> 'notes', '');
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save an individual Pokemon.' using errcode = '42501';
  end if;

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'That Pokedex tracker was not found.' using errcode = 'P0002';
  end if;

  begin
    v_pokemon_id := nullif(p_payload ->> 'pokemon_id', '')::integer;
    v_level := nullif(p_payload ->> 'level', '')::smallint;
    v_location_id := nullif(p_payload ->> 'location_id', '')::uuid;
    v_box_position := nullif(p_payload ->> 'box_position', '')::smallint;
    v_transferred_on := nullif(p_payload ->> 'transferred_on', '')::date;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Choose valid Pokemon, level, location, box position, and transfer date values.'
      using errcode = '22023';
  end;

  if v_pokemon_id is null or not exists (
    select 1 from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
    where catalog.pokemon_id = v_pokemon_id
  ) then
    raise exception 'That Pokemon is not part of this Pokedex.' using errcode = '22023';
  end if;
  if v_level is not null and v_level not between 1 and 100 then
    raise exception 'Pokemon levels must be between 1 and 100.' using errcode = '22023';
  end if;
  if v_box_position is not null and v_box_position not between 1 and 30 then
    raise exception 'Box positions must be between 1 and 30.' using errcode = '22023';
  end if;
  if not public.pokedex_collection_gender_is_known(v_gender)
     or not public.pokedex_collection_importance_is_known(v_importance)
     or not public.pokedex_collection_transfer_state_is_known(v_transfer_state) then
    raise exception 'Choose supported collection record values.' using errcode = '22023';
  end if;
  if char_length(v_form_label) > 80
     or char_length(v_nickname) > 50
     or char_length(v_original_trainer) > 50
     or char_length(v_origin_game) > 80
     or char_length(v_origin_mark) > 80
     or char_length(v_box_label) > 80
     or char_length(v_destination) > 120
     or char_length(v_notes) > 1000 then
    raise exception 'One or more individual Pokemon fields are too long.' using errcode = '22023';
  end if;
  if v_location_id is not null and not exists (
    select 1 from public.pokedex_collection_locations location
    where location.id = v_location_id
      and location.tracker_id = v_tracker.id
      and location.user_id = auth.uid()
  ) then
    raise exception 'Choose a storage location from this tracker.' using errcode = '22023';
  end if;
  if v_pokeball_key is not null
     and not public.pokedex_tracker_detail_key_is_known('pokeball', v_pokeball_key) then
    raise exception 'Choose a supported Poke Ball.' using errcode = '22023';
  end if;
  if p_payload ? 'ribbons' and jsonb_typeof(p_payload -> 'ribbons') <> 'array' then
    raise exception 'Ribbons must be a list.' using errcode = '22023';
  end if;

  select coalesce(array_agg(key order by key), '{}'::text[])
  into v_ribbon_keys
  from (
    select distinct lower(btrim(raw_key)) as key
    from jsonb_array_elements_text(coalesce(p_payload -> 'ribbons', '[]'::jsonb)) raw(raw_key)
    where nullif(btrim(raw_key), '') is not null
  ) normalized;

  if cardinality(v_ribbon_keys) > 100
     or exists (
       select 1 from unnest(v_ribbon_keys) key
       where not public.pokedex_tracker_detail_key_is_known('ribbon', key)
     ) then
    raise exception 'Choose only supported ribbons.' using errcode = '22023';
  end if;

  if v_transfer_state <> 'transferred' then
    v_transferred_on := null;
  end if;

  if p_specimen_id is null then
    insert into public.pokedex_collection_specimens(
      tracker_id, user_id, pokemon_id, form_label, nickname, is_shiny,
      gender, level, original_trainer, origin_game, origin_mark, location_id, box_label,
      box_position, pokeball_key, ribbon_keys, is_event, importance,
      intended_destination, transfer_state, transferred_on, notes
    ) values (
      v_tracker.id, auth.uid(), v_pokemon_id, v_form_label, v_nickname, v_is_shiny,
      v_gender, v_level, v_original_trainer, v_origin_game, v_origin_mark, v_location_id, v_box_label,
      v_box_position, v_pokeball_key, v_ribbon_keys, v_is_event, v_importance,
      v_destination, v_transfer_state, v_transferred_on, v_notes
    ) returning * into v_specimen;
  else
    update public.pokedex_collection_specimens
    set pokemon_id = v_pokemon_id,
        form_label = v_form_label,
        nickname = v_nickname,
        is_shiny = v_is_shiny,
        gender = v_gender,
        level = v_level,
        original_trainer = v_original_trainer,
        origin_game = v_origin_game,
        origin_mark = v_origin_mark,
        location_id = v_location_id,
        box_label = v_box_label,
        box_position = v_box_position,
        pokeball_key = v_pokeball_key,
        ribbon_keys = v_ribbon_keys,
        is_event = v_is_event,
        importance = v_importance,
        intended_destination = v_destination,
        transfer_state = v_transfer_state,
        transferred_on = v_transferred_on,
        notes = v_notes,
        updated_at = now()
    where id = p_specimen_id
      and tracker_id = v_tracker.id
      and user_id = auth.uid()
    returning * into v_specimen;

    if not found then
      raise exception 'That individual Pokemon record was not found.' using errcode = 'P0002';
    end if;
  end if;

  update public.pokedex_trackers
  set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();

  select jsonb_build_object(
    'id', v_specimen.id,
    'pokemon_id', v_specimen.pokemon_id,
    'pokemon', catalog.pokemon_name,
    'dex_number', catalog.dex_number,
    'form_label', v_specimen.form_label,
    'nickname', v_specimen.nickname,
    'is_shiny', v_specimen.is_shiny,
    'gender', v_specimen.gender,
    'level', v_specimen.level,
    'original_trainer', v_specimen.original_trainer,
    'origin_game', v_specimen.origin_game,
    'origin_mark', v_specimen.origin_mark,
    'location_id', v_specimen.location_id,
    'location_name', coalesce(location.name, ''),
    'location_kind', coalesce(location.location_kind, ''),
    'box_label', v_specimen.box_label,
    'box_position', v_specimen.box_position,
    'pokeball', coalesce(v_specimen.pokeball_key, ''),
    'ribbons', v_specimen.ribbon_keys,
    'is_event', v_specimen.is_event,
    'importance', v_specimen.importance,
    'intended_destination', v_specimen.intended_destination,
    'transfer_state', v_specimen.transfer_state,
    'transferred_on', v_specimen.transferred_on,
    'notes', v_specimen.notes,
    'created_at', v_specimen.created_at,
    'updated_at', v_specimen.updated_at
  ) into v_result
  from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
  left join public.pokedex_collection_locations location
    on location.id = v_specimen.location_id
   and location.tracker_id = v_specimen.tracker_id
   and location.user_id = v_specimen.user_id
  where catalog.pokemon_id = v_specimen.pokemon_id;

  return v_result;
end;
$$;

create or replace function public.delete_my_pokedex_collection_specimen(
  p_tracker_id uuid,
  p_specimen_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete an individual Pokemon.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pokedex_trackers
    where id = p_tracker_id and user_id = auth.uid()
  ) then
    raise exception 'That Pokedex tracker was not found.' using errcode = 'P0002';
  end if;

  delete from public.pokedex_collection_specimens
  where id = p_specimen_id
    and tracker_id = p_tracker_id
    and user_id = auth.uid();
  return found;
end;
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
    raise exception 'Sign in to export Pokedex trackers.' using errcode = '42501';
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
    ), '[]'::jsonb),
    'details', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pokemon_id', detail.pokemon_id,
        'is_shiny', detail.is_shiny,
        'pokeball', coalesce(detail.pokeball_key, ''),
        'ribbons', detail.ribbon_keys,
        'notes', detail.notes,
        'updated_at', detail.updated_at
      ) order by detail.pokemon_id, detail.is_shiny)
      from public.pokedex_tracker_entry_details detail
      where detail.tracker_id = tracker.id
        and detail.user_id = auth.uid()
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', location.id,
        'kind', location.location_kind,
        'name', location.name,
        'platform', location.platform,
        'notes', location.notes,
        'created_at', location.created_at,
        'updated_at', location.updated_at
      ) order by location.name, location.created_at)
      from public.pokedex_collection_locations location
      where location.tracker_id = tracker.id
        and location.user_id = auth.uid()
    ), '[]'::jsonb),
    'specimens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', specimen.id,
        'pokemon_id', specimen.pokemon_id,
        'form_label', specimen.form_label,
        'nickname', specimen.nickname,
        'is_shiny', specimen.is_shiny,
        'gender', specimen.gender,
        'level', specimen.level,
        'original_trainer', specimen.original_trainer,
        'origin_game', specimen.origin_game,
        'origin_mark', specimen.origin_mark,
        'location_id', specimen.location_id,
        'box_label', specimen.box_label,
        'box_position', specimen.box_position,
        'pokeball', coalesce(specimen.pokeball_key, ''),
        'ribbons', specimen.ribbon_keys,
        'is_event', specimen.is_event,
        'importance', specimen.importance,
        'intended_destination', specimen.intended_destination,
        'transfer_state', specimen.transfer_state,
        'transferred_on', specimen.transferred_on,
        'notes', specimen.notes,
        'created_at', specimen.created_at,
        'updated_at', specimen.updated_at
      ) order by specimen.updated_at desc, specimen.id)
      from public.pokedex_collection_specimens specimen
      where specimen.tracker_id = tracker.id
        and specimen.user_id = auth.uid()
    ), '[]'::jsonb)
  ) order by tracker.updated_at desc), '[]'::jsonb)
  into v_trackers
  from public.pokedex_trackers tracker
  where tracker.user_id = auth.uid();

  return jsonb_build_object('trackers', v_trackers);
end;
$$;

revoke all on function public.get_my_pokedex_collection_inventory(uuid)
  from public, anon, authenticated;
revoke all on function public.save_my_pokedex_collection_location(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_my_pokedex_collection_location(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.save_my_pokedex_collection_specimen(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_my_pokedex_collection_specimen(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.export_my_pokedex_trackers()
  from public, anon, authenticated;

grant execute on function public.get_my_pokedex_collection_inventory(uuid)
  to authenticated, service_role;
grant execute on function public.save_my_pokedex_collection_location(uuid, uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.delete_my_pokedex_collection_location(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.save_my_pokedex_collection_specimen(uuid, uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.delete_my_pokedex_collection_specimen(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers()
  to authenticated, service_role;

do $$
begin
  if not (select relrowsecurity and relforcerowsecurity
          from pg_class where oid = 'public.pokedex_collection_locations'::regclass)
     or not (select relrowsecurity and relforcerowsecurity
             from pg_class where oid = 'public.pokedex_collection_specimens'::regclass) then
    raise exception 'Pokedex collection inventory tables must use forced RLS';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('pokedex_collection_locations', 'pokedex_collection_specimens')
  ) then
    raise exception 'Pokedex collection inventory tables must not expose direct client policies';
  end if;

  if has_table_privilege('anon', 'public.pokedex_collection_locations', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'INSERT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'DELETE')
     or has_table_privilege('anon', 'public.pokedex_collection_specimens', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'INSERT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'DELETE') then
    raise exception 'Pokedex collection inventory tables must remain inaccessible to browser roles';
  end if;

  if has_function_privilege('anon', 'public.get_my_pokedex_collection_inventory(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_my_pokedex_collection_location(uuid,uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_my_pokedex_collection_specimen(uuid,uuid,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_collection_inventory(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_my_pokedex_collection_location(uuid,uuid,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_my_pokedex_collection_specimen(uuid,uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_collection_location_kind_is_known(text)', 'EXECUTE') then
    raise exception 'Pokedex collection inventory function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
