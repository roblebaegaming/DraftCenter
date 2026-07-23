-- Auth-aware current poll plus a public archive of completed poll results.
-- Run once AFTER migration 035.

begin;

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
    'signed_in', auth.uid() is not null,
    'poll', coalesce((select jsonb_build_object(
      'id', p.id, 'poll_date', p.poll_date, 'question', p.question, 'answer_type', p.answer_type, 'options', p.options,
      'counts', case when auth.uid() is null then '{}'::jsonb else coalesce((
        select jsonb_object_agg(answer_key, total) from (
          select a.answer_key, count(*)::integer as total from public.daily_poll_answers a
          where a.poll_id = p.id group by a.answer_key
        ) counts
      ), '{}'::jsonb) end,
      'total_votes', case when auth.uid() is null then null else (
        select count(*)::integer from public.daily_poll_answers a where a.poll_id = p.id
      ) end,
      'selected_key', case when auth.uid() is null then null else (
        select answer_key from public.daily_poll_answers a where a.poll_id = p.id and a.user_id = auth.uid()
      ) end
    ) from current_poll p), 'null'::jsonb),
    'leagues', coalesce((select jsonb_agg(to_jsonb(public_leagues)) from public_leagues), '[]'::jsonb),
    'popularity', coalesce((select jsonb_agg(jsonb_build_object('pokemon', pokemon, 'favorites', total)) from favorite_counts), '[]'::jsonb),
    'adp', coalesce((select jsonb_agg(jsonb_build_object('pokemon', pokemon, 'drafts', drafts, 'average_pick', average_pick)) from adp), '[]'::jsonb)
  );
$$;

create or replace function public.get_public_poll_history(p_limit integer default 12)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'poll_date', p.poll_date, 'question', p.question,
    'answer_type', p.answer_type, 'options', p.options,
    'counts', coalesce((
      select jsonb_object_agg(answer_key, total) from (
        select a.answer_key, count(*)::integer as total
        from public.daily_poll_answers a where a.poll_id = p.id group by a.answer_key
      ) result_counts
    ), '{}'::jsonb),
    'total_votes', (select count(*)::integer from public.daily_poll_answers a where a.poll_id = p.id)
  ) order by p.poll_date desc), '[]'::jsonb)
  from (
    select * from public.daily_polls
    where poll_date < current_date
    order by poll_date desc
    limit greatest(1, least(coalesce(p_limit, 12), 50))
  ) p;
$$;

revoke execute on function public.get_public_explore() from public;
revoke execute on function public.get_public_poll_history(integer) from public;
grant execute on function public.get_public_explore() to anon, authenticated;
grant execute on function public.get_public_poll_history(integer) to anon, authenticated;

commit;
