-- Read-only My Teams history for DraftCenter-hosted leagues, plus a
-- database-enforced free-tier limit for manually created external teams.

begin;

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
        'league_id', league_id,
        'league_name', league_name,
        'slug', slug,
        'season_number', season_number,
        'archived', archived,
        'team_index', team_index,
        'team_name', team_name,
        'color', color,
        'logo_url', logo_url,
        'pokemon', coalesce(
          (select jsonb_agg(mon.value ->> 'name')
           from jsonb_array_elements(
             case when jsonb_typeof(roster) = 'array' then roster else '[]'::jsonb end
           ) mon(value)
           where nullif(mon.value ->> 'name', '') is not null),
          '[]'::jsonb
        )
      )
      order by archived asc, league_name, season_number desc, team_name
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

create or replace function public.enforce_personal_team_free_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id <> auth.uid() then
    raise exception 'Personal teams can only be created for your own account.';
  end if;

  if (
    select count(*)
    from public.personal_teams
    where owner_id = new.owner_id
  ) >= 10 then
    raise exception 'The free My Teams plan supports up to 10 external teams.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_personal_team_free_limit()
  from public, anon, authenticated;

drop trigger if exists personal_teams_enforce_free_limit
  on public.personal_teams;
create trigger personal_teams_enforce_free_limit
before insert on public.personal_teams
for each row
execute function public.enforce_personal_team_free_limit();

commit;

notify pgrst, 'reload schema';
