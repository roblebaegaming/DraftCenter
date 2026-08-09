-- Migration 365: profile-owned Nuzlocke Run Cards inside the existing private My Teams binder.
-- League teams and ordinary external teams keep their existing contracts.

begin;

alter table public.personal_teams
  add column if not exists nuzlocke_run jsonb;

alter table public.personal_teams
  drop constraint if exists personal_teams_workspace_type_check,
  add constraint personal_teams_workspace_type_check
    check (workspace_type in ('weekly', 'tournament', 'nuzlocke'));

alter table public.personal_teams
  drop constraint if exists personal_teams_nuzlocke_run_check,
  add constraint personal_teams_nuzlocke_run_check
    check (
      (
        workspace_type = 'nuzlocke'
        and not is_public
        and nuzlocke_run is not null
        and jsonb_typeof(nuzlocke_run) = 'object'
        and jsonb_typeof(nuzlocke_run -> 'team') = 'array'
        and jsonb_array_length(nuzlocke_run -> 'team') between 1 and 251
        and octet_length(nuzlocke_run::text) <= 500000
      )
      or (
        workspace_type <> 'nuzlocke'
        and nuzlocke_run is null
      )
    );

comment on column public.personal_teams.nuzlocke_run is
  'Owner-only normalized Nuzlocke Run Card, including encounters and recreation URL.';

create or replace function public.restore_my_personal_teams(p_teams jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team jsonb;
  v_id uuid;
  v_existing integer;
  v_new integer;
  v_restored integer := 0;
  v_workspace_type text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before restoring My Teams.';
  end if;
  if jsonb_typeof(p_teams) <> 'array' or jsonb_array_length(p_teams) > 10 then
    raise exception 'A My Teams recovery file must contain at most 10 teams.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_teams) team
    where nullif(team ->> 'id', '') is null
       or nullif(btrim(team ->> 'team_name'), '') is null
  ) then
    raise exception 'The recovery file contains an invalid team.';
  end if;

  select count(*) into v_existing
  from public.personal_teams
  where owner_id = auth.uid();

  select count(*) into v_new
  from jsonb_array_elements(p_teams) team
  where not exists (
    select 1
    from public.personal_teams existing
    where existing.id = (team ->> 'id')::uuid
      and existing.owner_id = auth.uid()
  );
  if v_existing + v_new > 10 then
    raise exception 'Restoring this file would exceed the 10-team limit.';
  end if;

  for v_team in select value from jsonb_array_elements(p_teams)
  loop
    v_id := (v_team ->> 'id')::uuid;
    v_workspace_type := case
      when (v_team ->> 'workspace_type') in ('tournament', 'nuzlocke') then v_team ->> 'workspace_type'
      else 'weekly'
    end;

    update public.personal_teams
    set team_name = btrim(v_team ->> 'team_name'),
        league_name = nullif(btrim(v_team ->> 'league_name'), ''),
        format_name = nullif(btrim(v_team ->> 'format_name'), ''),
        workspace_type = v_workspace_type,
        planning_entries = coalesce(v_team -> 'planning_entries', '[]'::jsonb),
        notes = coalesce(v_team ->> 'notes', ''),
        weekly_notes = coalesce(v_team ->> 'weekly_notes', ''),
        pokepaste_url = nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        replica_code = coalesce(v_team ->> 'replica_code', ''),
        spreadsheet_url = nullif(btrim(v_team ->> 'spreadsheet_url'), ''),
        team_report_url = nullif(btrim(v_team ->> 'team_report_url'), ''),
        pokemon = coalesce(v_team -> 'pokemon', '[]'::jsonb),
        archived = coalesce((v_team ->> 'archived')::boolean, false),
        is_public = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'is_public')::boolean, false) end,
        regulation_id = case when v_workspace_type = 'nuzlocke' then null else nullif(btrim(v_team ->> 'regulation_id'), '') end,
        public_summary = case when v_workspace_type = 'nuzlocke' then '' else coalesce(v_team ->> 'public_summary', '') end,
        share_pokepaste = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_pokepaste')::boolean, false) end,
        share_replica_code = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_replica_code')::boolean, false) end,
        share_team_report = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_team_report')::boolean, false) end,
        nuzlocke_run = case when v_workspace_type = 'nuzlocke' then v_team -> 'nuzlocke_run' else null end,
        updated_at = now()
    where id = v_id and owner_id = auth.uid();

    if not found then
      insert into public.personal_teams (
        id, owner_id, team_name, league_name, format_name, workspace_type,
        planning_entries, notes, weekly_notes, pokepaste_url, replica_code,
        spreadsheet_url, team_report_url, pokemon, archived, is_public,
        regulation_id, public_summary, share_pokepaste, share_replica_code,
        share_team_report, nuzlocke_run
      ) values (
        v_id,
        auth.uid(),
        btrim(v_team ->> 'team_name'),
        nullif(btrim(v_team ->> 'league_name'), ''),
        nullif(btrim(v_team ->> 'format_name'), ''),
        v_workspace_type,
        coalesce(v_team -> 'planning_entries', '[]'::jsonb),
        coalesce(v_team ->> 'notes', ''),
        coalesce(v_team ->> 'weekly_notes', ''),
        nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        coalesce(v_team ->> 'replica_code', ''),
        nullif(btrim(v_team ->> 'spreadsheet_url'), ''),
        nullif(btrim(v_team ->> 'team_report_url'), ''),
        coalesce(v_team -> 'pokemon', '[]'::jsonb),
        coalesce((v_team ->> 'archived')::boolean, false),
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'is_public')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then null else nullif(btrim(v_team ->> 'regulation_id'), '') end,
        case when v_workspace_type = 'nuzlocke' then '' else coalesce(v_team ->> 'public_summary', '') end,
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_pokepaste')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_replica_code')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_team_report')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then v_team -> 'nuzlocke_run' else null end
      );
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

do $$
begin
  if not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'personal_teams'
      and relation.relrowsecurity
  ) then
    raise exception 'personal_teams must keep row level security enabled.';
  end if;
  if has_table_privilege('anon', 'public.personal_teams', 'SELECT')
     or has_table_privilege('anon', 'public.personal_teams', 'INSERT')
     or has_table_privilege('anon', 'public.personal_teams', 'UPDATE')
     or has_table_privilege('anon', 'public.personal_teams', 'DELETE') then
    raise exception 'Anonymous users must not receive direct personal_teams access.';
  end if;
  if not has_table_privilege('authenticated', 'public.personal_teams', 'SELECT')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'INSERT')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'DELETE') then
    raise exception 'Authenticated My Teams grants are incomplete.';
  end if;
  if (select count(distinct command) from (
    select cmd as command
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_teams'
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) policies) <> 4 then
    raise exception 'Owner-scoped personal_teams policies are incomplete.';
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
