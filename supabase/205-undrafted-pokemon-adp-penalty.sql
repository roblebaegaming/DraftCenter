-- ADP is an average across every draft in which a Pokemon was eligible.
-- A non-selection contributes completed-pick-count + 1, preventing one early
-- selection from outranking a Pokemon selected consistently in every draft.

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
  ), completed_snake_sessions as (
    select ds.id, ds.league_id, ds.created_at,
      count(dp.id)::integer as completed_picks
    from public.draft_sessions ds
    left join public.draft_picks dp on dp.draft_session_id = ds.id
    where ds.mode = 'snake' and ds.status = 'complete'
    group by ds.id, ds.league_id, ds.created_at
  ), relational_eligible as (
    select session.id as draft_session_id, session.league_id,
      lp.id as league_pokemon_id, lp.pokemon_id, session.completed_picks
    from completed_snake_sessions session
    join public.league_pokemon lp on lp.league_id = session.league_id
    left join public.league_state_snapshots s on s.league_id = session.league_id
    where lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(s.state -> 'seasonHistory', '[]'::jsonb)) archived
        where coalesce(archived ->> 'draftType', 'snake') = 'snake'
          and nullif(archived ->> 'endedAt', '') is not null
          and to_timestamp((archived ->> 'endedAt')::double precision / 1000.0) >= session.created_at
      )
  ), relational_adp as (
    select pc.display_name as pokemon,
      count(dp.id)::integer as drafts,
      count(*)::integer as eligible_drafts,
      sum(coalesce(dp.pick_number + 1, re.completed_picks + 1))::numeric as pick_sum
    from relational_eligible re
    join public.pokemon_catalogue pc on pc.id = re.pokemon_id
    left join public.draft_picks dp
      on dp.draft_session_id = re.draft_session_id
      and dp.league_pokemon_id = re.league_pokemon_id
    group by pc.display_name
  ), archived_sessions as (
    select l.id as league_id,
      archived ->> 'seasonNumber' as season_number,
      archived,
      (
        select count(*)::integer
        from jsonb_array_elements(coalesce(archived -> 'draftLog', '[]'::jsonb)) entry
        where nullif(entry ->> 'draftPick', '') is not null
      ) as completed_picks
    from public.leagues l
    join public.league_state_snapshots s on s.league_id = l.id
    cross join lateral jsonb_array_elements(coalesce(s.state -> 'seasonHistory', '[]'::jsonb)) archived
    where coalesce(archived ->> 'draftType', 'snake') = 'snake'
  ), archived_eligible as (
    select session.league_id, session.season_number, session.archived,
      session.completed_picks, eligible.name as pokemon
    from archived_sessions session
    cross join lateral (
      select distinct trim(pool.value) as name
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(session.archived -> 'eligibleDraftPool') = 'array'
            then session.archived -> 'eligibleDraftPool'
          else coalesce((
            select jsonb_agg(distinct entry ->> 'name')
            from jsonb_array_elements(coalesce(session.archived -> 'draftLog', '[]'::jsonb)) entry
            where nullif(entry ->> 'name', '') is not null
          ), '[]'::jsonb)
        end
      ) pool(value)
      where trim(pool.value) <> ''
    ) eligible
  ), archived_samples as (
    select eligible.league_id, eligible.season_number,
      pc.display_name as pokemon,
      pick.pick_number,
      coalesce(pick.pick_number, eligible.completed_picks + 1)::numeric as adp_value
    from archived_eligible eligible
    join public.pokemon_catalogue pc
      on lower(pc.display_name) = lower(eligible.pokemon)
    left join lateral (
      select nullif(entry ->> 'draftPick', '')::numeric + 1 as pick_number
      from jsonb_array_elements(coalesce(eligible.archived -> 'draftLog', '[]'::jsonb)) entry
      where lower(entry ->> 'name') = lower(eligible.pokemon)
        and nullif(entry ->> 'draftPick', '') is not null
      order by nullif(entry ->> 'draftPick', '')::numeric
      limit 1
    ) pick on true
  ), archived_adp as (
    select pokemon,
      count(pick_number)::integer as drafts,
      count(*)::integer as eligible_drafts,
      sum(adp_value)::numeric as pick_sum
    from archived_samples
    group by pokemon
  ), combined_adp as (
    select pokemon, sum(drafts)::integer as drafts,
      sum(eligible_drafts)::integer as eligible_drafts,
      round(sum(pick_sum) / nullif(sum(eligible_drafts), 0), 1) as average_pick
    from (
      select pokemon, drafts, eligible_drafts, pick_sum from relational_adp
      union all
      select pokemon, drafts, eligible_drafts, pick_sum from archived_adp
    ) samples
    group by pokemon
    having sum(eligible_drafts) > 0
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

create or replace function public.get_public_pokemon_draft_profile(p_pokemon text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with eligible_leagues as (
    select id from public.leagues
    where league_visibility in ('watch', 'open') and not is_practice
  ), target as (
    select id, display_name from public.pokemon_catalogue
    where lower(display_name) = lower(trim(p_pokemon)) limit 1
  ), session_pick_counts as (
    select ds.id, count(dp.id)::integer as completed_picks
    from public.draft_sessions ds
    left join public.draft_picks dp on dp.draft_session_id = ds.id
    where ds.status = 'complete'
    group by ds.id
  ), eligible_sessions as (
    select ds.id, ds.mode, ds.league_id, lp.id as league_pokemon_id,
      counts.completed_picks,
      coalesce(nullif(s.state #>> '{settings,regulationId}', ''), 'custom') as regulation_id
    from public.draft_sessions ds
    join session_pick_counts counts on counts.id = ds.id
    join eligible_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.league_id = ds.league_id
    join target t on t.id = lp.pokemon_id
    left join public.league_state_snapshots s on s.league_id = ds.league_id
    where ds.status = 'complete' and lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
  ), target_picks as (
    select dp.*, es.mode, es.league_id, es.regulation_id
    from eligible_sessions es
    join public.draft_picks dp
      on dp.draft_session_id = es.id
      and dp.league_pokemon_id = es.league_pokemon_id
  ), snake_samples as (
    select es.id as draft_session_id, es.regulation_id,
      tp.pick_number,
      coalesce(tp.pick_number + 1, es.completed_picks + 1)::numeric as adp_value
    from eligible_sessions es
    left join target_picks tp on tp.draft_session_id = es.id
    where es.mode = 'snake'
  ), draft_summary as (
    select
      (select count(*)::integer from snake_samples) as eligible_drafts,
      (select count(pick_number)::integer from snake_samples) as drafted_in,
      (select round(avg(adp_value), 1) from snake_samples) as average_pick,
      round((avg(price) filter (where mode = 'auction' and price is not null))::numeric, 1) as average_auction_price,
      count(*) filter (where mode = 'auction' and price is not null)::integer as auction_samples
    from target_picks
  ), format_adp as (
    select regulation_id, count(*)::integer as eligible_drafts,
      count(pick_number)::integer as drafted_in,
      round(avg(adp_value), 1) as average_pick
    from snake_samples group by regulation_id
  ), target_teams as (
    select distinct re.team_id
    from public.roster_entries re
    join public.teams team on team.id = re.team_id
    join eligible_leagues el on el.id = team.league_id
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join target t on t.id = lp.pokemon_id
    where re.released_at is null
  ), team_matches as (
    select m.home_team_id as team_id, (m.winner_team_id = m.home_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
    union all
    select m.away_team_id as team_id, (m.winner_team_id = m.away_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
  ), performance as (
    select count(tm.team_id)::integer as games, coalesce(sum(tm.won), 0)::integer as wins,
      round(100.0 * sum(tm.won) / nullif(count(tm.team_id), 0), 1) as win_rate
    from target_teams tt left join team_matches tm on tm.team_id = tt.team_id
  ), partners as (
    select pc.display_name as pokemon, count(distinct re.team_id)::integer as teams
    from target_teams tt
    join public.roster_entries re on re.team_id = tt.team_id and re.released_at is null
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where not exists (select 1 from target t where t.id = pc.id)
    group by pc.display_name order by teams desc, pokemon asc limit 10
  ), usage_weeks as (
    select date_trunc('week', dp.created_at)::date as week, count(*)::integer as picks
    from target_picks dp
    where dp.created_at >= date_trunc('week', now()) - interval '11 weeks'
    group by date_trunc('week', dp.created_at)::date
  )
  select jsonb_build_object(
    'pokemon', (select display_name from target),
    'eligible_drafts', ds.eligible_drafts,
    'drafted_in', ds.drafted_in,
    'draft_rate', round(100.0 * ds.drafted_in / nullif(ds.eligible_drafts, 0), 1),
    'average_pick', ds.average_pick,
    'adp_by_format', coalesce((select jsonb_agg(to_jsonb(format_adp) order by regulation_id) from format_adp), '[]'::jsonb),
    'average_auction_price', ds.average_auction_price,
    'auction_samples', ds.auction_samples,
    'games', perf.games, 'wins', perf.wins, 'win_rate', perf.win_rate,
    'partners', coalesce((select jsonb_agg(to_jsonb(partners)) from partners), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(to_jsonb(usage_weeks) order by week) from usage_weeks), '[]'::jsonb)
  )
  from draft_summary ds cross join performance perf;
$$;

revoke execute on function public.get_public_explore() from public;
grant execute on function public.get_public_explore() to anon, authenticated;
revoke execute on function public.get_public_pokemon_draft_profile(text) from public;
grant execute on function public.get_public_pokemon_draft_profile(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
