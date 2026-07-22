-- DraftCenter milestone 23: safe, public Explore data.

create or replace function public.get_public_explore()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with current_poll as (
    select p.* from public.daily_polls p where p.poll_date <= current_date order by p.poll_date desc limit 1
  ), public_leagues as (
    select l.id, l.slug, l.name, l.description, l.season_label, l.image_url, l.league_visibility, l.is_practice, l.draft_starts_at, l.updated_at
    from public.leagues l where l.league_visibility in ('watch', 'open')
      and (not l.is_practice or l.practice_expires_at is null or l.practice_expires_at > now())
    order by l.updated_at desc limit 24
  ), favorite_counts as (
    select trim(pokemon) as pokemon, count(*)::integer as total
    from public.profiles pr cross join lateral unnest(coalesce(pr.favorite_pokemon, '{}'::text[])) as pokemon
    where trim(pokemon) <> '' group by trim(pokemon) order by total desc, pokemon asc limit 50
  ), adp as (
    select pc.display_name as pokemon, count(*)::integer as drafts, round(avg(dp.pick_number)::numeric, 1) as average_pick
    from public.draft_picks dp join public.draft_sessions ds on ds.id = dp.draft_session_id
    join public.leagues l on l.id = ds.league_id join public.league_pokemon lp on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where l.league_visibility in ('watch', 'open') and not l.is_practice
    group by pc.display_name having count(*) >= 1 order by average_pick asc, drafts desc, pokemon asc limit 50
  )
  select jsonb_build_object(
    'poll', coalesce((select jsonb_build_object(
      'id', p.id, 'poll_date', p.poll_date, 'question', p.question, 'answer_type', p.answer_type, 'options', p.options,
      'counts', coalesce((select jsonb_object_agg(answer_key, total) from (select a.answer_key, count(*)::integer as total from public.daily_poll_answers a where a.poll_id = p.id group by a.answer_key) counts), '{}'::jsonb),
      'total_votes', (select count(*)::integer from public.daily_poll_answers a where a.poll_id = p.id)
    ) from current_poll p), 'null'::jsonb),
    'leagues', coalesce((select jsonb_agg(to_jsonb(public_leagues)) from public_leagues), '[]'::jsonb),
    'popularity', coalesce((select jsonb_agg(jsonb_build_object('pokemon', pokemon, 'favorites', total)) from favorite_counts), '[]'::jsonb),
    'adp', coalesce((select jsonb_agg(jsonb_build_object('pokemon', pokemon, 'drafts', drafts, 'average_pick', average_pick)) from adp), '[]'::jsonb)
  );
$$;

grant execute on function public.get_public_explore() to anon, authenticated;

create or replace function public.get_public_league(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with league_row as (
    select id, slug, name, description, season_label, image_url, league_visibility, draft_starts_at, updated_at
    from public.leagues where slug = p_slug and league_visibility in ('watch', 'open')
  )
  select jsonb_build_object(
    'league', (select to_jsonb(league_row) from league_row),
    'draft', (select jsonb_build_object('status', ds.status, 'current_pick_number', ds.current_pick_number)
              from public.draft_sessions ds join league_row l on l.id = ds.league_id),
    'picks', coalesce((select jsonb_agg(jsonb_build_object(
      'pick_number', dp.pick_number, 'round_number', dp.round_number,
      'pokemon', pc.display_name, 'team', t.name
    ) order by dp.pick_number)
    from public.draft_picks dp join public.draft_sessions ds on ds.id = dp.draft_session_id
    join league_row l on l.id = ds.league_id join public.teams t on t.id = dp.team_id
    join public.league_pokemon lp on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id), '[]'::jsonb)
  );
$$;

grant execute on function public.get_public_league(text) to anon, authenticated;
