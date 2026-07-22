-- DraftCenter milestone 13: preview an invite before the recipient joins.
-- Run once AFTER migrations 001-015.

create or replace function public.preview_league_invite(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_invite public.league_invites; v_league public.leagues; v_email text;
begin
  if auth.uid() is null then raise exception 'Sign in before opening an invite.'; end if;
  select * into v_invite from public.league_invites where token = p_token;
  if v_invite.id is null or v_invite.accepted_at is not null then raise exception 'This invite is no longer available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then raise exception 'This invite has expired.'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_invite.email is not null and v_invite.email <> v_email then raise exception 'This invite was sent to a different email address.'; end if;
  select * into v_league from public.leagues where id = v_invite.league_id;
  return jsonb_build_object('token', v_invite.token, 'league_id', v_league.id, 'league_name', v_league.name, 'season_label', v_league.season_label, 'role', v_invite.role, 'is_spectator', v_invite.role = 'viewer', 'expires_at', v_invite.expires_at);
end;
$$;

grant execute on function public.preview_league_invite(uuid) to authenticated;
