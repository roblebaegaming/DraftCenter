-- Aggregated, privacy-safe community draft trends.
-- Run once AFTER migration 035.

begin;

create or replace function public.get_public_draft_trends()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with eligible_leagues as (
    select id from public.leagues
    where league_visibility in ('watch', 'open') and not is_practice
  ),
  weekly as (
    select pc.display_name as pokemon, count(*)::integer as drafts
    from public.draft_picks dp
    join public.draft_sessions ds on ds.id = dp.draft_session_id
    join eligible_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where dp.created_at >= now() - interval '7 days'
    group by pc.display_name
    order by drafts desc, pokemon asc
    limit 20
  ),
  pokemon_teams as (
    select distinct re.team_id, pc.display_name as pokemon
    from public.roster_entries re
    join public.teams t on t.id = re.team_id
    join eligible_leagues el on el.id = t.league_id
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where re.released_at is null
  ),
  completed_team_matches as (
    select m.id, m.home_team_id as team_id, (m.winner_team_id = m.home_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
    union all
    select m.id, m.away_team_id as team_id, (m.winner_team_id = m.away_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
  ),
  win_rates as (
    select pt.pokemon, count(ctm.id)::integer as games, sum(ctm.won)::integer as wins,
      round(100.0 * sum(ctm.won) / nullif(count(ctm.id), 0), 1) as win_rate
    from pokemon_teams pt
    join completed_team_matches ctm on ctm.team_id = pt.team_id
    group by pt.pokemon
    having count(ctm.id) >= 2
    order by win_rate desc, games desc, pokemon asc
    limit 20
  ),
  partner_counts as (
    select a.pokemon, b.pokemon as partner, count(distinct a.team_id)::integer as teams
    from pokemon_teams a
    join pokemon_teams b on b.team_id = a.team_id and b.pokemon <> a.pokemon
    group by a.pokemon, b.pokemon
  ),
  top_partners as (
    select pokemon, partner, teams
    from (
      select *, row_number() over (partition by pokemon order by teams desc, partner asc) as rank
      from partner_counts
    ) ranked
    where rank = 1
    order by teams desc, pokemon asc
    limit 20
  )
  select jsonb_build_object(
    'weekly_drafted', coalesce((select jsonb_agg(jsonb_build_object('pokemon', pokemon, 'drafts', drafts)) from weekly), '[]'::jsonb),
    'win_rates', coalesce((select jsonb_agg(jsonb_build_object('pokemon', pokemon, 'games', games, 'wins', wins, 'win_rate', win_rate)) from win_rates), '[]'::jsonb),
    'partners', coalesce((select jsonb_agg(jsonb_build_object('pokemon', pokemon, 'partner', partner, 'teams', teams)) from top_partners), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_public_draft_trends() from public;
grant execute on function public.get_public_draft_trends() to anon, authenticated;

commit;
