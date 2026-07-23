-- Weekly momentum and auction-value trends for public leagues.
-- Run once AFTER migration 035.

begin;

create or replace function public.get_public_market_trends()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with eligible_leagues as (
    select id from public.leagues
    where league_visibility in ('watch', 'open') and not is_practice
  ),
  pick_windows as (
    select pc.display_name as pokemon,
      count(*) filter (where dp.created_at >= now() - interval '7 days')::integer as current_drafts,
      count(*) filter (
        where dp.created_at >= now() - interval '14 days'
          and dp.created_at < now() - interval '7 days'
      )::integer as previous_drafts
    from public.draft_picks dp
    join public.draft_sessions ds on ds.id = dp.draft_session_id
    join eligible_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where dp.created_at >= now() - interval '14 days'
    group by pc.display_name
  ),
  risers as (
    select pokemon, current_drafts, previous_drafts,
      current_drafts - previous_drafts as change
    from pick_windows
    where current_drafts - previous_drafts > 0
    order by change desc, current_drafts desc, pokemon asc
    limit 10
  ),
  fallers as (
    select pokemon, current_drafts, previous_drafts,
      current_drafts - previous_drafts as change
    from pick_windows
    where current_drafts - previous_drafts < 0
    order by change asc, previous_drafts desc, pokemon asc
    limit 10
  ),
  auction_rosters as (
    select distinct re.team_id, pc.display_name as pokemon, dp.price
    from public.roster_entries re
    join public.teams t on t.id = re.team_id
    join eligible_leagues el on el.id = t.league_id
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    join public.draft_picks dp
      on dp.team_id = re.team_id and dp.league_pokemon_id = re.league_pokemon_id
    join public.draft_sessions ds on ds.id = dp.draft_session_id and ds.mode = 'auction'
    where re.released_at is null and dp.price is not null
  ),
  team_matches as (
    select m.home_team_id as team_id, (m.winner_team_id = m.home_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
    union all
    select m.away_team_id as team_id, (m.winner_team_id = m.away_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
  ),
  busts as (
    select ar.pokemon, round(avg(ar.price), 1) as average_cost,
      count(tm.team_id)::integer as games, sum(tm.won)::integer as wins,
      round(100.0 * sum(tm.won) / nullif(count(tm.team_id), 0), 1) as win_rate,
      round(avg(ar.price) * (1 - sum(tm.won)::numeric / nullif(count(tm.team_id), 0)), 2) as bust_score
    from auction_rosters ar
    join team_matches tm on tm.team_id = ar.team_id
    group by ar.pokemon
    having count(tm.team_id) >= 2
    order by bust_score desc, average_cost desc, games desc
    limit 10
  )
  select jsonb_build_object(
    'risers', coalesce((select jsonb_agg(to_jsonb(risers)) from risers), '[]'::jsonb),
    'fallers', coalesce((select jsonb_agg(to_jsonb(fallers)) from fallers), '[]'::jsonb),
    'busts', coalesce((select jsonb_agg(to_jsonb(busts)) from busts), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_public_market_trends() from public;
grant execute on function public.get_public_market_trends() to anon, authenticated;

commit;
