-- Build the reusable Worlds Meta Picks contract. All three 2026 events are
-- intentionally staged with empty option pools. A later reviewed migration
-- must seed each official pool and explicitly open its event.

begin;

do $preflight$
begin
  if to_regclass('public.worlds_meta_events') is not null
    or to_regclass('public.worlds_meta_options') is not null
    or to_regclass('public.worlds_meta_entries') is not null
    or to_regclass('public.worlds_meta_result_snapshots') is not null then
    raise exception 'Worlds Meta Picks tables already exist; review them before applying migration 378.';
  end if;
end;
$preflight$;

create table public.worlds_meta_events (
  id text primary key check (id ~ '^[a-z0-9-]{3,80}$'),
  display_name text not null check (char_length(btrim(display_name)) between 3 and 120),
  discipline text not null check (discipline in ('vgc', 'tcg', 'go')),
  prediction_type text not null check (prediction_type in ('champion_roster', 'deck_archetype')),
  status text not null default 'draft' check (status in ('draft', 'open', 'locked', 'scoring', 'final', 'cancelled')),
  picks_required integer not null check (picks_required between 1 and 12),
  result_size integer not null check (result_size between 1 and 64),
  requires_featured_pick boolean not null default false,
  opens_at timestamptz not null,
  locks_at timestamptz not null check (locks_at > opens_at),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  option_source_url text not null check (option_source_url ~ '^https://'),
  source_checked_at date not null,
  scoring_rules jsonb not null check (jsonb_typeof(scoring_rules) = 'object'),
  current_result_snapshot_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.worlds_meta_options (
  event_id text not null references public.worlds_meta_events(id) on delete restrict,
  option_key text not null check (option_key ~ '^[a-z0-9-]{2,100}$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  group_label text check (group_label is null or char_length(btrim(group_label)) between 2 and 100),
  is_selectable boolean not null default true,
  source_order integer not null check (source_order > 0),
  source_url text not null check (source_url ~ '^https://'),
  source_checked_at date not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (event_id, option_key),
  unique (event_id, source_order)
);

create table public.worlds_meta_entries (
  event_id text not null references public.worlds_meta_events(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  pick_keys text[] not null check (cardinality(pick_keys) between 1 and 12),
  featured_key text check (featured_key is null or featured_key = any(pick_keys)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.worlds_meta_result_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique references public.worlds_meta_events(id) on delete restrict,
  snapshot_status text not null check (snapshot_status = 'final'),
  official_source_url text not null check (official_source_url ~ '^https://'),
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, id)
);

alter table public.worlds_meta_events
  add constraint worlds_meta_events_current_result_fk
  foreign key (id, current_result_snapshot_id)
  references public.worlds_meta_result_snapshots(event_id, id)
  on delete restrict;

create index worlds_meta_entries_event_updated_idx
  on public.worlds_meta_entries(event_id, updated_at);

alter table public.worlds_meta_events enable row level security;
alter table public.worlds_meta_options enable row level security;
alter table public.worlds_meta_entries enable row level security;
alter table public.worlds_meta_result_snapshots enable row level security;

revoke all on table public.worlds_meta_events from public, anon, authenticated;
revoke all on table public.worlds_meta_options from public, anon, authenticated;
revoke all on table public.worlds_meta_entries from public, anon, authenticated;
revoke all on table public.worlds_meta_result_snapshots from public, anon, authenticated;

create or replace function public.prevent_worlds_meta_result_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Worlds Meta Picks final snapshots are immutable.' using errcode = '55000';
end;
$$;

create trigger worlds_meta_result_snapshots_immutable
before update or delete on public.worlds_meta_result_snapshots
for each row execute function public.prevent_worlds_meta_result_snapshot_mutation();

insert into public.worlds_meta_events (
  id, display_name, discipline, prediction_type, status, picks_required,
  result_size, requires_featured_pick, opens_at, locks_at, starts_at, ends_at,
  option_source_url, source_checked_at, scoring_rules
) values
  (
    '2026-vgc-champion-team',
    '2026 VGC Worlds Champion Team',
    'vgc',
    'champion_roster',
    'draft',
    6,
    6,
    false,
    '2026-08-12T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-31T07:00:00Z',
    'https://worlds.pokemon.com/en-us/',
    '2026-08-11',
    '{"method":"ranked_champion_roster","rank_points":[25,20,16,13,10,8],"exact_roster_bonus":8,"maximum_raw_score":100}'::jsonb
  ),
  (
    '2026-tcg-champion-decks',
    '2026 TCG Worlds Winning Decks',
    'tcg',
    'deck_archetype',
    'draft',
    5,
    64,
    true,
    '2026-08-12T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-31T07:00:00Z',
    'https://worlds.pokemon.com/en-us/',
    '2026-08-11',
    '{"method":"best_archetype_placement","placement_points":{"1":30,"2":20,"4":12,"8":7,"16":4,"32":2,"64":1},"featured_multiplier":2,"maximum_raw_score":111,"normalized_maximum":100}'::jsonb
  ),
  (
    '2026-go-champion-team',
    '2026 Pokemon GO Worlds Champion Team',
    'go',
    'champion_roster',
    'draft',
    6,
    6,
    false,
    '2026-08-12T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-31T07:00:00Z',
    'https://www.pokemon.com/us/play-pokemon/about/tournaments-rules-and-resources/',
    '2026-08-11',
    '{"method":"ranked_champion_roster","rank_points":[25,20,16,13,10,8],"exact_roster_bonus":8,"maximum_raw_score":100}'::jsonb
  );

create or replace function public.worlds_meta_placement_points(p_placement integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_placement = 1 then 30
    when p_placement = 2 then 20
    when p_placement between 3 and 4 then 12
    when p_placement between 5 and 8 then 7
    when p_placement between 9 and 16 then 4
    when p_placement between 17 and 32 then 2
    when p_placement between 33 and 64 then 1
    else 0
  end;
$$;

create or replace function public.score_worlds_meta_entry(
  p_event_id text,
  p_pick_keys text[],
  p_featured_key text
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.worlds_meta_events%rowtype;
  v_payload jsonb;
  v_raw numeric := 0;
  v_exact boolean := false;
begin
  select event.*
    into v_event
  from public.worlds_meta_events event
  join public.worlds_meta_result_snapshots snapshot
    on snapshot.id = event.current_result_snapshot_id
   and snapshot.event_id = event.id
   and snapshot.snapshot_status = 'final'
  where event.id = p_event_id;

  if not found or p_pick_keys is null then
    return 0;
  end if;

  select snapshot.result_payload
    into v_payload
  from public.worlds_meta_result_snapshots snapshot
  where snapshot.id = v_event.current_result_snapshot_id
    and snapshot.event_id = v_event.id
    and snapshot.snapshot_status = 'final';

  if v_event.prediction_type = 'champion_roster' then
    select coalesce(sum(
      case when v_payload -> 'winning_option_keys' ? ranked.option_key
        then coalesce((v_event.scoring_rules -> 'rank_points' ->> ((ranked.ordinality - 1)::integer))::numeric, 0)
        else 0
      end
    ), 0)
      into v_raw
    from unnest(p_pick_keys) with ordinality ranked(option_key, ordinality);

    select cardinality(p_pick_keys) = v_event.result_size
      and (select count(distinct winner.value) from jsonb_array_elements_text(v_payload -> 'winning_option_keys') winner(value)) = v_event.result_size
      and not exists (
        select 1 from unnest(p_pick_keys) selected(option_key)
        where not (v_payload -> 'winning_option_keys' ? selected.option_key)
      )
      into v_exact;

    if v_exact then
      v_raw := v_raw + coalesce((v_event.scoring_rules ->> 'exact_roster_bonus')::numeric, 0);
    end if;
  else
    select coalesce(sum(
      public.worlds_meta_placement_points((v_payload -> 'placements' ->> selected.option_key)::integer)
      * case when selected.option_key = p_featured_key
          then coalesce((v_event.scoring_rules ->> 'featured_multiplier')::integer, 2)
          else 1
        end
    ), 0)
      into v_raw
    from unnest(p_pick_keys) selected(option_key)
    where (v_payload -> 'placements' ->> selected.option_key) ~ '^[0-9]+$';
  end if;

  return least(coalesce((v_event.scoring_rules ->> 'maximum_raw_score')::numeric, 100), v_raw);
end;
$$;

create or replace function public.get_worlds_meta_hub(p_event_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with selected_event as (
    select event.*
    from public.worlds_meta_events event
    where event.id = p_event_id
  ),
  scored_entries as (
    select
      entry.*,
      public.score_worlds_meta_entry(entry.event_id, entry.pick_keys, entry.featured_key) as raw_score
    from public.worlds_meta_entries entry
    where entry.event_id = p_event_id
  ),
  ranked_entries as (
    select
      scored.*,
      round(least(100::numeric, scored.raw_score / nullif((event.scoring_rules ->> 'maximum_raw_score')::numeric, 0) * 100), 1) as score,
      dense_rank() over (order by scored.raw_score desc)::integer as leaderboard_rank,
      row_number() over (order by scored.raw_score desc, lower(scored.display_name), scored.created_at)::integer as result_order
    from scored_entries scored
    join selected_event event on event.id = scored.event_id
  )
  select case when not exists (select 1 from selected_event) then null else jsonb_build_object(
    'event', (
      select jsonb_build_object(
        'id', event.id,
        'display_name', event.display_name,
        'discipline', event.discipline,
        'prediction_type', event.prediction_type,
        'status', event.status,
        'picks_required', event.picks_required,
        'result_size', event.result_size,
        'requires_featured_pick', event.requires_featured_pick,
        'opens_at', event.opens_at,
        'locks_at', event.locks_at,
        'starts_at', event.starts_at,
        'ends_at', event.ends_at,
        'option_source_url', event.option_source_url,
        'source_checked_at', event.source_checked_at,
        'scoring_rules', event.scoring_rules,
        'is_locked', event.status <> 'open' or now() < event.opens_at or now() >= event.locks_at,
        'results_status', case when event.current_result_snapshot_id is null then 'waiting' else 'final' end
      )
      from selected_event event
    ),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'option_key', option.option_key,
        'display_name', option.display_name,
        'group_label', option.group_label,
        'is_selectable', option.is_selectable,
        'metadata', option.metadata
      ) order by option.source_order)
      from public.worlds_meta_options option
      where option.event_id = p_event_id
    ), '[]'::jsonb),
    'entry_count', (select count(*) from scored_entries),
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', ranked.leaderboard_rank,
        'display_name', ranked.display_name,
        'score', ranked.score,
        'is_me', ranked.user_id = auth.uid(),
        'picks', case
          when ranked.user_id = auth.uid() or now() >= (select locks_at from selected_event)
            then to_jsonb(ranked.pick_keys)
          else null
        end,
        'featured_key', case
          when ranked.user_id = auth.uid() or now() >= (select locks_at from selected_event)
            then ranked.featured_key
          else null
        end
      ) order by ranked.result_order)
      from ranked_entries ranked
      where ranked.result_order <= 100
    ), '[]'::jsonb),
    'my_entry', (
      select jsonb_build_object(
        'display_name', mine.display_name,
        'picks', mine.pick_keys,
        'featured_key', mine.featured_key,
        'score', mine.score,
        'rank', mine.leaderboard_rank,
        'created_at', mine.created_at,
        'updated_at', mine.updated_at
      )
      from ranked_entries mine
      where mine.user_id = auth.uid()
    )
  ) end
  from selected_event
  limit 1;
$$;

create or replace function public.save_worlds_meta_entry(
  p_event_id text,
  p_pick_keys text[],
  p_featured_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.worlds_meta_events%rowtype;
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_valid_pick_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to save a Worlds Meta Picks entry.' using errcode = '42501';
  end if;

  select * into v_event
  from public.worlds_meta_events
  where id = p_event_id;

  if not found then
    raise exception 'That Worlds Meta Picks competition was not found.' using errcode = 'P0002';
  end if;

  if v_event.status <> 'open' or now() < v_event.opens_at or now() >= v_event.locks_at then
    raise exception 'Entries for this Worlds Meta Picks competition are locked.' using errcode = '22023';
  end if;

  if p_pick_keys is null or cardinality(p_pick_keys) <> v_event.picks_required then
    raise exception 'Choose exactly % options.', v_event.picks_required using errcode = '22023';
  end if;

  if (select count(distinct option_key) from unnest(p_pick_keys) selected(option_key)) <> v_event.picks_required then
    raise exception 'Each option can be chosen only once.' using errcode = '22023';
  end if;

  if v_event.requires_featured_pick and (p_featured_key is null or not (p_featured_key = any(p_pick_keys))) then
    raise exception 'Choose the Champion Deck from your selected archetypes.' using errcode = '22023';
  end if;

  if not v_event.requires_featured_pick and p_featured_key is not null then
    raise exception 'This competition does not use a featured pick.' using errcode = '22023';
  end if;

  select count(*) into v_valid_pick_count
  from public.worlds_meta_options option
  where option.event_id = p_event_id
    and option.is_selectable
    and option.option_key = any(p_pick_keys);

  if v_valid_pick_count <> v_event.picks_required then
    raise exception 'One or more picks are not in the reviewed option pool.' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Trainer')
    into v_display_name
  from public.profiles profile
  where profile.id = v_user_id;

  v_display_name := case
    when char_length(coalesce(v_display_name, '')) between 2 and 60 then v_display_name
    else 'Trainer'
  end;

  insert into public.worlds_meta_entries (event_id, user_id, display_name, pick_keys, featured_key)
  values (p_event_id, v_user_id, v_display_name, p_pick_keys, p_featured_key)
  on conflict (event_id, user_id) do update
    set display_name = excluded.display_name,
        pick_keys = excluded.pick_keys,
        featured_key = excluded.featured_key,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'picks', p_pick_keys,
    'featured_key', p_featured_key,
    'display_name', v_display_name
  );
end;
$$;

create or replace function public.finalize_worlds_meta_result(
  p_event_id text,
  p_official_source_url text,
  p_result_payload jsonb,
  p_confirmation_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.worlds_meta_events%rowtype;
  v_snapshot_id uuid;
  v_result_count integer;
  v_valid_count integer;
  v_unlisted_champion text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required to finalize Worlds Meta Picks.' using errcode = '42501';
  end if;

  if p_confirmation_text <> 'FINALIZE WORLDS META' then
    raise exception 'The Worlds Meta Picks finalization confirmation did not match.' using errcode = '22023';
  end if;

  if p_official_source_url is null or p_official_source_url !~ '^https://' then
    raise exception 'An official HTTPS result source is required.' using errcode = '22023';
  end if;

  select * into v_event
  from public.worlds_meta_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'That Worlds Meta Picks competition was not found.' using errcode = 'P0002';
  end if;

  if v_event.status not in ('locked', 'scoring') or now() < v_event.locks_at then
    raise exception 'The event must be locked before finalization.' using errcode = '22023';
  end if;

  if v_event.current_result_snapshot_id is not null then
    raise exception 'A final reviewed result already exists for this event.' using errcode = '23505';
  end if;

  if jsonb_typeof(p_result_payload) <> 'object' then
    raise exception 'The result payload must be an object.' using errcode = '22023';
  end if;

  if v_event.prediction_type = 'champion_roster' then
    if jsonb_typeof(p_result_payload -> 'winning_option_keys') <> 'array' then
      raise exception 'A winning_option_keys array is required.' using errcode = '22023';
    end if;

    select count(*), count(distinct winner.value)
      into v_result_count, v_valid_count
    from jsonb_array_elements_text(p_result_payload -> 'winning_option_keys') winner(value);

    if v_result_count <> v_event.result_size or v_valid_count <> v_event.result_size then
      raise exception 'The winning roster must contain exactly % unique options.', v_event.result_size using errcode = '22023';
    end if;

    select count(*) into v_valid_count
    from public.worlds_meta_options option
    where option.event_id = p_event_id
      and option.is_selectable
      and option.option_key in (
        select winner.value from jsonb_array_elements_text(p_result_payload -> 'winning_option_keys') winner(value)
      );

    if v_valid_count <> v_event.result_size then
      raise exception 'The winning roster contains an option outside the reviewed pool.' using errcode = '22023';
    end if;
  else
    if jsonb_typeof(p_result_payload -> 'placements') <> 'object' then
      raise exception 'A placements object is required.' using errcode = '22023';
    end if;

    select count(*) into v_result_count
    from jsonb_each_text(p_result_payload -> 'placements') placement(option_key, place_value)
    where place_value ~ '^[0-9]+$'
      and place_value::integer between 1 and v_event.result_size;

    if v_result_count = 0
      or v_result_count <> (select count(*) from jsonb_object_keys(p_result_payload -> 'placements')) then
      raise exception 'Every deck placement must be an integer inside the published field.' using errcode = '22023';
    end if;

    v_unlisted_champion := nullif(btrim(p_result_payload ->> 'unlisted_champion'), '');
    if v_unlisted_champion is not null and char_length(v_unlisted_champion) not between 2 and 120 then
      raise exception 'An unlisted champion archetype must be between 2 and 120 characters.' using errcode = '22023';
    end if;

    select count(*) into v_valid_count
    from jsonb_each_text(p_result_payload -> 'placements') placement(option_key, place_value)
    where place_value = '1';

    if v_unlisted_champion is null and v_valid_count <> 1 then
      raise exception 'The reviewed deck results must include exactly one World Champion archetype.' using errcode = '22023';
    elsif v_unlisted_champion is not null and v_valid_count <> 0 then
      raise exception 'An unlisted World Champion cannot also assign first place to a reviewed archetype.' using errcode = '22023';
    end if;

    select count(*) into v_valid_count
    from jsonb_object_keys(p_result_payload -> 'placements') result(option_key)
    join public.worlds_meta_options option
      on option.event_id = p_event_id
     and option.option_key = result.option_key
     and option.is_selectable;

    if v_valid_count <> v_result_count then
      raise exception 'The deck results contain an archetype outside the reviewed pool.' using errcode = '22023';
    end if;
  end if;

  insert into public.worlds_meta_result_snapshots (
    event_id, snapshot_status, official_source_url, result_payload
  ) values (
    p_event_id, 'final', p_official_source_url, p_result_payload
  ) returning id into v_snapshot_id;

  update public.worlds_meta_events
  set current_result_snapshot_id = v_snapshot_id,
      status = 'final',
      updated_at = now()
  where id = p_event_id;

  return jsonb_build_object('ok', true, 'event_id', p_event_id, 'status', 'final');
end;
$$;

create or replace function public.get_worlds_meta_overall_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with final_events as (
    select event.*
    from public.worlds_meta_events event
    join public.worlds_meta_result_snapshots snapshot
      on snapshot.id = event.current_result_snapshot_id
     and snapshot.event_id = event.id
     and snapshot.snapshot_status = 'final'
    where event.status = 'final'
  ),
  final_count as (
    select count(*)::integer as discipline_count from final_events
  ),
  entrants as (
    select distinct entry.user_id
    from public.worlds_meta_entries entry
    join final_events event on event.id = entry.event_id
  ),
  discipline_scores as (
    select
      entrant.user_id,
      event.discipline,
      coalesce(round(least(100::numeric,
        public.score_worlds_meta_entry(entry.event_id, entry.pick_keys, entry.featured_key)
        / nullif((event.scoring_rules ->> 'maximum_raw_score')::numeric, 0) * 100
      ), 1), 0) as score,
      entry.display_name
    from entrants entrant
    cross join final_events event
    left join public.worlds_meta_entries entry
      on entry.event_id = event.id
     and entry.user_id = entrant.user_id
  ),
  totals as (
    select
      score.user_id,
      coalesce(max(score.display_name) filter (where score.display_name is not null), 'Trainer') as display_name,
      coalesce(max(score.score) filter (where score.discipline = 'vgc'), 0) as vgc_score,
      coalesce(max(score.score) filter (where score.discipline = 'tcg'), 0) as tcg_score,
      coalesce(max(score.score) filter (where score.discipline = 'go'), 0) as go_score,
      round(sum(score.score) / nullif((select discipline_count from final_count), 0), 1) as overall_score
    from discipline_scores score
    group by score.user_id
  ),
  ranked as (
    select
      totals.*,
      dense_rank() over (order by totals.overall_score desc)::integer as leaderboard_rank,
      row_number() over (order by totals.overall_score desc, lower(totals.display_name))::integer as result_order
    from totals
  )
  select jsonb_build_object(
    'is_open', (select discipline_count >= 2 from final_count),
    'final_discipline_count', (select discipline_count from final_count),
    'standings', case when (select discipline_count >= 2 from final_count) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', ranked.leaderboard_rank,
        'display_name', ranked.display_name,
        'overall_score', ranked.overall_score,
        'vgc_score', ranked.vgc_score,
        'tcg_score', ranked.tcg_score,
        'go_score', ranked.go_score,
        'is_me', ranked.user_id = auth.uid()
      ) order by ranked.result_order)
      from ranked
      where ranked.result_order <= 100
    ), '[]'::jsonb) else '[]'::jsonb end
  );
$$;

revoke all on function public.worlds_meta_placement_points(integer) from public, anon, authenticated;
revoke all on function public.prevent_worlds_meta_result_snapshot_mutation() from public, anon, authenticated;
revoke all on function public.score_worlds_meta_entry(text, text[], text) from public, anon, authenticated;
revoke all on function public.get_worlds_meta_hub(text) from public, anon, authenticated;
revoke all on function public.save_worlds_meta_entry(text, text[], text) from public, anon, authenticated;
revoke all on function public.finalize_worlds_meta_result(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.get_worlds_meta_overall_leaderboard() from public, anon, authenticated;

grant execute on function public.get_worlds_meta_hub(text) to anon, authenticated;
grant execute on function public.save_worlds_meta_entry(text, text[], text) to authenticated;
grant execute on function public.finalize_worlds_meta_result(text, text, jsonb, text) to service_role;
grant execute on function public.get_worlds_meta_overall_leaderboard() to anon, authenticated;

comment on table public.worlds_meta_events is
  'Fail-closed Worlds Meta Picks events. A reviewed option migration must seed and open each discipline.';
comment on table public.worlds_meta_result_snapshots is
  'Immutable, owner-reviewed final inputs for Worlds Meta Picks; no results automation writes here.';
comment on function public.get_worlds_meta_hub(text) is
  'Returns a privacy-aware Worlds Meta Picks event, reviewed option pool, entry, and leaderboard without user identifiers.';
comment on function public.finalize_worlds_meta_result(text, text, jsonb, text) is
  'Service-only manual finalization from an owner-reviewed official HTTPS source.';

commit;
