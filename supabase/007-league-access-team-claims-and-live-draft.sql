-- DraftCenter milestone 4
-- Run this once in the Supabase SQL Editor AFTER migrations 001-006.
-- It is additive and keeps the older is_public field in sync for compatibility.

alter table public.leagues
  add column if not exists league_visibility text not null default 'private',
  add column if not exists is_practice boolean not null default false,
  add column if not exists practice_expires_at timestamptz;

alter table public.leagues drop constraint if exists leagues_visibility_check;
alter table public.leagues add constraint leagues_visibility_check
  check (league_visibility in ('private', 'watch', 'open'));

update public.leagues
set league_visibility = case when is_public then 'watch' else 'private' end
where league_visibility = 'private' and is_public = true;

create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_description text,
  p_season_label text,
  p_visibility text,
  p_is_practice boolean
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league_id uuid; v_visibility text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to create a league.'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'League name must be at least 2 characters.'; end if;
  if p_slug !~ '^[a-z0-9-]{3,100}$' then raise exception 'League link must use 3-100 lowercase letters, numbers, or hyphens.'; end if;
  v_visibility := coalesce(nullif(lower(trim(p_visibility)), ''), 'private');
  if v_visibility not in ('private', 'watch', 'open') then raise exception 'Invalid league visibility.'; end if;

  insert into public.profiles (id, display_name)
  values (auth.uid(), 'Coach') on conflict (id) do nothing;

  insert into public.leagues (name, slug, description, season_label, created_by, is_public, league_visibility, is_practice, practice_expires_at)
  values (trim(p_name), p_slug, coalesce(p_description, ''), nullif(trim(p_season_label), ''), auth.uid(),
          v_visibility <> 'private', v_visibility, coalesce(p_is_practice, false),
          case when coalesce(p_is_practice, false) then now() + interval '30 days' else null end)
  returning id into v_league_id;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'commissioner');
  insert into public.league_state_snapshots (league_id) values (v_league_id);
  return v_league_id;
end;
$$;

create or replace function public.update_league_access(
  p_league_id uuid,
  p_visibility text,
  p_is_practice boolean default false,
  p_practice_expires_at timestamptz default null
)
returns public.leagues
language plpgsql security definer set search_path = public
as $$
declare v_league public.leagues; v_visibility text;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can update league access.'; end if;
  v_visibility := lower(trim(p_visibility));
  if v_visibility not in ('private', 'watch', 'open') then raise exception 'Choose private, watch, or open.'; end if;
  update public.leagues set league_visibility = v_visibility, is_public = v_visibility <> 'private',
    is_practice = coalesce(p_is_practice, false), practice_expires_at = case
      when coalesce(p_is_practice, false) then coalesce(p_practice_expires_at, now() + interval '30 days') else null end,
    updated_at = now()
  where id = p_league_id returning * into v_league;
  return v_league;
end;
$$;

-- Open leagues add a coach; watch leagues intentionally do not expose a Join button.
create or replace function public.join_open_league(p_slug text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to join a league.'; end if;
  select id into v_league_id from public.leagues where slug = p_slug and league_visibility = 'open';
  if v_league_id is null then raise exception 'That open league was not found.'; end if;
  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'coach') on conflict (league_id, user_id) do nothing;
  return v_league_id;
end;
$$;

create table if not exists public.team_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.team_assignments enable row level security;
create policy "members see team assignments" on public.team_assignments for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and public.is_league_member(t.league_id)));

-- Commissioners can give an existing DraftCenter username a team. The user
-- becomes a coach automatically; the existing claim_team RPC still lets a coach claim an unassigned team themselves.
create or replace function public.assign_team_to_username(p_team_id uuid, p_username text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league_id uuid; v_user_id uuid; v_membership_id uuid;
begin
  select league_id into v_league_id from public.teams where id = p_team_id for update;
  if v_league_id is null then raise exception 'Team not found.'; end if;
  if not public.is_league_staff(v_league_id) then raise exception 'Only league commissioners can assign teams.'; end if;
  select id into v_user_id from public.profiles where lower(username) = lower(trim(p_username));
  if v_user_id is null then raise exception 'No DraftCenter profile has that username yet.'; end if;
  insert into public.league_memberships (league_id, user_id, role) values (v_league_id, v_user_id, 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end
    returning id into v_membership_id;
  if exists (select 1 from public.teams where league_id = v_league_id and owner_membership_id = v_membership_id and id <> p_team_id) then
    raise exception 'That coach already has a team in this league.';
  end if;
  update public.teams set owner_membership_id = v_membership_id where id = p_team_id;
  insert into public.team_assignments (team_id, assigned_to, assigned_by) values (p_team_id, v_user_id, auth.uid())
    on conflict (team_id) do update set assigned_to = excluded.assigned_to, assigned_by = excluded.assigned_by, created_at = now();
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (v_league_id, 'team_assigned', auth.uid(), jsonb_build_object('team_id', p_team_id, 'username', lower(trim(p_username))));
  return v_membership_id;
end;
$$;

-- Correct the original draft function's return type so a UUID pick id is not
-- forced into a bigint. This keeps pick locking and turn advancement on the server.
drop function if exists public.make_snake_pick(uuid, uuid);
create or replace function public.make_snake_pick(p_draft_session_id uuid, p_league_pokemon_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league uuid; v_team uuid; v_pick int; v_config jsonb; v_order jsonb; v_total int; v_next_team uuid; v_pokemon record; v_pick_id uuid;
begin
  select league_id, current_team_id, current_pick_number, configuration into v_league, v_team, v_pick, v_config
    from public.draft_sessions where id = p_draft_session_id and status = 'active' and mode = 'snake' for update;
  if v_league is null then raise exception 'No active snake draft found.'; end if;
  if not public.is_league_staff(v_league) and not exists (
    select 1 from public.teams t join public.league_memberships m on m.id = t.owner_membership_id where t.id = v_team and m.user_id = auth.uid()
  ) then raise exception 'It is not your team''s turn.'; end if;
  select * into v_pokemon from public.league_pokemon where id = p_league_pokemon_id and league_id = v_league for update;
  if v_pokemon.id is null or not v_pokemon.is_allowed or v_pokemon.is_drafted then raise exception 'That Pokémon is no longer available.'; end if;
  update public.league_pokemon set is_drafted = true where id = p_league_pokemon_id;
  insert into public.draft_picks(draft_session_id, team_id, league_pokemon_id, pick_number, made_by)
    values (p_draft_session_id, v_team, p_league_pokemon_id, v_pick, auth.uid()) returning id into v_pick_id;
  insert into public.roster_entries(team_id, league_pokemon_id, acquisition_type) values (v_team, p_league_pokemon_id, 'draft');
  v_order := v_config -> 'team_order'; v_total := jsonb_array_length(v_order);
  if v_pick + 1 >= v_total then
    update public.draft_sessions set status = 'complete', current_pick_number = v_pick + 1, current_team_id = null, updated_at = now() where id = p_draft_session_id;
  else
    v_next_team := (v_order ->> (v_pick + 1))::uuid;
    update public.draft_sessions set current_pick_number = v_pick + 1, current_team_id = v_next_team, updated_at = now() where id = p_draft_session_id;
  end if;
  insert into public.league_events(league_id, kind, actor_id, payload)
    values (v_league, 'draft_pick', auth.uid(), jsonb_build_object('draft_pick_id', v_pick_id, 'team_id', v_team, 'league_pokemon_id', p_league_pokemon_id, 'pick_number', v_pick));
  return v_pick_id;
end;
$$;

grant execute on function public.create_league(text, text, text, text, text, boolean) to authenticated;
grant execute on function public.update_league_access(uuid, text, boolean, timestamptz) to authenticated;
grant execute on function public.join_open_league(text) to authenticated;
grant execute on function public.assign_team_to_username(uuid, text) to authenticated;
grant execute on function public.make_snake_pick(uuid, uuid) to authenticated;
