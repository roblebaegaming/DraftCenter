-- Per-user My Teams archive preferences for DraftCenter-hosted league teams.
-- This never changes league state or another member's view.

begin;

create table if not exists public.my_league_team_archives (
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  team_index integer not null check (team_index >= 0),
  archived_at timestamptz not null default now(),
  primary key (user_id, league_id, season_number, team_index)
);

alter table public.my_league_team_archives enable row level security;
revoke all on table public.my_league_team_archives from public, anon, authenticated;

create or replace function public.set_my_league_team_archived(
  p_league_id uuid,
  p_season_number integer,
  p_team_index integer,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to organize My Teams.';
  end if;
  if p_season_number < 1 or p_team_index < 0 then
    raise exception 'That league-team reference is invalid.';
  end if;
  if not exists (
    select 1 from public.league_memberships
    where league_id = p_league_id and user_id = auth.uid()
  ) then
    raise exception 'You can only archive your own league teams.';
  end if;

  if coalesce(p_archived, false) then
    insert into public.my_league_team_archives (
      user_id, league_id, season_number, team_index
    ) values (
      auth.uid(), p_league_id, p_season_number, p_team_index
    )
    on conflict (user_id, league_id, season_number, team_index)
    do update set archived_at = now();
  else
    delete from public.my_league_team_archives
    where user_id = auth.uid()
      and league_id = p_league_id
      and season_number = p_season_number
      and team_index = p_team_index;
  end if;
end;
$$;

revoke all on function public.set_my_league_team_archived(uuid, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.set_my_league_team_archived(uuid, integer, integer, boolean)
  to authenticated;

create or replace function public.get_my_league_team_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_identity text;
  v_teams jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your league teams.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_identity
  from public.profiles
  where id = auth.uid();

  with current_teams as (
    select
      l.id as league_id,
      l.name as league_name,
      l.slug,
      coalesce(nullif(s.state ->> 'seasonNumber', '')::integer, 1) as season_number,
      false as archived,
      team.ordinality::integer - 1 as team_index,
      team.value ->> 'name' as team_name,
      team.value ->> 'color' as color,
      team.value ->> 'logoUrl' as logo_url,
      coalesce(s.state -> 'rosters' -> (team.ordinality::integer - 1), '[]'::jsonb) as roster
    from public.league_state_snapshots s
    join public.leagues l on l.id = s.league_id
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(s.state -> 'teams') = 'array'
        then s.state -> 'teams' else '[]'::jsonb end
    ) with ordinality team(value, ordinality)
    where lower(coalesce(team.value ->> 'claimedBy', '')) = lower(v_identity)
  ),
  archived_teams as (
    select
      l.id as league_id,
      l.name as league_name,
      l.slug,
      coalesce(nullif(season.value ->> 'seasonNumber', '')::integer, season.ordinality::integer) as season_number,
      true as archived,
      team.ordinality::integer - 1 as team_index,
      team.value ->> 'name' as team_name,
      team.value ->> 'color' as color,
      team.value ->> 'logoUrl' as logo_url,
      coalesce(season.value -> 'rosters' -> (team.ordinality::integer - 1), '[]'::jsonb) as roster
    from public.league_state_snapshots s
    join public.leagues l on l.id = s.league_id
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(s.state -> 'seasonHistory') = 'array'
        then s.state -> 'seasonHistory' else '[]'::jsonb end
    ) with ordinality season(value, ordinality)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(season.value -> 'teams') = 'array'
        then season.value -> 'teams' else '[]'::jsonb end
    ) with ordinality team(value, ordinality)
    where lower(coalesce(team.value ->> 'claimedBy', '')) = lower(v_identity)
  ),
  combined as (
    select * from current_teams
    union all
    select * from archived_teams
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'league_id', combined.league_id,
        'league_name', combined.league_name,
        'slug', combined.slug,
        'season_number', combined.season_number,
        'archived', combined.archived,
        'user_archived', exists (
          select 1
          from public.my_league_team_archives preference
          where preference.user_id = auth.uid()
            and preference.league_id = combined.league_id
            and preference.season_number = combined.season_number
            and preference.team_index = combined.team_index
        ),
        'team_index', combined.team_index,
        'team_name', combined.team_name,
        'color', combined.color,
        'logo_url', combined.logo_url,
        'pokemon', coalesce(
          (select jsonb_agg(mon.value ->> 'name')
           from jsonb_array_elements(
             case when jsonb_typeof(combined.roster) = 'array' then combined.roster else '[]'::jsonb end
           ) mon(value)
           where nullif(mon.value ->> 'name', '') is not null),
          '[]'::jsonb
        )
      )
      order by combined.archived asc, combined.league_name, combined.season_number desc, combined.team_name
    ),
    '[]'::jsonb
  )
  into v_teams
  from combined;

  return jsonb_build_object('teams', v_teams);
end;
$$;

revoke all on function public.get_my_league_team_history()
  from public, anon, authenticated;
grant execute on function public.get_my_league_team_history()
  to authenticated;

commit;

notify pgrst, 'reload schema';
