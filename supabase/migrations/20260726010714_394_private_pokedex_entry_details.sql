-- Migration 394: private per-entry Poké Ball, ribbon, and note details for
-- account-owned Pokédex trackers. Details remain independent of caught flags.

begin;

create table public.pokedex_tracker_entry_details (
  tracker_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  is_shiny boolean not null default false,
  pokeball_key text check (pokeball_key is null or pokeball_key ~ '^[a-z0-9-]{1,40}$'),
  ribbon_keys text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tracker_id, pokemon_id, is_shiny),
  foreign key (tracker_id, user_id)
    references public.pokedex_trackers(id, user_id) on delete cascade,
  constraint pokedex_tracker_entry_details_ribbon_count_check
    check (cardinality(ribbon_keys) <= 100),
  constraint pokedex_tracker_entry_details_ribbon_shape_check
    check (array_position(ribbon_keys, null) is null)
);

create index pokedex_tracker_entry_details_user_tracker_idx
  on public.pokedex_tracker_entry_details(user_id, tracker_id);

alter table public.pokedex_tracker_entry_details enable row level security;
alter table public.pokedex_tracker_entry_details force row level security;

revoke all on table public.pokedex_tracker_entry_details from public, anon, authenticated;
grant all on table public.pokedex_tracker_entry_details to service_role;

comment on table public.pokedex_tracker_entry_details is
  'Private Poké Ball, ribbon, and note metadata for standard and shiny Pokédex entries. Browser table access is denied; authenticated RPCs enforce ownership.';

create or replace function public.pokedex_tracker_detail_key_is_known(
  p_kind text,
  p_key text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_kind
    when 'pokeball' then p_key = any(array[
      'poke', 'great', 'ultra', 'master', 'safari', 'net', 'dive', 'nest',
      'repeat', 'timer', 'luxury', 'premier', 'dusk', 'heal', 'quick',
      'cherish', 'fast', 'level', 'lure', 'heavy', 'love', 'friend', 'moon',
      'sport', 'dream', 'beast', 'strange', 'la-poke', 'la-great', 'la-ultra',
      'feather', 'wing', 'jet', 'la-heavy', 'leaden', 'gigaton', 'origin'
    ]::text[])
    when 'ribbon' then p_key = any(array[
      'champion-g3', 'artist', 'effort', 'winning', 'victory',
      'g3-cool', 'g3-cool-super', 'g3-cool-hyper', 'g3-cool-master',
      'g3-beauty', 'g3-beauty-super', 'g3-beauty-hyper', 'g3-beauty-master',
      'g3-cute', 'g3-cute-super', 'g3-cute-hyper', 'g3-cute-master',
      'g3-smart', 'g3-smart-super', 'g3-smart-hyper', 'g3-smart-master',
      'g3-tough', 'g3-tough-super', 'g3-tough-hyper', 'g3-tough-master',
      'champion-sinnoh', 'alert', 'shock', 'downcast', 'careless', 'relax',
      'snooze', 'smile', 'gorgeous', 'royal', 'gorgeous-royal', 'footprint',
      'record', 'legend', 'ability', 'great-ability', 'double-ability',
      'multi-ability', 'pair-ability', 'world-ability',
      'g4-cool', 'g4-cool-great', 'g4-cool-ultra', 'g4-cool-master',
      'g4-beauty', 'g4-beauty-great', 'g4-beauty-ultra', 'g4-beauty-master',
      'g4-cute', 'g4-cute-great', 'g4-cute-ultra', 'g4-cute-master',
      'g4-smart', 'g4-smart-great', 'g4-smart-ultra', 'g4-smart-master',
      'g4-tough', 'g4-tough-great', 'g4-tough-ultra', 'g4-tough-master',
      'champion-kalos', 'champion-hoenn', 'best-friends', 'training',
      'skillful-battler', 'expert-battler', 'contest-star', 'coolness-master',
      'beauty-master', 'cuteness-master', 'cleverness-master', 'toughness-master',
      'champion-alola', 'battle-royal-master', 'battle-tree-great',
      'battle-tree-master', 'champion-galar', 'tower-master', 'master-rank',
      'hisui', 'twinkling-star', 'champion-paldea', 'once-in-a-lifetime',
      'partner'
    ]::text[])
    else false
  end;
$$;

revoke all on function public.pokedex_tracker_detail_key_is_known(text, text)
  from public, anon, authenticated;

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
      ),
      'pokeball', coalesce(standard_detail.pokeball_key, ''),
      'ribbons', coalesce(standard_detail.ribbon_keys, '{}'::text[]),
      'notes', coalesce(standard_detail.notes, ''),
      'shiny_pokeball', coalesce(shiny_detail.pokeball_key, ''),
      'shiny_ribbons', coalesce(shiny_detail.ribbon_keys, '{}'::text[]),
      'shiny_notes', coalesce(shiny_detail.notes, '')
    ) order by catalog.sort_order, catalog.pokemon_name), '[]'::jsonb)
  ) into v_result
  from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
  left join public.pokedex_tracker_entry_details standard_detail
    on standard_detail.tracker_id = v_tracker.id
   and standard_detail.user_id = auth.uid()
   and standard_detail.pokemon_id = catalog.pokemon_id
   and not standard_detail.is_shiny
  left join public.pokedex_tracker_entry_details shiny_detail
    on shiny_detail.tracker_id = v_tracker.id
   and shiny_detail.user_id = auth.uid()
   and shiny_detail.pokemon_id = catalog.pokemon_id
   and shiny_detail.is_shiny;

  return v_result;
end;
$$;

create or replace function public.set_my_pokedex_tracker_entry_details(
  p_tracker_id uuid,
  p_pokemon_id integer,
  p_is_shiny boolean,
  p_pokeball_key text,
  p_ribbon_keys text[],
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_is_shiny boolean := coalesce(p_is_shiny, false);
  v_pokeball_key text := nullif(lower(btrim(coalesce(p_pokeball_key, ''))), '');
  v_ribbon_keys text[];
  v_notes text := coalesce(p_notes, '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to save Pokédex details.' using errcode = '42501';
  end if;

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002';
  end if;
  if v_is_shiny and not v_tracker.include_shiny then
    raise exception 'Enable the shiny dex before saving shiny details.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
    where catalog.pokemon_id = p_pokemon_id
  ) then
    raise exception 'That Pokémon is not part of this Pokédex.' using errcode = '22023';
  end if;
  if char_length(v_notes) > 1000 then
    raise exception 'Pokémon notes must be 1,000 characters or fewer.' using errcode = '22023';
  end if;
  if v_pokeball_key is not null
     and not public.pokedex_tracker_detail_key_is_known('pokeball', v_pokeball_key) then
    raise exception 'Choose a supported Poké Ball.' using errcode = '22023';
  end if;

  select coalesce(array_agg(key order by key), '{}'::text[])
  into v_ribbon_keys
  from (
    select distinct lower(btrim(raw_key)) as key
    from unnest(coalesce(p_ribbon_keys, '{}'::text[])) raw(raw_key)
    where nullif(btrim(raw_key), '') is not null
  ) normalized;

  if cardinality(v_ribbon_keys) > 100
     or exists (
       select 1 from unnest(v_ribbon_keys) key
       where not public.pokedex_tracker_detail_key_is_known('ribbon', key)
     ) then
    raise exception 'Choose only supported ribbons.' using errcode = '22023';
  end if;

  if v_pokeball_key is null and cardinality(v_ribbon_keys) = 0 and v_notes = '' then
    delete from public.pokedex_tracker_entry_details
    where tracker_id = v_tracker.id
      and user_id = auth.uid()
      and pokemon_id = p_pokemon_id
      and is_shiny = v_is_shiny;
  else
    insert into public.pokedex_tracker_entry_details(
      tracker_id, user_id, pokemon_id, is_shiny,
      pokeball_key, ribbon_keys, notes
    ) values (
      v_tracker.id, auth.uid(), p_pokemon_id, v_is_shiny,
      v_pokeball_key, v_ribbon_keys, v_notes
    )
    on conflict(tracker_id, pokemon_id, is_shiny) do update
    set pokeball_key = excluded.pokeball_key,
        ribbon_keys = excluded.ribbon_keys,
        notes = excluded.notes,
        updated_at = now()
    where pokedex_tracker_entry_details.user_id = auth.uid();
  end if;

  update public.pokedex_trackers
  set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();

  return jsonb_build_object(
    'pokeball', coalesce(v_pokeball_key, ''),
    'ribbons', v_ribbon_keys,
    'notes', v_notes
  );
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
    ), '[]'::jsonb)
  ) order by tracker.updated_at desc), '[]'::jsonb)
  into v_trackers
  from public.pokedex_trackers tracker
  where tracker.user_id = auth.uid();

  return jsonb_build_object('trackers', v_trackers);
end;
$$;

revoke all on function public.get_my_pokedex_tracker(uuid) from public, anon, authenticated;
revoke all on function public.set_my_pokedex_tracker_entry_details(uuid, integer, boolean, text, text[], text)
  from public, anon, authenticated;
revoke all on function public.export_my_pokedex_trackers() from public, anon, authenticated;

grant execute on function public.get_my_pokedex_tracker(uuid) to authenticated, service_role;
grant execute on function public.set_my_pokedex_tracker_entry_details(uuid, integer, boolean, text, text[], text)
  to authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers() to authenticated, service_role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pokedex_tracker_entry_details'::regclass)
     or not (select relforcerowsecurity from pg_class where oid = 'public.pokedex_tracker_entry_details'::regclass) then
    raise exception 'Pokédex entry details must use forced RLS';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pokedex_tracker_entry_details'
  ) then
    raise exception 'Pokédex entry details must not expose direct client policies';
  end if;

  if has_table_privilege('anon', 'public.pokedex_tracker_entry_details', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'INSERT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'DELETE') then
    raise exception 'Pokédex entry details must remain inaccessible to browser roles';
  end if;

  if has_function_privilege('anon', 'public.set_my_pokedex_tracker_entry_details(uuid,integer,boolean,text,text[],text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.set_my_pokedex_tracker_entry_details(uuid,integer,boolean,text,text[],text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_tracker_detail_key_is_known(text,text)', 'EXECUTE') then
    raise exception 'Pokédex entry detail function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
