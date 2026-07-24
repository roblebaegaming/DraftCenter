-- Rank Daily Draft Bracket community champions by:
-- 1. Final wins, 2. semifinal win percentage, 3. quarterfinal win percentage.

begin;

create or replace function public.get_daily_community_games(p_local_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'bracket', (
      select jsonb_build_object(
        'id', b.id,
        'game_date', b.game_date,
        'pokemon', b.pokemon,
        'completed_brackets', (
          select count(distinct m.user_id)::integer
          from public.daily_bracket_matchups m
          where m.bracket_id = b.id
            and m.round_number = 3
        ),
        'results_revealed', b.game_date < current_date or auth.uid() is not null,
        'champions', case
          when b.game_date >= current_date and auth.uid() is null then '[]'::jsonb
          else coalesce((
            with finalists as (
              select
                lower(m.winner) as pokemon_key,
                min(m.winner) as pokemon,
                count(*)::integer as final_wins
              from public.daily_bracket_matchups m
              where m.bracket_id = b.id
                and m.round_number = 3
              group by lower(m.winner)
            ),
            ranked as (
              select
                f.pokemon,
                f.final_wins,
                coalesce((
                  select round(
                    100.0 * count(*) filter (where lower(m.winner) = f.pokemon_key)
                    / nullif(count(*), 0)
                  )::integer
                  from public.daily_bracket_matchups m
                  where m.bracket_id = b.id
                    and m.round_number = 2
                    and (
                      lower(m.winner) = f.pokemon_key
                      or lower(m.loser) = f.pokemon_key
                    )
                ), 0) as semifinal_percent,
                coalesce((
                  select round(
                    100.0 * count(*) filter (where lower(m.winner) = f.pokemon_key)
                    / nullif(count(*), 0)
                  )::integer
                  from public.daily_bracket_matchups m
                  where m.bracket_id = b.id
                    and m.round_number = 1
                    and (
                      lower(m.winner) = f.pokemon_key
                      or lower(m.loser) = f.pokemon_key
                    )
                ), 0) as quarterfinal_percent
              from finalists f
            )
            select jsonb_agg(
              jsonb_build_object(
                'pokemon', pokemon,
                'wins', final_wins,
                'semifinal_percent', semifinal_percent,
                'quarterfinal_percent', quarterfinal_percent
              )
              order by
                final_wins desc,
                semifinal_percent desc,
                quarterfinal_percent desc,
                pokemon
            )
            from ranked
          ), '[]'::jsonb)
        end,
        'matchup_results', case
          when b.game_date >= current_date and auth.uid() is null then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'round', round_number,
                'winner', winner,
                'loser', loser,
                'votes', total
              )
              order by round_number, total desc
            )
            from (
              select
                round_number,
                min(winner) as winner,
                min(loser) as loser,
                count(*)::integer as total
              from public.daily_bracket_matchups
              where bracket_id = b.id
              group by round_number, lower(winner), lower(loser)
            ) results
          ), '[]'::jsonb)
        end,
        'selected_winners', case
          when auth.uid() is null then '[]'::jsonb
          else coalesce((
            select jsonb_agg(m.winner order by m.round_number, m.match_number)
            from public.daily_bracket_matchups m
            where m.bracket_id = b.id
              and m.user_id = auth.uid()
          ), '[]'::jsonb)
        end
      )
      from public.daily_draft_brackets b
      where b.game_date = p_local_date
    ),
    'quiz', (
      select jsonb_build_object(
        'id', q.id,
        'quiz_date', q.quiz_date,
        'prompt', q.prompt,
        'hint', q.hint,
        'difficulty', q.difficulty,
        'answered', exists(
          select 1
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
            and a.user_id = auth.uid()
        ),
        'selected_answer', (
          select a.display_answer
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
            and a.user_id = auth.uid()
        ),
        'selected_correct', (
          select a.is_correct
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
            and a.user_id = auth.uid()
        ),
        'correct_answers', case
          when q.quiz_date < current_date or exists(
            select 1
            from public.daily_quiz_answers a
            where a.quiz_id = q.id
              and a.user_id = auth.uid()
          ) then q.accepted_answers
          else '[]'::jsonb
        end,
        'total_answers', (
          select count(*)::integer
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
        ),
        'correct_percent', case
          when q.quiz_date >= current_date and (
            auth.uid() is null or not exists(
              select 1
              from public.daily_quiz_answers a
              where a.quiz_id = q.id
                and a.user_id = auth.uid()
            )
          ) then null
          else coalesce((
            select round(
              100.0 * count(*) filter (where a.is_correct)
              / nullif(count(*), 0)
            )::integer
            from public.daily_quiz_answers a
            where a.quiz_id = q.id
          ), 0)
        end,
        'top_answers', case
          when q.quiz_date >= current_date and (
            auth.uid() is null or not exists(
              select 1
              from public.daily_quiz_answers a
              where a.quiz_id = q.id
                and a.user_id = auth.uid()
            )
          ) then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'answer', ranked.display_answer,
                'count', ranked.total
              )
              order by ranked.total desc, ranked.display_answer
            )
            from (
              select
                min(a.display_answer) as display_answer,
                count(*)::integer as total
              from public.daily_quiz_answers a
              where a.quiz_id = q.id
              group by a.normalized_answer
              order by total desc
              limit 5
            ) ranked
          ), '[]'::jsonb)
        end
      )
      from public.daily_quizzes q
      where q.quiz_date = p_local_date
    )
  );
$$;

revoke all on function public.get_daily_community_games(date)
  from public, anon, authenticated;

grant execute on function public.get_daily_community_games(date)
  to anon, authenticated;

commit;
