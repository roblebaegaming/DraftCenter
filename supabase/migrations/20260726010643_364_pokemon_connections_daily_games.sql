-- Migration 364: add Pokémon Connections completion and discussion support while preserving
-- every historical Daily Three completion and its badge progress. Legacy
-- table, function, preference, and delivery identifiers remain in place for
-- backward compatibility; user-facing language is now Daily Games.

begin;

-- Grandfather every account that completed the original three account-backed
-- games before this migration. These rows are never removed when the fourth
-- game becomes part of new Daily Games completion days.
insert into public.daily_three_completions(user_id, activity_date)
select poll.user_id, poll.activity_date
from (
  select answer.user_id, poll.poll_date activity_date
  from public.daily_poll_answers answer
  join public.daily_polls poll on poll.id = answer.poll_id
) poll
where exists (
  select 1
  from public.daily_bracket_matchups matchup
  join public.daily_draft_brackets bracket on bracket.id = matchup.bracket_id
  where matchup.user_id = poll.user_id
    and bracket.game_date = poll.activity_date
    and matchup.round_number = 3
)
and exists (
  select 1
  from public.daily_quiz_answers answer
  join public.daily_quizzes quiz on quiz.id = answer.quiz_id
  where answer.user_id = poll.user_id
    and quiz.quiz_date = poll.activity_date
)
on conflict do nothing;

create table if not exists public.daily_connections_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  completed_at timestamptz not null default now(),
  primary key(user_id, activity_date)
);

alter table public.daily_connections_completions enable row level security;
revoke all on table public.daily_connections_completions from public, anon, authenticated;
grant select on table public.daily_connections_completions to service_role;

alter table public.daily_game_comments
  drop constraint if exists daily_game_comments_game_type_check;
alter table public.daily_game_comments
  add constraint daily_game_comments_game_type_check
  check (game_type in ('bracket', 'quiz', 'connections'));

create or replace function public.pokemon_connections_game_id(p_date date)
returns uuid
language sql
immutable
strict
set search_path = public
as $$
  select md5('pokemon-connections:' || p_date::text)::uuid;
$$;

create or replace function public.can_access_daily_game_discussion(
  p_user uuid,
  p_game_type text,
  p_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and case p_game_type
    when 'bracket' then exists (
      select 1
      from public.daily_bracket_matchups matchup
      where matchup.user_id = p_user
        and matchup.bracket_id = p_game_id
        and matchup.round_number = 3
    )
    when 'quiz' then exists (
      select 1
      from public.daily_quiz_answers answer
      where answer.user_id = p_user
        and answer.quiz_id = p_game_id
    )
    when 'connections' then exists (
      select 1
      from public.daily_connections_completions completion
      where completion.user_id = p_user
        and public.pokemon_connections_game_id(completion.activity_date) = p_game_id
    )
    else false
  end;
$$;

create or replace function public.refresh_daily_three(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll boolean;
  v_bracket boolean;
  v_quiz boolean;
  v_connections boolean;
  v_total integer;
  v_current integer := 0;
  v_best integer := 0;
  v_run integer := 0;
  v_prev date;
  r record;
begin
  select exists(
    select 1 from public.daily_poll_answers answer
    join public.daily_polls poll on poll.id = answer.poll_id
    where answer.user_id = p_user and poll.poll_date = p_date
  ) into v_poll;
  select exists(
    select 1 from public.daily_bracket_matchups matchup
    join public.daily_draft_brackets bracket on bracket.id = matchup.bracket_id
    where matchup.user_id = p_user and bracket.game_date = p_date and matchup.round_number = 3
  ) into v_bracket;
  select exists(
    select 1 from public.daily_quiz_answers answer
    join public.daily_quizzes quiz on quiz.id = answer.quiz_id
    where answer.user_id = p_user and quiz.quiz_date = p_date
  ) into v_quiz;
  select exists(
    select 1 from public.daily_connections_completions completion
    where completion.user_id = p_user and completion.activity_date = p_date
  ) into v_connections;

  if v_poll and v_bracket and v_quiz and v_connections then
    insert into public.daily_three_completions(user_id, activity_date)
    values(p_user, p_date)
    on conflict do nothing;
  end if;

  select count(*)::integer into v_total
  from public.daily_three_completions
  where user_id = p_user;
  for r in
    select activity_date
    from public.daily_three_completions
    where user_id = p_user
    order by activity_date
  loop
    if v_prev is not null and r.activity_date = v_prev + 1 then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    v_best := greatest(v_best, v_run);
    v_prev := r.activity_date;
  end loop;
  v_prev := p_date;
  while exists(
    select 1 from public.daily_three_completions
    where user_id = p_user and activity_date = v_prev
  ) loop
    v_current := v_current + 1;
    v_prev := v_prev - 1;
  end loop;
  perform public.set_badge_progress(p_user, 'daily_trio', '', v_total);
  perform public.set_badge_progress(p_user, 'community_regular', '', v_total);
  perform public.set_badge_progress(p_user, 'daily_streak', '', greatest(v_current, v_best));
end;
$$;

create or replace function public.refresh_my_daily_games_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to refresh Daily Games badges.';
  end if;

  for r in
    select distinct activity_date
    from (
      select poll.poll_date activity_date
      from public.daily_poll_answers answer
      join public.daily_polls poll on poll.id = answer.poll_id
      where answer.user_id = auth.uid()
      union all
      select bracket.game_date
      from public.daily_bracket_matchups matchup
      join public.daily_draft_brackets bracket on bracket.id = matchup.bracket_id
      where matchup.user_id = auth.uid() and matchup.round_number = 3
      union all
      select quiz.quiz_date
      from public.daily_quiz_answers answer
      join public.daily_quizzes quiz on quiz.id = answer.quiz_id
      where answer.user_id = auth.uid()
      union all
      select activity_date
      from public.daily_connections_completions
      where user_id = auth.uid()
      union all
      select activity_date
      from public.daily_three_completions
      where user_id = auth.uid()
    ) activity
  loop
    perform public.refresh_daily_three(auth.uid(), r.activity_date);
  end loop;

  return public.refresh_my_account_badges();
end;
$$;

-- Keep the old RPC callable for open sessions and older clients.
create or replace function public.refresh_my_daily_three_badges()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.refresh_my_daily_games_badges();
$$;

create or replace function public.complete_pokemon_connections(
  p_local_date date,
  p_time_zone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verified_date date;
  v_game_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save Pokémon Connections progress.';
  end if;
  if p_local_date is null or nullif(trim(p_time_zone), '') is null then
    raise exception 'A local date and browser time zone are required.';
  end if;
  begin
    v_verified_date := (now() at time zone p_time_zone)::date;
  exception when others then
    raise exception 'Your browser time zone was not recognized.';
  end;
  if v_verified_date <> p_local_date then
    raise exception 'Your local Pokémon Connections date changed. Refresh and try again.';
  end if;

  insert into public.daily_connections_completions(user_id, activity_date)
  values(auth.uid(), p_local_date)
  on conflict do nothing;
  perform public.refresh_daily_three(auth.uid(), p_local_date);
  v_game_id := public.pokemon_connections_game_id(p_local_date);

  return jsonb_build_object(
    'game_id', v_game_id,
    'badge_profile', public.get_my_badge_profile()
  );
end;
$$;

create or replace function public.get_daily_game_comments(
  p_game_type text,
  p_game_id uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to read this discussion.';
  end if;
  if not public.can_access_daily_game_discussion(auth.uid(), p_game_type, p_game_id) then
    raise exception 'Complete this daily game to unlock its discussion.';
  end if;
  return (
    select coalesce(
      jsonb_agg(to_jsonb(rows) order by rows.parent_comment_id nulls first, rows.upvotes desc, rows.created_at asc),
      '[]'::jsonb
    )
    from (
      select c.id, c.body, c.created_at, c.parent_comment_id,
        c.user_id, profile.username, profile.display_name, profile.avatar_url,
        (select count(*)::integer from public.daily_game_comment_upvotes upvote where upvote.comment_id = c.id) upvotes,
        exists(
          select 1 from public.daily_game_comment_upvotes upvote
          where upvote.comment_id = c.id and upvote.user_id = auth.uid()
        ) upvoted_by_me
      from public.daily_game_comments c
      left join public.profiles profile on profile.id = c.user_id
      where c.game_type = p_game_type and c.game_id = p_game_id
      order by c.parent_comment_id nulls first, upvotes desc, c.created_at asc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) rows
  );
end;
$$;

create or replace function public.create_daily_game_comment(
  p_game_type text,
  p_game_id uuid,
  p_body text,
  p_parent_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to comment.';
  end if;
  if p_game_type not in ('bracket', 'quiz', 'connections') then
    raise exception 'Unknown Daily Games activity.';
  end if;
  if not public.can_access_daily_game_discussion(auth.uid(), p_game_type, p_game_id) then
    raise exception 'Complete this daily game to unlock its discussion.';
  end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 1000 then
    raise exception 'Comments must be between 1 and 1,000 characters.';
  end if;
  if p_parent_comment_id is not null and not exists (
    select 1 from public.daily_game_comments
    where id = p_parent_comment_id
      and game_type = p_game_type
      and game_id = p_game_id
      and parent_comment_id is null
  ) then
    raise exception 'Replies must belong to a top-level comment on this activity.';
  end if;
  insert into public.daily_game_comments(game_type, game_id, user_id, parent_comment_id, body)
  values(p_game_type, p_game_id, auth.uid(), p_parent_comment_id, trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.upvote_daily_game_comment(p_comment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_game_type text;
  v_game_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to upvote.';
  end if;
  select game_type, game_id into v_game_type, v_game_id
  from public.daily_game_comments
  where id = p_comment_id;
  if v_game_id is null then
    raise exception 'That comment no longer exists.';
  end if;
  if not public.can_access_daily_game_discussion(auth.uid(), v_game_type, v_game_id) then
    raise exception 'Complete this daily game to unlock its discussion.';
  end if;
  insert into public.daily_game_comment_upvotes(comment_id, user_id)
  values(p_comment_id, auth.uid())
  on conflict do nothing;
  select count(*)::integer into v_count
  from public.daily_game_comment_upvotes
  where comment_id = p_comment_id;
  return v_count;
end;
$$;

update public.badge_catalog
set name = 'Daily Games',
    description = 'Complete Pokémon Connections, the Poll, Draft Bracket, and Pokémon Quiz on the same local day.'
where code = 'daily_trio';

update public.badge_catalog
set name = 'Daily Games Streak',
    description = 'Complete all four Daily Games on consecutive days.'
where code = 'daily_streak';

update public.badge_catalog
set description = 'Complete all four Daily Games on many total days.'
where code = 'community_regular';

update public.badge_catalog
set description = 'Discover distinct Pokémon through eligible Daily Games and DraftCenter drafts.'
where code = 'pokedex_researcher';

update public.badge_catalog
set description = 'Find rare shiny Pokémon through eligible Daily Games and draft discoveries.'
where code = 'shiny_hunter';

create or replace function public.get_my_badge_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
select jsonb_build_object(
  'badges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', catalog.code, 'name', catalog.name, 'description', catalog.description,
      'icon', catalog.icon, 'category', catalog.category, 'thresholds', catalog.thresholds,
      'subject', coalesce(progress.subject, ''), 'progress', coalesce(progress.progress, 0),
      'tier', coalesce(progress.tier, 0), 'tier_names', catalog.tier_names
    ) order by coalesce(progress.tier, 0) desc, coalesce(progress.progress, 0) desc, catalog.name)
    from public.badge_catalog catalog
    left join public.user_badge_progress progress
      on progress.badge_code = catalog.code and progress.user_id = auth.uid()
  ), '[]'::jsonb),
  'events', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', event.id, 'code', event.badge_code, 'name', catalog.name,
      'description', catalog.description, 'icon', catalog.icon, 'subject', event.subject,
      'tier', event.tier, 'awarded_at', event.awarded_at
    ) order by event.awarded_at)
    from public.badge_award_events event
    join public.badge_catalog catalog on catalog.code = event.badge_code
    where event.user_id = auth.uid() and event.seen_at is null
  ), '[]'::jsonb),
  'daily_games', jsonb_build_object(
    'total', (select count(*) from public.daily_three_completions where user_id = auth.uid()),
    'dates', coalesce((select jsonb_agg(activity_date order by activity_date desc) from public.daily_three_completions where user_id = auth.uid()), '[]'::jsonb)
  ),
  'daily_three', jsonb_build_object(
    'total', (select count(*) from public.daily_three_completions where user_id = auth.uid()),
    'dates', coalesce((select jsonb_agg(activity_date order by activity_date desc) from public.daily_three_completions where user_id = auth.uid()), '[]'::jsonb)
  )
);
$$;

revoke all on function public.pokemon_connections_game_id(date) from public, anon, authenticated;
revoke all on function public.can_access_daily_game_discussion(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.refresh_daily_three(uuid, date) from public, anon, authenticated;
revoke all on function public.refresh_my_daily_games_badges() from public, anon, authenticated;
revoke all on function public.refresh_my_daily_three_badges() from public, anon, authenticated;
revoke all on function public.complete_pokemon_connections(date, text) from public, anon, authenticated;
revoke all on function public.get_daily_game_comments(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.create_daily_game_comment(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.upvote_daily_game_comment(uuid) from public, anon, authenticated;
revoke all on function public.get_my_badge_profile() from public, anon, authenticated;

grant execute on function public.refresh_my_daily_games_badges() to authenticated;
grant execute on function public.refresh_my_daily_three_badges() to authenticated;
grant execute on function public.complete_pokemon_connections(date, text) to authenticated;
grant execute on function public.get_daily_game_comments(text, uuid, integer) to authenticated;
grant execute on function public.create_daily_game_comment(text, uuid, text, uuid) to authenticated;
grant execute on function public.upvote_daily_game_comment(uuid) to authenticated;
grant execute on function public.get_my_badge_profile() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_class relation
    join pg_namespace schema on schema.oid = relation.relnamespace
    where schema.nspname = 'public'
      and relation.relname = 'daily_connections_completions'
      and relation.relrowsecurity
  ) then
    raise exception 'daily_connections_completions must have RLS enabled';
  end if;
  if has_table_privilege('anon', 'public.daily_connections_completions', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_connections_completions', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_connections_completions', 'INSERT') then
    raise exception 'daily_connections_completions direct client grants are too broad';
  end if;
  if has_function_privilege('anon', 'public.complete_pokemon_connections(date,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.complete_pokemon_connections(date,text)', 'EXECUTE') then
    raise exception 'Pokémon Connections completion grants are incorrect';
  end if;
  if has_function_privilege('authenticated', 'public.can_access_daily_game_discussion(uuid,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.refresh_daily_three(uuid,date)', 'EXECUTE') then
    raise exception 'Internal Daily Games helpers must not be client callable';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
