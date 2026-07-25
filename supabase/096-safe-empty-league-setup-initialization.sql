-- Safely persist the initial setup shown for a newly created league.
-- New league rows historically began with an empty {} snapshot, while the
-- React setup screen hydrated local default teams. A claim against that empty
-- server snapshot therefore failed with "Team not found."

begin;

create or replace function public.initialize_league_setup_if_empty(
  p_league_id uuid,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_existing_revision bigint;
  v_incoming jsonb := p_state;
  v_team_count integer;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can initialize league setup.';
  end if;

  select state, revision
  into v_existing, v_existing_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League setup was not found.';
  end if;

  -- Idempotent and overwrite-safe: once the server has teams, the caller's
  -- fallback payload is ignored and the authoritative state is returned.
  if jsonb_typeof(v_existing -> 'teams') = 'array'
     and jsonb_array_length(v_existing -> 'teams') > 0 then
    return v_existing;
  end if;

  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(p_state -> 'teams') <> 'array' then
    raise exception 'The initial league setup is incomplete.';
  end if;
  v_team_count := jsonb_array_length(p_state -> 'teams');
  if v_team_count < 2 or v_team_count > 16 then
    raise exception 'A league must start with 2 to 16 teams.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_state -> 'teams') team(value)
    where jsonb_typeof(team.value) <> 'object'
      or nullif(btrim(team.value ->> 'name'), '') is null
  ) then
    raise exception 'Every initial team needs a name.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_state -> 'teams') team(value)
    group by lower(btrim(team.value ->> 'name'))
    having count(*) > 1
  ) then
    raise exception 'Initial team names must be unique.';
  end if;
  if coalesce((p_state ->> 'locked')::boolean, false)
     or jsonb_array_length(coalesce(p_state -> 'rosters', '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(p_state -> 'schedule', '[]'::jsonb)) > 0
     or coalesce(p_state -> 'playoffs', 'null'::jsonb) <> 'null'::jsonb
     or jsonb_array_length(coalesce(p_state -> 'seasonHistory', '[]'::jsonb)) > 0 then
    raise exception 'Only a brand-new empty league can be initialized.';
  end if;

  v_incoming := jsonb_set(
    v_incoming,
    '{rev}',
    to_jsonb(coalesce((v_existing ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_incoming,
      revision = coalesce(v_existing_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  update public.leagues
  set settings = coalesce(v_incoming -> 'settings', '{}'::jsonb),
      updated_at = now()
  where id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'league_setup_initialized',
    auth.uid(),
    jsonb_build_object('team_count', v_team_count)
  );
  return v_incoming;
end;
$$;

revoke all on function public.initialize_league_setup_if_empty(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.initialize_league_setup_if_empty(uuid, jsonb)
  to authenticated;

commit;

notify pgrst, 'reload schema';
