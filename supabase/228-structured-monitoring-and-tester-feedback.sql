-- Privacy-safe production evidence and structured rehearsal feedback.

begin;

create table if not exists public.operational_health_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  league_id uuid references public.leagues(id) on delete cascade,
  kind text not null,
  message text not null check (char_length(message) between 1 and 1000),
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 4096)
);

create index if not exists operational_health_events_occurred_idx
  on public.operational_health_events (occurred_at desc);
create index if not exists operational_health_events_kind_idx
  on public.operational_health_events (kind, occurred_at desc);
create index if not exists operational_health_events_league_idx
  on public.operational_health_events (league_id, occurred_at desc)
  where league_id is not null;

alter table public.operational_health_events enable row level security;
revoke all on table public.operational_health_events from public, anon, authenticated;
grant select, insert, delete on table public.operational_health_events to service_role;
grant usage, select on sequence public.operational_health_events_id_seq to service_role;

alter table public.operational_health_events
  drop constraint if exists operational_health_events_kind_check;

alter table public.operational_health_events
  add constraint operational_health_events_kind_check check (kind in (
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
  ));

create or replace function public.report_operational_issue(
  p_kind text,
  p_message text,
  p_league_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before reporting an operational issue.';
  end if;
  if p_kind not in (
    'league_save_failed',
    'draft_operation_failed',
    'claim_operation_failed',
    'transaction_operation_failed',
    'team_claim_failed',
    'availability_operation_failed',
    'result_operation_failed',
    'result_save_failed',
    'commissioner_action_failed',
    'feedback_submission_failed',
    'client_runtime_error'
  ) then
    raise exception 'Unsupported operational issue category.';
  end if;
  if p_league_id is not null
     and not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;
  if (
    select count(*)
    from public.operational_health_events
    where actor_id = auth.uid()
      and occurred_at > now() - interval '1 hour'
  ) >= 30 then
    return;
  end if;

  if p_league_id is not null then
    select m.role::text
      into v_role
      from public.league_memberships m
      where m.league_id = p_league_id
        and m.user_id = auth.uid()
      limit 1;
  end if;

  v_context := jsonb_strip_nulls(jsonb_build_object(
    'action', left(p_context->>'action', 80),
    'correlation_id', left(coalesce(nullif(p_context->>'correlation_id', ''), gen_random_uuid()::text), 80),
    'draft_state', left(p_context->>'draft_state', 80),
    'draft_type', left(p_context->>'draft_type', 40),
    'error_code', left(p_context->>'error_code', 80),
    'match', left(p_context->>'match', 40),
    'release', left(p_context->>'release', 120),
    'request_id', left(p_context->>'request_id', 120),
    'revision', left(p_context->>'revision', 40),
    'role', coalesce(v_role, left(p_context->>'role', 40)),
    'route', left(p_context->>'route', 160),
    'tab', left(p_context->>'tab', 80),
    'week', left(p_context->>'week', 40)
  ));

  insert into public.operational_health_events(actor_id, league_id, kind, message, context)
  values (
    auth.uid(),
    p_league_id,
    p_kind,
    left(coalesce(nullif(btrim(p_message), ''), 'Unknown client error'), 1000),
    v_context
  );
end;
$$;

revoke all on function public.report_operational_issue(text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.report_operational_issue(text, text, uuid, jsonb)
  to authenticated;

create or replace function public.create_operational_smoke_test(
  p_league_id uuid,
  p_release text default null,
  p_route text default 'league'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.operational_health_events;
  v_role text;
  v_correlation_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Join this league before creating a monitoring test.';
  end if;
  if (
    select count(*)
    from public.operational_health_events
    where actor_id = auth.uid()
      and kind = 'monitoring_test'
      and occurred_at > now() - interval '15 minutes'
  ) >= 3 then
    raise exception 'Wait before creating another monitoring test.';
  end if;
  select m.role::text into v_role
    from public.league_memberships m
    where m.league_id = p_league_id and m.user_id = auth.uid()
    limit 1;
  insert into public.operational_health_events(actor_id, league_id, kind, message, context)
  values (
    auth.uid(),
    p_league_id,
    'monitoring_test',
    'Deliberate monitoring test; no product error occurred.',
    jsonb_build_object(
      'action', 'monitoring_test',
      'correlation_id', v_correlation_id::text,
      'release', left(coalesce(nullif(btrim(p_release), ''), 'unknown'), 120),
      'role', v_role,
      'route', left(coalesce(nullif(btrim(p_route), ''), 'league'), 160)
    )
  )
  returning * into v_event;
  return jsonb_build_object(
    'id', v_event.id,
    'occurred_at', v_event.occurred_at,
    'correlation_id', v_correlation_id
  );
end;
$$;

revoke all on function public.create_operational_smoke_test(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_operational_smoke_test(uuid, text, text)
  to authenticated;

create or replace function public.list_accessible_operational_health(
  p_league_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', visible.id,
    'occurred_at', visible.occurred_at,
    'league_id', visible.league_id,
    'kind', visible.kind,
    'message', visible.message,
    'context', visible.context,
    'actor_reference', visible.actor_reference
  ) order by visible.occurred_at desc), '[]'::jsonb)
  from (
    select
      e.id,
      e.occurred_at,
      e.league_id,
      e.kind,
      e.message,
      e.context,
      'user-' || substr(md5(e.actor_id::text), 1, 12) as actor_reference
    from public.operational_health_events e
    where auth.uid() is not null
      and (p_league_id is null or e.league_id = p_league_id)
      and (
        e.actor_id = auth.uid()
        or (
          p_league_id is not null
          and e.league_id = p_league_id
          and public.is_league_staff(e.league_id)
        )
      )
    order by e.occurred_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) visible;
$$;

revoke all on function public.list_accessible_operational_health(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.list_accessible_operational_health(uuid, integer)
  to authenticated;

create table if not exists public.tester_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete cascade,
  status text not null default 'New' check (status in (
    'New',
    'Needs reproduction',
    'Confirmed',
    'Fixing',
    'Ready to retest',
    'Verified',
    'Deferred'
  )),
  severity text not null check (severity in ('Blocker', 'Major', 'Minor', 'Suggestion')),
  tester_alias text not null check (char_length(tester_alias) between 1 and 100),
  reported_at timestamptz not null,
  reporter_timezone text not null check (char_length(reporter_timezone) between 1 and 100),
  device_browser text not null check (char_length(device_browser) between 1 and 160),
  account_role text not null check (char_length(account_role) between 1 and 40),
  league_name text not null check (char_length(league_name) between 1 and 160),
  draft_type text not null check (draft_type in ('snake', 'auction', 'not_applicable', 'unknown')),
  attempted text not null check (char_length(attempted) between 1 and 2000),
  expected_result text not null check (char_length(expected_result) between 1 and 2000),
  actual_result text not null check (char_length(actual_result) between 1 and 4000),
  refresh_fixed text not null check (refresh_fixed in ('yes', 'no', 'not_tried')),
  evidence_url text check (evidence_url is null or char_length(evidence_url) <= 1000),
  release text not null check (char_length(release) between 1 and 120),
  correlation_id uuid not null default gen_random_uuid()
);

create index if not exists tester_feedback_created_idx
  on public.tester_feedback (created_at desc);
create index if not exists tester_feedback_league_idx
  on public.tester_feedback (league_id, created_at desc)
  where league_id is not null;
create index if not exists tester_feedback_status_idx
  on public.tester_feedback (status, severity, created_at desc);

alter table public.tester_feedback enable row level security;
revoke all on table public.tester_feedback from public, anon, authenticated;
grant select, insert, update, delete on table public.tester_feedback to service_role;
grant usage, select on sequence public.tester_feedback_id_seq to service_role;

create or replace function public.submit_tester_feedback(
  p_tester_alias text,
  p_reported_at timestamptz,
  p_reporter_timezone text,
  p_device_browser text,
  p_account_role text,
  p_league_id uuid,
  p_league_name text,
  p_draft_type text,
  p_attempted text,
  p_expected_result text,
  p_actual_result text,
  p_refresh_fixed text,
  p_evidence_url text,
  p_severity text,
  p_release text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feedback public.tester_feedback;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before submitting tester feedback.';
  end if;
  if p_league_id is not null and not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;
  if (
    select count(*)
    from public.tester_feedback
    where reporter_id = auth.uid()
      and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Too many reports were submitted recently. Please wait before trying again.';
  end if;
  if p_severity not in ('Blocker', 'Major', 'Minor', 'Suggestion') then
    raise exception 'Choose a valid severity.';
  end if;
  if p_draft_type not in ('snake', 'auction', 'not_applicable', 'unknown') then
    raise exception 'Choose a valid draft type.';
  end if;
  if p_refresh_fixed not in ('yes', 'no', 'not_tried') then
    raise exception 'Choose whether refreshing fixed the problem.';
  end if;
  if p_evidence_url is not null
     and btrim(p_evidence_url) <> ''
     and btrim(p_evidence_url) !~* '^https?://' then
    raise exception 'Screenshot or recording links must start with http:// or https://.';
  end if;
  if p_league_id is not null then
    select m.role::text into v_role
      from public.league_memberships m
      where m.league_id = p_league_id and m.user_id = auth.uid()
      limit 1;
  end if;

  insert into public.tester_feedback (
    reporter_id,
    league_id,
    severity,
    tester_alias,
    reported_at,
    reporter_timezone,
    device_browser,
    account_role,
    league_name,
    draft_type,
    attempted,
    expected_result,
    actual_result,
    refresh_fixed,
    evidence_url,
    release
  ) values (
    auth.uid(),
    p_league_id,
    p_severity,
    left(coalesce(nullif(btrim(p_tester_alias), ''), 'Anonymous tester'), 100),
    coalesce(p_reported_at, now()),
    left(coalesce(nullif(btrim(p_reporter_timezone), ''), 'UTC'), 100),
    left(coalesce(nullif(btrim(p_device_browser), ''), 'Unknown device and browser'), 160),
    left(coalesce(v_role, nullif(btrim(p_account_role), ''), 'unknown'), 40),
    left(coalesce(nullif(btrim(p_league_name), ''), 'No league selected'), 160),
    p_draft_type,
    left(coalesce(nullif(btrim(p_attempted), ''), 'Not supplied'), 2000),
    left(coalesce(nullif(btrim(p_expected_result), ''), 'Not supplied'), 2000),
    left(coalesce(nullif(btrim(p_actual_result), ''), 'Not supplied'), 4000),
    p_refresh_fixed,
    nullif(left(btrim(p_evidence_url), 1000), ''),
    left(coalesce(nullif(btrim(p_release), ''), 'unknown'), 120)
  )
  returning * into v_feedback;

  return jsonb_build_object(
    'issue_number', 'DC-' || lpad(v_feedback.id::text, 6, '0'),
    'status', v_feedback.status,
    'created_at', v_feedback.created_at,
    'correlation_id', v_feedback.correlation_id
  );
end;
$$;

revoke all on function public.submit_tester_feedback(
  text, timestamptz, text, text, text, uuid, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_tester_feedback(
  text, timestamptz, text, text, text, uuid, text, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.list_accessible_tester_feedback(
  p_league_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'issue_number', 'DC-' || lpad(visible.id::text, 6, '0'),
    'created_at', visible.created_at,
    'updated_at', visible.updated_at,
    'status', visible.status,
    'severity', visible.severity,
    'tester_alias', visible.tester_alias,
    'reported_at', visible.reported_at,
    'reporter_timezone', visible.reporter_timezone,
    'device_browser', visible.device_browser,
    'account_role', visible.account_role,
    'league_id', visible.league_id,
    'league_name', visible.league_name,
    'draft_type', visible.draft_type,
    'attempted', visible.attempted,
    'expected_result', visible.expected_result,
    'actual_result', visible.actual_result,
    'refresh_fixed', visible.refresh_fixed,
    'evidence_url', visible.evidence_url,
    'release', visible.release,
    'correlation_id', visible.correlation_id
  ) order by visible.created_at desc), '[]'::jsonb)
  from (
    select f.*
    from public.tester_feedback f
    where auth.uid() is not null
      and (p_league_id is null or f.league_id = p_league_id)
      and (
        f.reporter_id = auth.uid()
        or (
          p_league_id is not null
          and f.league_id = p_league_id
          and public.is_league_staff(f.league_id)
        )
      )
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) visible;
$$;

revoke all on function public.list_accessible_tester_feedback(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.list_accessible_tester_feedback(uuid, integer)
  to authenticated;

create or replace function public.update_tester_feedback_status(
  p_issue_number text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_feedback public.tester_feedback;
begin
  if p_status not in (
    'New',
    'Needs reproduction',
    'Confirmed',
    'Fixing',
    'Ready to retest',
    'Verified',
    'Deferred'
  ) then
    raise exception 'Choose a valid issue status.';
  end if;
  if upper(btrim(p_issue_number)) !~ '^DC-[0-9]+$' then
    raise exception 'Choose a valid DraftCenter issue number.';
  end if;
  v_id := substring(upper(btrim(p_issue_number)) from '^DC-([0-9]+)$')::bigint;
  select * into v_feedback
    from public.tester_feedback
    where id = v_id;
  if v_feedback.id is null then
    raise exception 'Tester report not found.';
  end if;
  if v_feedback.league_id is null or not public.is_league_staff(v_feedback.league_id) then
    raise exception 'Only league staff can triage this report.';
  end if;
  update public.tester_feedback
    set status = p_status, updated_at = now()
    where id = v_id
    returning * into v_feedback;
  return jsonb_build_object(
    'issue_number', 'DC-' || lpad(v_feedback.id::text, 6, '0'),
    'status', v_feedback.status,
    'updated_at', v_feedback.updated_at
  );
end;
$$;

revoke all on function public.update_tester_feedback_status(text, text)
  from public, anon, authenticated;
grant execute on function public.update_tester_feedback_status(text, text)
  to authenticated;

commit;

notify pgrst, 'reload schema';
