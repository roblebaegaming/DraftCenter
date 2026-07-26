-- Repair account-wide Pokémon and generation badges for the canonical
-- array-shaped league snapshots. Migration 061 safely handled malformed JSON,
-- but only scanned object-shaped roster maps, so current snapshots were skipped.

begin;

create or replace function public.refresh_my_draft_history_badges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  r record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to refresh draft-history badges.';
  end if;

  select coalesce(nullif(display_name, ''), username)
    into v_name
  from public.profiles
  where id = auth.uid();

  for r in
    with roster_mons as (
      select mon.value as mon
      from public.league_state_snapshots snapshot
      join public.league_memberships membership
        on membership.league_id = snapshot.league_id
       and membership.user_id = auth.uid()
      cross join lateral (
        select (entry.ordinality - 1)::text as team_key, entry.value as roster
        from jsonb_array_elements(
          case when jsonb_typeof(snapshot.state->'rosters') = 'array'
            then snapshot.state->'rosters' else '[]'::jsonb end
        ) with ordinality as entry(value, ordinality)
        union all
        select entry.key, entry.value
        from jsonb_each(
          case when jsonb_typeof(snapshot.state->'rosters') = 'object'
            then snapshot.state->'rosters' else '{}'::jsonb end
        ) as entry
      ) roster_entry
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(roster_entry.roster) = 'array'
          then roster_entry.roster else '[]'::jsonb end
      ) mon
      where lower(coalesce(snapshot.state #>> array[
        'teams', roster_entry.team_key, 'claimedBy'
      ], '')) = lower(v_name)
        and (
          jsonb_array_length(case
            when jsonb_typeof(snapshot.state->'seasonHistory') = 'array'
              then snapshot.state->'seasonHistory' else '[]'::jsonb end) = 0
          or nullif(snapshot.state->>'draftStartedAt', '') is not null
          or mon.value->>'draftPick' ~ '^[0-9]+$'
          or mon.value->>'cost' ~ '^[0-9]+([.][0-9]+)?$'
        )

      union all

      select mon.value as mon
      from public.league_state_snapshots snapshot
      join public.league_memberships membership
        on membership.league_id = snapshot.league_id
       and membership.user_id = auth.uid()
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(snapshot.state->'seasonHistory') = 'array'
          then snapshot.state->'seasonHistory' else '[]'::jsonb end
      ) season
      cross join lateral (
        select (entry.ordinality - 1)::text as team_key, entry.value as roster
        from jsonb_array_elements(
          case when jsonb_typeof(season.value->'rosters') = 'array'
            then season.value->'rosters' else '[]'::jsonb end
        ) with ordinality as entry(value, ordinality)
        union all
        select entry.key, entry.value
        from jsonb_each(
          case when jsonb_typeof(season.value->'rosters') = 'object'
            then season.value->'rosters' else '{}'::jsonb end
        ) as entry
      ) roster_entry
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(roster_entry.roster) = 'array'
          then roster_entry.roster else '[]'::jsonb end
      ) mon
      where lower(coalesce(season.value #>> array[
        'teams', roster_entry.team_key, 'claimedBy'
      ], '')) = lower(v_name)
    )
    select mon->>'name' as subject, count(*)::integer as total
    from roster_mons
    where nullif(mon->>'name', '') is not null
    group by mon->>'name'
  loop
    perform public.set_badge_progress(
      auth.uid(), 'pokemon_loyalist', r.subject, r.total
    );
  end loop;

  for r in
    with roster_mons as (
      select mon.value as mon
      from public.league_state_snapshots snapshot
      join public.league_memberships membership
        on membership.league_id = snapshot.league_id
       and membership.user_id = auth.uid()
      cross join lateral (
        select (entry.ordinality - 1)::text as team_key, entry.value as roster
        from jsonb_array_elements(
          case when jsonb_typeof(snapshot.state->'rosters') = 'array'
            then snapshot.state->'rosters' else '[]'::jsonb end
        ) with ordinality as entry(value, ordinality)
        union all
        select entry.key, entry.value
        from jsonb_each(
          case when jsonb_typeof(snapshot.state->'rosters') = 'object'
            then snapshot.state->'rosters' else '{}'::jsonb end
        ) as entry
      ) roster_entry
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(roster_entry.roster) = 'array'
          then roster_entry.roster else '[]'::jsonb end
      ) mon
      where lower(coalesce(snapshot.state #>> array[
        'teams', roster_entry.team_key, 'claimedBy'
      ], '')) = lower(v_name)
        and (
          jsonb_array_length(case
            when jsonb_typeof(snapshot.state->'seasonHistory') = 'array'
              then snapshot.state->'seasonHistory' else '[]'::jsonb end) = 0
          or nullif(snapshot.state->>'draftStartedAt', '') is not null
          or mon.value->>'draftPick' ~ '^[0-9]+$'
          or mon.value->>'cost' ~ '^[0-9]+([.][0-9]+)?$'
        )

      union all

      select mon.value as mon
      from public.league_state_snapshots snapshot
      join public.league_memberships membership
        on membership.league_id = snapshot.league_id
       and membership.user_id = auth.uid()
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(snapshot.state->'seasonHistory') = 'array'
          then snapshot.state->'seasonHistory' else '[]'::jsonb end
      ) season
      cross join lateral (
        select (entry.ordinality - 1)::text as team_key, entry.value as roster
        from jsonb_array_elements(
          case when jsonb_typeof(season.value->'rosters') = 'array'
            then season.value->'rosters' else '[]'::jsonb end
        ) with ordinality as entry(value, ordinality)
        union all
        select entry.key, entry.value
        from jsonb_each(
          case when jsonb_typeof(season.value->'rosters') = 'object'
            then season.value->'rosters' else '{}'::jsonb end
        ) as entry
      ) roster_entry
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(roster_entry.roster) = 'array'
          then roster_entry.roster else '[]'::jsonb end
      ) mon
      where lower(coalesce(season.value #>> array[
        'teams', roster_entry.team_key, 'claimedBy'
      ], '')) = lower(v_name)
    )
    select coalesce(nullif(mon->>'gen', ''), 'Unknown') as subject,
           count(*)::integer as total
    from roster_mons
    group by coalesce(nullif(mon->>'gen', ''), 'Unknown')
  loop
    if r.subject <> 'Unknown' then
      perform public.set_badge_progress(
        auth.uid(), 'generation_veteran', r.subject, r.total
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.refresh_my_draft_history_badges()
  from public, anon, authenticated;
grant execute on function public.refresh_my_draft_history_badges()
  to authenticated;

commit;

notify pgrst, 'reload schema';
