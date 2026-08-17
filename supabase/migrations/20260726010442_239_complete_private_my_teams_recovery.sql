-- Keep My Teams recovery complete as new private/public-sharing fields are added.
-- The restore remains owner-scoped: caller-supplied owner_id is never used.

begin;

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
    update public.personal_teams
    set team_name = btrim(v_team ->> 'team_name'),
        league_name = nullif(btrim(v_team ->> 'league_name'), ''),
        format_name = nullif(btrim(v_team ->> 'format_name'), ''),
        workspace_type = case when v_team ->> 'workspace_type' = 'tournament' then 'tournament' else 'weekly' end,
        planning_entries = coalesce(v_team -> 'planning_entries', '[]'::jsonb),
        notes = coalesce(v_team ->> 'notes', ''),
        weekly_notes = coalesce(v_team ->> 'weekly_notes', ''),
        pokepaste_url = nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        replica_code = coalesce(v_team ->> 'replica_code', ''),
        spreadsheet_url = nullif(btrim(v_team ->> 'spreadsheet_url'), ''),
        team_report_url = nullif(btrim(v_team ->> 'team_report_url'), ''),
        pokemon = coalesce(v_team -> 'pokemon', '[]'::jsonb),
        archived = coalesce((v_team ->> 'archived')::boolean, false),
        is_public = coalesce((v_team ->> 'is_public')::boolean, false),
        regulation_id = nullif(btrim(v_team ->> 'regulation_id'), ''),
        public_summary = coalesce(v_team ->> 'public_summary', ''),
        share_pokepaste = coalesce((v_team ->> 'share_pokepaste')::boolean, false),
        share_replica_code = coalesce((v_team ->> 'share_replica_code')::boolean, false),
        share_team_report = coalesce((v_team ->> 'share_team_report')::boolean, false),
        updated_at = now()
    where id = v_id and owner_id = auth.uid();

    if not found then
      insert into public.personal_teams (
        id, owner_id, team_name, league_name, format_name, workspace_type,
        planning_entries, notes, weekly_notes, pokepaste_url, replica_code,
        spreadsheet_url, team_report_url, pokemon, archived, is_public,
        regulation_id, public_summary, share_pokepaste, share_replica_code,
        share_team_report
      ) values (
        v_id,
        auth.uid(),
        btrim(v_team ->> 'team_name'),
        nullif(btrim(v_team ->> 'league_name'), ''),
        nullif(btrim(v_team ->> 'format_name'), ''),
        case when v_team ->> 'workspace_type' = 'tournament' then 'tournament' else 'weekly' end,
        coalesce(v_team -> 'planning_entries', '[]'::jsonb),
        coalesce(v_team ->> 'notes', ''),
        coalesce(v_team ->> 'weekly_notes', ''),
        nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        coalesce(v_team ->> 'replica_code', ''),
        nullif(btrim(v_team ->> 'spreadsheet_url'), ''),
        nullif(btrim(v_team ->> 'team_report_url'), ''),
        coalesce(v_team -> 'pokemon', '[]'::jsonb),
        coalesce((v_team ->> 'archived')::boolean, false),
        coalesce((v_team ->> 'is_public')::boolean, false),
        nullif(btrim(v_team ->> 'regulation_id'), ''),
        coalesce(v_team ->> 'public_summary', ''),
        coalesce((v_team ->> 'share_pokepaste')::boolean, false),
        coalesce((v_team ->> 'share_replica_code')::boolean, false),
        coalesce((v_team ->> 'share_team_report')::boolean, false)
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

commit;

notify pgrst, 'reload schema';
