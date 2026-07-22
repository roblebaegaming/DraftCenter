-- DraftCenter milestone 12: allow commissioners to send replacement/repeat invites.
-- Run once AFTER migrations 001-014.

-- Tokens are already unique. An email address should be allowed to receive a
-- fresh invite later (after an expiry, a removal, or a return to the league).
alter table public.league_invites drop constraint if exists league_invites_league_id_email_key;
drop index if exists public.league_invites_league_id_email_key;

create or replace function public.create_league_invite(p_league_id uuid, p_email text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_token uuid; v_expires_at timestamptz := now() + interval '14 days';
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can create invites.'; end if;
  insert into public.league_invites (league_id, email, role, created_by, expires_at)
  values (p_league_id, nullif(lower(trim(p_email)), ''), 'coach', auth.uid(), v_expires_at)
  returning token into v_token;
  return jsonb_build_object('token', v_token, 'role', 'coach', 'expires_at', v_expires_at);
end;
$$;

create or replace function public.create_spectator_invite(p_league_id uuid, p_email text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_token uuid; v_expires_at timestamptz := now() + interval '90 days';
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can create spectator links.'; end if;
  insert into public.league_invites (league_id, email, role, created_by, expires_at)
  values (p_league_id, nullif(lower(trim(p_email)), ''), 'viewer', auth.uid(), v_expires_at)
  returning token into v_token;
  return jsonb_build_object('token', v_token, 'role', 'viewer', 'expires_at', v_expires_at);
end;
$$;

grant execute on function public.create_league_invite(uuid, text) to authenticated;
grant execute on function public.create_spectator_invite(uuid, text) to authenticated;
