-- One general manager link may admit the whole league. Team ownership is
-- account-based so duplicate display names and concurrent claims stay safe.
begin;

alter table public.league_invites
  add column if not exists accepted_by uuid references auth.users(id) on delete set null;

create or replace function public.preview_league_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.league_invites;
  v_league public.leagues;
  v_email text;
  v_already_joined boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in before opening an invite.';
  end if;

  select * into v_invite from public.league_invites where token = p_token;
  if v_invite.id is null then raise exception 'This invite is no longer available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_invite.email is not null and v_invite.email <> v_email then
    raise exception 'This invite was sent to a different email address.';
  end if;

  v_already_joined := exists (
    select 1 from public.league_memberships
    where league_id = v_invite.league_id and user_id = auth.uid()
  );

  -- Addressed links remain single-recipient. General manager and spectator
  -- links have no email and intentionally remain reusable until expiry.
  if v_invite.email is not null
     and v_invite.accepted_at is not null
     and not (
       v_already_joined
       and (
         v_invite.accepted_by = auth.uid()
         or (v_invite.accepted_by is null and v_invite.email = v_email)
       )
     ) then
    raise exception 'This invite has already been accepted.';
  end if;

  select * into v_league from public.leagues where id = v_invite.league_id;
  return jsonb_build_object(
    'token', v_invite.token,
    'league_id', v_league.id,
    'league_name', v_league.name,
    'season_label', v_league.season_label,
    'role', v_invite.role,
    'is_spectator', v_invite.role = 'viewer',
    'expires_at', v_invite.expires_at,
    'already_joined', v_already_joined,
    'reusable', v_invite.email is null
  );
end;
$$;

create or replace function public.accept_league_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.league_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  select * into v_invite
  from public.league_invites
  where token = p_token
  for update;

  if v_invite.id is null then raise exception 'This invite is no longer available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_invite.email is not null and v_invite.email <> v_email then
    raise exception 'This invite was sent to a different email address.';
  end if;
  if v_invite.email is not null and v_invite.accepted_at is not null then
    if (
      v_invite.accepted_by = auth.uid()
      or (v_invite.accepted_by is null and v_invite.email = v_email)
    ) and exists (
      select 1 from public.league_memberships
      where league_id = v_invite.league_id and user_id = auth.uid()
    ) then
      update public.league_invites
      set accepted_by = coalesce(accepted_by, auth.uid())
      where id = v_invite.id;
      return v_invite.league_id;
    end if;
    raise exception 'This invite has already been accepted.';
  end if;

  insert into public.profiles(id, display_name)
  values(auth.uid(), coalesce(nullif(split_part(v_email, '@', 1), ''), 'Coach'))
  on conflict(id) do nothing;

  insert into public.league_memberships(league_id, user_id, role)
  values(v_invite.league_id, auth.uid(), v_invite.role)
  on conflict(league_id, user_id) do update
  set role = case
    when public.league_memberships.role = 'commissioner'
      then public.league_memberships.role
    when excluded.role = 'co_commissioner'
      then 'co_commissioner'::public.membership_role
    when public.league_memberships.role = 'viewer'
      then excluded.role
    else public.league_memberships.role
  end;

  if v_invite.email is not null then
    update public.league_invites
    set accepted_at = now(), accepted_by = auth.uid()
    where id = v_invite.id;
  end if;

  return v_invite.league_id;
end;
$$;

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
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_team_index < 0 then raise exception 'Choose a valid team.'; end if;
  if not exists (
    select 1 from public.league_memberships
    where league_id = p_league_id and user_id = auth.uid()
      and role in ('coach', 'commissioner', 'co_commissioner')
  ) then
    raise exception 'Accept the manager invitation before claiming a team.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League setup was not found.'; end if;
  if coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'Teams cannot be claimed after the live draft starts.';
  end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League teams have not been initialized yet.';
  end if;

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
  ) then
    raise exception 'You already claimed a team in this league.';
  end if;

  select display_name, username
  into v_name, v_username
  from public.profiles
  where id = auth.uid();
  v_name := coalesce(nullif(trim(v_name), ''), nullif(trim(v_username), ''), 'Coach');

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

  return v_state;
end;
$$;

revoke all on function public.preview_league_invite(uuid)
  from public, anon, authenticated;
revoke all on function public.accept_league_invite(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_live_setup_team(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.preview_league_invite(uuid) to authenticated;
grant execute on function public.accept_league_invite(uuid) to authenticated;
grant execute on function public.claim_live_setup_team(uuid, integer) to authenticated;

commit;
notify pgrst, 'reload schema';
