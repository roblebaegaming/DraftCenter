-- Repair asymmetric overlap lookups for teams claimed before claimedByUserId
-- was stored in the league snapshot. Raw availability remains private: the
-- public RPC still returns only the caller's slots and computed intersections.

begin;

create or replace function public.match_availability_team_user(
  p_league_id uuid,
  p_state jsonb,
  p_team integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team jsonb;
  v_user uuid;
  v_claimed_name text;
  v_display_matches integer;
begin
  if p_team is null or p_team < 0 then
    return null;
  end if;

  v_team := p_state #> array['teams', p_team::text];
  if jsonb_typeof(v_team) <> 'object' then
    return null;
  end if;

  begin
    v_user := nullif(btrim(v_team ->> 'claimedByUserId'), '')::uuid;
  exception when others then
    v_user := null;
  end;

  if v_user is not null and exists (
    select 1
    from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = v_user
  ) then
    return v_user;
  end if;

  v_claimed_name := lower(nullif(btrim(v_team ->> 'claimedBy'), ''));
  if v_claimed_name is null then
    return null;
  end if;

  -- Usernames are account-unique and take precedence for legacy snapshots.
  select profile.id
  into v_user
  from public.profiles profile
  join public.league_memberships membership
    on membership.user_id = profile.id
   and membership.league_id = p_league_id
  where lower(coalesce(profile.username, '')) = v_claimed_name
  order by profile.id
  limit 1;

  if v_user is not null then
    return v_user;
  end if;

  -- Display names are accepted only when they identify exactly one member of
  -- this league. Ambiguous legacy names fail closed instead of exposing data.
  select
    count(*)::integer,
    (array_agg(profile.id order by profile.id))[1]
  into v_display_matches, v_user
  from public.profiles profile
  join public.league_memberships membership
    on membership.user_id = profile.id
   and membership.league_id = p_league_id
  where lower(coalesce(nullif(btrim(profile.display_name), ''), '')) = v_claimed_name;

  if v_display_matches = 1 then
    return v_user;
  end if;

  return null;
end;
$$;

create or replace function public.match_availability_actor_team(
  p_league_id uuid,
  p_state jsonb,
  p_week integer,
  p_match integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair jsonb;
  v_team integer;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    return null;
  end if;

  v_pair := p_state #> array['schedule', p_week::text, p_match::text];
  if jsonb_typeof(v_pair) <> 'array' or jsonb_array_length(v_pair) <> 2 then
    return null;
  end if;

  for v_team in
    select (value #>> '{}')::integer
    from jsonb_array_elements(v_pair)
  loop
    if public.match_availability_team_user(p_league_id, p_state, v_team) = auth.uid() then
      return v_team;
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.get_my_match_availability(
  p_league_id uuid,
  p_season_number integer,
  p_week integer,
  p_match integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_actor_team integer;
  v_pair jsonb;
  v_other_team integer;
  v_other_user uuid;
  v_own jsonb;
  v_mutual jsonb;
begin
  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id;

  v_actor_team := public.match_availability_actor_team(
    p_league_id, v_state, p_week, p_match
  );
  if v_actor_team is null then
    raise exception 'Only the two scheduled managers can coordinate this match.';
  end if;

  v_pair := v_state #> array['schedule', p_week::text, p_match::text];
  v_other_team := case
    when (v_pair ->> 0)::integer = v_actor_team then (v_pair ->> 1)::integer
    else (v_pair ->> 0)::integer
  end;
  v_other_user := public.match_availability_team_user(
    p_league_id, v_state, v_other_team
  );

  select coalesce(jsonb_agg(
    jsonb_build_object('id', id, 'starts_at', starts_at, 'ends_at', ends_at)
    order by starts_at
  ), '[]'::jsonb)
  into v_own
  from public.league_match_availability
  where league_id = p_league_id
    and season_number = p_season_number
    and week_index = p_week
    and match_index = p_match
    and user_id = auth.uid();

  select coalesce(jsonb_agg(
    jsonb_build_object('starts_at', overlap_start, 'ends_at', overlap_end)
    order by overlap_start
  ), '[]'::jsonb)
  into v_mutual
  from (
    select distinct
      greatest(mine.starts_at, theirs.starts_at) as overlap_start,
      least(mine.ends_at, theirs.ends_at) as overlap_end
    from public.league_match_availability mine
    join public.league_match_availability theirs
      on theirs.league_id = mine.league_id
      and theirs.season_number = mine.season_number
      and theirs.week_index = mine.week_index
      and theirs.match_index = mine.match_index
      and theirs.user_id = v_other_user
      and greatest(mine.starts_at, theirs.starts_at)
        < least(mine.ends_at, theirs.ends_at)
    where mine.league_id = p_league_id
      and mine.season_number = p_season_number
      and mine.week_index = p_week
      and mine.match_index = p_match
      and mine.user_id = auth.uid()
  ) overlap_rows;

  return jsonb_build_object(
    'own_slots', v_own,
    'mutual_slots', v_mutual,
    'opponent_has_submitted', exists (
      select 1
      from public.league_match_availability
      where league_id = p_league_id
        and season_number = p_season_number
        and week_index = p_week
        and match_index = p_match
        and user_id = v_other_user
    )
  );
end;
$$;

revoke all on function public.match_availability_team_user(uuid,jsonb,integer)
  from public, anon, authenticated;
revoke all on function public.match_availability_actor_team(uuid,jsonb,integer,integer)
  from public, anon, authenticated;
revoke all on function public.get_my_match_availability(uuid,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.get_my_match_availability(uuid,integer,integer,integer)
  to authenticated;

commit;

notify pgrst, 'reload schema';
