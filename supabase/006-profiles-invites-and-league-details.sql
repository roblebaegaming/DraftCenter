-- DraftCenter milestone 3: real profiles, shareable invite links, and league metadata.
-- Run this ONCE in Supabase SQL Editor after migrations 001-005.

alter table public.profiles add column if not exists username text;
alter table public.leagues add column if not exists draft_starts_at timestamptz;
alter table public.league_invites alter column email drop not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username)) where username is not null;

create or replace function public.set_my_profile(p_username text, p_display_name text default null)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters: lowercase letters, numbers, and underscores.';
  end if;
  insert into public.profiles (id, display_name, username)
  values (auth.uid(), coalesce(nullif(trim(p_display_name), ''), p_username), p_username)
  on conflict (id) do update
    set username = excluded.username,
        display_name = coalesce(nullif(trim(p_display_name), ''), public.profiles.display_name)
  returning * into v_profile;
  return v_profile;
end; $$;

create or replace function public.update_league_details(
  p_league_id uuid,
  p_name text,
  p_description text default '',
  p_season_label text default null,
  p_draft_starts_at timestamptz default null,
  p_is_public boolean default false
)
returns public.leagues
language plpgsql security definer set search_path = public
as $$
declare v_league public.leagues;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can update league details.'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'League name must be at least 2 characters.'; end if;
  update public.leagues set
    name = trim(p_name), description = coalesce(trim(p_description), ''),
    season_label = nullif(trim(p_season_label), ''), draft_starts_at = p_draft_starts_at,
    is_public = coalesce(p_is_public, false), updated_at = now()
  where id = p_league_id returning * into v_league;
  return v_league;
end; $$;

create or replace function public.create_league_invite(p_league_id uuid, p_email text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_token uuid; v_role public.membership_role;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can create invites.'; end if;
  insert into public.league_invites (league_id, email, role, created_by, expires_at)
  values (p_league_id, nullif(lower(trim(p_email)), ''), 'coach', auth.uid(), now() + interval '14 days')
  returning token, role into v_token, v_role;
  return jsonb_build_object('token', v_token, 'role', v_role, 'expires_at', now() + interval '14 days');
end; $$;

create or replace function public.accept_league_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_invite public.league_invites; v_email text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to accept an invite.'; end if;
  select * into v_invite from public.league_invites where token = p_token for update;
  if v_invite.id is null or v_invite.accepted_at is not null then raise exception 'This invite is no longer available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then raise exception 'This invite has expired.'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_invite.email is not null and v_invite.email <> v_email then raise exception 'This invite was sent to a different email address.'; end if;
  insert into public.profiles (id, display_name) values (auth.uid(), coalesce(nullif(split_part(v_email, '@', 1), ''), 'Coach')) on conflict (id) do nothing;
  insert into public.league_memberships (league_id, user_id, role)
  values (v_invite.league_id, auth.uid(), v_invite.role)
  on conflict (league_id, user_id) do nothing;
  update public.league_invites set accepted_at = coalesce(accepted_at, now()) where id = v_invite.id;
  return v_invite.league_id;
end; $$;

grant execute on function public.set_my_profile(text, text) to authenticated;
grant execute on function public.update_league_details(uuid, text, text, text, timestamptz, boolean) to authenticated;
grant execute on function public.create_league_invite(uuid, text) to authenticated;
grant execute on function public.accept_league_invite(uuid) to authenticated;
