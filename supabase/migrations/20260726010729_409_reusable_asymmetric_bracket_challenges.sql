-- Migration 409: reusable, private-entry prediction brackets with explicit
-- official publication, asymmetric fields, first-round byes, round scoring,
-- and owner-reviewed result recording.

begin;

create table public.prediction_bracket_events (
  event_id text primary key check (event_id ~ '^[a-z0-9-]{3,80}$'),
  display_name text not null check (char_length(btrim(display_name)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 500),
  official_info_url text not null check (official_info_url ~ '^https://'),
  status text not null default 'waiting_for_official_bracket'
    check (status in ('waiting_for_official_bracket', 'open', 'locked', 'scoring', 'final', 'cancelled')),
  field_size integer check (field_size between 3 and 64),
  bracket_capacity integer check (bracket_capacity in (4, 8, 16, 32, 64)),
  revision integer not null default 0 check (revision >= 0),
  opens_at timestamptz,
  locks_at timestamptz,
  official_bracket_url text check (official_bracket_url is null or official_bracket_url ~ '^https://'),
  source_checked_at timestamptz,
  round_points jsonb not null default '{}'::jsonb check (
    jsonb_typeof(round_points) = 'object' and pg_column_size(round_points) <= 2048
  ),
  published_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  check (locks_at is null or opens_at is not null),
  check (locks_at is null or locks_at > opens_at),
  check ((field_size is null and bracket_capacity is null) or (field_size is not null and bracket_capacity is not null))
);

create table public.prediction_bracket_slots (
  event_id text not null references public.prediction_bracket_events(event_id) on delete restrict,
  bracket_revision integer not null check (bracket_revision > 0),
  slot_number integer not null check (slot_number between 1 and 64),
  competitor_id text not null check (competitor_id ~ '^slot-[1-9][0-9]?$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2,3}$'),
  source_seed integer check (source_seed between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (event_id, bracket_revision, slot_number),
  unique (event_id, bracket_revision, competitor_id),
  unique (event_id, bracket_revision, source_seed)
);

create unique index prediction_bracket_slots_name_idx
  on public.prediction_bracket_slots(event_id, bracket_revision, lower(btrim(display_name)));

create table public.prediction_bracket_entries (
  event_id text not null references public.prediction_bracket_events(event_id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  bracket_revision integer not null check (bracket_revision > 0),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  picks jsonb not null check (jsonb_typeof(picks) = 'object' and pg_column_size(picks) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index prediction_bracket_entries_event_updated_idx
  on public.prediction_bracket_entries(event_id, updated_at);

create table public.prediction_bracket_results (
  event_id text not null references public.prediction_bracket_events(event_id) on delete restrict,
  bracket_revision integer not null check (bracket_revision > 0),
  round_number integer not null check (round_number between 1 and 6),
  match_number integer not null check (match_number between 1 and 32),
  winner_id text not null,
  result_status text not null default 'provisional' check (result_status in ('provisional', 'final')),
  source_url text not null check (source_url ~ '^https://'),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, bracket_revision, round_number, match_number),
  foreign key (event_id, bracket_revision, winner_id)
    references public.prediction_bracket_slots(event_id, bracket_revision, competitor_id) on delete restrict
);

create table public.prediction_bracket_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.prediction_bracket_events(event_id) on delete restrict,
  bracket_revision integer not null check (bracket_revision >= 0),
  action text not null check (action in ('published', 'result_recorded', 'result_corrected', 'finalized')),
  actor_user_id uuid references auth.users(id) on delete set null,
  source_url text check (source_url is null or source_url ~ '^https://'),
  details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384
  ),
  created_at timestamptz not null default now()
);

create index prediction_bracket_audit_event_created_idx
  on public.prediction_bracket_audit_log(event_id, created_at desc);

alter table public.prediction_bracket_events enable row level security;
alter table public.prediction_bracket_events force row level security;
alter table public.prediction_bracket_slots enable row level security;
alter table public.prediction_bracket_slots force row level security;
alter table public.prediction_bracket_entries enable row level security;
alter table public.prediction_bracket_entries force row level security;
alter table public.prediction_bracket_results enable row level security;
alter table public.prediction_bracket_results force row level security;
alter table public.prediction_bracket_audit_log enable row level security;
alter table public.prediction_bracket_audit_log force row level security;

revoke all on table public.prediction_bracket_events from public, anon, authenticated;
revoke all on table public.prediction_bracket_slots from public, anon, authenticated;
revoke all on table public.prediction_bracket_entries from public, anon, authenticated;
revoke all on table public.prediction_bracket_results from public, anon, authenticated;
revoke all on table public.prediction_bracket_audit_log from public, anon, authenticated;

grant select, insert, update on table public.prediction_bracket_events to service_role;
grant select, insert on table public.prediction_bracket_slots to service_role;
grant select, insert, update on table public.prediction_bracket_entries to service_role;
grant select, insert, update on table public.prediction_bracket_results to service_role;
grant select, insert on table public.prediction_bracket_audit_log to service_role;

insert into public.prediction_bracket_events (
  event_id, display_name, description, official_info_url
) values (
  'victory-road-san-francisco-2026',
  'Victory Road to San Francisco',
  'Predict every winner once Victory Road publishes the official Phase 2 Top Cut field and pairings.',
  'https://victoryroad.pro/vrtsf26/'
) on conflict (event_id) do nothing;

create or replace function public.prediction_bracket_round_count(p_capacity integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case p_capacity
    when 4 then 2
    when 8 then 3
    when 16 then 4
    when 32 then 5
    when 64 then 6
    else null
  end;
$$;

create or replace function public.publish_prediction_bracket(
  p_event_id text,
  p_field_size integer,
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
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_capacity integer;
  v_revision integer;
  v_round_count integer;
  v_round integer;
begin
  if p_confirmation_text <> 'PUBLISH OFFICIAL BRACKET' then
    raise exception 'Confirm the reviewed official bracket before publishing.' using errcode = '22023';
  end if;
  if p_approved_by is null then
    raise exception 'An owner identity is required to publish the bracket.' using errcode = '42501';
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
  if p_field_size not between 3 and 64 then
    raise exception 'Bracket fields must contain 3 to 64 players.' using errcode = '22023';
  end if;

  v_capacity := case
    when p_field_size <= 4 then 4
    when p_field_size <= 8 then 8
    when p_field_size <= 16 then 16
    when p_field_size <= 32 then 32
    else 64
  end;
  v_round_count := public.prediction_bracket_round_count(v_capacity);

  select * into v_event
  from public.prediction_bracket_events
  where event_id = p_event_id
  for update;
  if not found then raise exception 'The bracket event was not found.' using errcode = 'P0002'; end if;
  if v_event.status in ('final', 'cancelled') then
    raise exception 'This bracket can no longer be published.' using errcode = '22023';
  end if;
  if v_event.revision > 0 and exists (
    select 1 from public.prediction_bracket_entries entry
    where entry.event_id = p_event_id and entry.bracket_revision = v_event.revision
  ) then
    raise exception 'The published bracket cannot be replaced after an entry is saved.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) <> p_field_size then
    raise exception 'The official field must contain exactly the published players.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_participants) participant(slot integer, display_name text, country_code text, source_seed integer)
    where participant.slot not between 1 and v_capacity
       or char_length(btrim(coalesce(participant.display_name, ''))) not between 2 and 100
       or (nullif(participant.country_code, '') is not null and upper(participant.country_code) !~ '^[A-Z]{2,3}$')
       or (participant.source_seed is not null and participant.source_seed not between 1 and p_field_size)
  ) or (
    select count(distinct participant.slot)
    from jsonb_to_recordset(p_participants) participant(slot integer, display_name text, country_code text, source_seed integer)
  ) <> p_field_size or (
    select count(distinct lower(btrim(participant.display_name)))
    from jsonb_to_recordset(p_participants) participant(slot integer, display_name text, country_code text, source_seed integer)
  ) <> p_field_size then
    raise exception 'Every bracket slot and player name must be valid and unique.' using errcode = '22023';
  end if;
  if (
    select count(participant.source_seed)
    from jsonb_to_recordset(p_participants) participant(slot integer, display_name text, country_code text, source_seed integer)
  ) <> (
    select count(distinct participant.source_seed)
    from jsonb_to_recordset(p_participants) participant(slot integer, display_name text, country_code text, source_seed integer)
  ) then
    raise exception 'Published seeds must be unique and inside the official field.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from generate_series(1, v_capacity / 2) first_round(match_number)
    where not exists (
      select 1
      from jsonb_to_recordset(p_participants) participant(slot integer, display_name text, country_code text, source_seed integer)
      where participant.slot in ((first_round.match_number - 1) * 2 + 1, (first_round.match_number - 1) * 2 + 2)
    )
  ) then
    raise exception 'Every first-round matchup needs at least one player so byes advance correctly.' using errcode = '22023';
  end if;

  if (case
    when jsonb_typeof(p_round_points) = 'object' then (select count(*) from jsonb_object_keys(p_round_points))
    else -1
  end) <> v_round_count then
    raise exception 'Set one score for every bracket round.' using errcode = '22023';
  end if;
  for v_round in 1..v_round_count loop
    if coalesce(p_round_points ->> v_round::text, '') !~ '^[0-9]+$'
       or (p_round_points ->> v_round::text)::integer not between 1 and 1000 then
      raise exception 'Every round score must be a whole number from 1 to 1,000.' using errcode = '22023';
    end if;
  end loop;

  v_revision := v_event.revision + 1;
  insert into public.prediction_bracket_slots (
    event_id, bracket_revision, slot_number, competitor_id, display_name, country_code, source_seed
  )
  select
    p_event_id,
    v_revision,
    participant.slot,
    format('slot-%s', participant.slot),
    btrim(participant.display_name),
    nullif(upper(btrim(participant.country_code)), ''),
    participant.source_seed
  from jsonb_to_recordset(p_participants) participant(slot integer, display_name text, country_code text, source_seed integer);

  update public.prediction_bracket_events
  set status = 'open',
      field_size = p_field_size,
      bracket_capacity = v_capacity,
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

  insert into public.prediction_bracket_audit_log (
    event_id, bracket_revision, action, actor_user_id, source_url, details
  ) values (
    p_event_id, v_revision, 'published', p_approved_by, p_source_url,
    jsonb_build_object('field_size', p_field_size, 'bracket_capacity', v_capacity, 'opens_at', p_opens_at, 'locks_at', p_locks_at, 'participants', p_participants, 'round_points', p_round_points)
  );

  return jsonb_build_object('ok', true, 'status', 'open', 'revision', v_revision, 'field_size', p_field_size, 'bracket_capacity', v_capacity);
end;
$$;

create or replace function public.save_prediction_bracket_entry(
  p_event_id text,
  p_picks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_round_count integer;
  v_round integer;
  v_match integer;
  v_match_count integer;
  v_key text;
  v_a text;
  v_b text;
  v_winner text;
  v_choice_count integer := 0;
  v_advancers jsonb := '{}'::jsonb;
begin
  if v_user_id is null then raise exception 'Sign in to save a bracket.' using errcode = '42501'; end if;
  select * into v_event from public.prediction_bracket_events where event_id = p_event_id;
  if not found or v_event.revision = 0 then raise exception 'The official bracket has not been published.' using errcode = '22023'; end if;
  if v_event.status <> 'open' or now() < v_event.opens_at or now() >= v_event.locks_at then
    raise exception 'Bracket entries are locked.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_picks) <> 'object'
     or (select count(*) from jsonb_object_keys(p_picks)) <> v_event.field_size - 1 then
    raise exception 'Complete every played matchup before saving.' using errcode = '22023';
  end if;

  v_round_count := public.prediction_bracket_round_count(v_event.bracket_capacity);
  for v_round in 1..v_round_count loop
    v_match_count := v_event.bracket_capacity / power(2, v_round)::integer;
    for v_match in 1..v_match_count loop
      v_key := format('r%s-m%s', v_round, v_match);
      if v_round = 1 then
        select competitor_id into v_a from public.prediction_bracket_slots
        where event_id = p_event_id and bracket_revision = v_event.revision and slot_number = (v_match - 1) * 2 + 1;
        select competitor_id into v_b from public.prediction_bracket_slots
        where event_id = p_event_id and bracket_revision = v_event.revision and slot_number = (v_match - 1) * 2 + 2;
      else
        v_a := v_advancers ->> format('r%s-m%s', v_round - 1, (v_match - 1) * 2 + 1);
        v_b := v_advancers ->> format('r%s-m%s', v_round - 1, (v_match - 1) * 2 + 2);
      end if;
      if v_a is null and v_b is null then
        raise exception 'The published bracket contains an empty advancement path.' using errcode = '22023';
      elsif v_a is null or v_b is null then
        if p_picks ? v_key then raise exception 'A bye advances automatically and cannot be picked.' using errcode = '22023'; end if;
        v_winner := coalesce(v_a, v_b);
      else
        v_winner := p_picks ->> v_key;
        if v_winner is null or v_winner not in (v_a, v_b) then
          raise exception 'Bracket choices must follow winners through every round.' using errcode = '22023';
        end if;
        v_choice_count := v_choice_count + 1;
      end if;
      v_advancers := jsonb_set(v_advancers, array[v_key], to_jsonb(v_winner), true);
      v_a := null;
      v_b := null;
    end loop;
  end loop;
  if v_choice_count <> v_event.field_size - 1 then
    raise exception 'Complete every played matchup before saving.' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Trainer')
  into v_display_name from public.profiles profile where profile.id = v_user_id;
  if char_length(coalesce(v_display_name, '')) not between 2 and 60 then v_display_name := 'Trainer'; end if;

  insert into public.prediction_bracket_entries (event_id, user_id, bracket_revision, display_name, picks)
  values (p_event_id, v_user_id, v_event.revision, v_display_name, p_picks)
  on conflict (event_id, user_id) do update
    set bracket_revision = excluded.bracket_revision,
        display_name = excluded.display_name,
        picks = excluded.picks,
        updated_at = now();
  return jsonb_build_object('ok', true, 'picks', p_picks, 'display_name', v_display_name);
end;
$$;

create or replace function public.record_prediction_bracket_result(
  p_event_id text,
  p_round_number integer,
  p_match_number integer,
  p_winner_id text,
  p_source_url text,
  p_recorded_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_round_count integer;
  v_round integer;
  v_match integer;
  v_match_count integer;
  v_a text;
  v_b text;
  v_winner text;
  v_existing text;
  v_action text := 'result_recorded';
  v_advancers jsonb := '{}'::jsonb;
begin
  if p_recorded_by is null then raise exception 'An owner identity is required.' using errcode = '42501'; end if;
  if p_source_url is null or p_source_url !~ '^https://' then raise exception 'Use the official HTTPS bracket source.' using errcode = '22023'; end if;
  select * into v_event from public.prediction_bracket_events where event_id = p_event_id for update;
  if not found or v_event.revision = 0 then raise exception 'Publish the official bracket first.' using errcode = '22023'; end if;
  if v_event.status in ('final', 'cancelled') then raise exception 'Final bracket results cannot be changed.' using errcode = '22023'; end if;
  if now() < v_event.locks_at then raise exception 'Results cannot publish before bracket entries lock.' using errcode = '22023'; end if;
  v_round_count := public.prediction_bracket_round_count(v_event.bracket_capacity);
  if p_round_number not between 1 and v_round_count then raise exception 'That bracket round does not exist.' using errcode = '22023'; end if;
  if p_match_number not between 1 and v_event.bracket_capacity / power(2, p_round_number)::integer then
    raise exception 'That bracket match does not exist.' using errcode = '22023';
  end if;

  if p_round_number > 1 then
    for v_round in 1..(p_round_number - 1) loop
      v_match_count := v_event.bracket_capacity / power(2, v_round)::integer;
      for v_match in 1..v_match_count loop
      if v_round = 1 then
        select competitor_id into v_a from public.prediction_bracket_slots
        where event_id = p_event_id and bracket_revision = v_event.revision and slot_number = (v_match - 1) * 2 + 1;
        select competitor_id into v_b from public.prediction_bracket_slots
        where event_id = p_event_id and bracket_revision = v_event.revision and slot_number = (v_match - 1) * 2 + 2;
      else
        v_a := v_advancers ->> format('r%s-m%s', v_round - 1, (v_match - 1) * 2 + 1);
        v_b := v_advancers ->> format('r%s-m%s', v_round - 1, (v_match - 1) * 2 + 2);
      end if;
      if v_a is null or v_b is null then
        v_winner := coalesce(v_a, v_b);
      else
        select winner_id into v_winner from public.prediction_bracket_results
        where event_id = p_event_id and bracket_revision = v_event.revision
          and round_number = v_round and match_number = v_match;
        if v_winner is null then raise exception 'Record every feeder match winner first.' using errcode = '22023'; end if;
      end if;
      if v_winner is null then raise exception 'The published bracket contains an empty advancement path.' using errcode = '22023'; end if;
      v_advancers := jsonb_set(v_advancers, array[format('r%s-m%s', v_round, v_match)], to_jsonb(v_winner), true);
        v_a := null;
        v_b := null;
        v_winner := null;
      end loop;
    end loop;
  end if;

  if p_round_number = 1 then
    select competitor_id into v_a from public.prediction_bracket_slots
    where event_id = p_event_id and bracket_revision = v_event.revision and slot_number = (p_match_number - 1) * 2 + 1;
    select competitor_id into v_b from public.prediction_bracket_slots
    where event_id = p_event_id and bracket_revision = v_event.revision and slot_number = (p_match_number - 1) * 2 + 2;
  else
    v_a := v_advancers ->> format('r%s-m%s', p_round_number - 1, (p_match_number - 1) * 2 + 1);
    v_b := v_advancers ->> format('r%s-m%s', p_round_number - 1, (p_match_number - 1) * 2 + 2);
  end if;
  if v_a is null or v_b is null then raise exception 'A bye is automatic and has no result to record.' using errcode = '22023'; end if;
  if p_winner_id not in (v_a, v_b) then raise exception 'The winner must be one of this match''s players.' using errcode = '22023'; end if;

  select winner_id into v_existing from public.prediction_bracket_results
  where event_id = p_event_id and bracket_revision = v_event.revision
    and round_number = p_round_number and match_number = p_match_number;
  if v_existing = p_winner_id then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  if v_existing is not null then
    if p_round_number < v_round_count and exists (
      select 1 from public.prediction_bracket_results
      where event_id = p_event_id and bracket_revision = v_event.revision
        and round_number = p_round_number + 1 and match_number = ((p_match_number + 1) / 2)
    ) then raise exception 'Correct the downstream result before changing this winner.' using errcode = '22023'; end if;
    v_action := 'result_corrected';
  end if;

  insert into public.prediction_bracket_results (
    event_id, bracket_revision, round_number, match_number, winner_id, result_status, source_url, recorded_by
  ) values (
    p_event_id, v_event.revision, p_round_number, p_match_number, p_winner_id, 'provisional', p_source_url, p_recorded_by
  ) on conflict (event_id, bracket_revision, round_number, match_number) do update
    set winner_id = excluded.winner_id,
        result_status = 'provisional',
        source_url = excluded.source_url,
        recorded_by = excluded.recorded_by,
        updated_at = now();

  update public.prediction_bracket_events set status = 'scoring', updated_at = now() where event_id = p_event_id;
  insert into public.prediction_bracket_audit_log (event_id, bracket_revision, action, actor_user_id, source_url, details)
  values (p_event_id, v_event.revision, v_action, p_recorded_by, p_source_url,
    jsonb_build_object('round_number', p_round_number, 'match_number', p_match_number, 'winner_id', p_winner_id, 'previous_winner_id', v_existing));
  return jsonb_build_object('ok', true, 'status', 'scoring');
end;
$$;

create or replace function public.finalize_prediction_bracket(
  p_event_id text,
  p_official_source_url text,
  p_confirmation_text text,
  p_approved_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_result_count integer;
begin
  if p_confirmation_text <> 'FINALIZE OFFICIAL BRACKET' then raise exception 'Type the exact bracket finalization confirmation.' using errcode = '22023'; end if;
  if p_approved_by is null then raise exception 'An owner identity is required.' using errcode = '42501'; end if;
  if p_official_source_url is null or p_official_source_url !~ '^https://' then raise exception 'Use the official HTTPS result source.' using errcode = '22023'; end if;
  select * into v_event from public.prediction_bracket_events where event_id = p_event_id for update;
  if not found or v_event.revision = 0 then raise exception 'The official bracket is not published.' using errcode = '22023'; end if;
  if v_event.status = 'final' then return jsonb_build_object('ok', true, 'status', 'final'); end if;
  select count(*) into v_result_count from public.prediction_bracket_results
  where event_id = p_event_id and bracket_revision = v_event.revision;
  if v_result_count <> v_event.field_size - 1 then raise exception 'Record every played match winner before finalizing.' using errcode = '22023'; end if;
  update public.prediction_bracket_results
  set result_status = 'final', updated_at = now()
  where event_id = p_event_id and bracket_revision = v_event.revision;
  update public.prediction_bracket_events
  set status = 'final', finalized_at = now(), updated_at = now()
  where event_id = p_event_id;
  insert into public.prediction_bracket_audit_log (event_id, bracket_revision, action, actor_user_id, source_url, details)
  values (p_event_id, v_event.revision, 'finalized', p_approved_by, p_official_source_url, jsonb_build_object('result_count', v_result_count));
  return jsonb_build_object('ok', true, 'status', 'final', 'result_count', v_result_count);
end;
$$;

create or replace function public.get_prediction_bracket_hub(p_event_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_effective_status text;
  v_is_locked boolean;
  v_payload jsonb;
begin
  select * into v_event from public.prediction_bracket_events where event_id = p_event_id;
  if not found then return null; end if;
  if v_event.revision = 0 then v_effective_status := 'waiting_for_official_bracket';
  elsif v_event.status = 'final' then v_effective_status := 'final';
  elsif now() < v_event.opens_at then v_effective_status := 'scheduled';
  elsif now() < v_event.locks_at and v_event.status = 'open' then v_effective_status := 'open';
  elsif exists (
    select 1 from public.prediction_bracket_results result
    where result.event_id = p_event_id and result.bracket_revision = v_event.revision
  ) then v_effective_status := 'scoring';
  else v_effective_status := 'locked';
  end if;
  v_is_locked := v_effective_status <> 'open';

  with scored_entries as (
    select entry.*,
      coalesce((
        select sum(case when pick.value = result.winner_id
          then (v_event.round_points ->> result.round_number::text)::integer else 0 end)
        from jsonb_each_text(entry.picks) pick
        join public.prediction_bracket_results result
          on result.event_id = entry.event_id
         and result.bracket_revision = entry.bracket_revision
         and pick.key = format('r%s-m%s', result.round_number, result.match_number)
      ), 0)::integer as score
    from public.prediction_bracket_entries entry
    where entry.event_id = p_event_id and entry.bracket_revision = v_event.revision
  ), ranked as (
    select scored_entries.*,
      dense_rank() over (order by score desc)::integer as leaderboard_rank,
      row_number() over (order by score desc, lower(display_name), created_at)::integer as result_order
    from scored_entries
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'event_id', v_event.event_id,
      'display_name', v_event.display_name,
      'description', v_event.description,
      'official_info_url', v_event.official_info_url,
      'status', v_effective_status,
      'configured_status', v_event.status,
      'field_size', v_event.field_size,
      'bracket_capacity', v_event.bracket_capacity,
      'revision', v_event.revision,
      'opens_at', v_event.opens_at,
      'locks_at', v_event.locks_at,
      'official_bracket_url', v_event.official_bracket_url,
      'source_checked_at', v_event.source_checked_at,
      'round_points', v_event.round_points,
      'published_at', v_event.published_at,
      'finalized_at', v_event.finalized_at,
      'is_locked', v_is_locked
    ),
    'slots', coalesce((select jsonb_agg(jsonb_build_object(
      'slot_number', slot.slot_number,
      'competitor_id', slot.competitor_id,
      'display_name', slot.display_name,
      'country_code', slot.country_code,
      'source_seed', slot.source_seed
    ) order by slot.slot_number)
      from public.prediction_bracket_slots slot
      where slot.event_id = p_event_id and slot.bracket_revision = v_event.revision
    ), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(jsonb_build_object(
      'round_number', result.round_number,
      'match_number', result.match_number,
      'winner_id', result.winner_id,
      'result_status', result.result_status,
      'source_url', result.source_url,
      'updated_at', result.updated_at
    ) order by result.round_number, result.match_number)
      from public.prediction_bracket_results result
      where result.event_id = p_event_id and result.bracket_revision = v_event.revision
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

revoke all on function public.prediction_bracket_round_count(integer) from public, anon, authenticated, service_role;
revoke all on function public.publish_prediction_bracket(text, integer, timestamptz, timestamptz, text, timestamptz, jsonb, jsonb, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.save_prediction_bracket_entry(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.record_prediction_bracket_result(text, integer, integer, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finalize_prediction_bracket(text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_prediction_bracket_hub(text) from public, anon, authenticated, service_role;

grant execute on function public.get_prediction_bracket_hub(text) to anon, authenticated;
grant execute on function public.save_prediction_bracket_entry(text, jsonb) to authenticated;
grant execute on function public.publish_prediction_bracket(text, integer, timestamptz, timestamptz, text, timestamptz, jsonb, jsonb, uuid, text) to service_role;
grant execute on function public.record_prediction_bracket_result(text, integer, integer, text, text, uuid) to service_role;
grant execute on function public.finalize_prediction_bracket(text, text, text, uuid) to service_role;

do $$
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_events'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_slots'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_entries'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_results'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_audit_log'::regclass) then
    raise exception 'Prediction bracket tables must retain forced RLS';
  end if;
  if has_table_privilege('anon', 'public.prediction_bracket_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.prediction_bracket_entries', 'SELECT')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_hub(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_prediction_bracket_entry(text,jsonb)', 'EXECUTE') then
    raise exception 'Prediction bracket grants changed unexpectedly';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
