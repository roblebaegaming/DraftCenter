-- Make Community ADP regulation-aware.
-- Each Pokémon's sample comes only from completed snake drafts whose staged
-- legal pool marked that Pokémon as allowed. Commissioner-created custom
-- Pokémon use custom-* source ids and are excluded from community statistics.
-- Run once AFTER migration 043.

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
    group by trim(pokemon) order by total desc, pokemon asc limit 50
  ), eligible_pool as (
    select ds.id as draft_session_id, lp.id as league_pokemon_id, lp.pokemon_id
    from public.draft_sessions ds
    join public.league_pokemon lp on lp.league_id = ds.league_id
    where ds.mode = 'snake'
      and ds.status = 'complete'
      and lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
  ), adp as (
    select pc.display_name as pokemon,
      count(dp.id)::integer as drafts,
      count(distinct ep.draft_session_id)::integer as eligible_drafts,
      round(avg(dp.pick_number + 1)::numeric, 1) as average_pick
    from eligible_pool ep
    join public.pokemon_catalogue pc on pc.id = ep.pokemon_id
    left join public.draft_picks dp
      on dp.draft_session_id = ep.draft_session_id
      and dp.league_pokemon_id = ep.league_pokemon_id
    group by pc.display_name
    having count(dp.id) >= 1
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
          from public.daily_poll_answers a
          where a.poll_id = p.id group by a.answer_key
        ) counts
      ), '{}'::jsonb) end,
      'total_votes', case when auth.uid() is null then null else (
        select count(*)::integer from public.daily_poll_answers a where a.poll_id = p.id
      ) end,
      'selected_key', case when auth.uid() is null then null else (
        select answer_key from public.daily_poll_answers a
        where a.poll_id = p.id and a.user_id = auth.uid()
      ) end
    ) from current_poll p), 'null'::jsonb),
    'leagues', coalesce((select jsonb_agg(to_jsonb(public_leagues)) from public_leagues), '[]'::jsonb),
    'popularity', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon, 'favorites', total
    )) from favorite_counts), '[]'::jsonb),
    'adp', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon,
      'drafts', drafts,
      'eligible_drafts', eligible_drafts,
      'average_pick', average_pick
    )) from adp), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_public_explore() from public;
grant execute on function public.get_public_explore() to anon, authenticated;

commit;
