-- Keep new Team Lab matchup plans to one six-Pokémon battle team while
-- retaining legacy rows and backup recovery compatibility.

begin;

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
set search_path = ''
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
  if p_mode is distinct from 'team' then
    raise exception 'Team Lab matchup plans use one six-Pokémon team.';
  end if;
  if coalesce(p_format_id, '') !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'Choose a supported Team Lab format.';
  end if;
  if p_pokemon is null
     or jsonb_typeof(p_pokemon) <> 'array'
     or jsonb_array_length(p_pokemon) > 6
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
    raise exception 'The opponent team is invalid.';
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
      btrim(coalesce(p_opponent_team_name, '')), 'team', p_format_id,
      p_pokemon, p_opponent_sets, coalesce(p_notes, ''), btrim(coalesce(p_week_label, ''))
    ) returning id into v_id;
  else
    update public.team_lab_matchups
    set personal_team_id = p_personal_team_id,
        opponent_name = btrim(p_opponent_name),
        opponent_team_name = btrim(coalesce(p_opponent_team_name, '')),
        mode = 'team',
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

comment on function public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text) is
  'Saves one owner-scoped private six-Pokémon opponent plan and its bounded scouting fields. Legacy larger plans remain readable and restorable.';

revoke all on function public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text)
  to authenticated, service_role;

do $hardening$
declare
  v_definition text;
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'Team Lab matchup plans must keep forced row-level security.';
  end if;
  if has_table_privilege('anon', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'insert')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'delete') then
    raise exception 'Team Lab matchup access must remain RPC-only.';
  end if;
  if has_function_privilege('anon', 'public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text)', 'execute')
     or not has_function_privilege('service_role', 'public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text)', 'execute') then
    raise exception 'Team Lab matchup RPC grants are incorrect.';
  end if;
  select pg_get_functiondef('public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text)'::regprocedure)
  into v_definition;
  if lower(v_definition) not like '%jsonb_array_length(p_pokemon) > 6%'
     or lower(v_definition) not like '%p_mode is distinct from ''team''%'
     or lower(v_definition) not like '%set search_path to ''''%' then
    raise exception 'Team Lab six-Pokémon RPC hardening is incomplete.';
  end if;
end;
$hardening$;

notify pgrst, 'reload schema';
commit;
