-- Allow a removed manager's open team to be reclaimed after a draft without
-- reopening ordinary draft-time team claiming.

begin;

create or replace function public.claim_live_setup_team(
  p_league_id uuid,
  p_team_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_team jsonb;
  v_name text;
  v_username text;
  v_user_id text := auth.uid()::text;
  v_membership_id uuid;
  v_team_id uuid;
  v_team_owner uuid;
  v_locked boolean;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_team_index < 0 then raise exception 'Choose a valid team.'; end if;

  select id
  into v_membership_id
  from public.league_memberships
  where league_id = p_league_id
    and user_id = auth.uid()
    and role in ('coach', 'commissioner', 'co_commissioner');

  if v_membership_id is null then
    raise exception 'Accept the manager invitation before claiming a team.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League setup was not found.'; end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League teams have not been initialized yet.';
  end if;

  v_locked := coalesce((v_state ->> 'locked')::boolean, false);
  v_team := v_state #> array['teams', p_team_index::text];
  if v_team is null then raise exception 'Team not found.'; end if;
  if nullif(trim(v_team ->> 'claimedBy'), '') is not null
     or nullif(trim(v_team ->> 'claimedByUserId'), '') is not null then
    raise exception 'That team has already been claimed. Refresh to see the remaining teams.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'teams') as team
    where team ->> 'claimedByUserId' = v_user_id
  ) or exists (
    select 1
    from public.teams
    where league_id = p_league_id
      and owner_membership_id = v_membership_id
  ) then
    raise exception 'You already claimed a team in this league.';
  end if;

  select id, owner_membership_id
  into v_team_id, v_team_owner
  from public.teams
  where league_id = p_league_id
    and source_key = p_team_index::text
  for update;

  if v_locked and v_team_id is null then
    raise exception 'That replacement team is not available in the live draft records.';
  end if;
  if v_team_owner is not null then
    raise exception 'That team has already been claimed. Refresh to see the remaining teams.';
  end if;

  select display_name, username
  into v_name, v_username
  from public.profiles
  where id = auth.uid();
  v_name := coalesce(nullif(trim(v_name), ''), nullif(trim(v_username), ''), 'Coach');

  if v_team_id is not null then
    update public.teams
    set owner_membership_id = v_membership_id
    where id = v_team_id;
  end if;

  v_state := jsonb_set(
    v_state,
    array['teams', p_team_index::text],
    v_team || jsonb_build_object(
      'claimedBy', v_name,
      'claimedByUserId', v_user_id
    ),
    false
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(greatest(coalesce((v_state ->> 'rev')::bigint, 0) + 1, 1)),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  if v_locked then
    insert into public.league_events(league_id, kind, actor_id, payload)
    values (
      p_league_id,
      'replacement_claimed',
      auth.uid(),
      jsonb_build_object('team_id', v_team_id, 'team_index', p_team_index)
    );
  end if;

  return v_state;
end;
$$;

revoke all on function public.claim_live_setup_team(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_live_setup_team(uuid, integer)
  to authenticated;

commit;
notify pgrst, 'reload schema';
