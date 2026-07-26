-- A saved draft date must never look autonomous unless the hosted start job
-- is actually armed. This adds a configuration key/status API for the UI and
-- makes job registration update the public league date in the same transaction.

begin;

alter table public.scheduled_snake_draft_jobs
  add column if not exists preparation_key text;

create or replace function public.schedule_live_snake_draft_v3(
  p_league_id uuid,
  p_starts_at timestamptz,
  p_teams jsonb,
  p_pokemon jsonb,
  p_pick_order integer[],
  p_settings jsonb,
  p_keepers jsonb,
  p_started_state jsonb,
  p_preparation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only the commissioner can schedule this draft.';
  end if;
  if p_starts_at is null then
    raise exception 'Choose a scheduled draft time.';
  end if;
  if coalesce(p_settings ->> 'draftType', 'snake') <> 'snake' then
    raise exception 'Automatic scheduled starts currently require a snake draft.';
  end if;
  if jsonb_typeof(p_teams) <> 'array'
     or jsonb_array_length(p_teams) < 2
     or jsonb_typeof(p_pokemon) <> 'array'
     or jsonb_array_length(p_pokemon) < 1
     or coalesce(array_length(p_pick_order, 1), 0) < 1
     or jsonb_typeof(p_started_state) <> 'object' then
    raise exception 'Finish the draft setup before scheduling its automatic start.';
  end if;
  if nullif(btrim(coalesce(p_preparation_key, '')), '') is null then
    raise exception 'The scheduled draft configuration is missing its preparation key.';
  end if;
  if exists (
    select 1 from public.draft_sessions
    where league_id = p_league_id
      and status in ('active', 'paused', 'complete')
  ) then
    raise exception 'This league draft has already started.';
  end if;

  insert into public.scheduled_snake_draft_jobs (
    league_id, starts_at, commissioner_id, teams, pokemon, pick_order,
    settings, keepers, started_state, preparation_key,
    status, last_error, updated_at
  )
  values (
    p_league_id, p_starts_at, auth.uid(), p_teams, p_pokemon, p_pick_order,
    p_settings, coalesce(p_keepers, '{}'::jsonb), p_started_state,
    p_preparation_key, 'scheduled', null, now()
  )
  on conflict (league_id) do update
  set starts_at = excluded.starts_at,
      commissioner_id = excluded.commissioner_id,
      teams = excluded.teams,
      pokemon = excluded.pokemon,
      pick_order = excluded.pick_order,
      settings = excluded.settings,
      keepers = excluded.keepers,
      started_state = excluded.started_state,
      preparation_key = excluded.preparation_key,
      status = 'scheduled',
      last_error = null,
      updated_at = now();

  update public.leagues
  set draft_starts_at = p_starts_at,
      updated_at = now()
  where id = p_league_id;

  return jsonb_build_object(
    'status', 'scheduled',
    'starts_at', p_starts_at,
    'preparation_key', p_preparation_key
  );
end;
$$;

create or replace function public.get_scheduled_snake_draft_status(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_job public.scheduled_snake_draft_jobs;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;

  select *
  into v_job
  from public.scheduled_snake_draft_jobs
  where league_id = p_league_id;

  if v_job.league_id is null then
    return jsonb_build_object('status', 'missing');
  end if;

  return jsonb_build_object(
    'status', v_job.status,
    'starts_at', v_job.starts_at,
    'preparation_key', v_job.preparation_key,
    'last_error', v_job.last_error,
    'updated_at', v_job.updated_at
  );
end;
$$;

create or replace function public.cancel_scheduled_snake_draft(
  p_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled boolean;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only the commissioner can cancel this scheduled draft.';
  end if;

  update public.scheduled_snake_draft_jobs
  set status = 'cancelled', updated_at = now()
  where league_id = p_league_id
    and status in ('scheduled', 'failed');
  v_cancelled := found;

  update public.leagues
  set draft_starts_at = null,
      updated_at = now()
  where id = p_league_id
    and draft_starts_at is not null;

  return v_cancelled;
end;
$$;

revoke all on function public.schedule_live_snake_draft_v3(
  uuid, timestamptz, jsonb, jsonb, integer[], jsonb, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.schedule_live_snake_draft_v3(
  uuid, timestamptz, jsonb, jsonb, integer[], jsonb, jsonb, jsonb, text
) to authenticated;

revoke all on function public.get_scheduled_snake_draft_status(uuid)
  from public, anon, authenticated;
grant execute on function public.get_scheduled_snake_draft_status(uuid)
  to authenticated;

revoke all on function public.cancel_scheduled_snake_draft(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_scheduled_snake_draft(uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
