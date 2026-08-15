-- Make My Teams recovery preserve complete Team Lab sets across both the current
-- schema and intentionally smaller retained Preview baselines.

begin;

create or replace function public.restore_my_personal_teams(p_teams jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team jsonb;
  v_id uuid;
  v_restored integer := 0;
  v_workspace_type text;
  v_column_name text;
  v_updated integer;
  v_update_sql text := $update$
    update public.personal_teams
    set team_name = btrim($1 ->> 'team_name'),
        league_name = nullif(btrim($1 ->> 'league_name'), ''),
        format_name = nullif(btrim($1 ->> 'format_name'), ''),
        workspace_type = $2,
        planning_entries = coalesce($1 -> 'planning_entries', '[]'::jsonb),
        notes = coalesce($1 ->> 'notes', ''),
        weekly_notes = coalesce($1 ->> 'weekly_notes', ''),
        pokepaste_url = nullif(btrim($1 ->> 'pokepaste_url'), ''),
        replica_code = coalesce($1 ->> 'replica_code', ''),
        spreadsheet_url = nullif(btrim($1 ->> 'spreadsheet_url'), ''),
        pokemon = coalesce($1 -> 'pokemon', '[]'::jsonb),
        team_sets = coalesce($1 -> 'team_sets', '{"version":1,"pokemon":[]}'::jsonb),
        archived = coalesce(($1 ->> 'archived')::boolean, false)
  $update$;
  v_insert_columns text := 'id, owner_id, team_name, league_name, format_name, workspace_type, planning_entries, notes, weekly_notes, pokepaste_url, replica_code, spreadsheet_url, pokemon, team_sets, archived';
  v_insert_values text := $values$
    $3, auth.uid(), btrim($1 ->> 'team_name'),
    nullif(btrim($1 ->> 'league_name'), ''),
    nullif(btrim($1 ->> 'format_name'), ''), $2,
    coalesce($1 -> 'planning_entries', '[]'::jsonb),
    coalesce($1 ->> 'notes', ''),
    coalesce($1 ->> 'weekly_notes', ''),
    nullif(btrim($1 ->> 'pokepaste_url'), ''),
    coalesce($1 ->> 'replica_code', ''),
    nullif(btrim($1 ->> 'spreadsheet_url'), ''),
    coalesce($1 -> 'pokemon', '[]'::jsonb),
    coalesce($1 -> 'team_sets', '{"version":1,"pokemon":[]}'::jsonb),
    coalesce(($1 ->> 'archived')::boolean, false)
  $values$;
begin
  if auth.uid() is null then
    raise exception 'Sign in before restoring My Teams.';
  end if;
  if p_teams is null
     or jsonb_typeof(p_teams) <> 'array'
     or octet_length(p_teams::text) > 10000000 then
    raise exception 'The My Teams recovery file is invalid or too large.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_teams) team
    where nullif(team ->> 'id', '') is null
       or nullif(btrim(team ->> 'team_name'), '') is null
  ) then
    raise exception 'The recovery file contains an invalid team.';
  end if;

  -- Retained Preview projects can intentionally carry a smaller historical
  -- personal_teams surface. Restore every optional field that exists without
  -- making migration 404 backfill unrelated legacy columns.
  for v_column_name in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'personal_teams'
      and column_name in (
        'team_report_url', 'is_public', 'regulation_id', 'public_summary',
        'share_pokepaste', 'share_replica_code', 'share_team_report',
        'nuzlocke_run'
      )
    order by ordinal_position
  loop
    case v_column_name
      when 'team_report_url' then
        v_update_sql := v_update_sql || ', team_report_url = nullif(btrim($1 ->> ''team_report_url''), '''')';
        v_insert_values := v_insert_values || ', nullif(btrim($1 ->> ''team_report_url''), '''')';
      when 'is_public' then
        v_update_sql := v_update_sql || ', is_public = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''is_public'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''is_public'')::boolean, false) end';
      when 'regulation_id' then
        v_update_sql := v_update_sql || ', regulation_id = case when $2 = ''nuzlocke'' then null else nullif(btrim($1 ->> ''regulation_id''), '''') end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then null else nullif(btrim($1 ->> ''regulation_id''), '''') end';
      when 'public_summary' then
        v_update_sql := v_update_sql || ', public_summary = case when $2 = ''nuzlocke'' then '''' else coalesce($1 ->> ''public_summary'', '''') end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then '''' else coalesce($1 ->> ''public_summary'', '''') end';
      when 'share_pokepaste' then
        v_update_sql := v_update_sql || ', share_pokepaste = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_pokepaste'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_pokepaste'')::boolean, false) end';
      when 'share_replica_code' then
        v_update_sql := v_update_sql || ', share_replica_code = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_replica_code'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_replica_code'')::boolean, false) end';
      when 'share_team_report' then
        v_update_sql := v_update_sql || ', share_team_report = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_team_report'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_team_report'')::boolean, false) end';
      when 'nuzlocke_run' then
        v_update_sql := v_update_sql || ', nuzlocke_run = case when $2 = ''nuzlocke'' then $1 -> ''nuzlocke_run'' else null end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then $1 -> ''nuzlocke_run'' else null end';
      else
        raise exception 'Unexpected personal team recovery column.';
    end case;
    v_insert_columns := v_insert_columns || ', ' || quote_ident(v_column_name);
  end loop;

  v_update_sql := v_update_sql || ', updated_at = now() where id = $3 and owner_id = auth.uid()';

  for v_team in select value from jsonb_array_elements(p_teams)
  loop
    v_id := (v_team ->> 'id')::uuid;
    v_workspace_type := case
      when (v_team ->> 'workspace_type') in ('tournament', 'nuzlocke') then v_team ->> 'workspace_type'
      else 'weekly'
    end;

    execute v_update_sql using v_team, v_workspace_type, v_id;
    get diagnostics v_updated = row_count;

    if v_updated = 0 then
      execute format(
        'insert into public.personal_teams (%s) values (%s)',
        v_insert_columns,
        v_insert_values
      ) using v_team, v_workspace_type, v_id;
    end if;
    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$$;

revoke all on function public.restore_my_personal_teams(jsonb)
  from public, anon, authenticated;
grant execute on function public.restore_my_personal_teams(jsonb)
  to authenticated;

comment on function public.restore_my_personal_teams(jsonb) is
  'Restores bounded private My Teams backups and every supported field present in the active schema, including complete Team Lab sets.';

do $hardening$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'personal_teams'
      and column_name = 'team_sets'
  ) then
    raise exception 'Migration 405 requires the Team Lab set column from migration 404.';
  end if;
  if has_function_privilege('anon', 'public.restore_my_personal_teams(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.restore_my_personal_teams(jsonb)', 'execute') then
    raise exception 'My Teams recovery RPC grants are incorrect.';
  end if;
end;
$hardening$;

commit;
notify pgrst, 'reload schema';

