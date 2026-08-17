-- Permanent prediction-bracket directory and privacy-gated durable entrant URLs.
begin;

alter table public.prediction_bracket_entries
  add column if not exists public_id uuid;

update public.prediction_bracket_entries
set public_id = gen_random_uuid()
where public_id is null;

alter table public.prediction_bracket_entries
  alter column public_id set default gen_random_uuid(),
  alter column public_id set not null;

create unique index if not exists prediction_bracket_entries_public_id_idx
  on public.prediction_bracket_entries(public_id);

comment on column public.prediction_bracket_entries.public_id is
  'Opaque durable identifier for a public bracket URL. It never replaces or exposes the owner user_id.';

create or replace function public.get_prediction_bracket_directory()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with directory_events as (
    select
      event.*,
      case
        when event.revision = 0 then 'waiting_for_official_bracket'
        when event.status = 'final' then 'final'
        when now() < event.opens_at then 'scheduled'
        when now() < event.locks_at and event.status = 'open' then 'open'
        when exists (
          select 1
          from public.prediction_bracket_results result
          where result.event_id = event.event_id
            and result.bracket_revision = event.revision
        ) then 'scoring'
        else 'locked'
      end as effective_status,
      (
        select count(*)::integer
        from public.prediction_bracket_entries entry
        where entry.event_id = event.event_id
          and entry.bracket_revision = event.revision
      ) as entry_count
    from public.prediction_bracket_events event
    where event.status <> 'cancelled'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event.event_id,
    'display_name', event.display_name,
    'description', event.description,
    'official_info_url', event.official_info_url,
    'status', event.effective_status,
    'field_size', event.field_size,
    'entry_count', event.entry_count,
    'opens_at', event.opens_at,
    'locks_at', event.locks_at,
    'published_at', event.published_at,
    'finalized_at', event.finalized_at
  ) order by coalesce(event.finalized_at, event.locks_at, event.published_at, event.updated_at) desc), '[]'::jsonb)
  from directory_events event;
$$;

create or replace function public.get_prediction_bracket_public_entry(
  p_event_id text,
  p_public_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_effective_status text;
  v_payload jsonb;
begin
  if p_public_id is null then return null; end if;

  select *
  into v_event
  from public.prediction_bracket_events
  where event_id = p_event_id;

  if not found or v_event.status = 'cancelled' then return null; end if;

  if v_event.revision = 0 then v_effective_status := 'waiting_for_official_bracket';
  elsif v_event.status = 'final' then v_effective_status := 'final';
  elsif now() < v_event.opens_at then v_effective_status := 'scheduled';
  elsif now() < v_event.locks_at and v_event.status = 'open' then v_effective_status := 'open';
  elsif exists (
    select 1
    from public.prediction_bracket_results result
    where result.event_id = p_event_id
      and result.bracket_revision = v_event.revision
  ) then v_effective_status := 'scoring';
  else v_effective_status := 'locked';
  end if;

  if v_effective_status in ('waiting_for_official_bracket', 'scheduled', 'open') then
    return null;
  end if;

  with scored_entries as (
    select
      entry.public_id,
      entry.display_name,
      entry.picks,
      entry.created_at,
      coalesce((
        select sum(case
          when pick.value = result.winner_id
          then (v_event.round_points ->> result.round_number::text)::integer
          else 0
        end)
        from jsonb_each_text(entry.picks) pick
        join public.prediction_bracket_results result
          on result.event_id = entry.event_id
         and result.bracket_revision = entry.bracket_revision
         and pick.key = format('r%s-m%s', result.round_number, result.match_number)
      ), 0)::integer as score
    from public.prediction_bracket_entries entry
    where entry.event_id = p_event_id
      and entry.bracket_revision = v_event.revision
  ), ranked as (
    select
      scored.*,
      dense_rank() over (order by scored.score desc)::integer as leaderboard_rank
    from scored_entries scored
  ), selected_entry as (
    select *
    from ranked
    where public_id = p_public_id
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'event_id', v_event.event_id,
      'display_name', v_event.display_name,
      'description', v_event.description,
      'official_info_url', v_event.official_info_url,
      'status', v_effective_status,
      'field_size', v_event.field_size,
      'bracket_capacity', v_event.bracket_capacity,
      'revision', v_event.revision,
      'round_points', v_event.round_points,
      'locks_at', v_event.locks_at,
      'finalized_at', v_event.finalized_at
    ),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot_number', slot.slot_number,
        'competitor_id', slot.competitor_id,
        'display_name', slot.display_name,
        'country_code', slot.country_code,
        'source_seed', slot.source_seed
      ) order by slot.slot_number)
      from public.prediction_bracket_slots slot
      where slot.event_id = p_event_id
        and slot.bracket_revision = v_event.revision
    ), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'round_number', result.round_number,
        'match_number', result.match_number,
        'winner_id', result.winner_id,
        'result_status', result.result_status,
        'updated_at', result.updated_at
      ) order by result.round_number, result.match_number)
      from public.prediction_bracket_results result
      where result.event_id = p_event_id
        and result.bracket_revision = v_event.revision
    ), '[]'::jsonb),
    'entry', jsonb_build_object(
      'entry_id', selected.public_id,
      'display_name', selected.display_name,
      'picks', selected.picks,
      'score', selected.score,
      'rank', selected.leaderboard_rank
    )
  )
  into v_payload
  from selected_entry selected;

  return v_payload;
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
  v_is_locked := v_effective_status in ('locked', 'scoring', 'final');

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
      'entry_id', case when ranked.user_id = auth.uid() or v_is_locked then ranked.public_id else null end,
      'display_name', ranked.display_name,
      'score', ranked.score,
      'is_me', ranked.user_id = auth.uid(),
      'picks', case when ranked.user_id = auth.uid() or v_is_locked then ranked.picks else null end
    ) order by ranked.result_order)
      from ranked where ranked.result_order <= 100
    ), '[]'::jsonb),
    'my_entry', (select jsonb_build_object(
      'entry_id', mine.public_id,
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

revoke all on function public.get_prediction_bracket_directory() from public, anon, authenticated, service_role;
revoke all on function public.get_prediction_bracket_public_entry(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_prediction_bracket_hub(text) from public, anon, authenticated, service_role;
grant execute on function public.get_prediction_bracket_directory() to anon, authenticated;
grant execute on function public.get_prediction_bracket_public_entry(text, uuid) to anon, authenticated;
grant execute on function public.get_prediction_bracket_hub(text) to anon, authenticated;

comment on function public.get_prediction_bracket_directory() is
  'Lists public bracket events and aggregate entry counts without entrant identities or picks.';
comment on function public.get_prediction_bracket_public_entry(text, uuid) is
  'Returns one opaque-id bracket only after entries lock, without exposing its owner user_id.';

do $validation$
begin
  if has_table_privilege('anon', 'public.prediction_bracket_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.prediction_bracket_entries', 'SELECT')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_directory()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_directory()', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_public_entry(text,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_public_entry(text,uuid)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_hub(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_hub(text)', 'EXECUTE') then
    raise exception 'Prediction bracket directory grants would weaken the private entry boundary.';
  end if;
end;
$validation$;

notify pgrst, 'reload schema';
commit;
