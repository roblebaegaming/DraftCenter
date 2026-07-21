-- Draft.League development milestone 1
-- Run AFTER the original supabase-schema.sql and 002-create-profiles-on-signup.sql.
-- This is additive: it does not replace or conflict with the earlier tables.

create table if not exists public.league_state_snapshots (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  email text not null,
  role public.membership_role not null default 'coach',
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (league_id, email)
);

alter table public.league_state_snapshots enable row level security;
alter table public.league_invites enable row level security;

create policy "league members read snapshots"
  on public.league_state_snapshots for select to authenticated
  using (public.is_league_member(league_id));

create policy "staff manage league invites"
  on public.league_invites for all to authenticated
  using (public.is_league_staff(league_id))
  with check (public.is_league_staff(league_id));

-- Atomically creates a league, its commissioner membership and an empty
-- state bridge. The bridge lets the evolving prototype save one league at a
-- time while relational features are migrated into their own tables.
create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_description text default '',
  p_season_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a league.';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'League name must be at least 2 characters.';
  end if;
  if p_slug !~ '^[a-z0-9-]{3,100}$' then
    raise exception 'League link must use 3-100 lowercase letters, numbers, or hyphens.';
  end if;

  insert into public.profiles (id, display_name)
  values (auth.uid(), 'Coach')
  on conflict (id) do nothing;

  insert into public.leagues (name, slug, description, season_label, created_by)
  values (trim(p_name), p_slug, coalesce(p_description, ''), nullif(trim(p_season_label), ''), auth.uid())
  returning id into v_league_id;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'commissioner');

  insert into public.league_state_snapshots (league_id)
  values (v_league_id);

  return v_league_id;
end;
$$;

-- Whole-state storage is deliberately temporary. It is restricted to league
-- staff while draft picks, trades and reports are migrated into validated RPCs.
create or replace function public.save_league_snapshot(
  p_league_id uuid,
  p_state jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can save the prototype state.';
  end if;

  insert into public.league_state_snapshots (league_id, state, revision, updated_at)
  values (p_league_id, p_state, 1, now())
  on conflict (league_id) do update
    set state = excluded.state,
        revision = public.league_state_snapshots.revision + 1,
        updated_at = now()
  returning revision into v_revision;

  return v_revision;
end;
$$;

grant execute on function public.create_league(text, text, text, text) to authenticated;
grant execute on function public.save_league_snapshot(uuid, jsonb) to authenticated;
