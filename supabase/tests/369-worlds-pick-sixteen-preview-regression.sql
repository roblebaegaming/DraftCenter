-- Preview-only transactional matrix for the 2026 VGC Masters Pick 16.
-- Run only after migrations 369 and 370 exist in an isolated Supabase branch.
-- The script creates synthetic accounts and entries, restores the seeded event,
-- removes every fixture, and returns one JSON result row. Any failed assertion
-- aborts the transaction.

begin;

create temp table dc_worlds_pick_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_picks text[];
  v_ace text;
  v_second_pick text;
  v_hub jsonb;
  v_original_opens_at timestamptz;
  v_original_locks_at timestamptz;
  v_rls_ok boolean;
  v_direct_access_denied boolean;
  v_rpc_grants_ok boolean;
  v_seed_ok boolean;
  v_short_entry_denied boolean := false;
  v_duplicate_entry_denied boolean := false;
  v_invalid_ace_denied boolean := false;
  v_private_before_lock boolean;
  v_own_entry_visible boolean;
  v_ace_score_ok boolean;
  v_public_after_lock boolean;
  v_locked_save_denied boolean := false;
  v_cleanup_ok boolean;
begin
  select count(*) = 3 and bool_and(c.relrowsecurity)
  into v_rls_ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'worlds_pick_events',
      'worlds_pick_competitors',
      'worlds_pick_entries'
    ]);
  if v_rls_ok is distinct from true then
    raise exception 'All three Worlds tables must have RLS enabled.';
  end if;

  select not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as roles(role_name)
    cross join unnest(array[
      'worlds_pick_events',
      'worlds_pick_competitors',
      'worlds_pick_entries'
    ]) as tables(table_name)
    where has_table_privilege(role_name, 'public.' || table_name, 'select')
       or has_table_privilege(role_name, 'public.' || table_name, 'insert')
       or has_table_privilege(role_name, 'public.' || table_name, 'update')
       or has_table_privilege(role_name, 'public.' || table_name, 'delete')
  ) into v_direct_access_denied;
  if v_direct_access_denied is distinct from true then
    raise exception 'Browser roles unexpectedly have direct Worlds table access.';
  end if;

  select
    has_function_privilege('anon', 'public.get_worlds_pick_hub(text)', 'execute')
    and has_function_privilege('authenticated', 'public.get_worlds_pick_hub(text)', 'execute')
    and not has_function_privilege('anon', 'public.save_worlds_pick_entry(text,text[],text)', 'execute')
    and has_function_privilege('authenticated', 'public.save_worlds_pick_entry(text,text[],text)', 'execute')
  into v_rpc_grants_ok;
  if v_rpc_grants_ok is distinct from true then
    raise exception 'Worlds RPC grants do not match the browser boundary.';
  end if;

  select
    count(*) = 438
    and count(*) filter (where not is_selectable) = 0
    and count(*) filter (where attendance_status <> 'invite_earned') = 0
    and count(distinct slug) = 438
    and min(source_order) = 1
    and max(source_order) = 438
  into v_seed_ok
  from public.worlds_pick_competitors
  where event_id = '2026-vgc-masters';
  if v_seed_ok is distinct from true then
    raise exception 'The Worlds Masters seed is incomplete or has an unexpected status.';
  end if;

  select opens_at, locks_at
  into v_original_opens_at, v_original_locks_at
  from public.worlds_pick_events
  where id = '2026-vgc-masters'
    and division = 'Masters'
    and picks_required = 16;
  if not found then
    raise exception 'The seeded VGC Masters event is missing.';
  end if;

  select array_agg(slug order by source_order)
  into v_picks
  from (
    select slug, source_order
    from public.worlds_pick_competitors
    where event_id = '2026-vgc-masters'
    order by source_order
    limit 16
  ) selected;
  v_ace := v_picks[1];
  v_second_pick := v_picks[2];

  insert into auth.users(id, aud, role)
  values
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values
    (v_user_one, 'Preview Picker One'),
    (v_user_two, 'Preview Picker Two');

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user_one, 'role', 'authenticated')::text,
    true
  );

  begin
    perform public.save_worlds_pick_entry(
      '2026-vgc-masters',
      v_picks[1:15],
      v_ace
    );
  exception when others then
    if sqlerrm = 'Choose exactly 16 competitors.' then
      v_short_entry_denied := true;
    else
      raise;
    end if;
  end;

  begin
    perform public.save_worlds_pick_entry(
      '2026-vgc-masters',
      array[v_picks[1]] || v_picks[1:15],
      v_ace
    );
  exception when others then
    if sqlerrm = 'Each competitor can be chosen only once.' then
      v_duplicate_entry_denied := true;
    else
      raise;
    end if;
  end;

  begin
    perform public.save_worlds_pick_entry(
      '2026-vgc-masters',
      v_picks,
      'not-in-the-entry'
    );
  exception when others then
    if sqlerrm = 'Choose one Ace Pick from your 16 competitors.' then
      v_invalid_ace_denied := true;
    else
      raise;
    end if;
  end;

  perform public.save_worlds_pick_entry('2026-vgc-masters', v_picks, v_ace);
  select public.get_worlds_pick_hub('2026-vgc-masters') into v_hub;
  v_own_entry_visible :=
    v_hub #>> '{my_entry,display_name}' = 'Preview Picker One'
    and v_hub #>> '{my_entry,ace_slug}' = v_ace
    and jsonb_array_length(v_hub #> '{my_entry,picks}') = 16;

  perform set_config('request.jwt.claim.sub', v_user_two::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user_two, 'role', 'authenticated')::text,
    true
  );
  select public.get_worlds_pick_hub('2026-vgc-masters') into v_hub;
  v_private_before_lock :=
    (v_hub ->> 'entry_count')::integer = 1
    and v_hub #> '{standings,0,picks}' = 'null'::jsonb
    and v_hub #> '{standings,0,ace_slug}' = 'null'::jsonb
    and v_hub -> 'my_entry' = 'null'::jsonb;

  update public.worlds_pick_competitors
  set score_points = case slug when v_ace then 30 when v_second_pick then 20 else score_points end
  where event_id = '2026-vgc-masters'
    and slug in (v_ace, v_second_pick);

  update public.worlds_pick_events
  set opens_at = now() - interval '2 days',
      locks_at = now() - interval '1 day'
  where id = '2026-vgc-masters';

  select public.get_worlds_pick_hub('2026-vgc-masters') into v_hub;
  v_ace_score_ok := (v_hub #>> '{standings,0,score}')::integer = 80;
  v_public_after_lock :=
    jsonb_array_length(v_hub #> '{standings,0,picks}') = 16
    and v_hub #>> '{standings,0,ace_slug}' = v_ace;

  begin
    perform public.save_worlds_pick_entry('2026-vgc-masters', v_picks, v_ace);
  exception when others then
    if sqlerrm = 'Entries for this Worlds competition are locked.' then
      v_locked_save_denied := true;
    else
      raise;
    end if;
  end;

  if v_short_entry_denied is distinct from true
     or v_duplicate_entry_denied is distinct from true
     or v_invalid_ace_denied is distinct from true
     or v_private_before_lock is distinct from true
     or v_own_entry_visible is distinct from true
     or v_ace_score_ok is distinct from true
     or v_public_after_lock is distinct from true
     or v_locked_save_denied is distinct from true then
    raise exception 'One or more Worlds Pick 16 behavior assertions failed.';
  end if;

  delete from public.worlds_pick_entries
  where event_id = '2026-vgc-masters'
    and user_id in (v_user_one, v_user_two);
  update public.worlds_pick_competitors
  set score_points = 0
  where event_id = '2026-vgc-masters'
    and slug in (v_ace, v_second_pick);
  update public.worlds_pick_events
  set opens_at = v_original_opens_at,
      locks_at = v_original_locks_at
  where id = '2026-vgc-masters';
  delete from public.profiles where id in (v_user_one, v_user_two);
  delete from auth.users where id in (v_user_one, v_user_two);

  select
    not exists (
      select 1 from public.worlds_pick_entries
      where user_id in (v_user_one, v_user_two)
    )
    and not exists (
      select 1 from public.profiles
      where id in (v_user_one, v_user_two)
    )
    and not exists (
      select 1 from auth.users
      where id in (v_user_one, v_user_two)
    )
    and exists (
      select 1 from public.worlds_pick_events
      where id = '2026-vgc-masters'
        and opens_at = v_original_opens_at
        and locks_at = v_original_locks_at
    )
    and not exists (
      select 1 from public.worlds_pick_competitors
      where event_id = '2026-vgc-masters'
        and slug in (v_ace, v_second_pick)
        and score_points <> 0
    )
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Worlds Preview fixtures were not completely removed.';
  end if;

  insert into dc_worlds_pick_preview_results(result)
  values (jsonb_build_object(
    'tables_with_rls', 3,
    'browser_direct_table_access_denied', v_direct_access_denied,
    'rpc_grants', v_rpc_grants_ok,
    'masters_roster_rows', 438,
    'short_entry_denied', v_short_entry_denied,
    'duplicate_entry_denied', v_duplicate_entry_denied,
    'invalid_ace_denied', v_invalid_ace_denied,
    'own_entry_visible_before_lock', v_own_entry_visible,
    'other_entry_private_before_lock', v_private_before_lock,
    'ace_scoring_doubled', v_ace_score_ok,
    'entries_public_after_lock', v_public_after_lock,
    'locked_save_denied', v_locked_save_denied,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result
from dc_worlds_pick_preview_results;
