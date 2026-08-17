-- Run only after migration 413 on an isolated Supabase Preview branch.
-- Every fixture and timing change is removed by the final rollback.

begin;

do $validation$
declare
  v_event_id text := 'preview-worlds-odds-413';
  v_user_id uuid;
  v_first_user_id uuid;
  v_keep_user_id uuid;
  v_picks text[];
  v_payload jsonb;
  v_index integer;
begin
  insert into public.worlds_pick_events (
    id, display_name, discipline, entry_unit, division, picks_required, status,
    opens_at, locks_at, starts_at, ends_at, bracket_status,
    roster_source_url, roster_checked_at, scoring_rules
  ) values (
    v_event_id, 'Preview Worlds odds', 'vgc', 'individual', 'Masters', 10, 'open',
    now() - interval '1 hour', now() + interval '1 hour', now() + interval '1 hour',
    now() + interval '3 days', 'waiting_for_official_bracket',
    'https://example.com/preview-roster', current_date,
    '{"selection_multiplier":2}'::jsonb
  );

  insert into public.worlds_pick_competitors (
    event_id, slug, display_name, country_code, qualification_region,
    qualification_path, source_order, source_url, source_checked_at
  )
  select
    v_event_id,
    format('preview-player-%s', lpad(player::text, 2, '0')),
    format('Preview Player %s', player),
    'USA',
    'North America',
    'Preview qualification',
    player,
    'https://example.com/preview-roster',
    current_date
  from generate_series(1, 10) player;

  select array_agg(slug order by source_order)
  into v_picks
  from public.worlds_pick_competitors
  where event_id = v_event_id;

  for v_index in 1..24 loop
    v_user_id := gen_random_uuid();
    if v_index = 1 then v_first_user_id := v_user_id; end if;
    insert into auth.users(id, aud, role) values (v_user_id, 'authenticated', 'authenticated');
    insert into public.worlds_pick_entries(event_id, user_id, display_name, pick_slugs, ace_slug)
    values (v_event_id, v_user_id, format('Preview Trainer %s', v_index), v_picks, v_picks[1]);
  end loop;

  select public.get_worlds_pick_popularity(v_event_id) into v_payload;
  if (v_payload ->> 'entry_count')::integer <> 24
     or (v_payload ->> 'sample_ready')::boolean
     or exists (
       select 1 from jsonb_array_elements(v_payload -> 'competitors') competitor
       where (competitor ->> 'pick_count')::integer <> 0
          or (competitor ->> 'ace_count')::integer <> 0
          or exists (
            select 1 from jsonb_object_keys(competitor) as payload_keys(payload_key)
            where payload_key not in ('slug', 'pick_count', 'ace_count')
          )
     )
     or exists (
       select 1 from jsonb_object_keys(v_payload) as payload_keys(payload_key)
       where payload_key not in ('entry_count', 'sample_ready', 'competitors')
     )
     or position(v_first_user_id::text in v_payload::text) > 0
     or position('Preview Trainer' in v_payload::text) > 0
     or position('pick_slugs' in v_payload::text) > 0
     or position('ace_slug' in v_payload::text) > 0 then
    raise exception 'Popularity leaked aggregate support or identity below the 25-entry threshold.';
  end if;

  v_user_id := gen_random_uuid();
  v_keep_user_id := v_user_id;
  insert into auth.users(id, aud, role) values (v_user_id, 'authenticated', 'authenticated');
  insert into public.worlds_pick_entries(event_id, user_id, display_name, pick_slugs, ace_slug)
  values (v_event_id, v_user_id, 'Preview Trainer 25', v_picks, v_picks[1]);

  select public.get_worlds_pick_popularity(v_event_id) into v_payload;
  if (v_payload ->> 'entry_count')::integer <> 25
     or not (v_payload ->> 'sample_ready')::boolean
     or (v_payload #>> '{competitors,0,pick_count}')::integer <> 25
     or (v_payload #>> '{competitors,0,ace_count}')::integer <> 25
     or (v_payload #>> '{competitors,1,pick_count}')::integer <> 25
     or (v_payload #>> '{competitors,1,ace_count}')::integer <> 0
     or position(v_user_id::text in v_payload::text) > 0
     or position('Preview Trainer' in v_payload::text) > 0
     or position('pick_slugs' in v_payload::text) > 0
     or position('ace_slug' in v_payload::text) > 0 then
    raise exception 'The 25-entry aggregate payload was incomplete or exposed an identity.';
  end if;

  delete from public.worlds_pick_entries where event_id = v_event_id and user_id <> v_keep_user_id;
  update public.worlds_pick_events set locks_at = now() - interval '1 minute' where id = v_event_id;
  select public.get_worlds_pick_popularity(v_event_id) into v_payload;
  if (v_payload ->> 'entry_count')::integer <> 1
     or not (v_payload ->> 'sample_ready')::boolean
     or (v_payload #>> '{competitors,0,pick_count}')::integer <> 1 then
    raise exception 'Locked events must expose aggregate popularity even below 25 entries.';
  end if;

  if has_table_privilege('anon', 'public.worlds_pick_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.worlds_pick_entries', 'SELECT')
     or not has_function_privilege('anon', 'public.get_worlds_pick_popularity(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_worlds_pick_popularity(text)', 'EXECUTE') then
    raise exception 'Popularity RPC grants or private-entry table grants changed unexpectedly.';
  end if;
end;
$validation$;

rollback;
