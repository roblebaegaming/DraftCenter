-- Migration 395: private Team Lab battle reports for weekly matchup use.
-- Battle observations remain account-private and browser access stays RPC-only.

begin;

create or replace function public.is_valid_team_lab_battle_report(p_report jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((p_report is not null
    and jsonb_typeof(p_report) = 'object'
    and p_report ->> 'version' = '1'
    and jsonb_typeof(p_report -> 'my_pokemon') = 'array'
    and jsonb_array_length(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end) <= 10
    and jsonb_typeof(p_report -> 'opponent_pokemon') = 'array'
    and jsonb_array_length(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) <= 10
    and jsonb_typeof(p_report -> 'battle_notes') = 'string'
    and char_length(p_report ->> 'battle_notes') <= 10000
    and octet_length(p_report::text) <= 50000
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end) entry
      where jsonb_typeof(entry) is distinct from 'object'
         or jsonb_typeof(entry -> 'name') is distinct from 'string'
         or char_length(btrim(entry ->> 'name')) not between 1 and 120
         or jsonb_typeof(entry -> 'brought') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'fainted') is distinct from 'boolean'
    )
    and (
      select count(*)
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end) entry
    ) = (
      select count(distinct lower(btrim(entry ->> 'name')))
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end) entry
    )
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) entry
      where jsonb_typeof(entry) is distinct from 'object'
         or jsonb_typeof(entry -> 'name') is distinct from 'string'
         or char_length(btrim(entry ->> 'name')) not between 1 and 120
         or jsonb_typeof(entry -> 'brought') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'fainted') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'moves') is distinct from 'array'
         or jsonb_array_length(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) > 4
         or exists (
           select 1
           from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
           where jsonb_typeof(move) is distinct from 'string'
              or char_length(btrim(move #>> '{}')) not between 1 and 100
         )
         or (
           select count(*) from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
         ) <> (
           select count(distinct lower(btrim(move #>> '{}')))
           from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
         )
    )
    and (
      select count(*)
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) entry
    ) = (
      select count(distinct lower(btrim(entry ->> 'name')))
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) entry
    )), false);
$$;

revoke all on function public.is_valid_team_lab_battle_report(jsonb)
  from public, anon, authenticated;

alter table public.team_lab_matchups
  add column week_label text not null default ''
    check (char_length(week_label) <= 100),
  add column sheet_mode text not null default 'closed'
    check (sheet_mode in ('closed', 'open')),
  add column battle_report jsonb not null default '{"version":1,"my_pokemon":[],"opponent_pokemon":[],"battle_notes":""}'::jsonb;

alter table public.team_lab_matchups
  add constraint team_lab_matchups_battle_report_check
  check (public.is_valid_team_lab_battle_report(battle_report));

comment on column public.team_lab_matchups.week_label is
  'Private free-form week or round label for this saved matchup.';
comment on column public.team_lab_matchups.sheet_mode is
  'Whether the private notebook is tracking a closed or open team sheet matchup.';
comment on column public.team_lab_matchups.battle_report is
  'Private versioned brought, fainted, revealed-move, and battle-note state.';

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
    'week_label', matchup.week_label,
    'sheet_mode', matchup.sheet_mode,
    'battle_report', matchup.battle_report,
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
    'week_label', v_row.week_label,
    'sheet_mode', v_row.sheet_mode,
    'battle_report', v_row.battle_report,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.save_my_team_lab_battle_report(
  p_matchup_id uuid,
  p_week_label text,
  p_sheet_mode text,
  p_battle_report jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.team_lab_matchups%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a battle report.';
  end if;
  if char_length(coalesce(p_week_label, '')) > 100 then
    raise exception 'Week or round must be 100 characters or fewer.';
  end if;
  if p_sheet_mode not in ('closed', 'open') then
    raise exception 'Choose closed or open team sheet mode.';
  end if;
  if not public.is_valid_team_lab_battle_report(p_battle_report) then
    raise exception 'The battle report is invalid.';
  end if;

  update public.team_lab_matchups
  set week_label = btrim(coalesce(p_week_label, '')),
      sheet_mode = p_sheet_mode,
      battle_report = p_battle_report
  where id = p_matchup_id and owner_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'That matchup plan is unavailable.';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'personal_team_id', v_row.personal_team_id,
    'opponent_name', v_row.opponent_name,
    'opponent_team_name', v_row.opponent_team_name,
    'mode', v_row.mode,
    'format_id', v_row.format_id,
    'pokemon', v_row.pokemon,
    'notes', v_row.notes,
    'week_label', v_row.week_label,
    'sheet_mode', v_row.sheet_mode,
    'battle_report', v_row.battle_report,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
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
  v_week_label text;
  v_sheet_mode text;
  v_battle_report jsonb;
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
    v_week_label := coalesce(v_matchup ->> 'week_label', '');
    v_sheet_mode := case when v_matchup ->> 'sheet_mode' = 'open' then 'open' else 'closed' end;
    v_battle_report := coalesce(
      v_matchup -> 'battle_report',
      '{"version":1,"my_pokemon":[],"opponent_pokemon":[],"battle_notes":""}'::jsonb
    );

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
       or char_length(coalesce(v_matchup ->> 'notes', '')) > 20000
       or char_length(v_week_label) > 100
       or not public.is_valid_team_lab_battle_report(v_battle_report) then
      raise exception 'The Team Lab recovery section contains an invalid matchup.';
    end if;

    update public.team_lab_matchups
    set personal_team_id = v_team_id,
        opponent_name = btrim(v_matchup ->> 'opponent_name'),
        opponent_team_name = btrim(coalesce(v_matchup ->> 'opponent_team_name', '')),
        mode = v_mode,
        format_id = v_matchup ->> 'format_id',
        pokemon = v_pokemon,
        notes = coalesce(v_matchup ->> 'notes', ''),
        week_label = btrim(v_week_label),
        sheet_mode = v_sheet_mode,
        battle_report = v_battle_report
    where id = v_id and owner_id = auth.uid();

    if not found then
      if exists (select 1 from public.team_lab_matchups where id = v_id) then
        raise exception 'A restored matchup identifier belongs to another account.';
      end if;
      insert into public.team_lab_matchups (
        id, owner_id, personal_team_id, opponent_name, opponent_team_name,
        mode, format_id, pokemon, notes, week_label, sheet_mode, battle_report
      ) values (
        v_id, auth.uid(), v_team_id, btrim(v_matchup ->> 'opponent_name'),
        btrim(coalesce(v_matchup ->> 'opponent_team_name', '')), v_mode,
        v_matchup ->> 'format_id', v_pokemon,
        coalesce(v_matchup ->> 'notes', ''), btrim(v_week_label),
        v_sheet_mode, v_battle_report
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
revoke all on function public.save_my_team_lab_battle_report(uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.restore_my_team_lab_matchups(jsonb)
  from public, anon, authenticated;

grant execute on function public.list_my_team_lab_matchups(uuid) to authenticated;
grant execute on function public.save_my_team_lab_matchup(uuid, uuid, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.save_my_team_lab_battle_report(uuid, text, text, jsonb) to authenticated;
grant execute on function public.restore_my_team_lab_matchups(jsonb) to authenticated;

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
    raise exception 'Team Lab battle reports must remain RPC-only.';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.save_my_team_lab_battle_report(uuid,text,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated Team Lab battle-report save access is missing.';
  end if;
end;
$$;

commit;
