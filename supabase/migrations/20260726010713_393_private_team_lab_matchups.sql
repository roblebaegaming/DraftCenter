-- Migration 393: account-private Team Lab matchup plans and the current
-- no-quota My Teams contract. Future entitlements require a separate release.

begin;

drop trigger if exists personal_teams_enforce_free_limit on public.personal_teams;
drop function if exists public.enforce_personal_team_free_limit();

create unique index if not exists personal_teams_id_owner_idx
  on public.personal_teams(id, owner_id);

create table public.team_lab_matchups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  personal_team_id uuid not null references public.personal_teams(id) on delete cascade,
  opponent_name text not null check (char_length(btrim(opponent_name)) between 1 and 120),
  opponent_team_name text not null default '' check (char_length(opponent_team_name) <= 120),
  mode text not null default 'roster' check (mode in ('team', 'roster')),
  format_id text not null default 'reg-mb' check (format_id ~ '^[a-z0-9-]{1,80}$'),
  pokemon jsonb not null default '[]'::jsonb,
  notes text not null default '' check (char_length(notes) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_lab_matchups_pokemon_check check (
    jsonb_typeof(pokemon) = 'array'
    and jsonb_array_length(pokemon) <= 10
    and octet_length(pokemon::text) <= 5000
  )
);

alter table public.team_lab_matchups
  add constraint team_lab_matchups_personal_team_owner_fkey
  foreign key (personal_team_id, owner_id)
  references public.personal_teams(id, owner_id)
  on delete cascade;

create index team_lab_matchups_owner_team_updated_idx
  on public.team_lab_matchups(owner_id, personal_team_id, updated_at desc);

alter table public.team_lab_matchups enable row level security;
alter table public.team_lab_matchups force row level security;
revoke all on table public.team_lab_matchups from public, anon, authenticated;
grant all on table public.team_lab_matchups to service_role;

comment on table public.team_lab_matchups is
  'Private opponent rosters and notes attached to an account-owned My Teams workspace. Browser access is RPC-only.';

create or replace function public.set_team_lab_matchup_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_team_lab_matchup_updated_at()
  from public, anon, authenticated;

create trigger team_lab_matchups_set_updated_at
before update on public.team_lab_matchups
for each row execute function public.set_team_lab_matchup_updated_at();

create or replace function public.list_my_team_lab_matchups(
  p_personal_team_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', matchup.id,
    'personal_team_id', matchup.personal_team_id,
    'opponent_name', matchup.opponent_name,
    'opponent_team_name', matchup.opponent_team_name,
    'mode', matchup.mode,
    'format_id', matchup.format_id,
    'pokemon', matchup.pokemon,
    'notes', matchup.notes,
    'created_at', matchup.created_at,
    'updated_at', matchup.updated_at
  ) order by matchup.updated_at desc), '[]'::jsonb)
  from public.team_lab_matchups matchup
  where matchup.owner_id = auth.uid()
    and (p_personal_team_id is null or matchup.personal_team_id = p_personal_team_id);
$$;

create or replace function public.save_my_team_lab_matchup(
  p_matchup_id uuid,
  p_personal_team_id uuid,
  p_opponent_name text,
  p_opponent_team_name text,
  p_mode text,
  p_format_id text,
  p_pokemon jsonb,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_row public.team_lab_matchups%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a matchup plan.';
  end if;
  if not exists (
    select 1 from public.personal_teams team
    where team.id = p_personal_team_id and team.owner_id = auth.uid()
  ) then
    raise exception 'Choose one of your own saved teams.';
  end if;
  if char_length(btrim(coalesce(p_opponent_name, ''))) not between 1 and 120 then
    raise exception 'Opponent name must be between 1 and 120 characters.';
  end if;
  if char_length(coalesce(p_opponent_team_name, '')) > 120 then
    raise exception 'Opponent team name must be 120 characters or fewer.';
  end if;
  if p_mode not in ('team', 'roster') then
    raise exception 'Choose a supported Team Lab roster size.';
  end if;
  if coalesce(p_format_id, '') !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'Choose a supported Team Lab format.';
  end if;
  if p_pokemon is null
     or jsonb_typeof(p_pokemon) <> 'array'
     or jsonb_array_length(p_pokemon) > (case when p_mode = 'team' then 6 else 10 end)
     or octet_length(p_pokemon::text) > 5000
     or exists (
       select 1 from jsonb_array_elements(p_pokemon) item
       where jsonb_typeof(item) <> 'string'
          or char_length(btrim(item #>> '{}')) not between 1 and 120
     )
     or (
       select count(*) from jsonb_array_elements_text(p_pokemon)
     ) <> (
       select count(distinct roster_name)
       from jsonb_array_elements_text(p_pokemon) as roster(roster_name)
     ) then
    raise exception 'The opponent roster is invalid.';
  end if;
  if char_length(coalesce(p_notes, '')) > 20000 then
    raise exception 'Matchup notes must be 20,000 characters or fewer.';
  end if;

  if p_matchup_id is null then
    insert into public.team_lab_matchups (
      owner_id, personal_team_id, opponent_name, opponent_team_name,
      mode, format_id, pokemon, notes
    ) values (
      auth.uid(), p_personal_team_id, btrim(p_opponent_name),
      btrim(coalesce(p_opponent_team_name, '')), p_mode, p_format_id,
      p_pokemon, coalesce(p_notes, '')
    ) returning id into v_id;
  else
    update public.team_lab_matchups
    set personal_team_id = p_personal_team_id,
        opponent_name = btrim(p_opponent_name),
        opponent_team_name = btrim(coalesce(p_opponent_team_name, '')),
        mode = p_mode,
        format_id = p_format_id,
        pokemon = p_pokemon,
        notes = coalesce(p_notes, '')
    where id = p_matchup_id and owner_id = auth.uid()
    returning id into v_id;
    if v_id is null then
      raise exception 'That matchup plan is unavailable.';
    end if;
  end if;

  select * into v_row from public.team_lab_matchups
  where id = v_id and owner_id = auth.uid();

  return jsonb_build_object(
    'id', v_row.id,
    'personal_team_id', v_row.personal_team_id,
    'opponent_name', v_row.opponent_name,
    'opponent_team_name', v_row.opponent_team_name,
    'mode', v_row.mode,
    'format_id', v_row.format_id,
    'pokemon', v_row.pokemon,
    'notes', v_row.notes,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.delete_my_team_lab_matchup(p_matchup_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete a matchup plan.';
  end if;
  delete from public.team_lab_matchups
  where id = p_matchup_id and owner_id = auth.uid();
  if not found then
    raise exception 'That matchup plan is unavailable.';
  end if;
end;
$$;

create or replace function public.export_my_team_lab_matchups()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.list_my_team_lab_matchups(null);
$$;

create or replace function public.restore_my_team_lab_matchups(p_matchups jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_matchup jsonb;
  v_id uuid;
  v_team_id uuid;
  v_mode text;
  v_pokemon jsonb;
  v_restored integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in before restoring Team Lab matchups.';
  end if;
  if p_matchups is null
     or jsonb_typeof(p_matchups) <> 'array'
     or octet_length(p_matchups::text) > 10000000 then
    raise exception 'The Team Lab recovery section is invalid or too large.';
  end if;

  for v_matchup in select value from jsonb_array_elements(p_matchups)
  loop
    v_id := (v_matchup ->> 'id')::uuid;
    v_team_id := (v_matchup ->> 'personal_team_id')::uuid;
    v_mode := case when v_matchup ->> 'mode' = 'team' then 'team' else 'roster' end;
    v_pokemon := coalesce(v_matchup -> 'pokemon', '[]'::jsonb);

    if not exists (
      select 1 from public.personal_teams team
      where team.id = v_team_id and team.owner_id = auth.uid()
    ) then
      raise exception 'A restored matchup references a team outside this account.';
    end if;
    if nullif(btrim(v_matchup ->> 'opponent_name'), '') is null
       or char_length(btrim(v_matchup ->> 'opponent_name')) > 120
       or char_length(coalesce(v_matchup ->> 'opponent_team_name', '')) > 120
       or coalesce(v_matchup ->> 'format_id', '') !~ '^[a-z0-9-]{1,80}$'
       or jsonb_typeof(v_pokemon) <> 'array'
       or jsonb_array_length(v_pokemon) > (case when v_mode = 'team' then 6 else 10 end)
       or octet_length(v_pokemon::text) > 5000
       or exists (
         select 1 from jsonb_array_elements(v_pokemon) item
         where jsonb_typeof(item) <> 'string'
            or char_length(btrim(item #>> '{}')) not between 1 and 120
       )
       or (
         select count(*) from jsonb_array_elements_text(v_pokemon)
       ) <> (
         select count(distinct roster_name)
         from jsonb_array_elements_text(v_pokemon) as roster(roster_name)
       )
       or char_length(coalesce(v_matchup ->> 'notes', '')) > 20000 then
      raise exception 'The Team Lab recovery section contains an invalid matchup.';
    end if;

    update public.team_lab_matchups
    set personal_team_id = v_team_id,
        opponent_name = btrim(v_matchup ->> 'opponent_name'),
        opponent_team_name = btrim(coalesce(v_matchup ->> 'opponent_team_name', '')),
        mode = v_mode,
        format_id = v_matchup ->> 'format_id',
        pokemon = v_pokemon,
        notes = coalesce(v_matchup ->> 'notes', '')
    where id = v_id and owner_id = auth.uid();

    if not found then
      if exists (select 1 from public.team_lab_matchups where id = v_id) then
        raise exception 'A restored matchup identifier belongs to another account.';
      end if;
      insert into public.team_lab_matchups (
        id, owner_id, personal_team_id, opponent_name, opponent_team_name,
        mode, format_id, pokemon, notes
      ) values (
        v_id, auth.uid(), v_team_id, btrim(v_matchup ->> 'opponent_name'),
        btrim(coalesce(v_matchup ->> 'opponent_team_name', '')), v_mode,
        v_matchup ->> 'format_id', v_pokemon,
        coalesce(v_matchup ->> 'notes', '')
      );
    end if;
    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$$;

revoke all on function public.list_my_team_lab_matchups(uuid)
  from public, anon, authenticated;
revoke all on function public.save_my_team_lab_matchup(uuid, uuid, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.delete_my_team_lab_matchup(uuid)
  from public, anon, authenticated;
revoke all on function public.export_my_team_lab_matchups()
  from public, anon, authenticated;
revoke all on function public.restore_my_team_lab_matchups(jsonb)
  from public, anon, authenticated;

grant execute on function public.list_my_team_lab_matchups(uuid) to authenticated;
grant execute on function public.save_my_team_lab_matchup(uuid, uuid, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.delete_my_team_lab_matchup(uuid) to authenticated;
grant execute on function public.export_my_team_lab_matchups() to authenticated;
grant execute on function public.restore_my_team_lab_matchups(jsonb) to authenticated;

-- Preserve complete My Teams recovery without imposing a product count quota.
-- A payload-size guard remains to prevent a single abusive RPC request.
create or replace function public.restore_my_personal_teams(p_teams jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team jsonb;
  v_id uuid;
  v_restored integer := 0;
  v_workspace_type text;
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
        v_id, auth.uid(), btrim(v_team ->> 'team_name'),
        nullif(btrim(v_team ->> 'league_name'), ''),
        nullif(btrim(v_team ->> 'format_name'), ''), v_workspace_type,
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
      and relation.relname = 'team_lab_matchups'
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'team_lab_matchups must keep forced row level security enabled.';
  end if;
  if has_table_privilege('anon', 'public.team_lab_matchups', 'SELECT')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'SELECT')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'INSERT')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'UPDATE')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'DELETE') then
    raise exception 'Team Lab matchup table access must remain RPC-only.';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
