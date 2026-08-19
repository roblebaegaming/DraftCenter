-- Run only after migration 441 on an isolated Supabase Preview branch.
-- The fixture proves anonymous leaderboard profiles are bounded and rolls back.

begin;

do $validation$
declare
  v_event_id text := 'preview-worlds-shared-profiles';
  v_user_id uuid := gen_random_uuid();
  v_username text := 'worlds-preview-' || substr(replace(v_user_id::text, '-', ''), 1, 12);
  v_hub jsonb;
  v_profile jsonb;
begin
  if not has_function_privilege('anon', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('service_role', 'public.get_worlds_pick_hub(text)', 'execute')
     or exists (
       select 1
       from pg_catalog.pg_class relation
       join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname in ('worlds_pick_entries','profiles','user_badge_progress')
         and not relation.relrowsecurity
     )
     or exists (
       select 1
       from pg_catalog.pg_policies policy
       where policy.schemaname = 'public'
         and policy.tablename in ('worlds_pick_entries','profiles','user_badge_progress')
         and 'anon' = any(policy.roles)
     ) then
    raise exception 'The Worlds leaderboard profile grants exceed the RPC-only boundary.';
  end if;

  insert into auth.users(id, aud, role)
  values (v_user_id, 'authenticated', 'authenticated');

  insert into public.profiles(id, display_name, username, avatar_url, favorite_pokemon)
  values (
    v_user_id,
    'Shared Worlds Coach',
    v_username,
    'https://example.com/worlds-coach.png',
    array['Garchomp','Incineroar','Whimsicott','Pelipper','Archaludon','Raichu']
  );

  insert into public.user_badge_progress(
    user_id, badge_code, subject, progress, tier, first_earned_at
  ) values (
    v_user_id, 'pokedex_researcher', '', 25, 25, now()
  );

  insert into public.worlds_pick_events (
    id, display_name, discipline, entry_unit, division, picks_required, status,
    opens_at, locks_at, starts_at, ends_at, bracket_status, roster_source_url,
    roster_checked_at, scoring_rules
  ) values (
    v_event_id,
    'Shared English and Italian Worlds Preview',
    'vgc',
    'individual',
    'Masters',
    10,
    'open',
    now() - interval '1 day',
    now() + interval '1 day',
    now() + interval '1 day',
    now() + interval '4 days',
    'waiting_for_official_bracket',
    'https://worlds.pokemon.com/en-us/competitors/',
    current_date,
    '{"selection_multiplier":2}'::jsonb
  );

  insert into public.worlds_pick_competitors (
    event_id, slug, display_name, country_code, qualification_region,
    qualification_path, source_order, source_url, source_checked_at, score_points
  )
  select
    v_event_id,
    'shared-profile-player-' || slot,
    'Shared Profile Player ' || slot,
    'USA',
    'Preview',
    'Transactional shared profile fixture',
    slot,
    'https://worlds.pokemon.com/en-us/competitors/',
    current_date,
    0
  from generate_series(1, 10) slot;

  insert into public.worlds_pick_entries(event_id, user_id, display_name, pick_slugs, ace_slug)
  values (
    v_event_id,
    v_user_id,
    'Shared Worlds Coach',
    array[
      'shared-profile-player-1','shared-profile-player-2','shared-profile-player-3',
      'shared-profile-player-4','shared-profile-player-5','shared-profile-player-6',
      'shared-profile-player-7','shared-profile-player-8','shared-profile-player-9',
      'shared-profile-player-10'
    ],
    'shared-profile-player-1'
  );

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  select public.get_worlds_pick_hub(v_event_id) into v_hub;
  v_profile := v_hub #> '{standings,0,profile}';

  if v_hub #>> '{event,id}' <> v_event_id
     or (v_hub #>> '{entry_count}')::integer <> 1
     or v_hub #>> '{standings,0,display_name}' <> 'Shared Worlds Coach'
     or v_profile ->> 'username' <> v_username
     or v_profile ->> 'display_name' <> 'Shared Worlds Coach'
     or v_profile ->> 'avatar_url' <> 'https://example.com/worlds-coach.png'
     or jsonb_array_length(v_profile -> 'favorite_pokemon') <> 6
     or v_profile #>> '{favorite_pokemon,5}' <> 'Raichu'
     or jsonb_array_length(v_profile -> 'badges') <> 1
     or v_profile #>> '{badges,0,code}' <> 'pokedex_researcher'
     or v_profile ?| array['id','user_id','email','timezone','discord_user_id']
     or v_hub #> '{standings,0,picks}' <> 'null'::jsonb
     or v_hub #> '{standings,0,ace_slug}' <> 'null'::jsonb then
    raise exception 'The shared Worlds leaderboard profile payload is incomplete or overexposed: %', v_hub -> 'standings';
  end if;
end;
$validation$;

rollback;
