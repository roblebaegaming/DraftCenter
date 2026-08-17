-- Stage TCG Masters and Pokémon GO Pick 10 events without opening entries or
-- publishing a roster. Add a server-side overall leaderboard that remains
-- closed until at least two disciplines have final scores.

begin;

alter table public.worlds_pick_events
  add column discipline text;

alter table public.worlds_pick_events
  add column entry_unit text;

update public.worlds_pick_events
set discipline = 'vgc',
    entry_unit = 'individual'
where id = '2026-vgc-masters';

alter table public.worlds_pick_events
  alter column discipline set not null,
  alter column entry_unit set not null;

alter table public.worlds_pick_events
  add constraint worlds_pick_events_discipline_check
  check (discipline in ('vgc', 'tcg', 'go', 'unite'));

alter table public.worlds_pick_events
  add constraint worlds_pick_events_entry_unit_check
  check (entry_unit in ('individual', 'team'));

alter table public.worlds_pick_events
  drop constraint if exists worlds_pick_events_division_check;

alter table public.worlds_pick_events
  add constraint worlds_pick_events_division_check
  check (division in ('Masters', 'Open'));

alter table public.worlds_result_sources
  drop constraint if exists worlds_result_sources_division_check;

alter table public.worlds_result_sources
  add constraint worlds_result_sources_division_check
  check (division in ('Masters', 'Open'));

do $preflight$
begin
  if exists (
    select 1 from public.worlds_pick_events
    where id in ('2026-tcg-masters', '2026-pokemon-go')
  ) then
    raise exception 'A staged TCG or GO event already exists; review it before applying migration 374.';
  end if;

  if exists (
    select 1 from public.worlds_result_sources
    where event_id in ('2026-tcg-masters', '2026-pokemon-go')
  ) then
    raise exception 'A staged TCG or GO result source already exists; review it before applying migration 374.';
  end if;
end;
$preflight$;

insert into public.worlds_pick_events (
  id,
  display_name,
  discipline,
  entry_unit,
  division,
  picks_required,
  status,
  opens_at,
  locks_at,
  starts_at,
  ends_at,
  bracket_status,
  roster_source_url,
  roster_checked_at,
  scoring_rules
) values
  (
    '2026-tcg-masters',
    '2026 TCG Worlds Pick 10',
    'tcg',
    'individual',
    'Masters',
    10,
    'draft',
    '2026-08-10T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-31T07:00:00Z',
    'waiting_for_official_bracket',
    'https://www.pokemon.com/us/play-pokemon/leaderboards/tcg-masters/',
    '2026-08-10',
    '{"champion":30,"runner_up":20,"top_4":12,"top_8":7,"top_16":4,"top_32":2,"top_64":1,"maximum_raw_score":140,"selection_label":"Your Champion","selection_multiplier":2}'::jsonb
  ),
  (
    '2026-pokemon-go',
    '2026 Pokémon GO Worlds Pick 10',
    'go',
    'individual',
    'Open',
    10,
    'draft',
    '2026-08-10T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-28T07:00:00Z',
    '2026-08-31T07:00:00Z',
    'waiting_for_official_bracket',
    'https://worlds.pokemon.com/en-us/competitors/',
    '2026-08-10',
    '{"champion":30,"runner_up":20,"top_4":12,"top_8":7,"top_16":4,"top_32":2,"top_64":1,"maximum_raw_score":140,"selection_label":"Your Champion","selection_multiplier":2}'::jsonb
  );

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
  maximum_row_count,
  parser_version
) values
  (
    '2026-tcg-masters',
    'manual',
    'Masters',
    'Official Pokémon sources',
    'https://worlds.pokemon.com/en-us/competitors/',
    'pending',
    false,
    'disabled',
    300,
    '2026-08-28T07:00:00Z',
    '2026-08-31T12:00:00Z',
    1,
    600,
    'worlds-tcg-pending-v1'
  ),
  (
    '2026-pokemon-go',
    'manual',
    'Open',
    'Official Pokémon sources',
    'https://worlds.pokemon.com/en-us/competitors/',
    'pending',
    false,
    'disabled',
    300,
    '2026-08-28T07:00:00Z',
    '2026-08-31T12:00:00Z',
    1,
    300,
    'worlds-go-pending-v1'
  );

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

  if v_event.entry_unit <> 'individual' or v_event.division not in ('Masters', 'Open') then
    raise exception 'That Worlds competition does not use individual Pick 10 entries.' using errcode = '22023';
  end if;

  if p_pick_slugs is null or cardinality(p_pick_slugs) <> v_event.picks_required then
    raise exception 'Choose exactly % competitors.', v_event.picks_required using errcode = '22023';
  end if;

  if (select count(distinct slug) from unnest(p_pick_slugs) selected(slug)) <> v_event.picks_required then
    raise exception 'Each competitor can be chosen only once.' using errcode = '22023';
  end if;

  if p_ace_slug is null or not (p_ace_slug = any(p_pick_slugs)) then
    raise exception 'Choose Your Champion from your % selected competitors.', v_event.picks_required using errcode = '22023';
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

create or replace function public.get_worlds_overall_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with final_disciplines as (
    select
      event.id,
      event.discipline,
      (event.scoring_rules ->> 'maximum_raw_score')::numeric as maximum_raw_score
    from public.worlds_pick_events event
    where event.status = 'final'
      and event.entry_unit = 'individual'
      and event.discipline in ('vgc', 'tcg', 'go')
      and event.id in ('2026-vgc-masters', '2026-tcg-masters', '2026-pokemon-go')
      and coalesce((event.scoring_rules ->> 'maximum_raw_score')::numeric, 0) > 0
  ),
  scored_entries as (
    select
      entry.event_id,
      discipline.discipline,
      entry.user_id,
      entry.display_name,
      discipline.maximum_raw_score,
      coalesce(sum(
        competitor.score_points * case
          when selected.slug = entry.ace_slug then coalesce((event.scoring_rules ->> 'selection_multiplier')::integer, 2)
          else 1
        end
      ), 0)::numeric as raw_score
    from public.worlds_pick_entries entry
    join final_disciplines discipline on discipline.id = entry.event_id
    join public.worlds_pick_events event on event.id = entry.event_id
    left join lateral unnest(entry.pick_slugs) selected(slug) on true
    left join public.worlds_pick_competitors competitor
      on competitor.event_id = entry.event_id and competitor.slug = selected.slug
    group by entry.event_id, discipline.discipline, entry.user_id, entry.display_name, discipline.maximum_raw_score
  ),
  normalized_entries as (
    select
      scored.user_id,
      scored.display_name,
      scored.discipline,
      round(least(100::numeric, (scored.raw_score / scored.maximum_raw_score) * 100::numeric), 1) as overall_points
    from scored_entries scored
  ),
  user_totals as (
    select
      normalized.user_id,
      max(normalized.display_name) as display_name,
      round(sum(normalized.overall_points), 1) as overall_points,
      jsonb_object_agg(normalized.discipline, normalized.overall_points order by normalized.discipline) as discipline_points
    from normalized_entries normalized
    group by normalized.user_id
  ),
  ranked as (
    select
      total.*,
      dense_rank() over (order by total.overall_points desc)::integer as leaderboard_rank,
      row_number() over (order by total.overall_points desc, lower(total.display_name), total.user_id)::integer as result_order
    from user_totals total
  ),
  readiness as (
    select count(*)::integer as discipline_count from final_disciplines
  )
  select jsonb_build_object(
    'is_open', readiness.discipline_count >= 2,
    'discipline_count', readiness.discipline_count,
    'disciplines', coalesce((select jsonb_agg(discipline order by discipline) from final_disciplines), '[]'::jsonb),
    'standings', case when readiness.discipline_count < 2 then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', ranked.leaderboard_rank,
        'display_name', ranked.display_name,
        'overall_points', ranked.overall_points,
        'discipline_points', ranked.discipline_points,
        'is_me', ranked.user_id = auth.uid()
      ) order by ranked.result_order)
      from ranked
      where ranked.result_order <= 100
    ), '[]'::jsonb) end
  )
  from readiness;
$$;

comment on function public.get_worlds_overall_leaderboard() is
  'Returns a privacy-safe normalized leaderboard only after two individual Worlds disciplines are final.';

revoke all on function public.save_worlds_pick_entry(text, text[], text) from public, anon, authenticated;
grant execute on function public.save_worlds_pick_entry(text, text[], text) to authenticated;

revoke all on function public.get_worlds_overall_leaderboard() from public, anon, authenticated;
grant execute on function public.get_worlds_overall_leaderboard() to anon, authenticated;

commit;
