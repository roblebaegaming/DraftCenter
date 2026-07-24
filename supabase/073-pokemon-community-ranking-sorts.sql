-- Supply public Pokédex sorting totals for the three Daily Three achievements.

begin;

create or replace function public.get_pokemon_community_ranking_totals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with poll_answer_counts as (
    select
      p.id as poll_id,
      lower(regexp_replace(trim(a.answer_key), '[^a-zA-Z0-9]+', '', 'g')) as pokemon_key,
      min(a.answer_key) as pokemon,
      count(*)::integer as votes
    from public.daily_polls p
    join public.daily_poll_answers a on a.poll_id = p.id
    where p.answer_type = 'pokemon'
      and p.poll_date < current_date
    group by p.id, lower(regexp_replace(trim(a.answer_key), '[^a-zA-Z0-9]+', '', 'g'))
  ),
  poll_ranked as (
    select *,
      dense_rank() over (partition by poll_id order by votes desc) as place
    from poll_answer_counts
  ),
  poll_totals as (
    select pokemon_key, min(pokemon) as pokemon, count(*)::integer as poll_wins
    from poll_ranked
    where place = 1
    group by pokemon_key
  ),
  bracket_totals as (
    select
      lower(regexp_replace(trim(winner), '[^a-zA-Z0-9]+', '', 'g')) as pokemon_key,
      min(winner) as pokemon,
      count(*)::integer as bracket_championships
    from public.daily_bracket_matchups
    where round_number = 3
    group by lower(regexp_replace(trim(winner), '[^a-zA-Z0-9]+', '', 'g'))
  ),
  quiz_answer_counts as (
    select
      q.id as quiz_id,
      lower(a.normalized_answer) as pokemon_key,
      min(a.display_answer) as pokemon,
      count(*)::integer as votes
    from public.daily_quizzes q
    join public.daily_quiz_answers a on a.quiz_id = q.id
    where q.quiz_date < current_date
    group by q.id, lower(a.normalized_answer)
  ),
  quiz_ranked as (
    select *,
      dense_rank() over (partition by quiz_id order by votes desc) as place
    from quiz_answer_counts
  ),
  quiz_totals as (
    select pokemon_key, min(pokemon) as pokemon, count(*)::integer as quiz_popular_finishes
    from quiz_ranked
    where place = 1
    group by pokemon_key
  ),
  pokemon_keys as (
    select pokemon_key from poll_totals
    union
    select pokemon_key from bracket_totals
    union
    select pokemon_key from quiz_totals
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'pokemon', coalesce(p.pokemon, b.pokemon, q.pokemon, k.pokemon_key),
      'pokemon_key', k.pokemon_key,
      'poll_wins', coalesce(p.poll_wins, 0),
      'bracket_championships', coalesce(b.bracket_championships, 0),
      'quiz_popular_finishes', coalesce(q.quiz_popular_finishes, 0)
    )
    order by k.pokemon_key
  ), '[]'::jsonb)
  from pokemon_keys k
  left join poll_totals p using (pokemon_key)
  left join bracket_totals b using (pokemon_key)
  left join quiz_totals q using (pokemon_key);
$$;

revoke all on function public.get_pokemon_community_ranking_totals()
  from public, anon, authenticated;

grant execute on function public.get_pokemon_community_ranking_totals()
  to anon, authenticated;

commit;
