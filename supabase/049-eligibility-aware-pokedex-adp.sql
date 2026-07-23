-- Make each public Pokedex profile use the same eligibility-aware ADP rules
-- as Community: completed public snake drafts count only when that Pokemon
-- was actually allowed in the staged league pool.

begin;

create or replace function public.get_public_pokemon_draft_profile(p_pokemon text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with eligible_leagues as (
    select id from public.leagues
    where league_visibility in ('watch', 'open') and not is_practice
  ),
  target as (
    select id, display_name
    from public.pokemon_catalogue
    where lower(display_name) = lower(trim(p_pokemon))
    limit 1
  ),
  eligible_sessions as (
    select ds.id, ds.mode, ds.league_id, lp.id as league_pokemon_id,
      coalesce(nullif(s.state #>> '{settings,regulationId}', ''), 'custom') as regulation_id
    from public.draft_sessions ds
    join eligible_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.league_id = ds.league_id
    join target t on t.id = lp.pokemon_id
    left join public.league_state_snapshots s on s.league_id = ds.league_id
    where ds.status = 'complete'
      and lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
  ),
  target_picks as (
    select dp.*, es.mode, es.league_id, es.regulation_id
    from eligible_sessions es
    join public.draft_picks dp
      on dp.draft_session_id = es.id
      and dp.league_pokemon_id = es.league_pokemon_id
  ),
  draft_summary as (
    select
      (select count(*)::integer from eligible_sessions where mode = 'snake') as eligible_drafts,
      count(distinct draft_session_id) filter (where mode = 'snake')::integer as drafted_in,
      round((avg(pick_number + 1) filter (where mode = 'snake'))::numeric, 1) as average_pick,
      round((avg(price) filter (where mode = 'auction' and price is not null))::numeric, 1) as average_auction_price,
      count(*) filter (where mode = 'auction' and price is not null)::integer as auction_samples
    from target_picks
  ),
  format_adp as (
    select es.regulation_id,
      count(*)::integer as eligible_drafts,
      count(distinct tp.draft_session_id)::integer as drafted_in,
      round(avg(tp.pick_number + 1)::numeric, 1) as average_pick
    from eligible_sessions es
    left join target_picks tp on tp.draft_session_id = es.id
    where es.mode = 'snake'
    group by es.regulation_id
  ),
  target_teams as (
    select distinct re.team_id
    from public.roster_entries re
    join public.teams team on team.id = re.team_id
    join eligible_leagues el on el.id = team.league_id
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join target t on t.id = lp.pokemon_id
    where re.released_at is null
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
  performance as (
    select count(tm.team_id)::integer as games, coalesce(sum(tm.won), 0)::integer as wins,
      round(100.0 * sum(tm.won) / nullif(count(tm.team_id), 0), 1) as win_rate
    from target_teams tt left join team_matches tm on tm.team_id = tt.team_id
  ),
  partners as (
    select pc.display_name as pokemon, count(distinct re.team_id)::integer as teams
    from target_teams tt
    join public.roster_entries re on re.team_id = tt.team_id and re.released_at is null
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where not exists (select 1 from target t where t.id = pc.id)
    group by pc.display_name
    order by teams desc, pokemon asc
    limit 10
  ),
  usage_weeks as (
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
    'games', perf.games,
    'wins', perf.wins,
    'win_rate', perf.win_rate,
    'partners', coalesce((select jsonb_agg(to_jsonb(partners)) from partners), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(to_jsonb(usage_weeks) order by week) from usage_weeks), '[]'::jsonb)
  )
  from draft_summary ds cross join performance perf;
$$;

revoke execute on function public.get_public_pokemon_draft_profile(text) from public;
grant execute on function public.get_public_pokemon_draft_profile(text) to anon, authenticated;

commit;
