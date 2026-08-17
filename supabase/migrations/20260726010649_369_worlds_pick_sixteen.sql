begin;

create table if not exists public.worlds_pick_events (
  id text primary key check (id ~ '^[a-z0-9-]{3,64}$'),
  display_name text not null check (char_length(btrim(display_name)) between 3 and 100),
  division text not null check (division = 'Masters'),
  picks_required integer not null check (picks_required between 1 and 64),
  status text not null default 'open' check (status in ('draft', 'open', 'locked', 'scoring', 'final', 'cancelled')),
  opens_at timestamptz not null,
  locks_at timestamptz not null check (locks_at > opens_at),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  bracket_status text not null default 'waiting_for_official_bracket'
    check (bracket_status in ('waiting_for_official_bracket', 'open', 'locked', 'final')),
  roster_source_url text not null check (roster_source_url ~ '^https://'),
  roster_checked_at date not null,
  scoring_rules jsonb not null check (jsonb_typeof(scoring_rules) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worlds_pick_competitors (
  event_id text not null references public.worlds_pick_events(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9-]{2,100}$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  country_code text not null check (country_code ~ '^[A-Z]{3}$'),
  qualification_region text not null check (char_length(btrim(qualification_region)) between 2 and 80),
  qualification_path text not null check (char_length(btrim(qualification_path)) between 2 and 300),
  attendance_status text not null default 'invite_earned'
    check (attendance_status in ('invite_earned', 'confirmed', 'withdrawn', 'declined')),
  is_selectable boolean not null default true,
  result_label text,
  score_points integer not null default 0 check (score_points between 0 and 30),
  source_order integer not null check (source_order > 0),
  source_url text not null check (source_url ~ '^https://'),
  source_checked_at date not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, slug),
  unique (event_id, source_order)
);

create table if not exists public.worlds_pick_entries (
  event_id text not null references public.worlds_pick_events(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  pick_slugs text[] not null check (cardinality(pick_slugs) = 16),
  ace_slug text not null check (ace_slug = any(pick_slugs)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists worlds_pick_entries_event_updated_idx
  on public.worlds_pick_entries(event_id, updated_at);

alter table public.worlds_pick_events enable row level security;
alter table public.worlds_pick_competitors enable row level security;
alter table public.worlds_pick_entries enable row level security;

revoke all on table public.worlds_pick_events from public, anon, authenticated;
revoke all on table public.worlds_pick_competitors from public, anon, authenticated;
revoke all on table public.worlds_pick_entries from public, anon, authenticated;

insert into public.worlds_pick_events (
  id, display_name, division, picks_required, status, opens_at, locks_at, starts_at, ends_at,
  bracket_status, roster_source_url, roster_checked_at, scoring_rules
) values (
  '2026-vgc-masters',
  '2026 VGC Worlds Pick 16',
  'Masters',
  16,
  'open',
  '2026-08-10T07:00:00Z',
  '2026-08-28T07:00:00Z',
  '2026-08-28T07:00:00Z',
  '2026-08-31T07:00:00Z',
  'waiting_for_official_bracket',
  'https://victoryroad.pro/2026-worlds-invites/',
  '2026-08-10',
  '{"champion":30,"runner_up":20,"top_4":12,"top_8":7,"top_16":4,"top_32":2,"top_64":1,"ace_multiplier":2}'::jsonb
)
on conflict (id) do nothing;

create or replace function public.get_worlds_pick_hub(p_event_id text default '2026-vgc-masters')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with selected_event as (
    select e.*
    from public.worlds_pick_events e
    where e.id = p_event_id
  ),
  scored_entries as (
    select
      entry.event_id,
      entry.user_id,
      entry.display_name,
      entry.pick_slugs,
      entry.ace_slug,
      entry.created_at,
      entry.updated_at,
      coalesce((
        select sum(competitor.score_points * case when selected.slug = entry.ace_slug then 2 else 1 end)
        from unnest(entry.pick_slugs) selected(slug)
        join public.worlds_pick_competitors competitor
          on competitor.event_id = entry.event_id and competitor.slug = selected.slug
      ), 0)::integer as score
    from public.worlds_pick_entries entry
    where entry.event_id = p_event_id
  ),
  ranked_entries as (
    select
      scored.*,
      dense_rank() over (order by scored.score desc)::integer as leaderboard_rank,
      row_number() over (order by scored.score desc, lower(scored.display_name), scored.created_at)::integer as result_order
    from scored_entries scored
  )
  select case when not exists (select 1 from selected_event) then null else jsonb_build_object(
    'event', (
      select jsonb_build_object(
        'id', event.id,
        'display_name', event.display_name,
        'division', event.division,
        'picks_required', event.picks_required,
        'status', event.status,
        'opens_at', event.opens_at,
        'locks_at', event.locks_at,
        'starts_at', event.starts_at,
        'ends_at', event.ends_at,
        'bracket_status', event.bracket_status,
        'roster_source_url', event.roster_source_url,
        'roster_checked_at', event.roster_checked_at,
        'scoring_rules', event.scoring_rules,
        'is_locked', event.status <> 'open' or now() < event.opens_at or now() >= event.locks_at
      )
      from selected_event event
    ),
    'competitors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', competitor.slug,
        'display_name', competitor.display_name,
        'country_code', competitor.country_code,
        'qualification_region', competitor.qualification_region,
        'qualification_path', competitor.qualification_path,
        'attendance_status', competitor.attendance_status,
        'is_selectable', competitor.is_selectable,
        'result_label', competitor.result_label,
        'score_points', competitor.score_points
      ) order by competitor.source_order)
      from public.worlds_pick_competitors competitor
      where competitor.event_id = p_event_id
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
            then to_jsonb(ranked.pick_slugs)
          else null
        end,
        'ace_slug', case
          when ranked.user_id = auth.uid() or now() >= (select locks_at from selected_event)
            then ranked.ace_slug
          else null
        end
      ) order by ranked.result_order)
      from ranked_entries ranked
      where ranked.result_order <= 100
    ), '[]'::jsonb),
    'my_entry', (
      select jsonb_build_object(
        'display_name', mine.display_name,
        'picks', mine.pick_slugs,
        'ace_slug', mine.ace_slug,
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

create or replace function public.save_worlds_pick_entry(
  p_event_id text,
  p_pick_slugs text[],
  p_ace_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.worlds_pick_events%rowtype;
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_valid_pick_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to save a Worlds entry.' using errcode = '42501';
  end if;

  select * into v_event
  from public.worlds_pick_events
  where id = p_event_id;

  if not found then
    raise exception 'That Worlds competition was not found.' using errcode = 'P0002';
  end if;

  if v_event.status <> 'open' or now() < v_event.opens_at or now() >= v_event.locks_at then
    raise exception 'Entries for this Worlds competition are locked.' using errcode = '22023';
  end if;

  if v_event.division <> 'Masters' then
    raise exception 'Only Masters Division Worlds entries are supported.' using errcode = '22023';
  end if;

  if p_pick_slugs is null or cardinality(p_pick_slugs) <> v_event.picks_required then
    raise exception 'Choose exactly % competitors.', v_event.picks_required using errcode = '22023';
  end if;

  if (select count(distinct slug) from unnest(p_pick_slugs) selected(slug)) <> v_event.picks_required then
    raise exception 'Each competitor can be chosen only once.' using errcode = '22023';
  end if;

  if p_ace_slug is null or not (p_ace_slug = any(p_pick_slugs)) then
    raise exception 'Choose one Ace Pick from your 16 competitors.' using errcode = '22023';
  end if;

  select count(*) into v_valid_pick_count
  from public.worlds_pick_competitors competitor
  where competitor.event_id = p_event_id
    and competitor.is_selectable
    and competitor.attendance_status not in ('withdrawn', 'declined')
    and competitor.slug = any(p_pick_slugs);

  if v_valid_pick_count <> v_event.picks_required then
    raise exception 'One or more picks are not in the current selectable roster.' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Trainer')
    into v_display_name
  from public.profiles profile
  where profile.id = v_user_id;

  v_display_name := case
    when char_length(coalesce(v_display_name, '')) between 2 and 60 then v_display_name
    else 'Trainer'
  end;

  insert into public.worlds_pick_entries (event_id, user_id, display_name, pick_slugs, ace_slug)
  values (p_event_id, v_user_id, v_display_name, p_pick_slugs, p_ace_slug)
  on conflict (event_id, user_id) do update
    set display_name = excluded.display_name,
        pick_slugs = excluded.pick_slugs,
        ace_slug = excluded.ace_slug,
        updated_at = now();

  return jsonb_build_object('ok', true, 'picks', p_pick_slugs, 'ace_slug', p_ace_slug, 'display_name', v_display_name);
end;
$$;

revoke all on function public.get_worlds_pick_hub(text) from public, anon, authenticated;
revoke all on function public.save_worlds_pick_entry(text, text[], text) from public, anon, authenticated;
grant execute on function public.get_worlds_pick_hub(text) to anon, authenticated;
grant execute on function public.save_worlds_pick_entry(text, text[], text) to authenticated;

commit;
