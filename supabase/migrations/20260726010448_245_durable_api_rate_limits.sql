-- Durable server-side throttles for authenticated provider and rendering routes.

begin;

create table if not exists public.api_rate_limits (
  scope_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_scope_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.api_rate_limits%rowtype;
begin
  if nullif(trim(p_scope_key), '') is null or p_limit < 1 or p_window_seconds < 1 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_scope_key, 0));
  select * into v_row from public.api_rate_limits where scope_key = p_scope_key for update;
  if not found then
    insert into public.api_rate_limits(scope_key, window_started_at, request_count) values(left(p_scope_key, 128), now(), 1);
    return true;
  end if;
  if v_row.window_started_at <= now() - make_interval(secs => p_window_seconds) then
    update public.api_rate_limits set window_started_at=now(),request_count=1,updated_at=now() where scope_key=p_scope_key;
    return true;
  end if;
  if v_row.request_count >= p_limit then return false; end if;
  update public.api_rate_limits set request_count=request_count+1,updated_at=now() where scope_key=p_scope_key;
  return true;
end;
$$;

revoke all on function public.consume_api_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to service_role;

commit;
