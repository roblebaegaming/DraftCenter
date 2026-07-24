-- Make Poll of the Day follow the visitor's local calendar date instead of
-- the database server's UTC date. The browser supplies its YYYY-MM-DD date.

begin;

create or replace function public.get_local_daily_poll(p_local_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'id', p.id,
      'poll_date', p.poll_date,
      'question', p.question,
      'answer_type', p.answer_type,
      'options', p.options,
      'counts', case when auth.uid() is null then '{}'::jsonb else coalesce((
        select jsonb_object_agg(answer_key, total)
        from (
          select a.answer_key, count(*)::integer as total
          from public.daily_poll_answers a
          where a.poll_id = p.id
          group by a.answer_key
        ) answer_counts
      ), '{}'::jsonb) end,
      'total_votes', (
        select count(*)::integer
        from public.daily_poll_answers a
        where a.poll_id = p.id
      ),
      'selected_key', case when auth.uid() is null then null else (
        select a.answer_key
        from public.daily_poll_answers a
        where a.poll_id = p.id
          and a.user_id = auth.uid()
      ) end
    )
    from public.daily_polls p
    where p.poll_date = p_local_date
  ), 'null'::jsonb);
$$;

create or replace function public.get_local_poll_history(
  p_local_date date,
  p_limit integer default 30
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'poll_date', p.poll_date,
    'question', p.question,
    'answer_type', p.answer_type,
    'options', p.options,
    'counts', coalesce((
      select jsonb_object_agg(answer_key, total)
      from (
        select a.answer_key, count(*)::integer as total
        from public.daily_poll_answers a
        where a.poll_id = p.id
        group by a.answer_key
      ) result_counts
    ), '{}'::jsonb),
    'total_votes', (
      select count(*)::integer
      from public.daily_poll_answers a
      where a.poll_id = p.id
    )
  ) order by p.poll_date desc), '[]'::jsonb)
  from (
    select *
    from public.daily_polls
    where poll_date < p_local_date
    order by poll_date desc
    limit greatest(1, least(coalesce(p_limit, 30), 365))
  ) p;
$$;

create or replace function public.submit_local_daily_poll_answer(
  p_poll_id uuid,
  p_answer_key text,
  p_local_date date,
  p_time_zone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll public.daily_polls;
  v_is_valid boolean;
  v_verified_date date;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to vote.';
  end if;

  begin
    v_verified_date := (now() at time zone p_time_zone)::date;
  exception when others then
    raise exception 'Your browser time zone was not recognized.';
  end;

  if v_verified_date <> p_local_date then
    raise exception 'Your local poll date changed. Refresh and try again.';
  end if;

  select *
  into v_poll
  from public.daily_polls
  where id = p_poll_id
  for update;

  if v_poll.id is null then
    raise exception 'That poll was not found.';
  end if;

  if v_poll.poll_date <> p_local_date then
    raise exception 'Voting for that poll is closed in your local time.';
  end if;

  p_answer_key := trim(p_answer_key);

  if v_poll.answer_type = 'choice'
    and not exists (
      select 1
      from jsonb_array_elements(v_poll.options) option
      where option ->> 'key' = p_answer_key
    )
  then
    raise exception 'Choose one of the listed answers.';
  end if;

  if v_poll.answer_type = 'pokemon' then
    if char_length(p_answer_key) not between 2 and 60 then
      raise exception 'Choose a Pokemon from the search list.';
    end if;

    if to_regclass('public.pokemon_species') is not null then
      execute '
        select exists (
          select 1
          from public.pokemon_species
          where lower(name) = lower($1)
        )
      '
      into v_is_valid
      using p_answer_key;

      if not v_is_valid then
        raise exception 'Choose a Pokemon from the search list.';
      end if;
    end if;
  end if;

  insert into public.daily_poll_answers (
    poll_id,
    user_id,
    answer_key
  )
  values (
    v_poll.id,
    auth.uid(),
    p_answer_key
  )
  on conflict (poll_id, user_id) do update
  set
    answer_key = excluded.answer_key,
    answered_at = now();

  return public.get_local_daily_poll(p_local_date);
end;
$$;

revoke execute on function public.get_local_daily_poll(date) from public;
revoke execute on function public.get_local_poll_history(date, integer) from public;
revoke execute on function public.submit_local_daily_poll_answer(uuid, text, date, text) from public;

grant execute on function public.get_local_daily_poll(date) to anon, authenticated;
grant execute on function public.get_local_poll_history(date, integer) to anon, authenticated;
grant execute on function public.submit_local_daily_poll_answer(uuid, text, date, text) to authenticated;

commit;
