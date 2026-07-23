-- Restore Community ADP from archived season draft logs after a live draft
-- session is reset, and aggregate Pokemon win rates anonymously across every
-- non-practice league regardless of whether the league itself is public.

begin;

create or replace function public.get_public_explore()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with current_poll as (
    select p.* from public.daily_polls p
    where p.poll_date <= current_date order by p.poll_date desc limit 1
  ), public_leagues as (
    select l.id, l.slug, l.name, l.description, l.season_label, l.image_url,
      l.league_visibility, l.is_practice, l.draft_starts_at, l.updated_at
    from public.leagues l
    where l.league_visibility in ('watch', 'open')
      and (not l.is_practice or l.practice_expires_at is null or l.practice_expires_at > now())
    order by l.updated_at desc limit 24
  ), favorite_counts as (
    select trim(pokemon) as pokemon, count(*)::integer as total
    from public.profiles pr
    cross join lateral unnest(coalesce(pr.favorite_pokemon, '{}'::text[])) as pokemon
    where trim(pokemon) <> ''
    group by trim(pokemon) order by total desc, pokemon asc limit 24
  ), relational_eligible as (
    select ds.id as draft_session_id, ds.league_id, ds.created_at,
      lp.id as league_pokemon_id, lp.pokemon_id
    from public.draft_sessions ds
    join public.league_pokemon lp on lp.league_id = ds.league_id
    left join public.league_state_snapshots s on s.league_id = ds.league_id
    where ds.mode = 'snake' and ds.status = 'complete'
      and lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(s.state -> 'seasonHistory', '[]'::jsonb)) archived
        where coalesce(archived ->> 'draftType', 'snake') = 'snake'
          and nullif(archived ->> 'endedAt', '') is not null
          and to_timestamp((archived ->> 'endedAt')::double precision / 1000.0) >= ds.created_at
      )
  ), relational_adp as (
    select pc.display_name as pokemon,
      count(dp.id)::integer as drafts,
      count(distinct re.draft_session_id)::integer as eligible_drafts,
      sum(dp.pick_number + 1)::numeric as pick_sum
    from relational_eligible re
    join public.pokemon_catalogue pc on pc.id = re.pokemon_id
    left join public.draft_picks dp
      on dp.draft_session_id = re.draft_session_id
      and dp.league_pokemon_id = re.league_pokemon_id
    group by pc.display_name
  ), archived_drafts as (
    select l.id as league_id,
      archived ->> 'seasonNumber' as season_number,
      pc.display_name as pokemon,
      nullif(entry ->> 'draftPick', '')::numeric + 1 as pick_number
    from public.leagues l
    join public.league_state_snapshots s on s.league_id = l.id
    cross join lateral jsonb_array_elements(coalesce(s.state -> 'seasonHistory', '[]'::jsonb)) archived
    cross join lateral jsonb_array_elements(coalesce(archived -> 'draftLog', '[]'::jsonb)) entry
    join public.pokemon_catalogue pc on lower(pc.display_name) = lower(entry ->> 'name')
    where coalesce(archived ->> 'draftType', 'snake') = 'snake'
      and nullif(entry ->> 'name', '') is not null
      and nullif(entry ->> 'draftPick', '') is not null
  ), archived_adp as (
    select pokemon, count(*)::integer as drafts,
      count(distinct (league_id::text || ':' || coalesce(season_number, 'unknown')))::integer as eligible_drafts,
      sum(pick_number)::numeric as pick_sum
    from archived_drafts
    group by pokemon
  ), combined_adp as (
    select pokemon, sum(drafts)::integer as drafts,
      sum(eligible_drafts)::integer as eligible_drafts,
      round(sum(pick_sum) / nullif(sum(drafts), 0), 1) as average_pick
    from (
      select pokemon, drafts, eligible_drafts, pick_sum from relational_adp
      union all
      select pokemon, drafts, eligible_drafts, pick_sum from archived_adp
    ) samples
    group by pokemon
    having sum(drafts) > 0
    order by average_pick asc, drafts desc, pokemon asc
    limit 50
  )
  select jsonb_build_object(
    'signed_in', auth.uid() is not null,
    'poll', coalesce((select jsonb_build_object(
      'id', p.id, 'poll_date', p.poll_date, 'question', p.question,
      'answer_type', p.answer_type, 'options', p.options,
      'counts', case when auth.uid() is null then '{}'::jsonb else coalesce((
        select jsonb_object_agg(answer_key, total) from (
          select a.answer_key, count(*)::integer as total
          from public.daily_poll_answers a where a.poll_id = p.id group by a.answer_key
        ) c
      ), '{}'::jsonb) end,
      'total_votes', (select count(*)::integer from public.daily_poll_answers a where a.poll_id = p.id),
      'selected_key', case when auth.uid() is null then null else (
        select a.answer_key from public.daily_poll_answers a
        where a.poll_id = p.id and a.user_id = auth.uid()
      ) end
    ) from current_poll p), 'null'::jsonb),
    'leagues', coalesce((select jsonb_agg(to_jsonb(public_leagues)) from public_leagues), '[]'::jsonb),
    'popularity', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon, 'favorites', total
    )) from favorite_counts), '[]'::jsonb),
    'adp', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon, 'drafts', drafts,
      'eligible_drafts', eligible_drafts, 'average_pick', average_pick
    )) from combined_adp), '[]'::jsonb)
  );
$$;

create or replace function public.get_public_draft_trends()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with public_leagues as (
    select id from public.leagues
    where league_visibility in ('watch', 'open') and not is_practice
  ), weekly as (
    select pc.display_name as pokemon, count(distinct ds.id)::integer as drafts
    from public.draft_picks dp
    join public.draft_sessions ds on ds.id = dp.draft_session_id
    join public_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where dp.created_at >= now() - interval '7 days'
    group by pc.display_name
    order by drafts desc, pokemon asc
    limit 20
  ), season_states as (
    select l.id as league_id, s.state as season_state
    from public.leagues l
    join public.league_state_snapshots s on s.league_id = l.id
    where not l.is_practice
    union all
    select l.id, archived
    from public.leagues l
    join public.league_state_snapshots s on s.league_id = l.id
    cross join lateral jsonb_array_elements(coalesce(s.state -> 'seasonHistory', '[]'::jsonb)) archived
    where not l.is_practice
  ), pokemon_match_rows as (
    select mon ->> 'name' as pokemon, side.won
    from season_states ss
    cross join lateral jsonb_each(coalesce(ss.season_state -> 'matchResults', '{}'::jsonb)) result_row
    cross join lateral (
      select ss.season_state #> array[
        'schedule',
        split_part(result_row.key, '-', 1),
        split_part(result_row.key, '-', 2)
      ] as matchup
    ) scheduled
    cross join lateral (
      values
        ((scheduled.matchup ->> 0)::integer,
          case when (result_row.value ->> 'gamesA')::integer > (result_row.value ->> 'gamesB')::integer then 1 else 0 end),
        ((scheduled.matchup ->> 1)::integer,
          case when (result_row.value ->> 'gamesB')::integer > (result_row.value ->> 'gamesA')::integer then 1 else 0 end)
    ) side(team_index, won)
    cross join lateral jsonb_array_elements(coalesce(
      ss.season_state -> 'rosters' -> side.team_index,
      '[]'::jsonb
    )) mon
    where scheduled.matchup is not null
      and nullif(result_row.value ->> 'gamesA', '') is not null
      and nullif(result_row.value ->> 'gamesB', '') is not null
      and (result_row.value ->> 'gamesA')::integer <> (result_row.value ->> 'gamesB')::integer
      and nullif(mon ->> 'name', '') is not null
  ), win_rates as (
    select pokemon, count(*)::integer as games, sum(won)::integer as wins,
      round(100.0 * sum(won) / nullif(count(*), 0), 1) as win_rate
    from pokemon_match_rows
    group by pokemon
    having count(*) >= 2
    order by win_rate desc, games desc, pokemon asc
    limit 20
  )
  select jsonb_build_object(
    'weekly_drafted', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon, 'drafts', drafts
    )) from weekly), '[]'::jsonb),
    'win_rates', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon, 'games', games, 'wins', wins, 'win_rate', win_rate
    )) from win_rates), '[]'::jsonb),
    'partners', '[]'::jsonb
  );
$$;

revoke execute on function public.get_public_explore() from public;
revoke execute on function public.get_public_draft_trends() from public;
grant execute on function public.get_public_explore() to anon, authenticated;
grant execute on function public.get_public_draft_trends() to anon, authenticated;

commit;
