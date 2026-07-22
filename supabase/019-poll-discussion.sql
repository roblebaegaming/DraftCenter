-- DraftCenter milestone 16: signed-in discussion for each Poll of the Day.

create table if not exists public.daily_poll_comments (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.daily_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists daily_poll_comments_poll_created_idx
  on public.daily_poll_comments(poll_id, created_at desc);

alter table public.daily_poll_comments enable row level security;

drop policy if exists "signed-in users read poll comments" on public.daily_poll_comments;
create policy "signed-in users read poll comments"
  on public.daily_poll_comments for select to authenticated using (true);

drop policy if exists "users add their own poll comments" on public.daily_poll_comments;
create policy "users add their own poll comments"
  on public.daily_poll_comments for insert to authenticated with check (user_id = auth.uid());

create or replace function public.get_daily_poll_comments(
  p_poll_id uuid,
  p_limit integer default 5
)
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*)::integer from public.daily_poll_comments where poll_id = p_poll_id),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(comment_row) order by comment_row.created_at desc)
      from (
        select c.id, c.body, c.created_at, p.username, p.display_name
        from public.daily_poll_comments c
        left join public.profiles p on p.id = c.user_id
        where c.poll_id = p_poll_id
        order by c.created_at desc
        limit greatest(1, least(coalesce(p_limit, 5), 100))
      ) comment_row
    ), '[]'::jsonb)
  );
$$;

create or replace function public.create_daily_poll_comment(
  p_poll_id uuid,
  p_body text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to comment.'; end if;
  if not exists (select 1 from public.daily_polls where id = p_poll_id and poll_date <= current_date) then
    raise exception 'That poll is not available for comments.';
  end if;
  insert into public.daily_poll_comments(poll_id, user_id, body)
  values (p_poll_id, auth.uid(), trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.get_daily_poll_comments(uuid, integer) to authenticated;
grant execute on function public.create_daily_poll_comment(uuid, text) to authenticated;
