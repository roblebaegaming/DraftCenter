-- Keep every localized Worlds page on the same event while adding only the
-- bounded public coach fields needed by the shared leaderboard profile modal.

begin;

create or replace function public.get_worlds_pick_hub(p_event_id text default '2026-vgc-masters')
returns jsonb
language sql
stable
security definer
set search_path = ''
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
        'profile', coalesce((
          select jsonb_build_object(
            'username', profile.username,
            'display_name', coalesce(nullif(btrim(profile.display_name), ''), ranked.display_name),
            'avatar_url', profile.avatar_url,
            'favorite_pokemon', to_jsonb(coalesce(profile.favorite_pokemon[1:6], '{}'::text[])),
            'badges', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'code', catalog.code,
                  'name', catalog.name,
                  'description', catalog.description,
                  'icon', catalog.icon,
                  'subject', coalesce(progress.subject, ''),
                  'tier', progress.tier
                )
                order by progress.tier desc, catalog.name
              )
              from public.user_badge_progress progress
              join public.badge_catalog catalog on catalog.code = progress.badge_code
              where progress.user_id = ranked.user_id
                and progress.tier > 0
            ), '[]'::jsonb)
          )
          from public.profiles profile
          where profile.id = ranked.user_id
        ), jsonb_build_object(
          'username', null,
          'display_name', ranked.display_name,
          'avatar_url', null,
          'favorite_pokemon', '[]'::jsonb,
          'badges', '[]'::jsonb
        )),
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
  'Returns the shared private-aware Pick 10 hub, bounded public leaderboard profiles, and final average-finish tiebreakers.';

revoke all on function public.get_worlds_pick_hub(text) from public, anon, authenticated, service_role;
grant execute on function public.get_worlds_pick_hub(text) to anon, authenticated, service_role;

commit;
