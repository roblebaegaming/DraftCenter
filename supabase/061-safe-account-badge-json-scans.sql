-- Safely scan legacy league snapshots while refreshing account-wide badges.
-- Older snapshots may contain arrays or nulls where current snapshots use objects.

create or replace function public.refresh_my_account_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_map jsonb := jsonb_build_object(
    'draftDayHero','draft_day_hero',
    'leagueChampion','league_champion',
    'playoffQualifier','playoff_qualifier',
    'predictionChampion','prediction_champion',
    'biggestTrader','trade_master',
    'waiverWireWizard','waiver_wizard',
    'perfectSeason','perfect_season',
    'giantSlayer','giant_slayer'
  );
  v_key text;
  v_code text;
  v_total integer;
  r record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view badges.';
  end if;

  select coalesce(nullif(display_name,''), username)
    into v_name
  from public.profiles
  where id = auth.uid();

  for v_key, v_code in
    select key, value #>> '{}'
    from jsonb_each(v_map)
  loop
    select coalesce(sum(
      case
        when jsonb_typeof(s.state #> array['badges',v_name,v_key]) = 'number'
          then (s.state #>> array['badges',v_name,v_key])::integer
        else 0
      end
    ),0)::integer
      into v_total
    from public.league_state_snapshots s
    join public.league_memberships m on m.league_id = s.league_id
    where m.user_id = auth.uid();

    perform public.set_badge_progress(auth.uid(), v_code, '', v_total);
  end loop;

  with current_wins as (
    select count(*)::integer total
    from public.league_state_snapshots s
    join public.league_memberships lm on lm.league_id = s.league_id
    cross join lateral jsonb_each(
      case when jsonb_typeof(s.state->'matchResults') = 'object'
        then s.state->'matchResults' else '{}'::jsonb end
    ) result
    where lm.user_id = auth.uid()
      and lower(coalesce(s.state #>> array[
        'teams',
        case
          when coalesce((result.value->>'gamesA')::integer,0) >
               coalesce((result.value->>'gamesB')::integer,0)
            then s.state #>> array['schedule',split_part(result.key,'-',1),split_part(result.key,'-',2),'0']
          else s.state #>> array['schedule',split_part(result.key,'-',1),split_part(result.key,'-',2),'1']
        end,
        'claimedBy'
      ],'')) = lower(v_name)
  ),
  archived_wins as (
    select coalesce(sum(coalesce((standing.value->>'w')::integer,0)),0)::integer total
    from public.league_state_snapshots s
    join public.league_memberships lm on lm.league_id = s.league_id
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(s.state->'seasonHistory') = 'array'
        then s.state->'seasonHistory' else '[]'::jsonb end
    ) season
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(season.value->'standings') = 'array'
        then season.value->'standings' else '[]'::jsonb end
    ) standing
    where lm.user_id = auth.uid()
      and lower(coalesce(season.value #>> array['teams',standing.value->>'id','claimedBy'],'')) = lower(v_name)
  )
  select coalesce((select total from current_wins),0) +
         coalesce((select total from archived_wins),0)
    into v_total;

  perform public.set_badge_progress(auth.uid(), 'career_wins', '', v_total);

  for r in
    with roster_mons as (
      select mon.value mon
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_each(
        case when jsonb_typeof(s.state->'rosters') = 'object'
          then s.state->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array' then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(s.state #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)

      union all

      select mon.value
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.state->'seasonHistory') = 'array'
          then s.state->'seasonHistory' else '[]'::jsonb end
      ) season
      cross join lateral jsonb_each(
        case when jsonb_typeof(season.value->'rosters') = 'object'
          then season.value->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array' then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(season.value #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)
    )
    select mon->>'name' subject, count(*)::integer total
    from roster_mons
    where mon->>'name' is not null
    group by mon->>'name'
  loop
    perform public.set_badge_progress(auth.uid(), 'pokemon_loyalist', r.subject, r.total);
  end loop;

  for r in
    with roster_mons as (
      select mon.value mon
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_each(
        case when jsonb_typeof(s.state->'rosters') = 'object'
          then s.state->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array' then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(s.state #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)

      union all

      select mon.value
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.state->'seasonHistory') = 'array'
          then s.state->'seasonHistory' else '[]'::jsonb end
      ) season
      cross join lateral jsonb_each(
        case when jsonb_typeof(season.value->'rosters') = 'object'
          then season.value->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array' then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(season.value #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)
    )
    select coalesce(mon->>'gen','Unknown') subject, count(*)::integer total
    from roster_mons
    group by coalesce(mon->>'gen','Unknown')
  loop
    if r.subject <> 'Unknown' then
      perform public.set_badge_progress(auth.uid(), 'generation_veteran', r.subject, r.total);
    end if;
  end loop;

  return public.get_my_badge_profile();
end;
$$;

revoke all on function public.refresh_my_account_badges()
  from public, anon, authenticated;
grant execute on function public.refresh_my_account_badges()
  to authenticated;
