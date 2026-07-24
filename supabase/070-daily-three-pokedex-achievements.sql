-- Add Daily Draft Bracket and Daily Quiz achievements to public Pokédex entries.

begin;

create index if not exists daily_bracket_matchups_winner_idx
  on public.daily_bracket_matchups(lower(winner));

create index if not exists daily_bracket_matchups_loser_idx
  on public.daily_bracket_matchups(lower(loser));

create index if not exists daily_quiz_answers_normalized_idx
  on public.daily_quiz_answers(normalized_answer);

create or replace function public.get_pokemon_daily_three_profile(p_pokemon text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with quiz_answer_counts as (
    select
      q.id as quiz_id,
      q.quiz_date,
      q.prompt,
      min(a.display_answer) as display_answer,
      a.normalized_answer,
      count(*)::integer as votes
    from public.daily_quizzes q
    join public.daily_quiz_answers a on a.quiz_id = q.id
    where q.quiz_date < current_date
    group by q.id, q.quiz_date, q.prompt, a.normalized_answer
  ),
  ranked_quiz_answers as (
    select *,
      dense_rank() over (partition by quiz_id order by votes desc) as place
    from quiz_answer_counts
  ),
  popular_quiz_finishes as (
    select quiz_id, quiz_date, prompt, display_answer, votes
    from ranked_quiz_answers
    where place = 1
      and lower(normalized_answer) = lower(regexp_replace(trim(p_pokemon), '[^a-zA-Z0-9]+', '', 'g'))
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
    'bracket_championships', (
      select count(*)::integer
      from public.daily_bracket_matchups
      where round_number = 3
        and lower(winner) = lower(trim(p_pokemon))
    ),
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

commit;
