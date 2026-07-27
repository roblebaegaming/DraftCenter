-- Start scheduled hosted auction drafts from the server clock, even when
-- every browser is closed. The prepared state is written atomically and its
-- first nomination window begins at the actual server start time.

begin;

create table if not exists public.scheduled_auction_draft_jobs (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  starts_at timestamptz not null,
  commissioner_id uuid not null references public.profiles(id) on delete cascade,
  started_state jsonb not null,
  preparation_key text not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'starting', 'started', 'cancelled', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scheduled_auction_draft_jobs enable row level security;
revoke all on table public.scheduled_auction_draft_jobs
  from public, anon, authenticated;

create or replace function public.schedule_live_auction_draft(
  p_league_id uuid,
  p_starts_at timestamptz,
  p_started_state jsonb,
  p_preparation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only the commissioner can schedule this auction.';
  end if;
  if p_starts_at is null then
    raise exception 'Choose a scheduled draft time.';
  end if;
  if jsonb_typeof(p_started_state) <> 'object'
     or coalesce(p_started_state #>> '{settings,draftType}', '') <> 'auction'
     or coalesce((p_started_state ->> 'locked')::boolean, false) is not true
     or jsonb_array_length(coalesce(p_started_state -> 'teams', '[]'::jsonb)) < 2
     or jsonb_array_length(coalesce(p_started_state -> 'pool', '[]'::jsonb)) < 1 then
    raise exception 'Finish the auction setup before scheduling its automatic start.';
  end if;
  if nullif(btrim(coalesce(p_preparation_key, '')), '') is null then
    raise exception 'The scheduled auction configuration is missing its preparation key.';
  end if;

  insert into public.scheduled_auction_draft_jobs (
    league_id, starts_at, commissioner_id, started_state, preparation_key,
    status, last_error, updated_at
  )
  values (
    p_league_id, p_starts_at, auth.uid(), p_started_state, p_preparation_key,
    'scheduled', null, now()
  )
  on conflict (league_id) do update
  set starts_at = excluded.starts_at,
      commissioner_id = excluded.commissioner_id,
      started_state = excluded.started_state,
      preparation_key = excluded.preparation_key,
      status = 'scheduled',
      last_error = null,
      updated_at = now();

  update public.leagues
  set draft_starts_at = p_starts_at, updated_at = now()
  where id = p_league_id;

  return jsonb_build_object(
    'status', 'ready',
    'starts_at', p_starts_at,
    'preparation_key', p_preparation_key
  );
end;
$$;

create or replace function public.get_scheduled_auction_draft_status(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_job public.scheduled_auction_draft_jobs;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;
  select * into v_job
  from public.scheduled_auction_draft_jobs
  where league_id = p_league_id;
  if v_job.league_id is null then
    return jsonb_build_object('status', 'missing');
  end if;
  return jsonb_build_object(
    'status', v_job.status,
    'starts_at', v_job.starts_at,
    'preparation_key', v_job.preparation_key,
    'last_error', v_job.last_error,
    'updated_at', v_job.updated_at
  );
end;
$$;

create or replace function public.cancel_scheduled_auction_draft(
  p_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only the commissioner can cancel this scheduled auction.';
  end if;
  update public.scheduled_auction_draft_jobs
  set status = 'cancelled', updated_at = now()
  where league_id = p_league_id
    and status in ('scheduled', 'failed');
  return found;
end;
$$;

create or replace function public.reconcile_scheduled_auction_drafts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.scheduled_auction_draft_jobs;
  v_state jsonb;
  v_now_ms bigint;
  v_nomination_seconds integer;
  v_started integer := 0;
  v_failed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  for v_job in
    select *
    from public.scheduled_auction_draft_jobs
    where status = 'scheduled' and starts_at <= clock_timestamp()
    order by starts_at
    for update skip locked
  loop
    begin
      update public.scheduled_auction_draft_jobs
      set status = 'starting', updated_at = now()
      where league_id = v_job.league_id;

      select state into v_state
      from public.league_state_snapshots
      where league_id = v_job.league_id
      for update;

      if coalesce((v_state ->> 'locked')::boolean, false) then
        raise exception 'This league draft has already started.';
      end if;

      v_nomination_seconds := greatest(
        1,
        public.draft_setting_nonnegative_integer(
          v_job.started_state -> 'settings',
          'auctionNominationSeconds',
          30
        )
      );
      v_state := jsonb_set(v_job.started_state, '{settings,draftScheduledAt}', 'null'::jsonb, true);
      v_state := jsonb_set(v_state, '{draftStartedAt}', to_jsonb(v_now_ms), true);
      v_state := jsonb_set(
        v_state,
        '{nominationDeadline}',
        to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000),
        true
      );
      v_state := jsonb_set(
        v_state,
        '{rev}',
        to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
        true
      );

      update public.league_state_snapshots
      set state = v_state, revision = revision + 1, updated_at = now()
      where league_id = v_job.league_id;
      update public.leagues
      set draft_starts_at = null, updated_at = now()
      where id = v_job.league_id;
      update public.scheduled_auction_draft_jobs
      set status = 'started', last_error = null, updated_at = now()
      where league_id = v_job.league_id;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_job.league_id,
        'scheduled_auction_started',
        null,
        jsonb_build_object('started_at', clock_timestamp())
      );
      v_started := v_started + 1;
    exception when others then
      update public.scheduled_auction_draft_jobs
      set status = 'failed', last_error = sqlerrm, updated_at = now()
      where league_id = v_job.league_id;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_job.league_id,
        'scheduled_auction_start_failed',
        null,
        jsonb_build_object('error', sqlerrm)
      );
      v_failed := v_failed + 1;
    end;
  end loop;
  return jsonb_build_object('started', v_started, 'failed', v_failed);
end;
$$;

revoke all on function public.schedule_live_auction_draft(uuid, timestamptz, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.schedule_live_auction_draft(uuid, timestamptz, jsonb, text)
  to authenticated;
revoke all on function public.get_scheduled_auction_draft_status(uuid)
  from public, anon, authenticated;
grant execute on function public.get_scheduled_auction_draft_status(uuid)
  to authenticated;
revoke all on function public.cancel_scheduled_auction_draft(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_scheduled_auction_draft(uuid)
  to authenticated;
revoke all on function public.reconcile_scheduled_auction_drafts()
  from public, anon, authenticated;
grant execute on function public.reconcile_scheduled_auction_drafts()
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'draftcenter-scheduled-auctions') then
      perform cron.unschedule('draftcenter-scheduled-auctions');
    end if;
    perform cron.schedule(
      'draftcenter-scheduled-auctions',
      '* * * * *',
      'select public.reconcile_scheduled_auction_drafts()'
    );
  else
    raise notice 'Enable pg_cron, then run reconcile_scheduled_auction_drafts every minute.';
  end if;
exception when others then
  raise notice 'Auction cron registration needs manual verification: %', sqlerrm;
end;
$$;

commit;

notify pgrst, 'reload schema';
