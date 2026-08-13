-- Preview-only rollback matrix for migration 386.
-- Run only in an isolated Supabase branch after migrations through 386 exist.

begin;

create temp table dc_connections_usage_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_before jsonb;
  v_after jsonb;
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if has_function_privilege('anon', 'public.get_operations_connections_usage()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_operations_connections_usage()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_operations_connections_usage()', 'EXECUTE') then
    raise exception 'Connections usage RPC grants are incorrect.';
  end if;
  insert into dc_connections_usage_results values (jsonb_build_object('check', 'grants', 'ok', true));

  if not exists (
    select 1 from pg_class
    where oid = 'public.daily_connections_completions'::regclass
      and relrowsecurity
  ) or has_table_privilege('anon', 'public.daily_connections_completions', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_connections_completions', 'SELECT') then
    raise exception 'Connections completion rows did not retain their RLS boundary.';
  end if;
  insert into dc_connections_usage_results values (jsonb_build_object('check', 'rls', 'ok', true));

  select public.get_operations_connections_usage() into v_before;
  insert into auth.users(id, aud, role)
  values
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');
  insert into public.daily_connections_completions(user_id, activity_date, completed_at)
  values
    (v_user_one, v_today, now()),
    (v_user_two, v_today, now()),
    (v_user_one, v_today - 8, now() - interval '8 days');

  select public.get_operations_connections_usage() into v_after;
  if (v_after #>> '{all_time,completions}')::integer <> (v_before #>> '{all_time,completions}')::integer + 3
     or (v_after #>> '{all_time,players}')::integer <> (v_before #>> '{all_time,players}')::integer + 2
     or (v_after #>> '{today,completions}')::integer <> (v_before #>> '{today,completions}')::integer + 2
     or (v_after #>> '{last_7_days,completions}')::integer <> (v_before #>> '{last_7_days,completions}')::integer + 2
     or (v_after #>> '{last_30_days,completions}')::integer <> (v_before #>> '{last_30_days,completions}')::integer + 3 then
    raise exception 'Connections usage aggregates did not change by the synthetic fixture totals.';
  end if;
  insert into dc_connections_usage_results values (jsonb_build_object('check', 'aggregates', 'ok', true));

  if jsonb_array_length(v_after -> 'daily') <> 30
     or not exists (
       select 1
       from jsonb_array_elements(v_after -> 'daily') row
       where row ->> 'date' = v_today::text
         and (row ->> 'completions')::integer = (v_before #>> '{today,completions}')::integer + 2
     ) then
    raise exception 'Connections usage daily trend is incomplete.';
  end if;
  insert into dc_connections_usage_results values (jsonb_build_object('check', 'daily_trend', 'ok', true));

  if v_after::text like '%' || v_user_one::text || '%'
     or v_after::text like '%' || v_user_two::text || '%' then
    raise exception 'Connections usage exposed a player identifier.';
  end if;
  insert into dc_connections_usage_results values (jsonb_build_object('check', 'aggregate_only', 'ok', true));
end;
$validation$;

select result from dc_connections_usage_results order by result ->> 'check';

rollback;
