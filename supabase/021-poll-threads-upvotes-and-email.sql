-- DraftCenter milestone 21: threaded Poll of the Day discussion, upvotes,
-- and the preference/data needed for the daily results email.

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_draft_reminders boolean not null default true,
  email_turn_reminders boolean not null default true,
  email_transactions boolean not null default true,
  email_messages boolean not null default false,
  email_weekly_digest boolean not null default false,
  discord_draft_reminders boolean not null default true,
  discord_transactions boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
drop policy if exists "users manage their own notification preferences" on public.notification_preferences;
create policy "users manage their own notification preferences"
  on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notification_preferences
  add column if not exists email_daily_poll_results boolean not null default false;

alter table public.daily_poll_comments
  add column if not exists parent_comment_id uuid references public.daily_poll_comments(id) on delete cascade;

create index if not exists daily_poll_comments_parent_idx
  on public.daily_poll_comments(parent_comment_id, created_at asc);

create table if not exists public.daily_poll_comment_upvotes (
  comment_id uuid not null references public.daily_poll_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.daily_poll_comment_upvotes enable row level security;
drop policy if exists "signed-in users read poll comment upvotes" on public.daily_poll_comment_upvotes;
create policy "signed-in users read poll comment upvotes"
  on public.daily_poll_comment_upvotes for select to authenticated using (true);
drop policy if exists "users manage their own poll comment upvotes" on public.daily_poll_comment_upvotes;
create policy "users manage their own poll comment upvotes"
  on public.daily_poll_comment_upvotes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.get_daily_poll_comments(p_poll_id uuid, p_limit integer default 5)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*)::integer from public.daily_poll_comments where poll_id = p_poll_id),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(comment_row) order by comment_row.created_at desc)
      from (
        select c.id, c.body, c.created_at, c.parent_comment_id, p.username, p.display_name,
          (select count(*)::integer from public.daily_poll_comment_upvotes u where u.comment_id = c.id) as upvotes,
          exists(select 1 from public.daily_poll_comment_upvotes u where u.comment_id = c.id and u.user_id = auth.uid()) as upvoted_by_me
        from public.daily_poll_comments c
        left join public.profiles p on p.id = c.user_id
        where c.poll_id = p_poll_id
        order by c.created_at desc
        limit greatest(1, least(coalesce(p_limit, 5), 100))
      ) comment_row
    ), '[]'::jsonb)
  );
$$;

create or replace function public.create_daily_poll_comment(p_poll_id uuid, p_body text, p_parent_comment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to comment.'; end if;
  if not exists (select 1 from public.daily_polls where id = p_poll_id and poll_date <= current_date) then raise exception 'That poll is not available for comments.'; end if;
  if p_parent_comment_id is not null and not exists (
    select 1 from public.daily_poll_comments where id = p_parent_comment_id and poll_id = p_poll_id and parent_comment_id is null
  ) then raise exception 'Replies must be attached to a top-level comment on this poll.'; end if;
  insert into public.daily_poll_comments(poll_id, user_id, body, parent_comment_id)
  values (p_poll_id, auth.uid(), trim(p_body), p_parent_comment_id) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.toggle_daily_poll_comment_upvote(p_comment_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in to vote.'; end if;
  if not exists (select 1 from public.daily_poll_comments where id = p_comment_id) then raise exception 'That comment no longer exists.'; end if;
  if exists (select 1 from public.daily_poll_comment_upvotes where comment_id = p_comment_id and user_id = auth.uid()) then
    delete from public.daily_poll_comment_upvotes where comment_id = p_comment_id and user_id = auth.uid();
    return false;
  end if;
  insert into public.daily_poll_comment_upvotes(comment_id, user_id) values (p_comment_id, auth.uid());
  return true;
end;
$$;

create table if not exists public.daily_poll_email_deliveries (
  poll_id uuid not null references public.daily_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.daily_poll_email_deliveries enable row level security;
drop policy if exists "users read their own daily poll delivery history" on public.daily_poll_email_deliveries;
create policy "users read their own daily poll delivery history" on public.daily_poll_email_deliveries for select to authenticated using (user_id = auth.uid());

grant execute on function public.get_daily_poll_comments(uuid, integer) to authenticated;
grant execute on function public.create_daily_poll_comment(uuid, text, uuid) to authenticated;
grant execute on function public.toggle_daily_poll_comment_upvote(uuid) to authenticated;
