-- Private account-wide regular-season match record for the signed-in profile.

begin;

create or replace function public.get_my_career_match_record()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_wins integer := 0;
  v_losses integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your career record.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_name
  from public.profiles
  where id = auth.uid();

  with current_matches as (
    select
      case when result.value ->> 'gamesA' ~ '^[0-9]+$'
        then (result.value ->> 'gamesA')::integer else 0 end as games_a,
      case when result.value ->> 'gamesB' ~ '^[0-9]+$'
        then (result.value ->> 'gamesB')::integer else 0 end as games_b,
      lower(coalesce(s.state #>> array[
        'teams',
        s.state #>> array['schedule', split_part(result.key, '-', 1), split_part(result.key, '-', 2), '0'],
        'claimedBy'
      ], '')) = lower(v_name) as is_team_a,
      lower(coalesce(s.state #>> array[
        'teams',
        s.state #>> array['schedule', split_part(result.key, '-', 1), split_part(result.key, '-', 2), '1'],
        'claimedBy'
      ], '')) = lower(v_name) as is_team_b
    from public.league_state_snapshots s
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_each(
      case when jsonb_typeof(s.state -> 'matchResults') = 'object'
        then s.state -> 'matchResults' else '{}'::jsonb end
    ) result
  ),
  current_record as (
    select
      count(*) filter (
        where (is_team_a and games_a > games_b)
           or (is_team_b and games_b > games_a)
      )::integer as wins,
      count(*) filter (
        where (is_team_a and games_a < games_b)
           or (is_team_b and games_b < games_a)
      )::integer as losses
    from current_matches
    where is_team_a or is_team_b
  ),
  archived_record as (
    select
      coalesce(sum(case when standing.value ->> 'w' ~ '^[0-9]+$'
        then (standing.value ->> 'w')::integer else 0 end), 0)::integer as wins,
      coalesce(sum(case when standing.value ->> 'l' ~ '^[0-9]+$'
        then (standing.value ->> 'l')::integer else 0 end), 0)::integer as losses
    from public.league_state_snapshots s
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(s.state -> 'seasonHistory') = 'array'
        then s.state -> 'seasonHistory' else '[]'::jsonb end
    ) season
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(season.value -> 'standings') = 'array'
        then season.value -> 'standings' else '[]'::jsonb end
    ) standing
    where lower(coalesce(
      season.value #>> array['teams', standing.value ->> 'id', 'claimedBy'], ''
    )) = lower(v_name)
  )
  select
    coalesce(current_record.wins, 0) + coalesce(archived_record.wins, 0),
    coalesce(current_record.losses, 0) + coalesce(archived_record.losses, 0)
  into v_wins, v_losses
  from current_record cross join archived_record;

  return jsonb_build_object(
    'wins', v_wins,
    'losses', v_losses,
    'games', v_wins + v_losses,
    'win_percentage', case
      when v_wins + v_losses = 0 then 0
      else round(100.0 * v_wins / (v_wins + v_losses), 1)
    end
  );
end;
$$;

revoke all on function public.get_my_career_match_record()
  from public, anon, authenticated;

grant execute on function public.get_my_career_match_record()
  to authenticated;

commit;

notify pgrst, 'reload schema';
