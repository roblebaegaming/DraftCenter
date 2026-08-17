-- Opt-in league Discord announcement for yesterday's Daily Three results and
-- today's new Question of the Day. Delivery claims prevent duplicate posts.

begin;

alter table public.league_discord_settings
  add column if not exists notify_daily_three boolean not null default false;

create table if not exists public.daily_three_discord_deliveries (
  league_id uuid not null references public.leagues(id) on delete cascade,
  delivery_date date not null,
  created_at timestamptz not null default now(),
  primary key (league_id, delivery_date)
);

alter table public.daily_three_discord_deliveries enable row level security;
revoke all on table public.daily_three_discord_deliveries from public, anon, authenticated;
grant select, insert, delete on table public.daily_three_discord_deliveries to service_role;

create or replace function public.save_league_discord_daily_three(
  p_league_id uuid,
  p_notify_daily_three boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage Discord settings.';
  end if;
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can manage Discord settings.';
  end if;
  update public.league_discord_settings
  set notify_daily_three = coalesce(p_notify_daily_three, false),
      updated_by = auth.uid(),
      updated_at = now()
  where league_id = p_league_id;
  if not found then
    raise exception 'Save the Discord server and channel before announcement preferences.';
  end if;
  return true;
end;
$$;

revoke all on function public.save_league_discord_daily_three(uuid, boolean) from public, anon;
grant execute on function public.save_league_discord_daily_three(uuid, boolean) to authenticated;

commit;

notify pgrst, 'reload schema';
