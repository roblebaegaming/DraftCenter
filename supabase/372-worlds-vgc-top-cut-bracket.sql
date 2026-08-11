-- Configurable, fail-closed 2026 VGC Masters Top Cut prediction challenge.
-- No field, seed, pairing, deadline, or result is invented by this migration.

begin;

create table public.worlds_bracket_events (
  event_id text primary key references public.worlds_pick_events(id) on delete restrict,
  division text not null default 'Masters' check (division = 'Masters'),
  status text not null default 'waiting_for_official_bracket'
    check (status in ('waiting_for_official_bracket', 'open', 'locked', 'scoring', 'final', 'cancelled')),
  bracket_size integer check (bracket_size in (4, 8, 16, 32, 64)),
  revision integer not null default 0 check (revision >= 0),
  opens_at timestamptz,
  locks_at timestamptz,
  official_bracket_url text check (official_bracket_url is null or official_bracket_url ~ '^https://'),
  source_checked_at timestamptz,
  round_points jsonb not null default '{}'::jsonb check (
    jsonb_typeof(round_points) = 'object' and pg_column_size(round_points) <= 2048
  ),
  auto_finalize_from_results boolean not null default true,
  published_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  check (locks_at is null or opens_at is not null),
  check (locks_at is null or locks_at > opens_at)
);

create table public.worlds_bracket_slots (
  event_id text not null references public.worlds_bracket_events(event_id) on delete restrict,
  bracket_revision integer not null check (bracket_revision > 0),
  slot_number integer not null check (slot_number between 1 and 64),
  source_seed integer check (source_seed between 1 and 64),
  competitor_slug text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, bracket_revision, slot_number),
  unique (event_id, bracket_revision, competitor_slug),
  unique (event_id, bracket_revision, source_seed),
  foreign key (event_id, competitor_slug)
    references public.worlds_pick_competitors(event_id, slug) on delete restrict
);

create table public.worlds_bracket_entries (
  event_id text not null references public.worlds_bracket_events(event_id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  bracket_revision integer not null check (bracket_revision > 0),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  picks jsonb not null check (jsonb_typeof(picks) = 'object' and pg_column_size(picks) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index worlds_bracket_entries_event_updated_idx
  on public.worlds_bracket_entries(event_id, updated_at);

create table public.worlds_bracket_results (
  event_id text not null references public.worlds_bracket_events(event_id) on delete restrict,
  bracket_revision integer not null check (bracket_revision > 0),
  round_number integer not null check (round_number between 1 and 6),
  match_number integer not null check (match_number between 1 and 32),
  winner_slug text not null,
  result_status text not null default 'provisional' check (result_status in ('provisional', 'final')),
  source_url text not null check (source_url ~ '^https://'),
  source_snapshot_id uuid references public.worlds_result_snapshots(id) on delete restrict,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, bracket_revision, round_number, match_number),
  foreign key (event_id, winner_slug)
    references public.worlds_pick_competitors(event_id, slug) on delete restrict
);

create table public.worlds_bracket_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.worlds_bracket_events(event_id) on delete restrict,
  bracket_revision integer not null check (bracket_revision >= 0),
  action text not null check (action in ('published', 'result_recorded', 'result_corrected', 'finalized', 'auto_finalized')),
  actor_user_id uuid references auth.users(id) on delete set null,
  source_url text check (source_url is null or source_url ~ '^https://'),
  details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384
  ),
  created_at timestamptz not null default now()
);

create index worlds_bracket_audit_event_created_idx
  on public.worlds_bracket_audit_log(event_id, created_at desc);

alter table public.worlds_bracket_events enable row level security;
alter table public.worlds_bracket_slots enable row level security;
alter table public.worlds_bracket_entries enable row level security;
alter table public.worlds_bracket_results enable row level security;
alter table public.worlds_bracket_audit_log enable row level security;

revoke all on table public.worlds_bracket_events from public, anon, authenticated;
revoke all on table public.worlds_bracket_slots from public, anon, authenticated;
revoke all on table public.worlds_bracket_entries from public, anon, authenticated;
revoke all on table public.worlds_bracket_results from public, anon, authenticated;
revoke all on table public.worlds_bracket_audit_log from public, anon, authenticated;

grant select, insert, update on table public.worlds_bracket_events to service_role;
grant select, insert on table public.worlds_bracket_slots to service_role;
grant select, insert, update on table public.worlds_bracket_entries to service_role;
grant select, insert, update on table public.worlds_bracket_results to service_role;
grant select, insert on table public.worlds_bracket_audit_log to service_role;

insert into public.worlds_bracket_events (event_id)
values ('2026-vgc-masters')
on conflict (event_id) do nothing;

create or replace function public.worlds_bracket_round_count(p_bracket_size integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case p_bracket_size
    when 4 then 2
    when 8 then 3
    when 16 then 4
    when 32 then 5
    when 64 then 6
    else null
  end;
$$;

create or replace function public.publish_worlds_bracket(
  p_event_id text,
  p_bracket_size integer,
  p_opens_at timestamptz,
  p_locks_at timestamptz,
  p_source_url text,
  p_source_checked_at timestamptz,
  p_round_points jsonb,
  p_participants jsonb,
  p_approved_by uuid,
  p_confirmation_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bracket public.worlds_bracket_events%rowtype;
  v_event public.worlds_pick_events%rowtype;
  v_revision integer;
  v_round_count integer;
  v_round integer;
  v_valid_competitors integer;
begin
  if p_confirmation_text <> 'PUBLISH OFFICIAL TOP CUT' then
    raise exception 'Confirm the reviewed official Top Cut before publishing.' using errcode = '22023';
  end if;
  if p_approved_by is null then
    raise exception 'An owner identity is required to publish the Top Cut.' using errcode = '42501';
  end if;
  if p_source_url is null or p_source_url !~ '^https://' then
    raise exception 'The official bracket source must use HTTPS.' using errcode = '22023';
  end if;
  if p_source_checked_at is null or p_source_checked_at > now() + interval '5 minutes' then
    raise exception 'Record when the official bracket source was checked.' using errcode = '22023';
  end if;
  if p_opens_at is null or p_locks_at is null or p_locks_at <= p_opens_at or p_locks_at <= now() then
    raise exception 'The prediction window must end in the future after it opens.' using errcode = '22023';
  end if;

  select * into v_event from public.worlds_pick_events where id = p_event_id;
  if not found or v_event.division <> 'Masters' then
    raise exception 'Only the configured VGC Masters event can publish this bracket.' using errcode = '22023';
  end if;

  select * into v_bracket
  from public.worlds_bracket_events
  where event_id = p_event_id
  for update;
  if not found then raise exception 'The Worlds bracket configuration was not found.' using errcode = 'P0002'; end if;
  if v_bracket.status in ('final', 'cancelled') then
    raise exception 'This Worlds bracket can no longer be published.' using errcode = '22023';
  end if;
  if v_bracket.revision > 0 and exists (
    select 1 from public.worlds_bracket_entries entry
    where entry.event_id = p_event_id and entry.bracket_revision = v_bracket.revision
  ) then
    raise exception 'The published bracket cannot be replaced after an entry is saved.' using errcode = '22023';
  end if;

  v_round_count := public.worlds_bracket_round_count(p_bracket_size);
  if v_round_count is null then
    raise exception 'Top Cut size must be 4, 8, 16, 32, or 64.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) <> p_bracket_size then
    raise exception 'The official field must fill every bracket slot.' using errcode = '22023';
  end if;
  if (
    select count(*)
    from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer)
    where slot between 1 and p_bracket_size and char_length(coalesce(competitor_slug, '')) between 2 and 100
  ) <> p_bracket_size
  or (
    select count(distinct slot)
    from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer)
  ) <> p_bracket_size
  or (
    select count(distinct competitor_slug)
    from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer)
  ) <> p_bracket_size then
    raise exception 'Every bracket slot and competitor must be unique.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer)
    where source_seed is not null and source_seed not between 1 and p_bracket_size
  ) or (
    select count(source_seed)
    from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer)
  ) <> (
    select count(distinct source_seed)
    from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer)
  ) then
    raise exception 'Published seeds must be unique and inside the official field.' using errcode = '22023';
  end if;

  select count(*) into v_valid_competitors
  from public.worlds_pick_competitors competitor
  where competitor.event_id = p_event_id
    and competitor.slug in (
      select participant.competitor_slug
      from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer)
    );
  if v_valid_competitors <> p_bracket_size then
    raise exception 'Every Top Cut name must map to the reviewed VGC Masters roster.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_round_points) <> 'object' or jsonb_object_length(p_round_points) <> v_round_count then
    raise exception 'Set one score for every bracket round.' using errcode = '22023';
  end if;
  for v_round in 1..v_round_count loop
    if coalesce(p_round_points ->> v_round::text, '') !~ '^[0-9]+$'
       or (p_round_points ->> v_round::text)::integer not between 1 and 1000 then
      raise exception 'Every round score must be a whole number from 1 to 1,000.' using errcode = '22023';
    end if;
  end loop;

  v_revision := v_bracket.revision + 1;
  insert into public.worlds_bracket_slots (
    event_id, bracket_revision, slot_number, source_seed, competitor_slug
  )
  select p_event_id, v_revision, participant.slot, participant.source_seed, participant.competitor_slug
  from jsonb_to_recordset(p_participants) as participant(slot integer, competitor_slug text, source_seed integer);

  update public.worlds_bracket_events
  set status = 'open',
      bracket_size = p_bracket_size,
      revision = v_revision,
      opens_at = p_opens_at,
      locks_at = p_locks_at,
      official_bracket_url = p_source_url,
      source_checked_at = p_source_checked_at,
      round_points = p_round_points,
      published_at = now(),
      finalized_at = null,
      updated_at = now()
  where event_id = p_event_id;

  update public.worlds_pick_events
  set bracket_status = 'open', updated_at = now()
  where id = p_event_id;

  insert into public.worlds_bracket_audit_log (
    event_id, bracket_revision, action, actor_user_id, source_url, details
  ) values (
    p_event_id, v_revision, 'published', p_approved_by, p_source_url,
    jsonb_build_object('bracket_size', p_bracket_size, 'opens_at', p_opens_at, 'locks_at', p_locks_at, 'participants', p_participants, 'round_points', p_round_points)
  );

  return jsonb_build_object('ok', true, 'status', 'open', 'revision', v_revision, 'bracket_size', p_bracket_size);
end;
$$;

create or replace function public.save_worlds_bracket_entry(
  p_event_id text,
  p_picks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bracket public.worlds_bracket_events%rowtype;
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_round_count integer;
  v_round integer;
  v_match integer;
  v_match_count integer;
  v_key text;
  v_winner text;
  v_a text;
  v_b text;
begin
  if v_user_id is null then raise exception 'Sign in to save a Top Cut bracket.' using errcode = '42501'; end if;
  select * into v_bracket from public.worlds_bracket_events where event_id = p_event_id;
  if not found or v_bracket.revision = 0 then raise exception 'The official Top Cut has not been published.' using errcode = '22023'; end if;
  if v_bracket.status <> 'open' or now() < v_bracket.opens_at or now() >= v_bracket.locks_at then
    raise exception 'Top Cut bracket entries are locked.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_picks) <> 'object' or jsonb_object_length(p_picks) <> v_bracket.bracket_size - 1 then
    raise exception 'Complete every Top Cut matchup before saving.' using errcode = '22023';
  end if;

  v_round_count := public.worlds_bracket_round_count(v_bracket.bracket_size);
  for v_round in 1..v_round_count loop
    v_match_count := v_bracket.bracket_size / power(2, v_round)::integer;
    for v_match in 1..v_match_count loop
      v_key := format('r%s-m%s', v_round, v_match);
      v_winner := p_picks ->> v_key;
      if v_round = 1 then
        select competitor_slug into v_a from public.worlds_bracket_slots
        where event_id = p_event_id and bracket_revision = v_bracket.revision and slot_number = (v_match - 1) * 2 + 1;
        select competitor_slug into v_b from public.worlds_bracket_slots
        where event_id = p_event_id and bracket_revision = v_bracket.revision and slot_number = (v_match - 1) * 2 + 2;
      else
        v_a := p_picks ->> format('r%s-m%s', v_round - 1, (v_match - 1) * 2 + 1);
        v_b := p_picks ->> format('r%s-m%s', v_round - 1, (v_match - 1) * 2 + 2);
      end if;
      if v_winner is null or v_winner not in (v_a, v_b) then
        raise exception 'Bracket choices must follow winners through every round.' using errcode = '22023';
      end if;
    end loop;
  end loop;

  select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Trainer')
  into v_display_name from public.profiles profile where profile.id = v_user_id;
  if char_length(coalesce(v_display_name, '')) not between 2 and 60 then v_display_name := 'Trainer'; end if;

  insert into public.worlds_bracket_entries (event_id, user_id, bracket_revision, display_name, picks)
  values (p_event_id, v_user_id, v_bracket.revision, v_display_name, p_picks)
  on conflict (event_id, user_id) do update
    set bracket_revision = excluded.bracket_revision,
        display_name = excluded.display_name,
        picks = excluded.picks,
        updated_at = now();
  return jsonb_build_object('ok', true, 'picks', p_picks, 'display_name', v_display_name);
end;
$$;

create or replace function public.record_worlds_bracket_result(
  p_event_id text,
  p_round_number integer,
  p_match_number integer,
  p_winner_slug text,
  p_source_url text,
  p_recorded_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bracket public.worlds_bracket_events%rowtype;
  v_round_count integer;
  v_match_count integer;
  v_a text;
  v_b text;
  v_existing text;
  v_action text := 'result_recorded';
begin
  if p_recorded_by is null then raise exception 'An owner identity is required.' using errcode = '42501'; end if;
  if p_source_url is null or p_source_url !~ '^https://' then raise exception 'Use the official HTTPS bracket source.' using errcode = '22023'; end if;
  select * into v_bracket from public.worlds_bracket_events where event_id = p_event_id for update;
  if not found or v_bracket.revision = 0 then raise exception 'Publish the official Top Cut first.' using errcode = '22023'; end if;
  if v_bracket.status in ('final', 'cancelled') then raise exception 'Final bracket results cannot be changed.' using errcode = '22023'; end if;
  if now() < v_bracket.locks_at then raise exception 'Results cannot publish before bracket entries lock.' using errcode = '22023'; end if;
  v_round_count := public.worlds_bracket_round_count(v_bracket.bracket_size);
  if p_round_number not between 1 and v_round_count then raise exception 'That bracket round does not exist.' using errcode = '22023'; end if;
  v_match_count := v_bracket.bracket_size / power(2, p_round_number)::integer;
  if p_match_number not between 1 and v_match_count then raise exception 'That bracket match does not exist.' using errcode = '22023'; end if;

  if p_round_number = 1 then
    select competitor_slug into v_a from public.worlds_bracket_slots
    where event_id = p_event_id and bracket_revision = v_bracket.revision and slot_number = (p_match_number - 1) * 2 + 1;
    select competitor_slug into v_b from public.worlds_bracket_slots
    where event_id = p_event_id and bracket_revision = v_bracket.revision and slot_number = (p_match_number - 1) * 2 + 2;
  else
    select winner_slug into v_a from public.worlds_bracket_results
    where event_id = p_event_id and bracket_revision = v_bracket.revision
      and round_number = p_round_number - 1 and match_number = (p_match_number - 1) * 2 + 1;
    select winner_slug into v_b from public.worlds_bracket_results
    where event_id = p_event_id and bracket_revision = v_bracket.revision
      and round_number = p_round_number - 1 and match_number = (p_match_number - 1) * 2 + 2;
  end if;
  if v_a is null or v_b is null then raise exception 'Record both feeder match winners first.' using errcode = '22023'; end if;
  if p_winner_slug not in (v_a, v_b) then raise exception 'The winner must be one of this match''s competitors.' using errcode = '22023'; end if;

  select winner_slug into v_existing from public.worlds_bracket_results
  where event_id = p_event_id and bracket_revision = v_bracket.revision
    and round_number = p_round_number and match_number = p_match_number;
  if v_existing = p_winner_slug then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  if v_existing is not null then
    if p_round_number < v_round_count and exists (
      select 1 from public.worlds_bracket_results
      where event_id = p_event_id and bracket_revision = v_bracket.revision
        and round_number = p_round_number + 1 and match_number = ((p_match_number + 1) / 2)
    ) then raise exception 'Remove or correct the downstream result before changing this winner.' using errcode = '22023'; end if;
    v_action := 'result_corrected';
  end if;

  insert into public.worlds_bracket_results (
    event_id, bracket_revision, round_number, match_number, winner_slug,
    result_status, source_url, recorded_by
  ) values (
    p_event_id, v_bracket.revision, p_round_number, p_match_number, p_winner_slug,
    'provisional', p_source_url, p_recorded_by
  ) on conflict (event_id, bracket_revision, round_number, match_number) do update
    set winner_slug = excluded.winner_slug,
        result_status = 'provisional',
        source_url = excluded.source_url,
        source_snapshot_id = null,
        recorded_by = excluded.recorded_by,
        updated_at = now();

  update public.worlds_bracket_events set status = 'scoring', updated_at = now() where event_id = p_event_id;
  update public.worlds_pick_events set bracket_status = 'locked', updated_at = now() where id = p_event_id;
  insert into public.worlds_bracket_audit_log (event_id, bracket_revision, action, actor_user_id, source_url, details)
  values (p_event_id, v_bracket.revision, v_action, p_recorded_by, p_source_url,
    jsonb_build_object('round_number', p_round_number, 'match_number', p_match_number, 'winner_slug', p_winner_slug, 'previous_winner_slug', v_existing));
  return jsonb_build_object('ok', true, 'status', 'scoring');
end;
$$;

create or replace function public.finalize_worlds_bracket(
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
  v_bracket public.worlds_bracket_events%rowtype;
  v_result_count integer;
begin
  if p_confirmation_text <> 'FINALIZE 2026 VGC TOP CUT' then raise exception 'Type the exact Top Cut finalization confirmation.' using errcode = '22023'; end if;
  if p_approved_by is null then raise exception 'An owner identity is required.' using errcode = '42501'; end if;
  if p_official_source_url is null or p_official_source_url !~ '^https://' then raise exception 'Use the official HTTPS result source.' using errcode = '22023'; end if;
  select * into v_bracket from public.worlds_bracket_events where event_id = p_event_id for update;
  if not found or v_bracket.revision = 0 then raise exception 'The official Top Cut is not published.' using errcode = '22023'; end if;
  if v_bracket.status = 'final' then return jsonb_build_object('ok', true, 'status', 'final'); end if;
  select count(*) into v_result_count from public.worlds_bracket_results
  where event_id = p_event_id and bracket_revision = v_bracket.revision;
  if v_result_count <> v_bracket.bracket_size - 1 then raise exception 'Record every bracket winner before finalizing.' using errcode = '22023'; end if;
  update public.worlds_bracket_results
  set result_status = 'final', updated_at = now()
  where event_id = p_event_id and bracket_revision = v_bracket.revision;
  update public.worlds_bracket_events set status = 'final', finalized_at = now(), updated_at = now() where event_id = p_event_id;
  update public.worlds_pick_events set bracket_status = 'final', updated_at = now() where id = p_event_id;
  insert into public.worlds_bracket_audit_log (event_id, bracket_revision, action, actor_user_id, source_url, details)
  values (p_event_id, v_bracket.revision, 'finalized', p_approved_by, p_official_source_url, jsonb_build_object('result_count', v_result_count));
  return jsonb_build_object('ok', true, 'status', 'final', 'result_count', v_result_count);
end;
$$;

create or replace function public.sync_worlds_bracket_from_final_results(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bracket public.worlds_bracket_events%rowtype;
  v_source public.worlds_result_sources%rowtype;
  v_snapshot_kind text;
  v_source_url text;
  v_round_count integer;
  v_round integer;
  v_match integer;
  v_match_count integer;
  v_a text;
  v_b text;
  v_a_placing integer;
  v_b_placing integer;
  v_winner text;
begin
  select * into v_bracket from public.worlds_bracket_events where event_id = p_event_id for update;
  if not found or v_bracket.revision = 0 then return jsonb_build_object('ok', true, 'status', 'waiting_for_official_bracket'); end if;
  if not v_bracket.auto_finalize_from_results then return jsonb_build_object('ok', true, 'status', 'automation_disabled'); end if;
  if v_bracket.status = 'final' then return jsonb_build_object('ok', true, 'status', 'final'); end if;
  if now() < v_bracket.locks_at then raise exception 'Final results cannot publish before bracket entries lock.' using errcode = '22023'; end if;
  select * into v_source from public.worlds_result_sources where event_id = p_event_id;
  if not found or v_source.state <> 'final' or v_source.current_snapshot_id is null then
    raise exception 'Only owner-finalized Worlds placements may backfill the bracket.' using errcode = '22023';
  end if;
  select snapshot_kind into v_snapshot_kind from public.worlds_result_snapshots
  where id = v_source.current_snapshot_id and event_id = p_event_id;
  if v_snapshot_kind <> 'final' then raise exception 'The current placement snapshot is not final.' using errcode = '22023'; end if;
  select official_source_url into v_source_url from public.worlds_result_finalizations
  where event_id = p_event_id and final_snapshot_id = v_source.current_snapshot_id
  order by created_at desc limit 1;
  v_source_url := coalesce(v_source_url, v_bracket.official_bracket_url);

  v_round_count := public.worlds_bracket_round_count(v_bracket.bracket_size);
  for v_round in 1..v_round_count loop
    v_match_count := v_bracket.bracket_size / power(2, v_round)::integer;
    for v_match in 1..v_match_count loop
      if v_round = 1 then
        select competitor_slug into v_a from public.worlds_bracket_slots
        where event_id = p_event_id and bracket_revision = v_bracket.revision and slot_number = (v_match - 1) * 2 + 1;
        select competitor_slug into v_b from public.worlds_bracket_slots
        where event_id = p_event_id and bracket_revision = v_bracket.revision and slot_number = (v_match - 1) * 2 + 2;
      else
        select winner_slug into v_a from public.worlds_bracket_results
        where event_id = p_event_id and bracket_revision = v_bracket.revision and round_number = v_round - 1 and match_number = (v_match - 1) * 2 + 1;
        select winner_slug into v_b from public.worlds_bracket_results
        where event_id = p_event_id and bracket_revision = v_bracket.revision and round_number = v_round - 1 and match_number = (v_match - 1) * 2 + 2;
      end if;
      select placing into v_a_placing from public.worlds_result_placements
      where snapshot_id = v_source.current_snapshot_id and event_id = p_event_id and competitor_slug = v_a;
      select placing into v_b_placing from public.worlds_result_placements
      where snapshot_id = v_source.current_snapshot_id and event_id = p_event_id and competitor_slug = v_b;
      if v_a is null or v_b is null or v_a_placing is null or v_b_placing is null
         or v_a_placing = 9999 or v_b_placing = 9999 or v_a_placing = v_b_placing then
        raise exception 'Final placements cannot uniquely resolve round %, match %.', v_round, v_match using errcode = '22023';
      end if;
      v_winner := case when v_a_placing < v_b_placing then v_a else v_b end;
      insert into public.worlds_bracket_results (
        event_id, bracket_revision, round_number, match_number, winner_slug,
        result_status, source_url, source_snapshot_id
      ) values (
        p_event_id, v_bracket.revision, v_round, v_match, v_winner,
        'final', v_source_url, v_source.current_snapshot_id
      ) on conflict (event_id, bracket_revision, round_number, match_number) do update
        set winner_slug = excluded.winner_slug,
            result_status = 'final',
            source_url = excluded.source_url,
            source_snapshot_id = excluded.source_snapshot_id,
            updated_at = now();
    end loop;
  end loop;

  update public.worlds_bracket_events set status = 'final', finalized_at = now(), updated_at = now() where event_id = p_event_id;
  update public.worlds_pick_events set bracket_status = 'final', updated_at = now() where id = p_event_id;
  insert into public.worlds_bracket_audit_log (event_id, bracket_revision, action, source_url, details)
  values (p_event_id, v_bracket.revision, 'auto_finalized', v_source_url,
    jsonb_build_object('source_snapshot_id', v_source.current_snapshot_id, 'result_count', v_bracket.bracket_size - 1));
  return jsonb_build_object('ok', true, 'status', 'final', 'result_count', v_bracket.bracket_size - 1);
end;
$$;

create or replace function public.get_worlds_bracket_hub(p_event_id text default '2026-vgc-masters')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bracket public.worlds_bracket_events%rowtype;
  v_effective_status text;
  v_is_locked boolean;
  v_payload jsonb;
begin
  select * into v_bracket from public.worlds_bracket_events where event_id = p_event_id;
  if not found then return null; end if;
  if v_bracket.revision = 0 then v_effective_status := 'waiting_for_official_bracket';
  elsif v_bracket.status = 'final' then v_effective_status := 'final';
  elsif now() < v_bracket.opens_at then v_effective_status := 'scheduled';
  elsif now() < v_bracket.locks_at and v_bracket.status = 'open' then v_effective_status := 'open';
  elsif exists (select 1 from public.worlds_bracket_results where event_id = p_event_id and bracket_revision = v_bracket.revision) then v_effective_status := 'scoring';
  else v_effective_status := 'locked'; end if;
  v_is_locked := v_effective_status not in ('open');

  with scored_entries as (
    select entry.*,
      coalesce((
        select sum(case when pick.value = result.winner_slug
          then (v_bracket.round_points ->> result.round_number::text)::integer else 0 end)
        from jsonb_each_text(entry.picks) pick
        join public.worlds_bracket_results result
          on result.event_id = entry.event_id
         and result.bracket_revision = entry.bracket_revision
         and pick.key = format('r%s-m%s', result.round_number, result.match_number)
      ), 0)::integer as score
    from public.worlds_bracket_entries entry
    where entry.event_id = p_event_id and entry.bracket_revision = v_bracket.revision
  ), ranked as (
    select scored_entries.*,
      dense_rank() over (order by score desc)::integer as leaderboard_rank,
      row_number() over (order by score desc, lower(display_name), created_at)::integer as result_order
    from scored_entries
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'event_id', v_bracket.event_id,
      'division', v_bracket.division,
      'status', v_effective_status,
      'configured_status', v_bracket.status,
      'bracket_size', v_bracket.bracket_size,
      'revision', v_bracket.revision,
      'opens_at', v_bracket.opens_at,
      'locks_at', v_bracket.locks_at,
      'official_bracket_url', v_bracket.official_bracket_url,
      'source_checked_at', v_bracket.source_checked_at,
      'round_points', v_bracket.round_points,
      'published_at', v_bracket.published_at,
      'finalized_at', v_bracket.finalized_at,
      'is_locked', v_is_locked
    ),
    'slots', coalesce((select jsonb_agg(jsonb_build_object(
      'slot_number', slot.slot_number,
      'source_seed', slot.source_seed,
      'competitor_slug', slot.competitor_slug,
      'display_name', competitor.display_name,
      'country_code', competitor.country_code
    ) order by slot.slot_number)
      from public.worlds_bracket_slots slot
      join public.worlds_pick_competitors competitor
        on competitor.event_id = slot.event_id and competitor.slug = slot.competitor_slug
      where slot.event_id = p_event_id and slot.bracket_revision = v_bracket.revision
    ), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(jsonb_build_object(
      'round_number', result.round_number,
      'match_number', result.match_number,
      'winner_slug', result.winner_slug,
      'result_status', result.result_status,
      'source_url', result.source_url,
      'updated_at', result.updated_at
    ) order by result.round_number, result.match_number)
      from public.worlds_bracket_results result
      where result.event_id = p_event_id and result.bracket_revision = v_bracket.revision
    ), '[]'::jsonb),
    'entry_count', (select count(*) from scored_entries),
    'standings', coalesce((select jsonb_agg(jsonb_build_object(
      'rank', ranked.leaderboard_rank,
      'display_name', ranked.display_name,
      'score', ranked.score,
      'is_me', ranked.user_id = auth.uid(),
      'picks', case when ranked.user_id = auth.uid() or v_is_locked then ranked.picks else null end
    ) order by ranked.result_order)
      from ranked where ranked.result_order <= 100
    ), '[]'::jsonb),
    'my_entry', (select jsonb_build_object(
      'display_name', mine.display_name,
      'picks', mine.picks,
      'score', mine.score,
      'rank', mine.leaderboard_rank,
      'created_at', mine.created_at,
      'updated_at', mine.updated_at
    ) from ranked mine where mine.user_id = auth.uid())
  ) into v_payload;
  return v_payload;
end;
$$;

revoke all on function public.worlds_bracket_round_count(integer) from public, anon, authenticated, service_role;
revoke all on function public.publish_worlds_bracket(text, integer, timestamptz, timestamptz, text, timestamptz, jsonb, jsonb, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.save_worlds_bracket_entry(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.record_worlds_bracket_result(text, integer, integer, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finalize_worlds_bracket(text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.sync_worlds_bracket_from_final_results(text) from public, anon, authenticated, service_role;
revoke all on function public.get_worlds_bracket_hub(text) from public, anon, authenticated, service_role;

grant execute on function public.get_worlds_bracket_hub(text) to anon, authenticated;
grant execute on function public.save_worlds_bracket_entry(text, jsonb) to authenticated;
grant execute on function public.publish_worlds_bracket(text, integer, timestamptz, timestamptz, text, timestamptz, jsonb, jsonb, uuid, text) to service_role;
grant execute on function public.record_worlds_bracket_result(text, integer, integer, text, text, uuid) to service_role;
grant execute on function public.finalize_worlds_bracket(text, text, text, uuid) to service_role;
grant execute on function public.sync_worlds_bracket_from_final_results(text) to service_role;

notify pgrst, 'reload schema';

commit;
