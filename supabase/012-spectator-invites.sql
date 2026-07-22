-- DraftCenter milestone 9: distinct competitor and spectator links.
-- Run once AFTER migrations 001-011.

create or replace function public.create_spectator_invite(p_league_id uuid, p_email text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_token uuid;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can create spectator links.';
  end if;
  insert into public.league_invites (league_id, email, role, created_by, expires_at)
  values (p_league_id, nullif(lower(trim(p_email)), ''), 'viewer', auth.uid(), now() + interval '90 days')
  returning token into v_token;
  return jsonb_build_object('token', v_token, 'role', 'viewer', 'expires_at', now() + interval '90 days');
end;
$$;

create or replace function public.accept_spectator_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_invite public.league_invites; v_email text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to view this league.'; end if;
  select * into v_invite from public.league_invites where token = p_token for update;
  if v_invite.id is null or v_invite.role <> 'viewer' then raise exception 'That spectator link is not available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then raise exception 'That spectator link has expired.'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_invite.email is not null and v_invite.email <> v_email then raise exception 'This spectator link was sent to a different email address.'; end if;
  insert into public.profiles (id, display_name) values (auth.uid(), coalesce(nullif(split_part(v_email, '@', 1), ''), 'Spectator')) on conflict (id) do nothing;
  insert into public.league_memberships (league_id, user_id, role)
  values (v_invite.league_id, auth.uid(), 'viewer')
  on conflict (league_id, user_id) do nothing;
  update public.league_invites set accepted_at = coalesce(accepted_at, now()) where id = v_invite.id;
  return v_invite.league_id;
end;
$$;

grant execute on function public.create_spectator_invite(uuid, text) to authenticated;
grant execute on function public.accept_spectator_invite(uuid) to authenticated;
