-- Count exactly one official community bracket champion for each completed day.
-- Keep the winning final-vote total available separately for future features.

begin;

create or replace function public.get_daily_bracket_official_champions()
returns table (
  bracket_id uuid,
  game_date date,
  pokemon_key text,
  pokemon text,
  championship_votes integer
)
language sql
stable
security definer
set search_path = public
as $$
  with finalists as (
    select
      b.id as bracket_id,
      b.game_date,
      lower(trim(m.winner)) as pokemon_key,
      min(m.winner) as pokemon,
      count(*)::integer as final_wins
    from public.daily_draft_brackets b
    join public.daily_bracket_matchups m on m.bracket_id = b.id
    where b.game_date < current_date
      and m.round_number = 3
    group by b.id, b.game_date, lower(trim(m.winner))
  ),
  scored as (
    select
      f.*,
      coalesce((
        select
          count(*) filter (where lower(trim(m.winner)) = f.pokemon_key)::numeric
          / nullif(count(*), 0)
        from public.daily_bracket_matchups m
        where m.bracket_id = f.bracket_id
          and m.round_number = 2
          and (
            lower(trim(m.winner)) = f.pokemon_key
            or lower(trim(m.loser)) = f.pokemon_key
          )
      ), 0) as semifinal_rate,
      coalesce((
        select
          count(*) filter (where lower(trim(m.winner)) = f.pokemon_key)::numeric
          / nullif(count(*), 0)
        from public.daily_bracket_matchups m
        where m.bracket_id = f.bracket_id
          and m.round_number = 1
          and (
            lower(trim(m.winner)) = f.pokemon_key
            or lower(trim(m.loser)) = f.pokemon_key
          )
      ), 0) as quarterfinal_rate
    from finalists f
  ),
  ranked as (
    select
      s.*,
      row_number() over (
        partition by s.game_date
        order by
          s.final_wins desc,
          s.semifinal_rate desc,
          s.quarterfinal_rate desc,
          s.pokemon_key
      ) as champion_rank
    from scored s
  )
  select
    r.bracket_id,
    r.game_date,
    r.pokemon_key,
    r.pokemon,
    r.final_wins as championship_votes
  from ranked r
  where r.champion_rank = 1;
$$;

revoke all on function public.get_daily_bracket_official_champions()
  from public, anon, authenticated;

create or replace function public.get_pokemon_daily_three_profile(p_pokemon text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select lower(regexp_replace(trim(p_pokemon), '[^a-zA-Z0-9]+', '', 'g')) as pokemon_key
  ),
  quiz_answer_counts as (
    select
      q.id as quiz_id,
      q.quiz_date,
      q.prompt,
      min(a.display_answer) as display_answer,
      lower(a.normalized_answer) as pokemon_key,
      count(*)::integer as votes
    from public.daily_quizzes q
    join public.daily_quiz_answers a on a.quiz_id = q.id
    where q.quiz_date < current_date
    group by q.id, q.quiz_date, q.prompt, lower(a.normalized_answer)
  ),
  ranked_quiz_answers as (
    select *,
      dense_rank() over (partition by quiz_id order by votes desc) as place
    from quiz_answer_counts
  ),
  popular_quiz_finishes as (
    select quiz_id, quiz_date, prompt, display_answer, votes
    from ranked_quiz_answers, requested
    where place = 1
      and ranked_quiz_answers.pokemon_key = requested.pokemon_key
  ),
  championships as (
    select c.*
    from public.get_daily_bracket_official_champions() c, requested
    where lower(regexp_replace(c.pokemon, '[^a-zA-Z0-9]+', '', 'g')) = requested.pokemon_key
  )
  select jsonb_build_object(
    'pokemon', p_pokemon,
    'bracket_wins', (
      select count(*)::integer
      from public.daily_bracket_matchups
      where lower(winner) = lower(trim(p_pokemon))
    ),
    'bracket_losses', (
      select count(*)::integer
      from public.daily_bracket_matchups
      where lower(loser) = lower(trim(p_pokemon))
    ),
    'bracket_championships', (select count(*)::integer from championships),
    'bracket_championship_votes', coalesce((
      select sum(championship_votes)::integer from championships
    ), 0),
    'most_defeated', coalesce((
      select jsonb_agg(
        jsonb_build_object('pokemon', opponent, 'wins', total)
        order by total desc, opponent
      )
      from (
        select min(loser) as opponent, count(*)::integer as total
        from public.daily_bracket_matchups
        where lower(winner) = lower(trim(p_pokemon))
        group by lower(loser)
        order by total desc, opponent
        limit 5
      ) wins
    ), '[]'::jsonb),
    'quiz_popular_finishes', (select count(*)::integer from popular_quiz_finishes),
    'quiz_popular_days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', quiz_id,
          'date', quiz_date,
          'prompt', prompt,
          'answer', display_answer,
          'votes', votes
        )
        order by quiz_date desc
      )
      from popular_quiz_finishes
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_pokemon_daily_three_profile(text)
  from public, anon, authenticated;

grant execute on function public.get_pokemon_daily_three_profile(text)
  to anon, authenticated;

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
    group by
      p.id,
      lower(regexp_replace(trim(a.answer_key), '[^a-zA-Z0-9]+', '', 'g'))
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
      lower(regexp_replace(pokemon, '[^a-zA-Z0-9]+', '', 'g')) as pokemon_key,
      min(pokemon) as pokemon,
      count(*)::integer as bracket_championships,
      sum(championship_votes)::integer as bracket_championship_votes
    from public.get_daily_bracket_official_champions()
    group by lower(regexp_replace(pokemon, '[^a-zA-Z0-9]+', '', 'g'))
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
      'bracket_championship_votes', coalesce(b.bracket_championship_votes, 0),
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
