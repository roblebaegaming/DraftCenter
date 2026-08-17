-- Cache only caller-independent Community Explore aggregates. The public RPC
-- still builds signed-in and selected poll fields per request so cached data
-- can never disclose one caller's poll state to another caller.

begin;

alter function public.get_public_explore()
  rename to get_public_explore_uncached;

revoke execute on function public.get_public_explore_uncached()
  from public, anon, authenticated;

create table public.public_explore_cache (
  cache_key text primary key check (cache_key = 'shared'),
  payload jsonb not null,
  refreshed_at timestamptz not null
);

alter table public.public_explore_cache enable row level security;
revoke all on table public.public_explore_cache
  from public, anon, authenticated;
grant select, insert, update, delete on table public.public_explore_cache
  to service_role;

create or replace function public.get_public_explore()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shared jsonb;
  v_refreshed_at timestamptz;
  v_full jsonb;
  v_poll jsonb;
begin
  select cache.payload, cache.refreshed_at
  into v_shared, v_refreshed_at
  from public.public_explore_cache cache
  where cache.cache_key = 'shared';

  if v_shared is null
     or v_refreshed_at < clock_timestamp() - interval '15 minutes' then
    -- Serialize refreshes so a burst of visitors cannot all run the expensive
    -- aggregate after the cache expires. The lock is transaction-scoped.
    perform pg_catalog.pg_advisory_xact_lock(249, 1);

    select cache.payload, cache.refreshed_at
    into v_shared, v_refreshed_at
    from public.public_explore_cache cache
    where cache.cache_key = 'shared';

    if v_shared is null
       or v_refreshed_at < clock_timestamp() - interval '15 minutes' then
      v_full := public.get_public_explore_uncached();
      v_shared := jsonb_build_object(
        'leagues', coalesce(v_full -> 'leagues', '[]'::jsonb),
        'popularity', coalesce(v_full -> 'popularity', '[]'::jsonb),
        'adp', coalesce(v_full -> 'adp', '[]'::jsonb)
      );

      insert into public.public_explore_cache(cache_key, payload, refreshed_at)
      values ('shared', v_shared, clock_timestamp())
      on conflict (cache_key) do update
      set payload = excluded.payload,
          refreshed_at = excluded.refreshed_at;
    end if;
  end if;

  select coalesce((
    select jsonb_build_object(
      'id', poll.id,
      'poll_date', poll.poll_date,
      'question', poll.question,
      'answer_type', poll.answer_type,
      'options', poll.options,
      'counts', case
        when auth.uid() is null then '{}'::jsonb
        else coalesce((
          select jsonb_object_agg(counts.answer_key, counts.total)
          from (
            select answer.answer_key, count(*)::integer as total
            from public.daily_poll_answers answer
            where answer.poll_id = poll.id
            group by answer.answer_key
          ) counts
        ), '{}'::jsonb)
      end,
      'total_votes', (
        select count(*)::integer
        from public.daily_poll_answers answer
        where answer.poll_id = poll.id
      ),
      'selected_key', case
        when auth.uid() is null then null
        else (
          select answer.answer_key
          from public.daily_poll_answers answer
          where answer.poll_id = poll.id
            and answer.user_id = auth.uid()
        )
      end
    )
    from public.daily_polls poll
    where poll.poll_date <= current_date
    order by poll.poll_date desc
    limit 1
  ), 'null'::jsonb)
  into v_poll;

  return v_shared || jsonb_build_object(
    'signed_in', auth.uid() is not null,
    'poll', v_poll
  );
end;
$$;

revoke execute on function public.get_public_explore() from public;
grant execute on function public.get_public_explore() to anon, authenticated;

comment on table public.public_explore_cache is
  'Private 15-minute cache of caller-independent Community Explore aggregates.';
comment on function public.get_public_explore_uncached() is
  'Internal uncached Community Explore aggregate; never expose to API roles.';
comment on function public.get_public_explore() is
  'Public Explore response with cached shared aggregates and caller-specific poll state.';

commit;

notify pgrst, 'reload schema';

-- Rollback (quiet period only):
--   begin;
--   drop function public.get_public_explore();
--   alter function public.get_public_explore_uncached()
--     rename to get_public_explore;
--   revoke execute on function public.get_public_explore() from public;
--   grant execute on function public.get_public_explore() to anon, authenticated;
--   drop table public.public_explore_cache;
--   commit;
--   notify pgrst, 'reload schema';
