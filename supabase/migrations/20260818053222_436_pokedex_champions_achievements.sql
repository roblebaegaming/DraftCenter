begin;

create table public.pokedex_champions_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  achievement_progress jsonb not null default '{}'::jsonb,
  pokemon_wins jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint pokedex_champions_achievement_progress_object check (jsonb_typeof(achievement_progress) = 'object'),
  constraint pokedex_champions_pokemon_wins_object check (jsonb_typeof(pokemon_wins) = 'object'),
  constraint pokedex_champions_achievement_progress_size check (octet_length(achievement_progress::text) <= 20000),
  constraint pokedex_champions_pokemon_wins_size check (octet_length(pokemon_wins::text) <= 30000)
);

comment on table public.pokedex_champions_progress is
  'Private account-wide Pokémon Champions Trainer Achievement and per-Pokémon win progress.';

alter table public.pokedex_champions_progress enable row level security;
alter table public.pokedex_champions_progress force row level security;
revoke all on table public.pokedex_champions_progress from public, anon, authenticated;

create function public.pokedex_champions_achievement_key_is_known(p_key text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_key = any (array[
    'battlewise','super-effective','extremely-effective','critical-hits','mega-evolution',
    'single-sweeper','double-sweeper','champion-seasons','competitions','shop-spend',
    'badges','titles','icons','outerwear','bottoms'
  ]::text[])
  or p_key ~ '^(wins|moves)-(normal|grass|fire|water|electric|bug|flying|poison|fighting|rock|ground|ice|psychic|ghost|dragon|dark|steel|fairy)$';
$$;

create function public.pokedex_champions_pokemon_id_is_known(p_pokemon_id integer)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_pokemon_id = any (array[
    3,6,9,15,18,24,25,26,36,38,45,59,65,68,71,80,94,115,121,127,128,130,132,134,135,136,142,143,149,
    154,157,160,168,181,184,186,196,197,199,205,208,211,212,214,227,229,248,254,257,260,279,282,302,303,
    306,308,310,319,323,324,334,350,351,354,358,359,362,376,389,392,395,398,405,407,409,411,428,442,445,
    448,450,454,460,461,464,470,471,472,473,475,478,479,497,500,503,505,510,512,514,516,518,530,531,534,
    545,547,553,560,563,569,571,579,584,587,604,609,614,618,623,635,637,652,655,658,660,663,666,668,670,
    671,675,676,678,681,683,685,687,689,691,693,695,697,699,700,701,702,706,707,709,711,713,715,724,727,
    730,733,740,745,748,750,752,758,763,765,766,778,780,784,823,841,842,844,855,858,861,866,867,869,870,
    877,887,899,900,902,903,904,908,911,914,925,934,936,937,939,952,956,959,964,968,970,972,979,981,983,
    1000,1013,1018,1019
  ]::integer[]);
$$;

create function public.get_my_pokedex_champions_progress()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select case when auth.uid() is null then null else coalesce((
    select jsonb_build_object(
      'achievement_progress', progress.achievement_progress,
      'pokemon_wins', progress.pokemon_wins,
      'updated_at', progress.updated_at
    )
    from public.pokedex_champions_progress progress
    where progress.user_id = auth.uid()
  ), jsonb_build_object('achievement_progress','{}'::jsonb,'pokemon_wins','{}'::jsonb,'updated_at',null)) end;
$$;

create function public.set_my_pokedex_champions_achievement_progress(
  p_achievement_key text,
  p_progress integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to save Champions progress.' using errcode = '42501'; end if;
  if not public.pokedex_champions_achievement_key_is_known(p_achievement_key) then
    raise exception 'That Pokémon Champions achievement is not supported.' using errcode = '22023';
  end if;
  if p_progress is null or p_progress < 0 or p_progress > 10000000 then
    raise exception 'Achievement progress must be between 0 and 10,000,000.' using errcode = '22023';
  end if;
  insert into public.pokedex_champions_progress (user_id, achievement_progress, pokemon_wins, updated_at)
  values (v_user_id, jsonb_build_object(p_achievement_key, p_progress), '{}'::jsonb, now())
  on conflict (user_id) do update set
    achievement_progress = jsonb_set(public.pokedex_champions_progress.achievement_progress, array[p_achievement_key], to_jsonb(p_progress), true),
    updated_at = now();
  return public.get_my_pokedex_champions_progress();
end;
$$;

create function public.set_my_pokedex_champions_pokemon_wins(
  p_pokemon_id integer,
  p_wins integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to save Champions progress.' using errcode = '42501'; end if;
  if not public.pokedex_champions_pokemon_id_is_known(p_pokemon_id) then
    raise exception 'That Pokémon is not in the reviewed Champions achievement roster.' using errcode = '22023';
  end if;
  if p_wins is null or p_wins < 0 or p_wins > 100000 then
    raise exception 'Pokémon wins must be between 0 and 100,000.' using errcode = '22023';
  end if;
  insert into public.pokedex_champions_progress (user_id, achievement_progress, pokemon_wins, updated_at)
  values (v_user_id, '{}'::jsonb, jsonb_build_object(p_pokemon_id::text, p_wins), now())
  on conflict (user_id) do update set
    pokemon_wins = jsonb_set(public.pokedex_champions_progress.pokemon_wins, array[p_pokemon_id::text], to_jsonb(p_wins), true),
    updated_at = now();
  return public.get_my_pokedex_champions_progress();
end;
$$;

create function public.merge_my_pokedex_champions_progress(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_current jsonb;
  v_achievements jsonb;
  v_pokemon jsonb;
  v_pair record;
  v_value integer;
begin
  if v_user_id is null then raise exception 'Sign in to restore Champions progress.' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(coalesce(p_payload -> 'achievement_progress','{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_payload -> 'pokemon_wins','{}'::jsonb)) <> 'object' then
    raise exception 'Champions progress must be a JSON object.' using errcode = '22023';
  end if;
  if (select count(*) > 60 from jsonb_object_keys(coalesce(p_payload -> 'achievement_progress','{}'::jsonb)))
     or (select count(*) > 208 from jsonb_object_keys(coalesce(p_payload -> 'pokemon_wins','{}'::jsonb))) then
    raise exception 'Champions progress is larger than the supported catalog.' using errcode = '22023';
  end if;
  v_current := public.get_my_pokedex_champions_progress();
  v_achievements := coalesce(v_current -> 'achievement_progress','{}'::jsonb);
  v_pokemon := coalesce(v_current -> 'pokemon_wins','{}'::jsonb);
  for v_pair in select * from jsonb_each_text(coalesce(p_payload -> 'achievement_progress','{}'::jsonb)) loop
    if not public.pokedex_champions_achievement_key_is_known(v_pair.key) or v_pair.value !~ '^\d{1,8}$' then
      raise exception 'The Champions backup contains unsupported achievement progress.' using errcode = '22023';
    end if;
    v_value := v_pair.value::integer;
    if v_value > 10000000 then raise exception 'The Champions backup contains an out-of-range achievement total.' using errcode = '22023'; end if;
    v_achievements := jsonb_set(v_achievements, array[v_pair.key], to_jsonb(greatest(coalesce((v_achievements ->> v_pair.key)::integer,0),v_value)), true);
  end loop;
  for v_pair in select * from jsonb_each_text(coalesce(p_payload -> 'pokemon_wins','{}'::jsonb)) loop
    if v_pair.key !~ '^\d{1,4}$' or not public.pokedex_champions_pokemon_id_is_known(v_pair.key::integer) or v_pair.value !~ '^\d{1,6}$' then
      raise exception 'The Champions backup contains unsupported Pokémon progress.' using errcode = '22023';
    end if;
    v_value := v_pair.value::integer;
    if v_value > 100000 then raise exception 'The Champions backup contains an out-of-range Pokémon win total.' using errcode = '22023'; end if;
    v_pokemon := jsonb_set(v_pokemon, array[v_pair.key], to_jsonb(greatest(coalesce((v_pokemon ->> v_pair.key)::integer,0),v_value)), true);
  end loop;
  insert into public.pokedex_champions_progress (user_id, achievement_progress, pokemon_wins, updated_at)
  values (v_user_id, v_achievements, v_pokemon, now())
  on conflict (user_id) do update set achievement_progress = excluded.achievement_progress, pokemon_wins = excluded.pokemon_wins, updated_at = now();
  return public.get_my_pokedex_champions_progress();
end;
$$;

alter function public.export_my_pokedex_trackers() rename to export_my_pokedex_trackers_v5;
revoke all on function public.export_my_pokedex_trackers_v5() from public, anon, authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers_v5() to service_role;

create function public.export_my_pokedex_trackers()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.export_my_pokedex_trackers_v5() || jsonb_build_object(
    'version', 6,
    'champions', public.get_my_pokedex_champions_progress()
  );
$$;

create function public.restore_my_pokedex_collector(p_export jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_champions jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to restore Pokédex data.' using errcode = '42501'; end if;
  if p_export is null or jsonb_typeof(p_export) <> 'object' or jsonb_typeof(p_export -> 'trackers') <> 'array' then
    raise exception 'Restore a valid Pokédex Collector backup.' using errcode = '22023';
  end if;
  v_result := public.restore_my_pokedex_trackers(p_export -> 'trackers');
  if p_export ? 'champions' and p_export -> 'champions' is not null then
    v_champions := public.merge_my_pokedex_champions_progress(p_export -> 'champions');
  else
    v_champions := public.get_my_pokedex_champions_progress();
  end if;
  return v_result || jsonb_build_object('version',6,'champions',v_champions);
end;
$$;

revoke all on function public.pokedex_champions_achievement_key_is_known(text) from public, anon, authenticated, service_role;
revoke all on function public.pokedex_champions_pokemon_id_is_known(integer) from public, anon, authenticated, service_role;
revoke all on function public.get_my_pokedex_champions_progress() from public, anon, authenticated, service_role;
revoke all on function public.set_my_pokedex_champions_achievement_progress(text,integer) from public, anon, authenticated, service_role;
revoke all on function public.set_my_pokedex_champions_pokemon_wins(integer,integer) from public, anon, authenticated, service_role;
revoke all on function public.merge_my_pokedex_champions_progress(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.export_my_pokedex_trackers() from public, anon, authenticated, service_role;
revoke all on function public.restore_my_pokedex_collector(jsonb) from public, anon, authenticated, service_role;

grant execute on function public.pokedex_champions_achievement_key_is_known(text) to service_role;
grant execute on function public.pokedex_champions_pokemon_id_is_known(integer) to service_role;
grant execute on function public.get_my_pokedex_champions_progress() to authenticated, service_role;
grant execute on function public.set_my_pokedex_champions_achievement_progress(text,integer) to authenticated, service_role;
grant execute on function public.set_my_pokedex_champions_pokemon_wins(integer,integer) to authenticated, service_role;
grant execute on function public.merge_my_pokedex_champions_progress(jsonb) to authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.restore_my_pokedex_collector(jsonb) to authenticated, service_role;

do $$
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.pokedex_champions_progress'::regclass)
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pokedex_champions_progress')
     or has_table_privilege('authenticated','public.pokedex_champions_progress','SELECT') then
    raise exception 'Champions progress must keep forced RLS with no direct browser table access';
  end if;
  if has_function_privilege('anon','public.get_my_pokedex_champions_progress()','EXECUTE')
     or not has_function_privilege('authenticated','public.get_my_pokedex_champions_progress()','EXECUTE')
     or has_function_privilege('authenticated','public.pokedex_champions_pokemon_id_is_known(integer)','EXECUTE') then
    raise exception 'Champions progress function grants are incorrect';
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
