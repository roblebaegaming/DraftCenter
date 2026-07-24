-- Recheck every Daily Three activity date for the signed-in user.
-- This repairs completions missed because activities were finished through
-- different page components or before all badge triggers were available.

create or replace function public.refresh_my_daily_three_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to refresh Daily Three badges.';
  end if;

  for r in
    select distinct activity_date
    from (
      select p.poll_date activity_date
      from public.daily_poll_answers a
      join public.daily_polls p on p.id = a.poll_id
      where a.user_id = auth.uid()

      union all

      select b.game_date
      from public.daily_bracket_matchups m
      join public.daily_draft_brackets b on b.id = m.bracket_id
      where m.user_id = auth.uid()
        and m.round_number = 3

      union all

      select q.quiz_date
      from public.daily_quiz_answers a
      join public.daily_quizzes q on q.id = a.quiz_id
      where a.user_id = auth.uid()
    ) activity
  loop
    perform public.refresh_daily_three(auth.uid(), r.activity_date);
  end loop;

  return public.refresh_my_account_badges();
end;
$$;

revoke all on function public.refresh_my_daily_three_badges()
  from public, anon, authenticated;

grant execute on function public.refresh_my_daily_three_badges()
  to authenticated;
