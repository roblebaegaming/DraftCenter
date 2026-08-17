-- Migration 396: private calendar links and structured opponent scouting.
-- The league planning RPC returns only a signed-in manager's scheduled matchup.

begin;

create or replace function public.is_valid_team_lab_opponent_sets(
  p_sets jsonb,
  p_roster jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    p_sets is not null
    and jsonb_typeof(p_sets) = 'object'
    and p_sets ->> 'version' = '1'
    and jsonb_typeof(p_sets -> 'pokemon') = 'array'
    and jsonb_typeof(p_roster) = 'array'
    and jsonb_array_length(case when jsonb_typeof(p_sets -> 'pokemon') = 'array' then p_sets -> 'pokemon' else '[]'::jsonb end)
      = jsonb_array_length(case when jsonb_typeof(p_roster) = 'array' then p_roster else '[]'::jsonb end)
    and jsonb_array_length(case when jsonb_typeof(p_sets -> 'pokemon') = 'array' then p_sets -> 'pokemon' else '[]'::jsonb end) <= 10
    and octet_length(p_sets::text) <= 20000
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(p_sets -> 'pokemon') = 'array' then p_sets -> 'pokemon' else '[]'::jsonb end) entry
      where jsonb_typeof(entry) is distinct from 'object'
         or jsonb_typeof(entry -> 'name') is distinct from 'string'
         or char_length(btrim(entry ->> 'name')) not between 1 and 120
         or jsonb_typeof(entry -> 'ability') is distinct from 'string'
         or char_length(entry ->> 'ability') > 100
         or jsonb_typeof(entry -> 'moves') is distinct from 'array'
         or jsonb_array_length(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) > 4
         or exists (
           select 1
           from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
           where jsonb_typeof(move) is distinct from 'string'
              or char_length(btrim(move #>> '{}')) not between 1 and 100
         )
         or (
           select count(*)
           from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
         ) <> (
           select count(distinct lower(btrim(move #>> '{}')))
           from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
         )
    )
    and (
      select count(*)
      from jsonb_array_elements(case when jsonb_typeof(p_sets -> 'pokemon') = 'array' then p_sets -> 'pokemon' else '[]'::jsonb end) entry
    ) = (
      select count(distinct lower(btrim(entry ->> 'name')))
      from jsonb_array_elements(case when jsonb_typeof(p_sets -> 'pokemon') = 'array' then p_sets -> 'pokemon' else '[]'::jsonb end) entry
    )
    and not exists (
      select 1
      from jsonb_array_elements_text(case when jsonb_typeof(p_roster) = 'array' then p_roster else '[]'::jsonb end) roster(name)
      where not exists (
        select 1
        from jsonb_array_elements(case when jsonb_typeof(p_sets -> 'pokemon') = 'array' then p_sets -> 'pokemon' else '[]'::jsonb end) entry
        where entry ->> 'name' = roster.name
      )
    )
  ), false);
$$;

revoke all on function public.is_valid_team_lab_opponent_sets(jsonb, jsonb)
  from public, anon, authenticated;

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
      select count(*) from jsonb_array_elements(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end)
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
         or (entry ? 'ability' and jsonb_typeof(entry -> 'ability') is distinct from 'string')
         or char_length(coalesce(entry ->> 'ability', '')) > 100
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
      select count(*) from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end)
    ) = (
      select count(distinct lower(btrim(entry ->> 'name')))
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) entry
    )), false);
$$;

revoke all on function public.is_valid_team_lab_battle_report(jsonb)
  from public, anon, authenticated;

alter table public.team_lab_matchups
  add column opponent_sets jsonb not null
    default '{"version":1,"pokemon":[]}'::jsonb;

update public.team_lab_matchups matchup
set opponent_sets = jsonb_build_object(
  'version', 1,
  'pokemon', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', roster.name,
      'ability', '',
      'moves', '[]'::jsonb
    ) order by roster.ordinality), '[]'::jsonb)
    from jsonb_array_elements_text(matchup.pokemon) with ordinality roster(name, ordinality)
  )
);

alter table public.team_lab_matchups
  add constraint team_lab_matchups_opponent_sets_check
  check (public.is_valid_team_lab_opponent_sets(opponent_sets, pokemon));

comment on column public.team_lab_matchups.opponent_sets is
  'Private versioned ability and four-move scouting entries aligned with the opponent roster.';

alter table public.pokemon_calendar_events
  add column personal_team_id uuid references public.personal_teams(id) on delete set null;

create index pokemon_calendar_events_personal_team_idx
  on public.pokemon_calendar_events(owner_id, personal_team_id)
  where personal_team_id is not null;

alter table public.pokemon_calendar_events force row level security;

drop policy if exists "Owners create their calendar events" on public.pokemon_calendar_events;
create policy "Owners create their calendar events"
  on public.pokemon_calendar_events for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      personal_team_id is null
      or exists (
        select 1 from public.personal_teams team
        where team.id = personal_team_id and team.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "Owners update their calendar events" on public.pokemon_calendar_events;
create policy "Owners update their calendar events"
  on public.pokemon_calendar_events for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      personal_team_id is null
      or exists (
        select 1 from public.personal_teams team
        where team.id = personal_team_id and team.owner_id = auth.uid()
      )
    )
  );

comment on column public.pokemon_calendar_events.personal_team_id is
  'Optional private connection to an account-owned My Teams workspace.';

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
    'opponent_sets', matchup.opponent_sets,
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

create or replace function public.save_my_team_lab_matchup_details(
  p_matchup_id uuid,
  p_personal_team_id uuid,
  p_opponent_name text,
  p_opponent_team_name text,
  p_mode text,
  p_format_id text,
  p_pokemon jsonb,
  p_opponent_sets jsonb,
  p_notes text,
  p_week_label text
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
       from jsonb_array_elements_text(p_pokemon) roster(roster_name)
     ) then
    raise exception 'The opponent roster is invalid.';
  end if;
  if not public.is_valid_team_lab_opponent_sets(p_opponent_sets, p_pokemon) then
    raise exception 'The opponent ability and move scouting data is invalid.';
  end if;
  if char_length(coalesce(p_notes, '')) > 20000 then
    raise exception 'Matchup notes must be 20,000 characters or fewer.';
  end if;
  if char_length(coalesce(p_week_label, '')) > 100 then
    raise exception 'Week or round must be 100 characters or fewer.';
  end if;

  if p_matchup_id is null then
    insert into public.team_lab_matchups (
      owner_id, personal_team_id, opponent_name, opponent_team_name,
      mode, format_id, pokemon, opponent_sets, notes, week_label
    ) values (
      auth.uid(), p_personal_team_id, btrim(p_opponent_name),
      btrim(coalesce(p_opponent_team_name, '')), p_mode, p_format_id,
      p_pokemon, p_opponent_sets, coalesce(p_notes, ''), btrim(coalesce(p_week_label, ''))
    ) returning id into v_id;
  else
    update public.team_lab_matchups
    set personal_team_id = p_personal_team_id,
        opponent_name = btrim(p_opponent_name),
        opponent_team_name = btrim(coalesce(p_opponent_team_name, '')),
        mode = p_mode,
        format_id = p_format_id,
        pokemon = p_pokemon,
        opponent_sets = p_opponent_sets,
        notes = coalesce(p_notes, ''),
        week_label = btrim(coalesce(p_week_label, ''))
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
    'opponent_sets', v_row.opponent_sets,
    'notes', v_row.notes,
    'week_label', v_row.week_label,
    'sheet_mode', v_row.sheet_mode,
    'battle_report', v_row.battle_report,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
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
  v_existing_sets jsonb := '{"version":1,"pokemon":[]}'::jsonb;
  v_week_label text := '';
  v_sets jsonb;
begin
  if p_matchup_id is not null then
    select opponent_sets, week_label into v_existing_sets, v_week_label
    from public.team_lab_matchups
    where id = p_matchup_id and owner_id = auth.uid();
  end if;

  select jsonb_build_object(
    'version', 1,
    'pokemon', coalesce(jsonb_agg(jsonb_build_object(
      'name', roster.name,
      'ability', coalesce(saved.entry ->> 'ability', ''),
      'moves', coalesce(saved.entry -> 'moves', '[]'::jsonb)
    ) order by roster.ordinality), '[]'::jsonb)
  )
  into v_sets
  from jsonb_array_elements_text(case when jsonb_typeof(p_pokemon) = 'array' then p_pokemon else '[]'::jsonb end)
    with ordinality roster(name, ordinality)
  left join lateral (
    select entry
    from jsonb_array_elements(case when jsonb_typeof(v_existing_sets -> 'pokemon') = 'array' then v_existing_sets -> 'pokemon' else '[]'::jsonb end) entry
    where entry ->> 'name' = roster.name
    limit 1
  ) saved on true;

  return public.save_my_team_lab_matchup_details(
    p_matchup_id, p_personal_team_id, p_opponent_name, p_opponent_team_name,
    p_mode, p_format_id, p_pokemon, v_sets, p_notes, v_week_label
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
    'opponent_sets', v_row.opponent_sets,
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
  v_opponent_sets jsonb;
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
    v_opponent_sets := coalesce(v_matchup -> 'opponent_sets', jsonb_build_object(
      'version', 1,
      'pokemon', (
        select coalesce(jsonb_agg(jsonb_build_object('name', name, 'ability', '', 'moves', '[]'::jsonb) order by ordinality), '[]'::jsonb)
        from jsonb_array_elements_text(case when jsonb_typeof(v_pokemon) = 'array' then v_pokemon else '[]'::jsonb end) with ordinality roster(name, ordinality)
      )
    ));
    v_week_label := coalesce(v_matchup ->> 'week_label', '');
    v_sheet_mode := case when v_matchup ->> 'sheet_mode' = 'open' then 'open' else 'closed' end;
    v_battle_report := coalesce(v_matchup -> 'battle_report', '{"version":1,"my_pokemon":[],"opponent_pokemon":[],"battle_notes":""}'::jsonb);

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
         from jsonb_array_elements_text(v_pokemon) roster(roster_name)
       )
       or char_length(coalesce(v_matchup ->> 'notes', '')) > 20000
       or char_length(v_week_label) > 100
       or not public.is_valid_team_lab_opponent_sets(v_opponent_sets, v_pokemon)
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
        opponent_sets = v_opponent_sets,
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
        mode, format_id, pokemon, opponent_sets, notes, week_label, sheet_mode, battle_report
      ) values (
        v_id, auth.uid(), v_team_id, btrim(v_matchup ->> 'opponent_name'),
        btrim(coalesce(v_matchup ->> 'opponent_team_name', '')), v_mode,
        v_matchup ->> 'format_id', v_pokemon, v_opponent_sets,
        coalesce(v_matchup ->> 'notes', ''), btrim(v_week_label),
        v_sheet_mode, v_battle_report
      );
    end if;
    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$$;

create or replace function public.get_my_league_matchup_planning_context(
  p_league_id uuid,
  p_week_index integer,
  p_my_team_index integer,
  p_opponent_team_index integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_state jsonb;
  v_league_name text;
  v_slug text;
  v_identity text;
  v_my_team jsonb;
  v_opponent_team jsonb;
  v_my_pokemon jsonb;
  v_opponent_pokemon jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to plan a league matchup.';
  end if;
  if p_week_index not between 0 and 127
     or p_my_team_index not between 0 and 127
     or p_opponent_team_index not between 0 and 127
     or p_my_team_index = p_opponent_team_index then
    raise exception 'That scheduled matchup is unavailable.';
  end if;

  select snapshot.state, league.name, league.slug,
         lower(coalesce(nullif(profile.display_name, ''), profile.username, ''))
  into v_state, v_league_name, v_slug, v_identity
  from public.league_state_snapshots snapshot
  join public.leagues league on league.id = snapshot.league_id
  join public.league_memberships membership
    on membership.league_id = league.id and membership.user_id = auth.uid()
  left join public.profiles profile on profile.id = auth.uid()
  where snapshot.league_id = p_league_id;

  if v_state is null then
    raise exception 'That scheduled matchup is unavailable.';
  end if;
  v_my_team := v_state -> 'teams' -> p_my_team_index;
  v_opponent_team := v_state -> 'teams' -> p_opponent_team_index;
  if v_my_team is null or v_opponent_team is null
     or not (
       v_my_team ->> 'claimedByUserId' = auth.uid()::text
       or (v_identity <> '' and lower(coalesce(v_my_team ->> 'claimedBy', '')) = v_identity)
     ) then
    raise exception 'That scheduled matchup is unavailable.';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'schedule' -> p_week_index) = 'array'
        then v_state -> 'schedule' -> p_week_index else '[]'::jsonb end
    ) pair
    where jsonb_typeof(pair) = 'array'
      and jsonb_array_length(pair) >= 2
      and (
        (pair ->> 0 = p_my_team_index::text and pair ->> 1 = p_opponent_team_index::text)
        or (pair ->> 1 = p_my_team_index::text and pair ->> 0 = p_opponent_team_index::text)
      )
  ) then
    raise exception 'That scheduled matchup is unavailable.';
  end if;

  select coalesce(jsonb_agg(mon ->> 'name' order by ordinality), '[]'::jsonb)
  into v_my_pokemon
  from jsonb_array_elements(
    case when jsonb_typeof(v_state -> 'rosters' -> p_my_team_index) = 'array'
      then v_state -> 'rosters' -> p_my_team_index else '[]'::jsonb end
  ) with ordinality roster(mon, ordinality)
  where jsonb_typeof(mon -> 'name') = 'string' and nullif(btrim(mon ->> 'name'), '') is not null;

  select coalesce(jsonb_agg(mon ->> 'name' order by ordinality), '[]'::jsonb)
  into v_opponent_pokemon
  from jsonb_array_elements(
    case when jsonb_typeof(v_state -> 'rosters' -> p_opponent_team_index) = 'array'
      then v_state -> 'rosters' -> p_opponent_team_index else '[]'::jsonb end
  ) with ordinality roster(mon, ordinality)
  where jsonb_typeof(mon -> 'name') = 'string' and nullif(btrim(mon ->> 'name'), '') is not null;

  return jsonb_build_object(
    'league_id', p_league_id,
    'league_name', v_league_name,
    'league_slug', v_slug,
    'season_number', coalesce(nullif(v_state ->> 'seasonNumber', '')::integer, 1),
    'week_index', p_week_index,
    'my_team_index', p_my_team_index,
    'my_team_name', coalesce(v_my_team ->> 'name', 'Your team'),
    'my_pokemon', v_my_pokemon,
    'opponent_team_index', p_opponent_team_index,
    'opponent_team_name', coalesce(v_opponent_team ->> 'name', 'Opponent'),
    'opponent_coach', coalesce(v_opponent_team ->> 'claimedBy', ''),
    'opponent_pokemon', v_opponent_pokemon
  );
end;
$$;

revoke all on function public.list_my_team_lab_matchups(uuid)
  from public, anon, authenticated;
revoke all on function public.save_my_team_lab_matchup_details(uuid, uuid, text, text, text, text, jsonb, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.save_my_team_lab_matchup(uuid, uuid, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.save_my_team_lab_battle_report(uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.restore_my_team_lab_matchups(jsonb)
  from public, anon, authenticated;
revoke all on function public.get_my_league_matchup_planning_context(uuid, integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.list_my_team_lab_matchups(uuid) to authenticated;
grant execute on function public.save_my_team_lab_matchup_details(uuid, uuid, text, text, text, text, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.save_my_team_lab_matchup(uuid, uuid, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.save_my_team_lab_battle_report(uuid, text, text, jsonb) to authenticated;
grant execute on function public.restore_my_team_lab_matchups(jsonb) to authenticated;
grant execute on function public.get_my_league_matchup_planning_context(uuid, integer, integer, integer) to authenticated;

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
  if not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'pokemon_calendar_events'
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'pokemon_calendar_events must use forced row level security.';
  end if;
  if has_table_privilege('anon', 'public.team_lab_matchups', 'SELECT')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'SELECT')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'INSERT')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'UPDATE')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'DELETE') then
    raise exception 'Structured opponent scouting must remain RPC-only.';
  end if;
  if has_function_privilege('anon', 'public.get_my_league_matchup_planning_context(uuid,integer,integer,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_league_matchup_planning_context(uuid,integer,integer,integer)', 'EXECUTE') then
    raise exception 'League matchup planning grants are invalid.';
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
