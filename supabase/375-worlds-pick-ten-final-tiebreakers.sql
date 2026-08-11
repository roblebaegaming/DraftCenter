-- Rank finalized Pick 10 entries by score, then the average finish of the
-- entrant's six best finishers, then the average finish of all ten picks.
-- Provisional standings continue to rank on points alone. Exact final ties
-- share a rank, and finalization fails closed if a saved pick has no placement.

begin;

update public.worlds_pick_events
set scoring_rules = scoring_rules || jsonb_build_object(
      'tiebreakers', jsonb_build_array(
        jsonb_build_object(
          'key', 'top_six_average_finish',
          'label', 'Top 6 average finish',
          'direction', 'lowest'
        ),
        jsonb_build_object(
          'key', 'all_ten_average_finish',
          'label', 'All 10 average finish',
          'direction', 'lowest'
        )
      ),
      'no_valid_placing_tiebreaker', 'published_field_plus_one'
    ),
    updated_at = now()
where id in ('2026-vgc-masters', '2026-tcg-masters', '2026-pokemon-go')
  and entry_unit = 'individual'
  and picks_required = 10;

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
        select sum(competitor.score_points * case
          when selected.slug = entry.ace_slug
            then coalesce((event.scoring_rules ->> 'selection_multiplier')::integer, 2)
          else 1
        end)
        from unnest(entry.pick_slugs) selected(slug)
        join public.worlds_pick_competitors competitor
          on competitor.event_id = entry.event_id and competitor.slug = selected.slug
      ), 0)::integer as score
    from public.worlds_pick_entries entry
    join selected_event event on event.id = entry.event_id
    where entry.event_id = p_event_id
  ),
  final_pick_placements as (
    select
      entry.event_id,
      entry.user_id,
      event.picks_required,
      case
        when placement."placing" = 9999 then snapshot.row_count + 1
        else placement."placing"
      end::numeric as effective_placing,
      row_number() over (
        partition by entry.event_id, entry.user_id
        order by
          case when placement."placing" = 9999 then snapshot.row_count + 1 else placement."placing" end,
          selected.slug
      ) as finish_order
    from public.worlds_pick_entries entry
    join selected_event event on event.id = entry.event_id
    join public.worlds_result_sources source
      on source.event_id = entry.event_id
     and source.state = 'final'
     and source.current_snapshot_id is not null
    join public.worlds_result_snapshots snapshot
      on snapshot.id = source.current_snapshot_id
     and snapshot.event_id = source.event_id
     and snapshot.snapshot_kind in ('final', 'correction')
    cross join lateral unnest(entry.pick_slugs) selected(slug)
    join public.worlds_result_placements placement
      on placement.snapshot_id = snapshot.id
     and placement.event_id = entry.event_id
     and placement.competitor_slug = selected.slug
    where entry.event_id = p_event_id
  ),
  final_entry_tiebreakers as (
    select
      placement.event_id,
      placement.user_id,
      case when count(*) = max(placement.picks_required)
        then round(avg(placement.effective_placing) filter (where placement.finish_order <= 6), 2)
        else null
      end as top_six_average_finish,
      case when count(*) = max(placement.picks_required)
        then round(avg(placement.effective_placing), 2)
        else null
      end as all_ten_average_finish
    from final_pick_placements placement
    group by placement.event_id, placement.user_id
  ),
  ranked_entries as (
    select
      scored.*,
      tiebreak.top_six_average_finish,
      tiebreak.all_ten_average_finish,
      dense_rank() over (
        order by
          scored.score desc,
          tiebreak.top_six_average_finish asc nulls last,
          tiebreak.all_ten_average_finish asc nulls last
      )::integer as leaderboard_rank,
      row_number() over (
        order by
          scored.score desc,
          tiebreak.top_six_average_finish asc nulls last,
          tiebreak.all_ten_average_finish asc nulls last,
          lower(scored.display_name),
          scored.created_at
      )::integer as result_order
    from scored_entries scored
    left join final_entry_tiebreakers tiebreak
      on tiebreak.event_id = scored.event_id
     and tiebreak.user_id = scored.user_id
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
        'top_six_average_finish', ranked.top_six_average_finish,
        'all_ten_average_finish', ranked.all_ten_average_finish,
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
        'top_six_average_finish', mine.top_six_average_finish,
        'all_ten_average_finish', mine.all_ten_average_finish,
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

comment on function public.get_worlds_pick_hub(text) is
  'Returns the private-aware Pick 10 hub and applies final average-finish tiebreakers from the immutable approved result snapshot.';

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
  v_missing_selected_placements integer;
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

  select count(*)
  into v_missing_selected_placements
  from (
    select distinct selected.slug
    from public.worlds_pick_entries entry
    cross join lateral unnest(entry.pick_slugs) selected(slug)
    where entry.event_id = p_event_id
  ) selected_pick
  where not exists (
    select 1
    from public.worlds_result_placements placement
    where placement.snapshot_id = v_provisional.id
      and placement.event_id = p_event_id
      and placement.competitor_slug = selected_pick.slug
  );

  if v_missing_selected_placements > 0 then
    raise exception 'Final results are missing placements for one or more saved Pick 10 selections.' using errcode = '22023';
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
    "placing", score_points, match_alias_id, record
  )
  select
    v_final_snapshot_id, event_id, competitor_slug, source_name, source_country_code,
    "placing", score_points, match_alias_id, record
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

comment on function public.finalize_worlds_results(text, text, text, uuid) is
  'Copies a complete reviewed provisional snapshot into immutable final history; every saved Pick 10 selection must have a placement.';

revoke all on function public.get_worlds_pick_hub(text) from public, anon, authenticated;
grant execute on function public.get_worlds_pick_hub(text) to anon, authenticated;

revoke all on function public.finalize_worlds_results(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.finalize_worlds_results(text, text, text, uuid) to service_role;

commit;
