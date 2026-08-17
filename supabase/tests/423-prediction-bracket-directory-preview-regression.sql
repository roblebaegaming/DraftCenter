-- Run only after migration 423 on an isolated Supabase Preview branch.
-- All fixtures and timing changes are removed by the final rollback.

begin;

do $validation$
declare
  v_event_id text := 'preview-durable-bracket-423';
  v_user_id uuid := gen_random_uuid();
  v_entry_id uuid;
  v_directory jsonb;
  v_hub jsonb;
  v_public_entry jsonb;
  v_picks jsonb := '{"r1-m1":"slot-1","r1-m2":"slot-3","r2-m1":"slot-1"}'::jsonb;
begin
  insert into auth.users(id, aud, role)
  values (v_user_id, 'authenticated', 'authenticated');

  insert into public.prediction_bracket_events(
    event_id, display_name, description, official_info_url, status,
    field_size, bracket_capacity, revision, opens_at, locks_at,
    official_bracket_url, source_checked_at, round_points, published_at
  ) values (
    v_event_id, 'Preview durable bracket',
    'Disposable privacy fixture for migration 423.',
    'https://example.com/event', 'open',
    4, 4, 1, now() + interval '1 hour', now() + interval '2 hours',
    'https://example.com/bracket', now(), '{"1":1,"2":2}'::jsonb, now()
  );

  insert into public.prediction_bracket_slots(
    event_id, bracket_revision, slot_number, competitor_id,
    display_name, country_code, source_seed
  ) values
    (v_event_id, 1, 1, 'slot-1', 'Preview Player One', 'US', 1),
    (v_event_id, 1, 2, 'slot-2', 'Preview Player Two', 'CA', 2),
    (v_event_id, 1, 3, 'slot-3', 'Preview Player Three', 'GB', 3),
    (v_event_id, 1, 4, 'slot-4', 'Preview Player Four', 'JP', 4);

  insert into public.prediction_bracket_entries(
    event_id, user_id, bracket_revision, display_name, picks
  ) values (
    v_event_id, v_user_id, 1, 'Preview Private Trainer', v_picks
  )
  returning public_id into v_entry_id;

  if v_entry_id is null then
    raise exception 'New bracket entries did not receive an opaque public ID.';
  end if;

  select public.get_prediction_bracket_directory() into v_directory;
  if not exists (
       select 1
       from jsonb_array_elements(v_directory) event
       where event ->> 'event_id' = v_event_id
         and (event ->> 'entry_count')::integer = 1
         and event ->> 'status' = 'scheduled'
     )
     or position(v_user_id::text in v_directory::text) > 0
     or position(v_entry_id::text in v_directory::text) > 0
     or position('Preview Private Trainer' in v_directory::text) > 0
     or position('r1-m1' in v_directory::text) > 0 then
    raise exception 'The directory did not stay aggregate-only.';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  select public.get_prediction_bracket_hub(v_event_id) into v_hub;
  if v_hub #> '{standings,0,picks}' is distinct from 'null'::jsonb
     or v_hub #> '{standings,0,entry_id}' is distinct from 'null'::jsonb then
    raise exception 'A scheduled bracket exposed picks or another entrant durable ID.';
  end if;

  select public.get_prediction_bracket_public_entry(v_event_id, v_entry_id)
  into v_public_entry;
  if v_public_entry is not null then
    raise exception 'A durable entrant URL exposed picks before lock.';
  end if;

  update public.prediction_bracket_events
  set opens_at = now() - interval '2 hours',
      locks_at = now() - interval '1 hour'
  where event_id = v_event_id;

  select public.get_prediction_bracket_public_entry(v_event_id, v_entry_id)
  into v_public_entry;

  if v_public_entry #>> '{entry,entry_id}' is distinct from v_entry_id::text
     or v_public_entry #>> '{entry,display_name}' is distinct from 'Preview Private Trainer'
     or v_public_entry #> '{entry,picks}' is distinct from v_picks
     or (v_public_entry #>> '{entry,score}')::integer is distinct from 0
     or (v_public_entry #>> '{entry,rank}')::integer is distinct from 1
     or jsonb_array_length(v_public_entry -> 'slots') is distinct from 4
     or position(v_user_id::text in v_public_entry::text) > 0
     or position('user_id' in v_public_entry::text) > 0
     or exists (
       select 1
       from jsonb_object_keys(v_public_entry) key
       where key not in ('event', 'slots', 'results', 'entry')
     )
     or exists (
       select 1
       from jsonb_object_keys(v_public_entry -> 'entry') key
       where key not in ('entry_id', 'display_name', 'picks', 'score', 'rank')
     ) then
    raise exception 'The locked durable bracket payload was incomplete or leaked its owner.';
  end if;

  if has_table_privilege('anon', 'public.prediction_bracket_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.prediction_bracket_entries', 'SELECT')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_directory()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_directory()', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_public_entry(text,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_public_entry(text,uuid)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_hub(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_hub(text)', 'EXECUTE') then
    raise exception 'Durable bracket grants weakened the private entry table boundary.';
  end if;
end;
$validation$;

rollback;
