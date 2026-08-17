-- Restore service-only operational tables and columns that exist in Production
-- but were not retained in the root-level numbered SQL history.
begin;

create table if not exists public.community_question_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null unique check (char_length(prompt) between 10 and 500),
  category text not null default 'community',
  active boolean not null default true,
  last_posted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.community_question_deliveries (
  question_date date primary key,
  prompt_id uuid not null references public.community_question_prompts(id) on delete restrict,
  channel_id text not null,
  message_id text,
  posted_at timestamptz not null default now()
);

create table if not exists public.daily_poll_discord_deliveries (
  poll_id uuid not null references public.daily_polls(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  channel_id text not null,
  delivered_at timestamptz not null default now(),
  primary key (poll_id, league_id)
);

alter table public.community_question_prompts enable row level security;
alter table public.community_question_deliveries enable row level security;
alter table public.daily_poll_discord_deliveries enable row level security;

revoke all on table
  public.community_question_prompts,
  public.community_question_deliveries,
  public.daily_poll_discord_deliveries
from public, anon, authenticated;
grant all on table
  public.community_question_prompts,
  public.community_question_deliveries,
  public.daily_poll_discord_deliveries
to service_role;

alter table public.league_discord_settings
  add column if not exists notify_daily_poll boolean not null default false;

alter table public.notification_events
  add column if not exists created_at timestamptz not null default now();

alter table public.operational_health_events
  drop constraint if exists operational_health_events_kind_check,
  add constraint operational_health_events_kind_check check (
    kind in (
      'league_save_failed',
      'draft_operation_failed',
      'claim_operation_failed',
      'transaction_operation_failed',
      'team_claim_failed',
      'availability_operation_failed',
      'result_operation_failed',
      'result_save_failed',
      'commissioner_action_failed',
      'notification_dispatch_failed',
      'feedback_submission_failed',
      'client_runtime_error',
      'monitoring_test'
    )
  );

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'community_question_prompts',
    'community_question_deliveries',
    'daily_poll_discord_deliveries'
  ]
  loop
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = v_table
        and relation.relrowsecurity
    ) then
      raise exception '% must keep row level security enabled.', v_table;
    end if;
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception '% must remain service-only.', v_table;
    end if;
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
