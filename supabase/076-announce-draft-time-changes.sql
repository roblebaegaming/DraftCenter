-- Announce newly set or changed draft times and rebuild future reminders.

begin;

create or replace function public.schedule_draft_reminders(p_league_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_name text;
  v_count integer := 0;
  v_rows integer := 0;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can schedule reminders.';
  end if;

  select draft_starts_at, name
  into v_start, v_name
  from public.leagues
  where id = p_league_id;

  if v_start is null then
    raise exception 'Set a draft date and time first.';
  end if;

  -- A changed draft time replaces all undelivered timed reminders.
  delete from public.notification_events
  where league_id = p_league_id
    and kind = 'draft_reminder'
    and sent_at is null;

  insert into public.notification_events (
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  select
    p_league_id,
    m.user_id,
    'draft_reminder',
    'email',
    'draft-email:' || p_league_id::text || ':' || extract(epoch from v_start)::bigint::text || ':' || reminder.hours_before::text || ':' || m.user_id::text,
    v_start - make_interval(hours => reminder.hours_before),
    jsonb_build_object(
      'subject', v_name || ' draft reminder',
      'league_name', v_name,
      'hours_before', reminder.hours_before,
      'draft_starts_at', v_start
    )
  from public.league_memberships m
  cross join (values (168), (24), (1)) as reminder(hours_before)
  where m.league_id = p_league_id
    and m.role in ('commissioner', 'co_commissioner', 'coach')
    and v_start - make_interval(hours => reminder.hours_before) > now()
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notification_events (
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  select
    p_league_id,
    null,
    'draft_reminder',
    'discord',
    'draft-discord:' || p_league_id::text || ':' || extract(epoch from v_start)::bigint::text || ':' || reminder.hours_before::text,
    v_start - make_interval(hours => reminder.hours_before),
    jsonb_build_object(
      'league_name', v_name,
      'hours_before', reminder.hours_before,
      'draft_starts_at', v_start
    )
  from (values (168), (24), (1)) as reminder(hours_before)
  where v_start - make_interval(hours => reminder.hours_before) > now()
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- One immediate league-channel announcement for each distinct scheduled time.
  insert into public.notification_events (
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  values (
    p_league_id,
    null,
    'draft_schedule_update',
    'discord',
    'draft-schedule-update:' || p_league_id::text || ':' || extract(epoch from v_start)::bigint::text,
    now(),
    jsonb_build_object(
      'league_name', v_name,
      'draft_starts_at', v_start
    )
  )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  return v_count;
end;
$$;

revoke all on function public.schedule_draft_reminders(uuid)
  from public, anon, authenticated;

grant execute on function public.schedule_draft_reminders(uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
