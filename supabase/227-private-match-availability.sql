-- Privacy-first opponent availability. Raw slots are visible only to their
-- owner; opponents receive only overlapping windows.

begin;

create table if not exists public.league_match_availability (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_number integer not null,
  week_index integer not null,
  match_index integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint league_match_availability_valid_range
    check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours')
);

create index if not exists league_match_availability_lookup_idx
  on public.league_match_availability
    (league_id, season_number, week_index, match_index, user_id, starts_at);

alter table public.league_match_availability enable row level security;
revoke all on table public.league_match_availability from public, anon, authenticated;

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
  v_identity text;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    return null;
  end if;
  v_pair := p_state #> array['schedule', p_week::text, p_match::text];
  if jsonb_typeof(v_pair) <> 'array' or jsonb_array_length(v_pair) <> 2 then
    return null;
  end if;
  select lower(coalesce(nullif(display_name, ''), username, ''))
  into v_identity from public.profiles where id = auth.uid();
  for v_team in select (value #>> '{}')::integer from jsonb_array_elements(v_pair)
  loop
    if p_state #>> array['teams', v_team::text, 'claimedByUserId'] = auth.uid()::text
       or (
         nullif(p_state #>> array['teams', v_team::text, 'claimedByUserId'], '') is null
         and lower(coalesce(p_state #>> array['teams', v_team::text, 'claimedBy'], '')) = v_identity
       ) then
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
  select state into v_state from public.league_state_snapshots
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
  begin
    v_other_user := nullif(v_state #>> array['teams', v_other_team::text, 'claimedByUserId'], '')::uuid;
  exception when others then
    v_other_user := null;
  end;

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
  ) overlaps;

  return jsonb_build_object(
    'own_slots', v_own,
    'mutual_slots', v_mutual,
    'opponent_has_submitted', exists (
      select 1 from public.league_match_availability
      where league_id = p_league_id
        and season_number = p_season_number
        and week_index = p_week
        and match_index = p_match
        and user_id = v_other_user
    )
  );
end;
$$;

create or replace function public.save_my_match_availability(
  p_league_id uuid,
  p_season_number integer,
  p_week integer,
  p_match integer,
  p_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_actor_team integer;
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_slot jsonb;
  v_start timestamptz;
  v_end timestamptz;
begin
  if jsonb_typeof(coalesce(p_slots, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_slots, '[]'::jsonb)) > 12 then
    raise exception 'Save no more than 12 availability windows.';
  end if;
  select state into v_state from public.league_state_snapshots
  where league_id = p_league_id for update;
  v_actor_team := public.match_availability_actor_team(
    p_league_id, v_state, p_week, p_match
  );
  if v_actor_team is null then
    raise exception 'Only the two scheduled managers can coordinate this match.';
  end if;
  if coalesce((v_state ->> 'seasonNumber')::integer, 1) <> p_season_number then
    raise exception 'That season is no longer active.';
  end if;
  begin
    v_week_start := (v_state #>> '{settings,seasonStartsAt}')::timestamptz
      + make_interval(days => p_week * 7);
  exception when others then
    raise exception 'This league needs a weekly season start before availability can be saved.';
  end;
  v_week_end := v_week_start + interval '7 days';

  for v_slot in select value from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb))
  loop
    begin
      v_start := (v_slot ->> 'starts_at')::timestamptz;
      v_end := (v_slot ->> 'ends_at')::timestamptz;
    exception when others then
      raise exception 'Choose valid availability dates and times.';
    end;
    if v_start < v_week_start or v_end > v_week_end
       or v_end <= v_start or v_end > v_start + interval '12 hours' then
      raise exception 'Availability must fall within this match week and last no more than 12 hours.';
    end if;
  end loop;

  delete from public.league_match_availability
  where league_id = p_league_id
    and season_number = p_season_number
    and week_index = p_week
    and match_index = p_match
    and user_id = auth.uid();

  insert into public.league_match_availability (
    league_id, season_number, week_index, match_index, user_id, starts_at, ends_at
  )
  select p_league_id, p_season_number, p_week, p_match, auth.uid(),
    (value ->> 'starts_at')::timestamptz,
    (value ->> 'ends_at')::timestamptz
  from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb));

  return public.get_my_match_availability(
    p_league_id, p_season_number, p_week, p_match
  );
end;
$$;

revoke all on function public.match_availability_actor_team(uuid,jsonb,integer,integer)
  from public, anon, authenticated;
revoke all on function public.get_my_match_availability(uuid,integer,integer,integer)
  from public, anon, authenticated;
revoke all on function public.save_my_match_availability(uuid,integer,integer,integer,jsonb)
  from public, anon, authenticated;
grant execute on function public.get_my_match_availability(uuid,integer,integer,integer)
  to authenticated;
grant execute on function public.save_my_match_availability(uuid,integer,integer,integer,jsonb)
  to authenticated;

commit;

notify pgrst, 'reload schema';
