-- Automated, fail-closed provisional scoring for the 2026 VGC Masters picks game.
-- The source is deliberately disabled until the owner records an approved feed.

begin;

create table public.worlds_result_sources (
  event_id text primary key references public.worlds_pick_events(id) on delete restrict,
  provider text not null default 'pokedata' check (provider in ('pokedata', 'manual')),
  external_event_id text check (external_event_id is null or external_event_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  division text not null default 'Masters' check (division = 'Masters'),
  feed_url text check (feed_url is null or feed_url ~ '^https://'),
  attribution_name text not null check (char_length(btrim(attribution_name)) between 2 and 80),
  attribution_url text not null check (attribution_url ~ '^https://'),
  permission_status text not null default 'pending'
    check (permission_status in ('pending', 'approved', 'manual_only', 'denied')),
  enabled boolean not null default false,
  state text not null default 'disabled' check (state in ('disabled', 'ready', 'live', 'final')),
  poll_interval_seconds integer not null default 300 check (poll_interval_seconds between 180 and 1800),
  active_from timestamptz not null,
  active_through timestamptz not null check (active_through > active_from),
  minimum_row_count integer not null default 64 check (minimum_row_count between 1 and 4096),
  maximum_row_count integer not null default 512 check (maximum_row_count between minimum_row_count and 4096),
  parser_version text not null default 'pokedata-vgc-masters-v1'
    check (parser_version ~ '^[a-z0-9.-]{3,80}$'),
  current_snapshot_id uuid,
  last_content_hash text check (last_content_hash is null or last_content_hash ~ '^[0-9a-f]{64}$'),
  last_etag text check (last_etag is null or char_length(last_etag) <= 500),
  last_modified text check (last_modified is null or char_length(last_modified) <= 200),
  last_attempt_at timestamptz,
  last_accepted_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_issue_code text check (last_issue_code is null or last_issue_code ~ '^[a-z0-9_]{2,80}$'),
  last_issue_message text check (last_issue_message is null or char_length(last_issue_message) <= 500),
  lock_token uuid,
  lock_acquired_at timestamptz,
  lock_expires_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (
    provider = 'pokedata'
    and permission_status = 'approved'
    and feed_url is not null
    and external_event_id is not null
    and state <> 'final'
  ))
);

create table public.worlds_result_import_runs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.worlds_result_sources(event_id) on delete restrict,
  import_method text not null check (import_method in ('scheduled', 'manual')),
  status text not null check (status in ('running', 'unchanged', 'accepted', 'rejected', 'failed', 'skipped', 'locked')),
  lock_token uuid,
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  http_status integer check (http_status is null or http_status between 100 and 599),
  response_bytes integer check (response_bytes is null or response_bytes between 0 and 5242880),
  row_count integer check (row_count is null or row_count between 0 and 4096),
  issue_code text check (issue_code is null or issue_code ~ '^[a-z0-9_]{2,80}$'),
  safe_message text check (safe_message is null or char_length(safe_message) <= 500),
  snapshot_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index worlds_result_import_runs_event_started_idx
  on public.worlds_result_import_runs(event_id, started_at desc);

create table public.worlds_result_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.worlds_result_sources(event_id) on delete restrict,
  snapshot_kind text not null check (snapshot_kind in ('provisional', 'final', 'correction')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  parser_version text not null check (parser_version ~ '^[a-z0-9.-]{3,80}$'),
  import_method text not null check (import_method in ('scheduled', 'manual', 'finalization')),
  source_url text not null check (source_url ~ '^https://'),
  source_fetched_at timestamptz not null,
  source_updated_at timestamptz,
  row_count integer not null check (row_count between 1 and 4096),
  source_rows jsonb not null check (
    jsonb_typeof(source_rows) = 'array'
    and pg_column_size(source_rows) <= 4194304
  ),
  published_at timestamptz not null default now(),
  unique (event_id, content_hash, snapshot_kind),
  unique (id, event_id)
);

alter table public.worlds_result_sources
  add constraint worlds_result_sources_current_snapshot_fk
  foreign key (current_snapshot_id, event_id)
  references public.worlds_result_snapshots(id, event_id)
  on delete restrict;

alter table public.worlds_result_import_runs
  add constraint worlds_result_import_runs_snapshot_fk
  foreign key (snapshot_id, event_id)
  references public.worlds_result_snapshots(id, event_id)
  on delete restrict;

create table public.worlds_result_aliases (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  source_name text not null check (char_length(btrim(source_name)) between 2 and 120),
  source_name_key text not null check (char_length(source_name_key) between 2 and 160),
  source_country_code text not null check (source_country_code ~ '^[A-Z]{2,3}$'),
  competitor_slug text not null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  foreign key (event_id, competitor_slug)
    references public.worlds_pick_competitors(event_id, slug) on delete restrict,
  check ((revoked_at is null and revoked_by is null) or revoked_at is not null)
);

create unique index worlds_result_aliases_active_identity_idx
  on public.worlds_result_aliases(event_id, source_name_key, source_country_code)
  where revoked_at is null;
create index worlds_result_aliases_competitor_idx
  on public.worlds_result_aliases(event_id, competitor_slug)
  where revoked_at is null;

create table public.worlds_result_mapping_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.worlds_result_import_runs(id) on delete restrict,
  event_id text not null references public.worlds_result_sources(event_id) on delete restrict,
  source_name text not null check (char_length(btrim(source_name)) between 2 and 120),
  source_name_key text not null check (char_length(source_name_key) between 2 and 160),
  source_country_code text not null check (source_country_code ~ '^[A-Z]{2,3}$'),
  placing integer not null check (placing between 1 and 9999),
  score_points integer not null check (score_points between 0 and 30),
  issue_code text not null check (issue_code in ('unmatched', 'duplicate_target', 'ambiguous')),
  suggested_competitor_slug text,
  suggestion_reason text check (suggestion_reason is null or char_length(suggestion_reason) <= 120),
  resolved_alias_id uuid references public.worlds_result_aliases(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (event_id, suggested_competitor_slug)
    references public.worlds_pick_competitors(event_id, slug) on delete restrict,
  unique (run_id, source_name_key, source_country_code)
);

create index worlds_result_mapping_issues_open_idx
  on public.worlds_result_mapping_issues(event_id, created_at desc)
  where resolved_at is null;

create table public.worlds_result_placements (
  snapshot_id uuid not null,
  event_id text not null,
  competitor_slug text not null,
  source_name text not null check (char_length(btrim(source_name)) between 2 and 120),
  source_country_code text not null check (source_country_code ~ '^[A-Z]{2,3}$'),
  placing integer not null check (placing between 1 and 9999),
  score_points integer not null check (score_points between 0 and 30),
  match_alias_id uuid not null references public.worlds_result_aliases(id) on delete restrict,
  record jsonb not null default '{}'::jsonb check (
    jsonb_typeof(record) = 'object'
    and pg_column_size(record) <= 2048
  ),
  primary key (snapshot_id, competitor_slug),
  foreign key (snapshot_id, event_id)
    references public.worlds_result_snapshots(id, event_id) on delete restrict,
  foreign key (event_id, competitor_slug)
    references public.worlds_pick_competitors(event_id, slug) on delete restrict
);

create table public.worlds_result_finalizations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.worlds_result_sources(event_id) on delete restrict,
  provisional_snapshot_id uuid not null,
  final_snapshot_id uuid not null,
  official_source_url text not null check (official_source_url ~ '^https://'),
  approved_by uuid references auth.users(id) on delete set null,
  confirmation_text text not null check (confirmation_text = 'FINALIZE 2026 VGC MASTERS'),
  revision_kind text not null default 'final' check (revision_kind in ('final', 'correction')),
  created_at timestamptz not null default now(),
  foreign key (provisional_snapshot_id, event_id)
    references public.worlds_result_snapshots(id, event_id) on delete restrict,
  foreign key (final_snapshot_id, event_id)
    references public.worlds_result_snapshots(id, event_id) on delete restrict
);

alter table public.worlds_result_sources enable row level security;
alter table public.worlds_result_import_runs enable row level security;
alter table public.worlds_result_snapshots enable row level security;
alter table public.worlds_result_aliases enable row level security;
alter table public.worlds_result_mapping_issues enable row level security;
alter table public.worlds_result_placements enable row level security;
alter table public.worlds_result_finalizations enable row level security;

revoke all on table public.worlds_result_sources from public, anon, authenticated;
revoke all on table public.worlds_result_import_runs from public, anon, authenticated;
revoke all on table public.worlds_result_snapshots from public, anon, authenticated;
revoke all on table public.worlds_result_aliases from public, anon, authenticated;
revoke all on table public.worlds_result_mapping_issues from public, anon, authenticated;
revoke all on table public.worlds_result_placements from public, anon, authenticated;
revoke all on table public.worlds_result_finalizations from public, anon, authenticated;

grant select, insert, update on table public.worlds_result_sources to service_role;
grant select, insert, update on table public.worlds_result_import_runs to service_role;
grant select, insert on table public.worlds_result_snapshots to service_role;
grant select, insert, update on table public.worlds_result_aliases to service_role;
grant select, insert, update on table public.worlds_result_mapping_issues to service_role;
grant select, insert on table public.worlds_result_placements to service_role;
grant select, insert on table public.worlds_result_finalizations to service_role;

create or replace function public.worlds_score_for_placing(p_placing integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_placing = 1 then 30
    when p_placing = 2 then 20
    when p_placing <= 4 then 12
    when p_placing <= 8 then 7
    when p_placing <= 16 then 4
    when p_placing <= 32 then 2
    when p_placing <= 64 then 1
    else 0
  end;
$$;

create or replace function public.worlds_result_label_for_placing(p_placing integer)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_placing = 9999 then 'No valid placing'
    when p_placing = 1 then 'World Champion'
    when p_placing = 2 then 'Runner-up'
    when p_placing <= 4 then 'Top 4'
    when p_placing <= 8 then 'Top 8'
    when p_placing <= 16 then 'Top 16'
    when p_placing <= 32 then 'Top 32'
    when p_placing <= 64 then 'Top 64'
    else 'Outside Top 64'
  end;
$$;

create or replace function public.begin_worlds_result_import(
  p_event_id text,
  p_import_method text default 'scheduled'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.worlds_result_sources%rowtype;
  v_run_id uuid := gen_random_uuid();
  v_lock_token uuid := gen_random_uuid();
  v_skip_code text;
  v_recovered_stale_lock boolean := false;
begin
  if p_import_method not in ('scheduled', 'manual') then
    raise exception 'Unsupported Worlds result import method.' using errcode = '22023';
  end if;

  select * into v_source
  from public.worlds_result_sources
  where event_id = p_event_id
  for update;

  if not found then
    raise exception 'Worlds result source is not configured.' using errcode = 'P0002';
  end if;

  if v_source.state = 'final' or v_source.finalized_at is not null then
    v_skip_code := 'results_final';
  elsif p_import_method = 'scheduled' and not v_source.enabled then
    v_skip_code := 'source_disabled';
  elsif p_import_method = 'scheduled' and (
    v_source.permission_status <> 'approved'
    or v_source.feed_url is null
    or v_source.external_event_id is null
  ) then
    v_skip_code := 'source_unapproved';
  elsif p_import_method = 'manual' and v_source.permission_status not in ('approved', 'manual_only') then
    v_skip_code := 'manual_source_unapproved';
  elsif p_import_method = 'scheduled' and now() not between v_source.active_from and v_source.active_through then
    v_skip_code := 'outside_event_window';
  end if;

  if v_skip_code is not null then
    insert into public.worlds_result_import_runs (
      id, event_id, import_method, status, issue_code, safe_message, completed_at
    ) values (
      v_run_id, p_event_id, p_import_method, 'skipped', v_skip_code,
      'The Worlds result source is not eligible to run.', now()
    );
    return jsonb_build_object('status', 'skipped', 'run_id', v_run_id, 'issue_code', v_skip_code);
  end if;

  if v_source.lock_expires_at is not null and v_source.lock_expires_at > now() then
    insert into public.worlds_result_import_runs (
      id, event_id, import_method, status, issue_code, safe_message, completed_at
    ) values (
      v_run_id, p_event_id, p_import_method, 'locked', 'overlapping_run',
      'Another Worlds result import is still running.', now()
    );
    return jsonb_build_object('status', 'locked', 'run_id', v_run_id, 'issue_code', 'overlapping_run');
  end if;

  if v_source.lock_token is not null then
    v_recovered_stale_lock := true;
    update public.worlds_result_import_runs
    set status = 'failed',
        issue_code = 'stale_lock_recovered',
        safe_message = 'An expired Worlds result import lock was recovered.',
        completed_at = now()
    where event_id = p_event_id
      and status = 'running'
      and lock_token = v_source.lock_token;
  end if;

  update public.worlds_result_sources
  set lock_token = v_lock_token,
      lock_acquired_at = now(),
      lock_expires_at = now() + interval '2 minutes',
      last_attempt_at = now(),
      updated_at = now()
  where event_id = p_event_id;

  insert into public.worlds_result_import_runs (
    id, event_id, import_method, status, lock_token
  ) values (
    v_run_id, p_event_id, p_import_method, 'running', v_lock_token
  );

  return jsonb_build_object(
    'status', 'running',
    'run_id', v_run_id,
    'lock_token', v_lock_token,
    'event_id', v_source.event_id,
    'division', v_source.division,
    'provider', v_source.provider,
    'external_event_id', v_source.external_event_id,
    'feed_url', v_source.feed_url,
    'attribution_url', v_source.attribution_url,
    'parser_version', v_source.parser_version,
    'minimum_row_count', v_source.minimum_row_count,
    'maximum_row_count', v_source.maximum_row_count,
    'active_from', v_source.active_from,
    'active_through', v_source.active_through,
    'poll_interval_seconds', v_source.poll_interval_seconds,
    'last_accepted_at', v_source.last_accepted_at,
    'recovered_stale_lock', v_recovered_stale_lock,
    'last_content_hash', v_source.last_content_hash,
    'last_etag', v_source.last_etag,
    'last_modified', v_source.last_modified
  );
end;
$$;

create or replace function public.complete_worlds_result_import(
  p_run_id uuid,
  p_lock_token uuid,
  p_status text,
  p_issue_code text default null,
  p_safe_message text default null,
  p_http_status integer default null,
  p_response_bytes integer default null,
  p_content_hash text default null,
  p_etag text default null,
  p_last_modified text default null,
  p_row_count integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.worlds_result_import_runs%rowtype;
begin
  if p_status not in ('unchanged', 'failed') then
    raise exception 'Unsupported Worlds result completion status.' using errcode = '22023';
  end if;

  select * into v_run
  from public.worlds_result_import_runs
  where id = p_run_id
  for update;

  if not found or v_run.status <> 'running' or v_run.lock_token <> p_lock_token then
    raise exception 'The Worlds result import is no longer current.' using errcode = '40001';
  end if;

  update public.worlds_result_import_runs
  set status = p_status,
      issue_code = p_issue_code,
      safe_message = left(p_safe_message, 500),
      http_status = p_http_status,
      response_bytes = p_response_bytes,
      content_hash = p_content_hash,
      row_count = p_row_count,
      completed_at = now()
  where id = p_run_id;

  update public.worlds_result_sources
  set last_content_hash = case when p_status = 'unchanged' then coalesce(p_content_hash, last_content_hash) else last_content_hash end,
      last_etag = case when p_status = 'unchanged' then coalesce(p_etag, last_etag) else last_etag end,
      last_modified = case when p_status = 'unchanged' then coalesce(p_last_modified, last_modified) else last_modified end,
      consecutive_failures = case when p_status = 'failed' then consecutive_failures + 1 else 0 end,
      last_issue_code = case when p_status = 'failed' then p_issue_code else null end,
      last_issue_message = case when p_status = 'failed' then left(p_safe_message, 500) else null end,
      lock_token = null,
      lock_acquired_at = null,
      lock_expires_at = null,
      updated_at = now()
  where event_id = v_run.event_id
    and lock_token = p_lock_token;

  return jsonb_build_object('status', p_status, 'run_id', p_run_id);
end;
$$;

create or replace function public.reject_worlds_result_import(
  p_run_id uuid,
  p_lock_token uuid,
  p_content_hash text,
  p_http_status integer,
  p_response_bytes integer,
  p_etag text,
  p_last_modified text,
  p_row_count integer,
  p_issue_code text,
  p_safe_message text,
  p_issues jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.worlds_result_import_runs%rowtype;
begin
  if jsonb_typeof(p_issues) <> 'array' or jsonb_array_length(p_issues) > 1024 then
    raise exception 'Worlds mapping issues are not a bounded array.' using errcode = '22023';
  end if;

  select * into v_run
  from public.worlds_result_import_runs
  where id = p_run_id
  for update;

  if not found or v_run.status <> 'running' or v_run.lock_token <> p_lock_token then
    raise exception 'The Worlds result import is no longer current.' using errcode = '40001';
  end if;

  insert into public.worlds_result_mapping_issues (
    run_id, event_id, source_name, source_name_key, source_country_code,
    placing, score_points, issue_code, suggested_competitor_slug, suggestion_reason
  )
  select
    p_run_id,
    v_run.event_id,
    issue.source_name,
    issue.source_name_key,
    issue.source_country_code,
    issue.placing,
    issue.score_points,
    issue.issue_code,
    nullif(issue.suggested_competitor_slug, ''),
    nullif(issue.suggestion_reason, '')
  from jsonb_to_recordset(p_issues) as issue(
    source_name text,
    source_name_key text,
    source_country_code text,
    placing integer,
    score_points integer,
    issue_code text,
    suggested_competitor_slug text,
    suggestion_reason text
  );

  update public.worlds_result_import_runs
  set status = 'rejected',
      content_hash = p_content_hash,
      http_status = p_http_status,
      response_bytes = p_response_bytes,
      row_count = p_row_count,
      issue_code = p_issue_code,
      safe_message = left(p_safe_message, 500),
      completed_at = now()
  where id = p_run_id;

  update public.worlds_result_sources
  set consecutive_failures = consecutive_failures + 1,
      last_issue_code = p_issue_code,
      last_issue_message = left(p_safe_message, 500),
      lock_token = null,
      lock_acquired_at = null,
      lock_expires_at = null,
      updated_at = now()
  where event_id = v_run.event_id
    and lock_token = p_lock_token;

  return jsonb_build_object(
    'status', 'rejected',
    'run_id', p_run_id,
    'issue_code', p_issue_code,
    'issues', jsonb_array_length(p_issues)
  );
end;
$$;

create or replace function public.publish_worlds_result_snapshot(
  p_run_id uuid,
  p_lock_token uuid,
  p_content_hash text,
  p_http_status integer,
  p_response_bytes integer,
  p_etag text,
  p_last_modified text,
  p_source_updated_at timestamptz,
  p_rows jsonb,
  p_issues jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.worlds_result_import_runs%rowtype;
  v_source public.worlds_result_sources%rowtype;
  v_snapshot_id uuid;
  v_row_count integer;
  v_unmatched_scoring integer;
  v_duplicate_targets integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_typeof(p_issues) <> 'array' then
    raise exception 'Worlds result rows and issues must be arrays.' using errcode = '22023';
  end if;

  v_row_count := jsonb_array_length(p_rows);

  select * into v_run
  from public.worlds_result_import_runs
  where id = p_run_id
  for update;

  if not found or v_run.status <> 'running' or v_run.lock_token <> p_lock_token then
    raise exception 'The Worlds result import is no longer current.' using errcode = '40001';
  end if;

  select * into v_source
  from public.worlds_result_sources
  where event_id = v_run.event_id
  for update;

  if v_source.lock_token <> p_lock_token or v_source.state = 'final' then
    raise exception 'The Worlds result source cannot publish this run.' using errcode = '40001';
  end if;

  if now() not between v_source.active_from and v_source.active_through
     or now() < (select event.locks_at from public.worlds_pick_events event where event.id = v_run.event_id) then
    raise exception 'Worlds result publication is outside the reviewed post-lock event window.' using errcode = '22023';
  end if;

  if v_row_count < v_source.minimum_row_count or v_row_count > v_source.maximum_row_count then
    raise exception 'The Worlds result row count is outside the reviewed bounds.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row_data(
      source_name text,
      source_name_key text,
      source_country_code text,
      placing integer,
      score_points integer,
      record jsonb
    )
    where char_length(btrim(source_name)) not between 2 and 120
       or char_length(source_name_key) not between 2 and 160
       or source_country_code !~ '^[A-Z]{2,3}$'
       or placing not between 1 and 9999
       or score_points <> public.worlds_score_for_placing(placing)
       or jsonb_typeof(record) <> 'object'
  ) then
    raise exception 'The Worlds result rows failed database validation.' using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(p_rows) as row_data(
      source_name text,
      source_name_key text,
      source_country_code text,
      placing integer,
      score_points integer,
      record jsonb
    )
  ) <> (
    select count(distinct (source_name_key, source_country_code))
    from jsonb_to_recordset(p_rows) as row_data(
      source_name text,
      source_name_key text,
      source_country_code text,
      placing integer,
      score_points integer,
      record jsonb
    )
  ) then
    raise exception 'The Worlds result payload contains duplicate source identities.' using errcode = '22023';
  end if;

  with source_rows as (
    select *
    from jsonb_to_recordset(p_rows) as row_data(
      source_name text,
      source_name_key text,
      source_country_code text,
      placing integer,
      score_points integer,
      record jsonb
    )
  ), mapped as (
    select source_rows.*, alias.id as alias_id, alias.competitor_slug
    from source_rows
    left join public.worlds_result_aliases alias
      on alias.event_id = v_run.event_id
     and alias.source_name_key = source_rows.source_name_key
     and alias.source_country_code = source_rows.source_country_code
     and alias.revoked_at is null
  )
  select
    count(*) filter (where score_points > 0 and alias_id is null),
    count(*) filter (where competitor_slug is not null)
      - count(distinct competitor_slug) filter (where competitor_slug is not null)
  into v_unmatched_scoring, v_duplicate_targets
  from mapped;

  if v_unmatched_scoring > 0 or v_duplicate_targets > 0 then
    raise exception 'The Worlds result payload is not fully and uniquely mapped for scoring.' using errcode = '22023';
  end if;

  select snapshot.id into v_snapshot_id
  from public.worlds_result_snapshots snapshot
  where snapshot.event_id = v_run.event_id
    and snapshot.content_hash = p_content_hash
    and snapshot.snapshot_kind = 'provisional';

  if v_snapshot_id is null then
    insert into public.worlds_result_snapshots (
      event_id, snapshot_kind, content_hash, parser_version, import_method,
      source_url, source_fetched_at, source_updated_at, row_count, source_rows
    ) values (
      v_run.event_id,
      'provisional',
      p_content_hash,
      v_source.parser_version,
      v_run.import_method,
      case when v_run.import_method = 'scheduled' then v_source.feed_url else v_source.attribution_url end,
      now(),
      p_source_updated_at,
      v_row_count,
      p_rows
    ) returning id into v_snapshot_id;

    insert into public.worlds_result_placements (
      snapshot_id, event_id, competitor_slug, source_name, source_country_code,
      placing, score_points, match_alias_id, record
    )
    select
      v_snapshot_id,
      v_run.event_id,
      alias.competitor_slug,
      row_data.source_name,
      row_data.source_country_code,
      row_data.placing,
      public.worlds_score_for_placing(row_data.placing),
      alias.id,
      row_data.record
    from jsonb_to_recordset(p_rows) as row_data(
      source_name text,
      source_name_key text,
      source_country_code text,
      placing integer,
      score_points integer,
      record jsonb
    )
    join public.worlds_result_aliases alias
      on alias.event_id = v_run.event_id
     and alias.source_name_key = row_data.source_name_key
     and alias.source_country_code = row_data.source_country_code
     and alias.revoked_at is null;
  end if;

  update public.worlds_pick_competitors
  set score_points = 0,
      result_label = null,
      updated_at = now()
  where event_id = v_run.event_id;

  update public.worlds_pick_competitors competitor
  set score_points = placement.score_points,
      result_label = case when placement.placing = 9999
        then 'No valid placing'
        else '#' || placement.placing || ' · ' || public.worlds_result_label_for_placing(placement.placing)
      end,
      updated_at = now()
  from public.worlds_result_placements placement
  where placement.snapshot_id = v_snapshot_id
    and competitor.event_id = placement.event_id
    and competitor.slug = placement.competitor_slug;

  if jsonb_array_length(p_issues) > 0 then
    insert into public.worlds_result_mapping_issues (
      run_id, event_id, source_name, source_name_key, source_country_code,
      placing, score_points, issue_code, suggested_competitor_slug, suggestion_reason
    )
    select
      p_run_id,
      v_run.event_id,
      issue.source_name,
      issue.source_name_key,
      issue.source_country_code,
      issue.placing,
      issue.score_points,
      issue.issue_code,
      nullif(issue.suggested_competitor_slug, ''),
      nullif(issue.suggestion_reason, '')
    from jsonb_to_recordset(p_issues) as issue(
      source_name text,
      source_name_key text,
      source_country_code text,
      placing integer,
      score_points integer,
      issue_code text,
      suggested_competitor_slug text,
      suggestion_reason text
    );
  end if;

  update public.worlds_pick_events
  set status = 'scoring', updated_at = now()
  where id = v_run.event_id
    and status <> 'final';

  update public.worlds_result_import_runs
  set status = 'accepted',
      content_hash = p_content_hash,
      http_status = p_http_status,
      response_bytes = p_response_bytes,
      row_count = v_row_count,
      snapshot_id = v_snapshot_id,
      completed_at = now()
  where id = p_run_id;

  update public.worlds_result_sources
  set state = 'live',
      current_snapshot_id = v_snapshot_id,
      last_content_hash = p_content_hash,
      last_etag = p_etag,
      last_modified = p_last_modified,
      last_accepted_at = now(),
      consecutive_failures = 0,
      last_issue_code = null,
      last_issue_message = null,
      lock_token = null,
      lock_acquired_at = null,
      lock_expires_at = null,
      updated_at = now()
  where event_id = v_run.event_id
    and lock_token = p_lock_token;

  return jsonb_build_object(
    'status', 'accepted',
    'run_id', p_run_id,
    'snapshot_id', v_snapshot_id,
    'row_count', v_row_count,
    'nonblocking_issues', jsonb_array_length(p_issues)
  );
end;
$$;

create or replace function public.finalize_worlds_results(
  p_event_id text,
  p_official_source_url text,
  p_confirmation_text text,
  p_approved_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.worlds_result_sources%rowtype;
  v_provisional public.worlds_result_snapshots%rowtype;
  v_final_snapshot_id uuid;
  v_finalization_id uuid;
begin
  if p_official_source_url !~ '^https://' then
    raise exception 'An HTTPS official result source is required.' using errcode = '22023';
  end if;
  if p_confirmation_text <> 'FINALIZE 2026 VGC MASTERS' then
    raise exception 'The finalization confirmation text does not match.' using errcode = '22023';
  end if;

  select * into v_source
  from public.worlds_result_sources
  where event_id = p_event_id
  for update;

  if not found or v_source.current_snapshot_id is null then
    raise exception 'There is no provisional Worlds result snapshot to finalize.' using errcode = '22023';
  end if;
  if v_source.state = 'final' then
    raise exception 'Worlds results are already final.' using errcode = '22023';
  end if;

  select * into v_provisional
  from public.worlds_result_snapshots
  where id = v_source.current_snapshot_id
    and event_id = p_event_id
    and snapshot_kind = 'provisional';

  if not found then
    raise exception 'The current Worlds result snapshot is not provisional.' using errcode = '22023';
  end if;

  insert into public.worlds_result_snapshots (
    event_id, snapshot_kind, content_hash, parser_version, import_method,
    source_url, source_fetched_at, source_updated_at, row_count, source_rows
  ) values (
    p_event_id,
    'final',
    v_provisional.content_hash,
    v_provisional.parser_version,
    'finalization',
    p_official_source_url,
    now(),
    now(),
    v_provisional.row_count,
    v_provisional.source_rows
  ) returning id into v_final_snapshot_id;

  insert into public.worlds_result_placements (
    snapshot_id, event_id, competitor_slug, source_name, source_country_code,
    placing, score_points, match_alias_id, record
  )
  select
    v_final_snapshot_id, event_id, competitor_slug, source_name, source_country_code,
    placing, score_points, match_alias_id, record
  from public.worlds_result_placements
  where snapshot_id = v_provisional.id;

  insert into public.worlds_result_finalizations (
    event_id, provisional_snapshot_id, final_snapshot_id, official_source_url,
    approved_by, confirmation_text
  ) values (
    p_event_id, v_provisional.id, v_final_snapshot_id, p_official_source_url,
    p_approved_by, p_confirmation_text
  ) returning id into v_finalization_id;

  update public.worlds_result_sources
  set enabled = false,
      state = 'final',
      current_snapshot_id = v_final_snapshot_id,
      finalized_at = now(),
      lock_token = null,
      lock_acquired_at = null,
      lock_expires_at = null,
      updated_at = now()
  where event_id = p_event_id;

  update public.worlds_pick_events
  set status = 'final', updated_at = now()
  where id = p_event_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'final',
    'snapshot_id', v_final_snapshot_id,
    'finalization_id', v_finalization_id
  );
end;
$$;

create or replace function public.get_worlds_result_status(
  p_event_id text default '2026-vgc-masters'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when source.event_id is null then jsonb_build_object(
    'status', 'waiting',
    'is_stale', false
  ) else jsonb_build_object(
    'status', case
      when source.state = 'final' and source.current_snapshot_id is not null then 'final'
      when source.current_snapshot_id is not null then 'provisional'
      else 'waiting'
    end,
    'is_stale', case
      when source.state = 'live' and source.last_accepted_at is not null
        then source.last_accepted_at < now() - make_interval(secs => source.poll_interval_seconds * 2)
      else false
    end,
    'last_successful_update', source.last_accepted_at,
    'source_name', case when source.state = 'final' then 'Official PokÃ©mon results' else source.attribution_name end,
    'source_url', case when source.state = 'final' then (
      select finalization.official_source_url
      from public.worlds_result_finalizations finalization
      where finalization.event_id = source.event_id
      order by finalization.created_at desc
      limit 1
    ) else source.attribution_url end
  ) end
  from (select 1) singleton
  left join public.worlds_result_sources source on source.event_id = p_event_id
  limit 1;
$$;

insert into public.worlds_result_sources (
  event_id,
  provider,
  division,
  attribution_name,
  attribution_url,
  permission_status,
  enabled,
  state,
  poll_interval_seconds,
  active_from,
  active_through,
  minimum_row_count,
  maximum_row_count
) values (
  '2026-vgc-masters',
  'pokedata',
  'Masters',
  'PokeData',
  'https://www.pokedata.ovh/standingsVGC/',
  'pending',
  false,
  'disabled',
  300,
  '2026-08-28T07:00:00Z',
  '2026-08-31T12:00:00Z',
  64,
  512
) on conflict (event_id) do nothing;

alter table public.owner_notification_deliveries
  drop constraint if exists owner_notification_deliveries_kind_check;
alter table public.owner_notification_deliveries
  add constraint owner_notification_deliveries_kind_check
  check (kind in ('new_league', 'daily_digest', 'worlds_results_alert'));

revoke all on function public.worlds_score_for_placing(integer) from public, anon, authenticated;
revoke all on function public.worlds_result_label_for_placing(integer) from public, anon, authenticated;
revoke all on function public.begin_worlds_result_import(text, text) from public, anon, authenticated, service_role;
revoke all on function public.complete_worlds_result_import(uuid, uuid, text, text, text, integer, integer, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.reject_worlds_result_import(uuid, uuid, text, integer, integer, text, text, integer, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.publish_worlds_result_snapshot(uuid, uuid, text, integer, integer, text, text, timestamptz, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.finalize_worlds_results(text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_worlds_result_status(text) from public, anon, authenticated;

grant execute on function public.worlds_score_for_placing(integer) to service_role;
grant execute on function public.worlds_result_label_for_placing(integer) to service_role;
grant execute on function public.begin_worlds_result_import(text, text) to service_role;
grant execute on function public.complete_worlds_result_import(uuid, uuid, text, text, text, integer, integer, text, text, text, integer) to service_role;
grant execute on function public.reject_worlds_result_import(uuid, uuid, text, integer, integer, text, text, integer, text, text, jsonb) to service_role;
grant execute on function public.publish_worlds_result_snapshot(uuid, uuid, text, integer, integer, text, text, timestamptz, jsonb, jsonb) to service_role;
grant execute on function public.finalize_worlds_results(text, text, text, uuid) to service_role;
grant execute on function public.get_worlds_result_status(text) to anon, authenticated;

commit;
