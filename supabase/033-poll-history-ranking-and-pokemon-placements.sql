-- Poll history, ranked discussion, closed past voting, and Pokemon podium history.
-- Run once AFTER migration 032.

create or replace function public.submit_daily_poll_answer(p_poll_id uuid, p_answer_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_poll public.daily_polls; v_is_valid boolean;
begin
  if auth.uid() is null then raise exception 'You must be signed in to vote.'; end if;
  select * into v_poll from public.daily_polls where id = p_poll_id for update;
  if v_poll.id is null then raise exception 'That poll was not found.'; end if;
  if v_poll.poll_date < current_date then raise exception 'Voting for this poll has closed.'; end if;
  if v_poll.poll_date > current_date then raise exception 'That poll is not open yet.'; end if;
  p_answer_key := trim(p_answer_key);
  if v_poll.answer_type = 'choice' and not exists (
    select 1 from jsonb_array_elements(v_poll.options) option where option ->> 'key' = p_answer_key
  ) then raise exception 'Choose one of the listed answers.'; end if;
  if v_poll.answer_type = 'pokemon' then
    if char_length(p_answer_key) not between 2 and 60 then raise exception 'Choose a Pokemon from the search list.'; end if;
    if to_regclass('public.pokemon_species') is not null then
      execute 'select exists (select 1 from public.pokemon_species where lower(name) = lower($1))'
        into v_is_valid using p_answer_key;
      if not v_is_valid then raise exception 'Choose a Pokemon from the search list.'; end if;
    end if;
  end if;
  insert into public.daily_poll_answers(poll_id, user_id, answer_key)
  values(v_poll.id, auth.uid(), p_answer_key)
  on conflict (poll_id, user_id) do update
    set answer_key = excluded.answer_key, answered_at = now();
  return public.get_daily_poll(v_poll.poll_date);
end;
$$;

create or replace function public.get_daily_poll_history(p_limit integer default 30)
returns jsonb
language sql security definer set search_path = public
as $$
  select coalesce(
    jsonb_agg(public.get_daily_poll(p.poll_date) order by p.poll_date desc),
    '[]'::jsonb
  )
  from (
    select poll_date
    from public.daily_polls
    where poll_date <= current_date
    order by poll_date desc
    limit greatest(1, least(coalesce(p_limit, 30), 365))
  ) p;
$$;

create or replace function public.get_daily_poll_comments(p_poll_id uuid, p_limit integer default 5)
returns jsonb language sql security definer set search_path = public as $$
  with ranked_top as (
    select c.id,
      (select count(*)::integer from public.daily_poll_comment_upvotes u where u.comment_id = c.id) as score
    from public.daily_poll_comments c
    where c.poll_id = p_poll_id and c.parent_comment_id is null
    order by score desc, c.created_at desc
    limit greatest(1, least(coalesce(p_limit, 5), 100))
  ),
  selected_comments as (
    select c.id, c.body, c.created_at, c.parent_comment_id, p.username, p.display_name,
      (select count(*)::integer from public.daily_poll_comment_upvotes u where u.comment_id = c.id) as upvotes,
      exists(select 1 from public.daily_poll_comment_upvotes u where u.comment_id = c.id and u.user_id = auth.uid()) as upvoted_by_me
    from public.daily_poll_comments c
    left join public.profiles p on p.id = c.user_id
    where c.id in (select id from ranked_top)
       or c.parent_comment_id in (select id from ranked_top)
  )
  select jsonb_build_object(
    'total', (select count(*)::integer from public.daily_poll_comments where poll_id = p_poll_id),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(sc) order by
        case when sc.parent_comment_id is null then 0 else 1 end,
        sc.upvotes desc,
        sc.created_at desc
      )
      from selected_comments sc
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_pokemon_poll_placements(p_pokemon text)
returns jsonb
language sql security definer set search_path = public
as $$
  with answer_counts as (
    select p.id as poll_id, p.poll_date, p.question, a.answer_key,
      count(*)::integer as votes
    from public.daily_polls p
    join public.daily_poll_answers a on a.poll_id = p.id
    where p.answer_type = 'pokemon' and p.poll_date < current_date
    group by p.id, p.poll_date, p.question, a.answer_key
  ),
  ranked as (
    select *, dense_rank() over (partition by poll_id order by votes desc) as place
    from answer_counts
  ),
  matches as (
    select poll_id, poll_date, question, votes, place::integer
    from ranked
    where place <= 3 and lower(answer_key) = lower(trim(p_pokemon))
  )
  select jsonb_build_object(
    'first', jsonb_build_object(
      'count', count(*) filter (where place = 1),
      'polls', coalesce(jsonb_agg(jsonb_build_object('id', poll_id, 'date', poll_date, 'question', question, 'votes', votes)
        order by poll_date desc) filter (where place = 1), '[]'::jsonb)
    ),
    'second', jsonb_build_object(
      'count', count(*) filter (where place = 2),
      'polls', coalesce(jsonb_agg(jsonb_build_object('id', poll_id, 'date', poll_date, 'question', question, 'votes', votes)
        order by poll_date desc) filter (where place = 2), '[]'::jsonb)
    ),
    'third', jsonb_build_object(
      'count', count(*) filter (where place = 3),
      'polls', coalesce(jsonb_agg(jsonb_build_object('id', poll_id, 'date', poll_date, 'question', question, 'votes', votes)
        order by poll_date desc) filter (where place = 3), '[]'::jsonb)
    )
  )
  from matches;
$$;

grant execute on function public.submit_daily_poll_answer(uuid, text) to authenticated;
grant execute on function public.get_daily_poll_history(integer) to authenticated;
grant execute on function public.get_daily_poll_comments(uuid, integer) to authenticated;
grant execute on function public.get_pokemon_poll_placements(text) to anon, authenticated;

create or replace function public.update_league_draft_time(p_league_id uuid, p_draft_starts_at timestamptz)
returns public.leagues
language plpgsql security definer set search_path = public
as $$
declare v_league public.leagues;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can update the draft time.';
  end if;
  update public.leagues
  set draft_starts_at = p_draft_starts_at, updated_at = now()
  where id = p_league_id
  returning * into v_league;
  return v_league;
end;
$$;

grant execute on function public.update_league_draft_time(uuid, timestamptz) to authenticated;
