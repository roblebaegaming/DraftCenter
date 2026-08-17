-- Normalize functions that were hotfixed in Production but displaced from the root-level SQL history.
begin;

CREATE OR REPLACE FUNCTION public.accept_match_schedule(p_schedule_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_schedule public.league_match_schedules;
  v_state jsonb;
  v_users uuid[];
begin
  select * into v_schedule from public.league_match_schedules where id = p_schedule_id for update;
  select state into v_state from public.league_state_snapshots where league_id = v_schedule.league_id;
  v_users := public.match_schedule_participant_users(v_state, v_schedule.week_index, v_schedule.match_index);
  if v_schedule.status <> 'proposed' or not auth.uid() = any(v_users)
     or auth.uid() = v_schedule.proposed_by then
    raise exception 'Only the opposing manager can accept this proposal.';
  end if;
  update public.league_match_schedules set status = 'confirmed',
    accepted_by = auth.uid(), confirmed_at = now(), cancelled_at = null, updated_at = now()
  where id = p_schedule_id returning * into v_schedule;
  perform public.enqueue_match_schedule_reminders(v_schedule.id);
  return public.get_my_match_schedule(
    v_schedule.league_id, v_schedule.season_number, v_schedule.week_index, v_schedule.match_index
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_match_schedule(p_schedule_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_schedule public.league_match_schedules;
  v_state jsonb;
  v_users uuid[];
  v_staff boolean;
begin
  select * into v_schedule from public.league_match_schedules where id = p_schedule_id for update;
  select state into v_state from public.league_state_snapshots where league_id = v_schedule.league_id;
  v_users := public.match_schedule_participant_users(v_state, v_schedule.week_index, v_schedule.match_index);
  v_staff := public.is_league_staff(v_schedule.league_id) and not auth.uid() = any(v_users);
  if not (auth.uid() = any(v_users) or v_staff) then
    raise exception 'Only scheduled managers and league staff can cancel this time.';
  end if;
  if v_staff and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'League staff must add a cancellation reason.';
  end if;
  perform public.clear_unsent_match_reminders(v_schedule.id);
  update public.league_match_schedules set status = 'cancelled',
    staff_override_by = case when v_staff then auth.uid() else null end,
    staff_override_reason = case when v_staff then btrim(p_reason) else null end,
    revision = revision + 1, cancelled_at = now(), updated_at = now()
  where id = p_schedule_id returning * into v_schedule;
  return public.get_my_match_schedule(
    v_schedule.league_id, v_schedule.season_number, v_schedule.week_index, v_schedule.match_index
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.capture_league_recovery_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ begin
 if old.state is distinct from new.state and not exists (
  select 1 from public.league_recovery_snapshots r where r.league_id=old.league_id and r.created_at>now()-interval '6 hours'
 ) then
  insert into public.league_recovery_snapshots(league_id,revision,state,source) values(old.league_id,old.revision,old.state,'automatic');
  delete from public.league_recovery_snapshots where league_id=old.league_id and created_at<now()-interval '30 days';
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.claim_league_notification_events(p_claim_token uuid, p_league_id uuid, p_limit integer DEFAULT 50)
 RETURNS SETOF notification_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if p_claim_token is null or p_league_id is null then raise exception 'A claim token and league are required.'; end if;
 return query with candidates as (
  select event.id from public.notification_events event
  where event.league_id=p_league_id and event.sent_at is null and event.failed_at is null
   and coalesce(event.next_attempt_at,event.scheduled_for)<=now()
   and (event.claimed_at is null or event.claimed_at<now()-interval '15 minutes')
  order by coalesce(event.next_attempt_at,event.scheduled_for),event.created_at
  for update skip locked limit greatest(1,least(coalesce(p_limit,50),50))
 ) update public.notification_events event set claimed_at=now(),claim_token=p_claim_token,attempt_count=event.attempt_count+1
 from candidates where event.id=candidates.id returning event.*;
end; $function$;

CREATE OR REPLACE FUNCTION public.claim_twitch_eventsub_message(p_message_id text, p_message_type text, p_broadcaster_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if nullif(trim(p_message_id),'') is null then return false; end if;
 delete from public.twitch_eventsub_messages where received_at<now()-interval '24 hours';
 insert into public.twitch_eventsub_messages(message_id,message_type,broadcaster_id) values(left(p_message_id,255),left(coalesce(p_message_type,'unknown'),100),left(p_broadcaster_id,255)) on conflict(message_id) do nothing;
 return found;
end; $function$;

CREATE OR REPLACE FUNCTION public.claim_vacant_league_commissioner(p_league_id uuid)
 RETURNS league_memberships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_membership public.league_memberships;
  v_league public.leagues;
  v_identity text;
  v_state jsonb;
  v_claimed_at timestamptz := clock_timestamp();
  v_claimed_at_ms bigint;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to claim commissioner.';
  end if;

  select *
    into v_league
    from public.leagues
    where id = p_league_id
    for update;

  if v_league.id is null then
    raise exception 'League not found.';
  end if;

  select *
    into v_membership
    from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
    for update;

  if v_membership.id is null then
    raise exception 'You must already be a league member to claim commissioner.';
  end if;

  if v_membership.role = 'viewer' then
    raise exception 'Spectators cannot claim commissioner.';
  end if;

  if exists (
    select 1
    from public.league_memberships
    where league_id = p_league_id
      and role = 'commissioner'
  ) then
    raise exception 'This league already has a commissioner.';
  end if;

  update public.league_memberships
    set role = 'commissioner'
    where id = v_membership.id
    returning * into v_membership;

  select coalesce(
    nullif(btrim(display_name), ''),
    nullif(btrim(username), ''),
    'Commissioner'
  )
    into v_identity
    from public.profiles
    where id = auth.uid();
  v_identity := coalesce(v_identity, 'Commissioner');
  v_claimed_at_ms := floor(extract(epoch from v_claimed_at) * 1000)::bigint;

  select state
    into v_state
    from public.league_state_snapshots
    where league_id = p_league_id
    for update;

  if v_state is not null then
    v_state := jsonb_set(v_state, '{commissioner}', to_jsonb(v_identity), true);
    v_state := jsonb_set(
      v_state,
      '{auditLog}',
      coalesce(v_state -> 'auditLog', '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'id', 'commissioner-claim-' || v_membership.id::text || '-' || v_claimed_at_ms::text,
          'ts', v_claimed_at_ms,
          'actor', v_identity,
          'action', 'Claimed vacant hosted league commissioner role',
          'detail', ''
        )
      ),
      true
    );

    update public.league_state_snapshots
      set state = v_state,
          revision = revision + 1,
          updated_at = now()
      where league_id = p_league_id;
  end if;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'commissioner_claimed',
    auth.uid(),
    jsonb_build_object('membership_id', v_membership.id)
  );

  return v_membership;
end;
$function$;

CREATE OR REPLACE FUNCTION public.clear_unsent_match_reminders(p_schedule_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.notification_events
  where sent_at is null and kind = 'match_reminder'
    and payload ->> 'match_schedule_id' = p_schedule_id::text
$function$;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_scope_key text, p_limit integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.api_rate_limits%rowtype;
begin
 if nullif(trim(p_scope_key),'') is null or p_limit<1 or p_window_seconds<1 then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_scope_key,0));
 select * into v_row from public.api_rate_limits where scope_key=p_scope_key for update;
 if not found then insert into public.api_rate_limits(scope_key,window_started_at,request_count) values(left(p_scope_key,128),now(),1); return true; end if;
 if v_row.window_started_at<=now()-make_interval(secs=>p_window_seconds) then update public.api_rate_limits set window_started_at=now(),request_count=1,updated_at=now() where scope_key=p_scope_key; return true; end if;
 if v_row.request_count>=p_limit then return false; end if;
 update public.api_rate_limits set request_count=request_count+1,updated_at=now() where scope_key=p_scope_key; return true;
end; $function$;

CREATE OR REPLACE FUNCTION public.create_operational_smoke_test(p_league_id uuid, p_release text DEFAULT NULL::text, p_route text DEFAULT 'league'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event public.operational_health_events;
  v_role text;
  v_correlation_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Join this league before creating a monitoring test.';
  end if;
  if (
    select count(*)
    from public.operational_health_events
    where actor_id = auth.uid()
      and kind = 'monitoring_test'
      and occurred_at > now() - interval '15 minutes'
  ) >= 3 then
    raise exception 'Wait before creating another monitoring test.';
  end if;
  select m.role::text into v_role
    from public.league_memberships m
    where m.league_id = p_league_id and m.user_id = auth.uid()
    limit 1;
  insert into public.operational_health_events(actor_id, league_id, kind, message, context)
  values (
    auth.uid(),
    p_league_id,
    'monitoring_test',
    'Deliberate monitoring test; no product error occurred.',
    jsonb_build_object(
      'action', 'monitoring_test',
      'correlation_id', v_correlation_id::text,
      'release', left(coalesce(nullif(btrim(p_release), ''), 'unknown'), 120),
      'role', v_role,
      'route', left(coalesce(nullif(btrim(p_route), ''), 'league'), 160)
    )
  )
  returning * into v_event;
  return jsonb_build_object(
    'id', v_event.id,
    'occurred_at', v_event.occurred_at,
    'correlation_id', v_correlation_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_match_schedule_reminders(p_schedule_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_schedule public.league_match_schedules;
  v_state jsonb;
  v_user uuid;
  v_offset integer;
  v_count integer := 0;
  v_offsets integer[];
  v_league_name text;
begin
  select * into v_schedule from public.league_match_schedules where id = p_schedule_id;
  if v_schedule.id is null or v_schedule.status <> 'confirmed' then return 0; end if;
  select state into v_state from public.league_state_snapshots where league_id = v_schedule.league_id;
  select name into v_league_name from public.leagues where id = v_schedule.league_id;
  perform public.clear_unsent_match_reminders(v_schedule.id);

  foreach v_user in array public.match_schedule_participant_users(
    v_state, v_schedule.week_index, v_schedule.match_index
  )
  loop
    select case when coalesce(enabled, true)
      then coalesce(offsets_minutes, array[1440, 60]) else array[]::integer[] end
    into v_offsets from public.match_reminder_preferences where user_id = v_user;
    if not found then v_offsets := array[1440, 60]; end if;
    foreach v_offset in array v_offsets
    loop
      if v_schedule.scheduled_at - make_interval(mins => v_offset) > now() then
        insert into public.notification_events (
          league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
        ) values (
          v_schedule.league_id, v_user, 'match_reminder', 'discord_dm',
          format('match-schedule:%s:rev:%s:user:%s:offset:%s',
            v_schedule.id, v_schedule.revision, v_user, v_offset),
          v_schedule.scheduled_at - make_interval(mins => v_offset),
          jsonb_build_object(
            'match_schedule_id', v_schedule.id,
            'schedule_revision', v_schedule.revision,
            'scheduled_at', v_schedule.scheduled_at,
            'hours_before', v_offset / 60,
            'league_name', coalesce(v_league_name, 'DraftCenter'),
            'title', format('%s match', coalesce(v_league_name, 'DraftCenter'))
          )
        ) on conflict (dedupe_key) do nothing;
        if found then v_count := v_count + 1; end if;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.export_league_match_schedule_recovery(p_league_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can export match scheduling recovery data.';
  end if;
  return jsonb_build_object(
    'schema_version', 1,
    'exported_at', now(),
    'league_id', p_league_id,
    'schedules', coalesce((
      select jsonb_agg(to_jsonb(schedule) order by schedule.week_index, schedule.match_index)
      from public.league_match_schedules schedule
      where schedule.league_id = p_league_id
    ), '[]'::jsonb),
    'preferences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', preference.user_id,
        'enabled', preference.enabled,
        'offsets_minutes', preference.offsets_minutes,
        'updated_at', preference.updated_at
      ) order by preference.user_id)
      from public.match_reminder_preferences preference
      where preference.user_id in (
        select distinct user_id
        from public.league_match_schedules schedule
        join public.league_state_snapshots snapshot on snapshot.league_id = schedule.league_id
        cross join lateral unnest(public.match_schedule_participant_users(
          snapshot.state, schedule.week_index, schedule.match_index
        )) user_id
        where schedule.league_id = p_league_id
      )
    ), '[]'::jsonb),
    'reminder_jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'user_id', event.user_id,
        'dedupe_key', event.dedupe_key,
        'scheduled_for', event.scheduled_for,
        'sent_at', event.sent_at,
        'failed_at', event.failed_at,
        'attempt_count', event.attempt_count,
        'match_schedule_id', event.payload ->> 'match_schedule_id',
        'schedule_revision', event.payload ->> 'schedule_revision'
      ) order by event.scheduled_for)
      from public.notification_events event
      where event.league_id = p_league_id and event.kind = 'match_reminder'
        and event.payload ? 'match_schedule_id'
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_match_availability(p_league_id uuid, p_season_number integer, p_week integer, p_match integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_actor_team integer;
  v_pair jsonb;
  v_other_team integer;
  v_other_user uuid;
  v_own jsonb;
  v_mutual jsonb;
begin
  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id;

  v_actor_team := public.match_availability_actor_team(
    p_league_id, v_state, p_week, p_match
  );
  if v_actor_team is null then
    raise exception 'Only the two scheduled managers can coordinate this match.';
  end if;

  v_pair := v_state #> array['schedule', p_week::text, p_match::text];
  v_other_team := case
    when (v_pair ->> 0)::integer = v_actor_team then (v_pair ->> 1)::integer
    else (v_pair ->> 0)::integer
  end;
  v_other_user := public.match_availability_team_user(
    p_league_id, v_state, v_other_team
  );

  select coalesce(jsonb_agg(
    jsonb_build_object('id', id, 'starts_at', starts_at, 'ends_at', ends_at)
    order by starts_at
  ), '[]'::jsonb)
  into v_own
  from public.league_match_availability
  where league_id = p_league_id
    and season_number = p_season_number
    and week_index = p_week
    and match_index = p_match
    and user_id = auth.uid();

  select coalesce(jsonb_agg(
    jsonb_build_object('starts_at', overlap_start, 'ends_at', overlap_end)
    order by overlap_start
  ), '[]'::jsonb)
  into v_mutual
  from (
    select distinct
      greatest(mine.starts_at, theirs.starts_at) as overlap_start,
      least(mine.ends_at, theirs.ends_at) as overlap_end
    from public.league_match_availability mine
    join public.league_match_availability theirs
      on theirs.league_id = mine.league_id
      and theirs.season_number = mine.season_number
      and theirs.week_index = mine.week_index
      and theirs.match_index = mine.match_index
      and theirs.user_id = v_other_user
      and greatest(mine.starts_at, theirs.starts_at)
        < least(mine.ends_at, theirs.ends_at)
    where mine.league_id = p_league_id
      and mine.season_number = p_season_number
      and mine.week_index = p_week
      and mine.match_index = p_match
      and mine.user_id = auth.uid()
  ) overlap_rows;

  return jsonb_build_object(
    'own_slots', v_own,
    'mutual_slots', v_mutual,
    'opponent_has_submitted', exists (
      select 1
      from public.league_match_availability
      where league_id = p_league_id
        and season_number = p_season_number
        and week_index = p_week
        and match_index = p_match
        and user_id = v_other_user
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_match_schedule(p_league_id uuid, p_season_number integer, p_week integer, p_match integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_users uuid[];
  v_schedule public.league_match_schedules;
  v_pref public.match_reminder_preferences;
begin
  select state into v_state from public.league_state_snapshots where league_id = p_league_id;
  v_users := public.match_schedule_participant_users(v_state, p_week, p_match);
  if not (auth.uid() = any(v_users) or public.is_league_staff(p_league_id)) then
    raise exception 'Only scheduled managers and league staff can view this match schedule.';
  end if;
  select * into v_schedule from public.league_match_schedules
  where league_id = p_league_id and season_number = p_season_number
    and week_index = p_week and match_index = p_match;
  select * into v_pref from public.match_reminder_preferences where user_id = auth.uid();
  return jsonb_build_object(
    'schedule', case when v_schedule.id is null then null else to_jsonb(v_schedule) end,
    'is_participant', auth.uid() = any(v_users),
    'is_staff', public.is_league_staff(p_league_id),
    'can_accept', v_schedule.status = 'proposed'
      and auth.uid() = any(v_users) and auth.uid() <> v_schedule.proposed_by,
    'reminder_preferences', jsonb_build_object(
      'enabled', coalesce(v_pref.enabled, true),
      'offsets_minutes', coalesce(v_pref.offsets_minutes, array[1440, 60])
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_my_setup_team(p_league_id uuid, p_team_index integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_claimed_by text;
  v_claimed_by_user_id text;
  v_display_name text;
  v_username text;
begin
  if auth.uid() is null or p_team_index is null or p_team_index < 0 then
    return false;
  end if;

  if not exists (
    select 1
    from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = auth.uid()
      and membership.role in ('coach', 'commissioner', 'co_commissioner')
  ) then
    return false;
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id;

  if v_state is null
     or jsonb_typeof(v_state -> 'teams') <> 'array'
     or p_team_index >= jsonb_array_length(v_state -> 'teams') then
    return false;
  end if;

  v_claimed_by_user_id := nullif(
    btrim(v_state #>> array['teams', p_team_index::text, 'claimedByUserId']),
    ''
  );
  if v_claimed_by_user_id = auth.uid()::text then
    return true;
  end if;

  if exists (
    select 1
    from public.teams team_record
    join public.league_memberships owner_membership
      on owner_membership.id = team_record.owner_membership_id
    where team_record.league_id = p_league_id
      and team_record.source_key = p_team_index::text
      and owner_membership.user_id = auth.uid()
  ) then
    return true;
  end if;

  select profile.display_name, profile.username
  into v_display_name, v_username
  from public.profiles profile
  where profile.id = auth.uid();

  v_claimed_by := nullif(
    btrim(v_state #>> array['teams', p_team_index::text, 'claimedBy']),
    ''
  );
  return v_claimed_by is not null
    and (
      lower(v_claimed_by) = lower(coalesce(v_username, ''))
      or lower(v_claimed_by) = lower(coalesce(v_display_name, ''))
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_accessible_operational_health(p_league_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', visible.id,
    'occurred_at', visible.occurred_at,
    'league_id', visible.league_id,
    'kind', visible.kind,
    'message', visible.message,
    'context', visible.context,
    'actor_reference', visible.actor_reference
  ) order by visible.occurred_at desc), '[]'::jsonb)
  from (
    select
      e.id,
      e.occurred_at,
      e.league_id,
      e.kind,
      e.message,
      e.context,
      'user-' || substr(md5(e.actor_id::text), 1, 12) as actor_reference
    from public.operational_health_events e
    where auth.uid() is not null
      and (p_league_id is null or e.league_id = p_league_id)
      and (
        e.actor_id = auth.uid()
        or (
          p_league_id is not null
          and e.league_id = p_league_id
          and public.is_league_staff(e.league_id)
        )
      )
    order by e.occurred_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) visible;
$function$;

CREATE OR REPLACE FUNCTION public.list_accessible_tester_feedback(p_league_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'issue_number', 'DC-' || lpad(visible.id::text, 6, '0'),
    'created_at', visible.created_at,
    'updated_at', visible.updated_at,
    'status', visible.status,
    'severity', visible.severity,
    'tester_alias', visible.tester_alias,
    'reported_at', visible.reported_at,
    'reporter_timezone', visible.reporter_timezone,
    'device_browser', visible.device_browser,
    'account_role', visible.account_role,
    'league_id', visible.league_id,
    'league_name', visible.league_name,
    'draft_type', visible.draft_type,
    'attempted', visible.attempted,
    'expected_result', visible.expected_result,
    'actual_result', visible.actual_result,
    'refresh_fixed', visible.refresh_fixed,
    'evidence_url', visible.evidence_url,
    'release', visible.release,
    'correlation_id', visible.correlation_id
  ) order by visible.created_at desc), '[]'::jsonb)
  from (
    select f.*
    from public.tester_feedback f
    where auth.uid() is not null
      and (p_league_id is null or f.league_id = p_league_id)
      and (
        f.reporter_id = auth.uid()
        or (
          p_league_id is not null
          and f.league_id = p_league_id
          and public.is_league_staff(f.league_id)
        )
      )
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) visible;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_draft_queue(p_league_id uuid, p_team_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_queue jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your draft queue.';
  end if;
  if not public.is_my_setup_team(p_league_id, p_team_index) then
    raise exception 'You can only view your own team queue.';
  end if;

  select coalesce(
    jsonb_agg(item.pokemon_name order by item.position),
    '[]'::jsonb
  )
  into v_queue
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index;

  return v_queue;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_twitch_broadcaster_offline(p_broadcaster_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  update public.league_live_streams
  set status = 'ended',
      twitch_monitoring_status = 'enabled',
      twitch_monitoring_error = null,
      updated_at = now()
  where platform = 'twitch'
    and twitch_broadcaster_id = p_broadcaster_id
    and status = 'live';

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.match_availability_actor_team(p_league_id uuid, p_state jsonb, p_week integer, p_match integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pair jsonb;
  v_team integer;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    return null;
  end if;

  v_pair := p_state #> array['schedule', p_week::text, p_match::text];
  if jsonb_typeof(v_pair) <> 'array' or jsonb_array_length(v_pair) <> 2 then
    return null;
  end if;

  for v_team in
    select (value #>> '{}')::integer
    from jsonb_array_elements(v_pair)
  loop
    if public.match_availability_team_user(p_league_id, p_state, v_team) = auth.uid() then
      return v_team;
    end if;
  end loop;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.match_availability_team_user(p_league_id uuid, p_state jsonb, p_team integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_team jsonb;
  v_user uuid;
  v_claimed_name text;
  v_display_matches integer;
begin
  if p_team is null or p_team < 0 then
    return null;
  end if;

  v_team := p_state #> array['teams', p_team::text];
  if jsonb_typeof(v_team) <> 'object' then
    return null;
  end if;

  begin
    v_user := nullif(btrim(v_team ->> 'claimedByUserId'), '')::uuid;
  exception when others then
    v_user := null;
  end;

  if v_user is not null and exists (
    select 1
    from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = v_user
  ) then
    return v_user;
  end if;

  v_claimed_name := lower(nullif(btrim(v_team ->> 'claimedBy'), ''));
  if v_claimed_name is null then
    return null;
  end if;

  -- Usernames are account-unique and take precedence for legacy snapshots.
  select profile.id
  into v_user
  from public.profiles profile
  join public.league_memberships membership
    on membership.user_id = profile.id
   and membership.league_id = p_league_id
  where lower(coalesce(profile.username, '')) = v_claimed_name
  order by profile.id
  limit 1;

  if v_user is not null then
    return v_user;
  end if;

  -- Display names are accepted only when they identify exactly one member of
  -- this league. Ambiguous legacy names fail closed instead of exposing data.
  select
    count(*)::integer,
    (array_agg(profile.id order by profile.id))[1]
  into v_display_matches, v_user
  from public.profiles profile
  join public.league_memberships membership
    on membership.user_id = profile.id
   and membership.league_id = p_league_id
  where lower(coalesce(nullif(btrim(profile.display_name), ''), '')) = v_claimed_name;

  if v_display_matches = 1 then
    return v_user;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.match_schedule_participant_users(p_state jsonb, p_week integer, p_match integer)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pair jsonb;
  v_team integer;
  v_user uuid;
  v_users uuid[] := array[]::uuid[];
begin
  v_pair := p_state #> array['schedule', p_week::text, p_match::text];
  if jsonb_typeof(v_pair) <> 'array' or jsonb_array_length(v_pair) <> 2 then
    return v_users;
  end if;
  for v_team in select (value #>> '{}')::integer from jsonb_array_elements(v_pair)
  loop
    begin
      v_user := nullif(p_state #>> array['teams', v_team::text, 'claimedByUserId'], '')::uuid;
    exception when others then
      v_user := null;
    end;
    if v_user is not null then v_users := array_append(v_users, v_user); end if;
  end loop;
  return v_users;
end;
$function$;

CREATE OR REPLACE FUNCTION public.move_private_free_agent_claim(p_league_id uuid, p_claim_id uuid, p_direction integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_claim public.league_free_agent_claims%rowtype;
  v_other public.league_free_agent_claims%rowtype;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  if p_direction not in (-1, 1) then
    raise exception 'Choose whether to move the claim up or down.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id;
  select * into v_claim
  from public.league_free_agent_claims
  where league_id = p_league_id
    and id = p_claim_id
  for update;
  if v_claim.id is null then
    raise exception 'That pending claim was not found.';
  end if;
  if not public.league_actor_can_control_snapshot_team(
    p_league_id, v_state, v_claim.team_index
  ) then
    raise exception
      'Only that team owner or a commissioner can reorder this claim.';
  end if;

  perform 1
  from public.league_free_agent_claims
  where league_id = p_league_id
    and team_index = v_claim.team_index
  for update;

  if p_direction < 0 then
    select * into v_other
    from public.league_free_agent_claims
    where league_id = p_league_id
      and team_index = v_claim.team_index
      and claim_priority < v_claim.claim_priority
    order by claim_priority desc, submitted_at desc, id desc
    limit 1;
  else
    select * into v_other
    from public.league_free_agent_claims
    where league_id = p_league_id
      and team_index = v_claim.team_index
      and claim_priority > v_claim.claim_priority
    order by claim_priority, submitted_at, id
    limit 1;
  end if;
  if v_other.id is null then
    return false;
  end if;

  update public.league_free_agent_claims
  set claim_priority = case
    when id = v_claim.id then v_other.claim_priority
    else v_claim.claim_priority
  end
  where id in (v_claim.id, v_other.id);

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'free_agent_claim_reordered',
    auth.uid(),
    jsonb_build_object(
      'claim_id', v_claim.id,
      'team_index', v_claim.team_index,
      'direction', p_direction
    )
  );
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mutate_live_auction(p_league_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_team_index integer;
  v_n integer;
  v_nomination_index integer;
  v_order jsonb;
  v_nominee jsonb;
  v_mon jsonb;
  v_mon_id text;
  v_bid integer;
  v_budget integer;
  v_roster jsonb;
  v_roster_max integer;
  v_deadline bigint;
  v_reset_seconds integer;
  v_pause_started bigint;
  v_pause_ms bigint;
  v_pool jsonb;
  v_event_payload jsonb := '{}'::jsonb;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League draft state was not found.'; end if;
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'There is no active hosted auction draft.';
  end if;

  insert into public.auction_team_owners (league_id, team_index, user_id)
  select p_league_id, team.ordinality - 1, owner.id
  from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb))
    with ordinality as team(value, ordinality)
  cross join lateral (
    select profile.id
    from public.profiles profile
    join public.league_memberships membership
      on membership.user_id = profile.id
     and membership.league_id = p_league_id
    where nullif(trim(team.value ->> 'claimedBy'), '') is not null
      and (
        lower(coalesce(profile.username, '')) = lower(team.value ->> 'claimedBy')
        or lower(coalesce(profile.display_name, '')) = lower(team.value ->> 'claimedBy')
      )
    order by case
      when lower(coalesce(profile.username, '')) = lower(team.value ->> 'claimedBy') then 0
      else 1
    end
    limit 1
  ) owner
  on conflict do nothing;

  v_order := coalesce(v_state -> 'auctionNominationOrder', '[]'::jsonb);
  v_n := jsonb_array_length(v_order);
  v_nomination_index := coalesce((v_state ->> 'auctionNominationIdx')::integer, 0);
  v_roster_max := greatest(1, coalesce((v_state #>> '{settings,rosterMax}')::integer, 1));

  if v_action = 'start_clock' then
    if coalesce((v_state ->> 'paused')::boolean, false)
       or v_state -> 'nominee' <> 'null'::jsonb
       or coalesce((v_state ->> 'auctionEnded')::boolean, false)
       or jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) = 0 then
      return v_state;
    end if;
    if v_state -> 'nominationDeadline' = 'null'::jsonb then
      v_deadline := v_now_ms
        + greatest(1, coalesce((v_state #>> '{settings,auctionNominationSeconds}')::integer, 30)) * 1000;
      v_state := jsonb_set(v_state, '{nominationDeadline}', to_jsonb(v_deadline), true);
    else
      return v_state;
    end if;

  elsif v_action = 'nominate' then
    if coalesce((v_state ->> 'paused')::boolean, false) then raise exception 'The draft is paused.'; end if;
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'Another Pokemon is already being auctioned.'; end if;
    if v_n = 0 then raise exception 'The nomination order is missing.'; end if;
    v_team_index := (v_order ->> (v_nomination_index % v_n))::integer;
    if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
      raise exception 'It is not your team''s nomination turn.';
    end if;
    v_mon_id := p_payload ->> 'pokemon_id';
    select pokemon.value
    into v_mon
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb)) pokemon(value)
    where pokemon.value ->> 'id' = v_mon_id
    limit 1;
    if v_mon is null then raise exception 'That Pokemon is no longer available.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select
      count(*) filter (where coalesce((pokemon.value ->> 'isRestricted')::boolean, false)),
      count(*) filter (where coalesce((pokemon.value ->> 'isMega')::boolean, false))
    into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster) pokemon(value);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null
       and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null
       and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;
    v_bid := greatest(1, coalesce((p_payload ->> 'amount')::integer, 1));
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That opening bid is over the team''s remaining budget.'; end if;
    v_deadline := v_now_ms
      + greatest(1, coalesce((v_state #>> '{settings,auctionTimerSeconds}')::integer, 30)) * 1000;
    v_nominee := jsonb_build_object(
      'mon', v_mon,
      'currentBid', v_bid,
      'currentBidder', v_team_index,
      'nominatedBy', v_team_index,
      'deadline', v_deadline,
      'bids', jsonb_build_array(
        jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms)
      )
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'pokemon_id', v_mon_id,
      'amount', v_bid
    );

  elsif v_action = 'bid' then
    if coalesce((v_state ->> 'paused')::boolean, false) then raise exception 'The draft is paused.'; end if;
    v_nominee := v_state -> 'nominee';
    if v_nominee is null or v_nominee = 'null'::jsonb then raise exception 'There is no active nomination.'; end if;
    v_deadline := (v_nominee ->> 'deadline')::bigint;
    if v_now_ms >= v_deadline then raise exception 'The bidding clock has expired.'; end if;
    v_team_index := (p_payload ->> 'team_index')::integer;
    if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
      raise exception 'You cannot bid for that team.';
    end if;
    if v_team_index = (v_nominee ->> 'currentBidder')::integer then
      raise exception 'Your team already has the highest bid.';
    end if;
    v_bid := (p_payload ->> 'amount')::integer;
    if v_bid <= (v_nominee ->> 'currentBid')::integer then raise exception 'That bid is no longer high enough.'; end if;
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That bid is over the team''s remaining budget.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;
    v_mon := v_nominee -> 'mon';
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select
      count(*) filter (where coalesce((pokemon.value ->> 'isRestricted')::boolean, false)),
      count(*) filter (where coalesce((pokemon.value ->> 'isMega')::boolean, false))
    into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster) pokemon(value);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null
       and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null
       and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;
    v_reset_seconds := greatest(
      1,
      coalesce((v_state #>> '{settings,auctionBidResetSeconds}')::integer, 10)
    );
    v_nominee := jsonb_set(v_nominee, '{currentBid}', to_jsonb(v_bid), true);
    v_nominee := jsonb_set(v_nominee, '{currentBidder}', to_jsonb(v_team_index), true);
    v_nominee := jsonb_set(
      v_nominee,
      '{deadline}',
      to_jsonb(v_now_ms + v_reset_seconds * 1000),
      true
    );
    v_nominee := jsonb_set(
      v_nominee,
      '{bids}',
      coalesce(v_nominee -> 'bids', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms)
        ),
      true
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_event_payload := jsonb_build_object('team_index', v_team_index, 'amount', v_bid);

  elsif v_action = 'resolve' then
    if coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_nominee := v_state -> 'nominee';
    if v_nominee is null or v_nominee = 'null'::jsonb then return v_state; end if;
    if v_now_ms < (v_nominee ->> 'deadline')::bigint then return v_state; end if;
    v_team_index := (v_nominee ->> 'currentBidder')::integer;
    v_bid := (v_nominee ->> 'currentBid')::integer;
    v_mon := jsonb_set(v_nominee -> 'mon', '{cost}', to_jsonb(v_bid), true);
    v_mon := jsonb_set(v_mon, '{acquiredVia}', '"draft"'::jsonb, true);
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if jsonb_array_length(v_roster) >= v_roster_max or v_bid > v_budget then
      raise exception 'The winning team can no longer complete this purchase.';
    end if;
    v_state := jsonb_set(
      v_state,
      array['rosters', v_team_index::text],
      v_roster || jsonb_build_array(v_mon),
      true
    );
    v_state := jsonb_set(
      v_state,
      array['budgets', v_team_index::text],
      to_jsonb(v_budget - v_bid),
      true
    );
    v_mon_id := v_nominee #>> '{mon,id}';
    select coalesce(jsonb_agg(pokemon.value order by pokemon.ordinality), '[]'::jsonb)
    into v_pool
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
      with ordinality as pokemon(value, ordinality)
    where pokemon.value ->> 'id' <> v_mon_id;
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(v_state, '{nominee}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_state := jsonb_set(
      v_state,
      '{auctionNominationIdx}',
      to_jsonb(v_nomination_index + 1),
      true
    );
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'pokemon_id', v_mon_id,
      'amount', v_bid
    );

  elsif v_action = 'skip' then
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'An active auction cannot be skipped.'; end if;
    if v_n = 0 then raise exception 'The nomination order is missing.'; end if;
    v_team_index := (v_order ->> (v_nomination_index % v_n))::integer;
    if not public.is_league_staff(p_league_id) then
      if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
        raise exception 'You cannot skip another team''s nomination turn.';
      end if;
      if v_state -> 'nominationDeadline' = 'null'::jsonb
         or v_now_ms < (v_state ->> 'nominationDeadline')::bigint then
        raise exception 'The nomination clock has not expired.';
      end if;
    end if;
    v_state := jsonb_set(
      v_state,
      '{auctionNominationIdx}',
      to_jsonb(v_nomination_index + 1),
      true
    );
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);

  elsif v_action = 'pause' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can pause the draft.'; end if;
    if coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
    v_state := jsonb_set(
      v_state,
      '{pauseIsOvernight}',
      to_jsonb(coalesce((p_payload ->> 'overnight')::boolean, false)),
      true
    );

  elsif v_action = 'resume' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can resume the draft.'; end if;
    if not coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_pause_started := coalesce((v_state ->> 'pausedAt')::bigint, v_now_ms);
    v_pause_ms := greatest(0, v_now_ms - v_pause_started);
    if v_state -> 'nominationDeadline' <> 'null'::jsonb then
      v_state := jsonb_set(
        v_state,
        '{nominationDeadline}',
        to_jsonb((v_state ->> 'nominationDeadline')::bigint + v_pause_ms),
        true
      );
    end if;
    if v_state -> 'nominee' <> 'null'::jsonb then
      v_state := jsonb_set(
        v_state,
        '{nominee,deadline}',
        to_jsonb((v_state #>> '{nominee,deadline}')::bigint + v_pause_ms),
        true
      );
    end if;
    v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);

  elsif v_action = 'end' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can end the auction.'; end if;
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'Let the current nomination finish first.'; end if;
    v_state := jsonb_set(v_state, '{auctionEnded}', 'true'::jsonb, true);

  else
    raise exception 'Unknown auction action.';
  end if;

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (p_league_id, 'auction_' || v_action, auth.uid(), v_event_payload);

  return v_state;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mutate_my_draft_queue(p_league_id uuid, p_team_index integer, p_action text, p_pokemon_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_action text := lower(trim(coalesce(p_action, '')));
  v_name text := nullif(trim(p_pokemon_name), '');
  v_position integer;
  v_target_position integer;
  v_target_name text;
  v_queue jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update your draft queue.';
  end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Choose a valid Pokemon.';
  end if;
  if not public.is_my_setup_team(p_league_id, p_team_index) then
    raise exception 'You can only update your own team queue.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_league_id::text), p_team_index);

  select item.position
  into v_position
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index
    and item.pokemon_name = v_name;

  if v_action = 'add' then
    if v_position is null then
      if (
        select count(*)
        from public.private_draft_queue_items item
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
      ) >= 100 then
        raise exception 'Draft queues can hold up to 100 Pokemon.';
      end if;

      insert into public.private_draft_queue_items(
        league_id,
        user_id,
        team_index,
        pokemon_name,
        position
      )
      select
        p_league_id,
        auth.uid(),
        p_team_index,
        v_name,
        coalesce(max(item.position) + 1, 0)
      from public.private_draft_queue_items item
      where item.league_id = p_league_id
        and item.user_id = auth.uid()
        and item.team_index = p_team_index;
    end if;
  elsif v_action = 'remove' then
    delete from public.private_draft_queue_items item
    where item.league_id = p_league_id
      and item.user_id = auth.uid()
      and item.team_index = p_team_index
      and item.pokemon_name = v_name;
  elsif v_action in ('up', 'down') then
    if v_position is not null then
      v_target_position := v_position
        + case when v_action = 'up' then -1 else 1 end;

      select item.pokemon_name
      into v_target_name
      from public.private_draft_queue_items item
      where item.league_id = p_league_id
        and item.user_id = auth.uid()
        and item.team_index = p_team_index
        and item.position = v_target_position;

      if v_target_name is not null then
        update public.private_draft_queue_items item
        set position = 1000000
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_target_name;

        update public.private_draft_queue_items item
        set position = v_target_position
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_name;

        update public.private_draft_queue_items item
        set position = v_position
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_target_name;
      end if;
    end if;
  else
    raise exception 'Unknown queue action.';
  end if;

  with ordered as (
    select
      item.pokemon_name,
      row_number() over (order by item.position) - 1 as next_position
    from public.private_draft_queue_items item
    where item.league_id = p_league_id
      and item.user_id = auth.uid()
      and item.team_index = p_team_index
  )
  update public.private_draft_queue_items item
  set position = ordered.next_position
  from ordered
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index
    and item.pokemon_name = ordered.pokemon_name;

  select coalesce(
    jsonb_agg(item.pokemon_name order by item.position),
    '[]'::jsonb
  )
  into v_queue
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index;

  return v_queue;
end;
$function$;

CREATE OR REPLACE FUNCTION public.override_match_schedule(p_league_id uuid, p_season_number integer, p_week integer, p_match integer, p_scheduled_at timestamp with time zone, p_duration_minutes integer, p_timezone text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_schedule public.league_match_schedules;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can override a match time.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Add a brief override reason.';
  end if;
  if p_duration_minutes not between 15 and 360 then
    raise exception 'Match duration must be between 15 and 360 minutes.';
  end if;
  select state into v_state from public.league_state_snapshots
  where league_id = p_league_id for update;
  perform public.validate_match_schedule_time(v_state, p_week, p_scheduled_at, p_timezone);
  select * into v_schedule from public.league_match_schedules
  where league_id = p_league_id and season_number = p_season_number
    and week_index = p_week and match_index = p_match for update;
  if v_schedule.id is not null then perform public.clear_unsent_match_reminders(v_schedule.id); end if;

  insert into public.league_match_schedules (
    league_id, season_number, week_index, match_index, scheduled_at,
    duration_minutes, display_timezone, status, proposed_by, accepted_by,
    staff_override_by, staff_override_reason, confirmed_at
  ) values (
    p_league_id, p_season_number, p_week, p_match, p_scheduled_at,
    p_duration_minutes, btrim(p_timezone), 'confirmed', auth.uid(), auth.uid(),
    auth.uid(), btrim(p_reason), now()
  )
  on conflict (league_id, season_number, week_index, match_index)
  do update set scheduled_at = excluded.scheduled_at,
    duration_minutes = excluded.duration_minutes,
    display_timezone = excluded.display_timezone, status = 'confirmed',
    proposed_by = auth.uid(), accepted_by = auth.uid(),
    staff_override_by = auth.uid(), staff_override_reason = btrim(p_reason),
    revision = public.league_match_schedules.revision + 1,
    confirmed_at = now(), cancelled_at = null, updated_at = now()
  returning * into v_schedule;
  perform public.enqueue_match_schedule_reminders(v_schedule.id);
  return public.get_my_match_schedule(p_league_id, p_season_number, p_week, p_match);
end;
$function$;

CREATE OR REPLACE FUNCTION public.process_private_free_agent_claims_internal(p_league_id uuid, p_cycle text DEFAULT NULL::text, p_cutoff timestamp with time zone DEFAULT NULL::timestamp with time zone, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_settings jsonb;
  v_context jsonb;
  v_mode text;
  v_team_count integer;
  v_rosters jsonb;
  v_budgets jsonb;
  v_pool jsonb;
  v_faab_budgets jsonb;
  v_priority jsonb;
  v_transaction_log jsonb;
  v_results jsonb := '[]'::jsonb;
  v_claim_count integer := 0;
  v_winner_count integer := 0;
  v_current_week integer;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_uses_budget boolean;
  v_skip_tier_cost boolean;
  v_total_limit integer;
  v_week_limit integer;
  v_deadline_week integer;
  v_total_used integer;
  v_week_used integer;
  v_claim record;
  v_group record;
  v_roster jsonb;
  v_new_roster jsonb;
  v_add_mon jsonb;
  v_drop_mon jsonb;
  v_awarded_mon jsonb;
  v_add_cost numeric;
  v_drop_cost numeric;
  v_final_cost numeric;
  v_current_budget numeric;
  v_new_budget numeric;
  v_current_faab integer;
  v_new_faab integer;
  v_bid integer;
  v_reason text;
  v_awarded boolean;
  v_result_claim jsonb;
begin
  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
  v_mode := coalesce(v_settings ->> 'faClaimMode', 'instant');
  if not public.snapshot_draft_is_complete(v_state) then
    raise exception 'Transactions open only after the draft is complete.';
  end if;
  if v_mode = 'instant' then
    raise exception 'This league processes free agents instantly.';
  end if;

  -- Scheduled calls are re-checked after taking the league row lock. This
  -- prevents a stale cron scan from processing after the commissioner changes
  -- the clock, time zone, claim mode, or automatic-processing setting.
  if p_cycle is not null then
    v_context := public.league_claim_due_context(v_state, clock_timestamp());
    if v_context is null
       or coalesce(v_context ->> 'cycle', '') <> p_cycle then
      return v_state;
    end if;
    p_cutoff := (v_context ->> 'due_at')::timestamptz;
  end if;

  v_rosters := coalesce(v_state -> 'rosters', '[]'::jsonb);
  v_pool := case
    when jsonb_typeof(v_state -> 'pool') = 'array'
    then v_state -> 'pool'
    else '[]'::jsonb
  end;
  if jsonb_typeof(v_rosters) <> 'array'
     or jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League roster data is invalid. Ask a commissioner to restore a backup.';
  end if;
  v_team_count := jsonb_array_length(v_state -> 'teams');
  if jsonb_array_length(v_rosters) <> v_team_count then
    raise exception 'League roster data does not match the team list.';
  end if;

  v_budgets := case
    when jsonb_typeof(v_state -> 'budgets') = 'array'
    then v_state -> 'budgets'
    else '[]'::jsonb
  end;
  if jsonb_array_length(v_budgets) <> v_team_count then
    select coalesce(
      jsonb_agg(
        greatest(
          0,
          coalesce(
            nullif(v_budgets ->> team_index, '')::numeric,
            nullif(v_settings ->> 'budget', '')::numeric,
            0
          )
        )
        order by team_index
      ),
      '[]'::jsonb
    )
    into v_budgets
    from generate_series(0, v_team_count - 1) team_index;
  end if;

  v_faab_budgets := case
    when jsonb_typeof(v_state -> 'faabBudgets') = 'object'
    then v_state -> 'faabBudgets'
    else '{}'::jsonb
  end;
  v_priority := case
    when jsonb_typeof(v_state -> 'waiverPriority') = 'array'
      and jsonb_array_length(v_state -> 'waiverPriority') > 0
    then v_state -> 'waiverPriority'
    else (
      select coalesce(jsonb_agg(team_index order by team_index), '[]'::jsonb)
      from generate_series(0, v_team_count - 1) team_index
    )
  end;
  v_transaction_log := case
    when jsonb_typeof(v_state -> 'transactionLog') = 'array'
    then v_state -> 'transactionLog'
    else '[]'::jsonb
  end;
  v_current_week := public.snapshot_operational_week(v_state, clock_timestamp());
  v_uses_budget := case
    when jsonb_typeof(v_settings -> 'postDraftBudgetEnabled') = 'boolean'
    then (v_settings ->> 'postDraftBudgetEnabled')::boolean
    else coalesce(v_settings ->> 'draftType', 'snake') = 'auction'
      or coalesce((v_settings ->> 'snakeBudgetEnabled')::boolean, false)
  end;
  v_skip_tier_cost := v_mode = 'faab'
    and coalesce((v_settings ->> 'faabReplacesTierCost')::boolean, false);
  v_total_limit := case
    when jsonb_typeof(v_settings -> 'maxTransactionsTotal') = 'number'
    then (v_settings ->> 'maxTransactionsTotal')::integer
    else null
  end;
  v_week_limit := case
    when jsonb_typeof(v_settings -> 'maxTransactionsPerWeek') = 'number'
    then (v_settings ->> 'maxTransactionsPerWeek')::integer
    else null
  end;
  v_deadline_week := case
    when jsonb_typeof(v_settings -> 'transactionsLastWeek') = 'number'
    then (v_settings ->> 'transactionsLastWeek')::integer
    else null
  end;

  select count(*)
  into v_claim_count
  from public.league_free_agent_claims
  where league_id = p_league_id
    and (p_cutoff is null or submitted_at <= p_cutoff);

  for v_group in
    select
      coalesce(claim_priority, 2147483647) as claim_priority,
      lower(add_name) as add_key,
      min(submitted_at) as first_submitted
    from public.league_free_agent_claims
    where league_id = p_league_id
      and (p_cutoff is null or submitted_at <= p_cutoff)
    group by coalesce(claim_priority, 2147483647), lower(add_name)
    order by coalesce(claim_priority, 2147483647), min(submitted_at), lower(add_name)
  loop
    v_awarded := false;

    for v_claim in
      select
        claim.*,
        coalesce(
          (
            select priority_item.ordinality::integer
            from jsonb_array_elements_text(v_priority)
              with ordinality priority_item(value, ordinality)
            where priority_item.value::integer = claim.team_index
            limit 1
          ),
          2147483647
        ) as priority_rank,
        public.snapshot_team_record_score(v_state, claim.team_index)
          as record_score
      from public.league_free_agent_claims claim
      where claim.league_id = p_league_id
        and lower(claim.add_name) = v_group.add_key
        and coalesce(claim.claim_priority, 2147483647) = v_group.claim_priority
        and (p_cutoff is null or claim.submitted_at <= p_cutoff)
      order by
        case when v_mode = 'faab' then coalesce(claim.bid_amount, 0) end desc,
        case when v_mode = 'worst-record'
          then public.snapshot_team_record_score(v_state, claim.team_index)
        end asc,
        case when v_mode in ('faab', 'priority') then
          coalesce(
            (
              select priority_item.ordinality::integer
              from jsonb_array_elements_text(v_priority)
                with ordinality priority_item(value, ordinality)
              where priority_item.value::integer = claim.team_index
              limit 1
            ),
            2147483647
          )
        end asc,
        case when v_mode = 'random'
          then md5(claim.id::text || coalesce(p_cycle, 'manual'))
        end asc,
        claim.submitted_at,
        claim.id
    loop
      v_reason := null;
      v_result_claim := jsonb_build_object(
        'id', v_claim.id,
        'teamIdx', v_claim.team_index,
        'addName', v_claim.add_name,
        'dropName', v_claim.drop_name,
        'submittedAt',
          floor(extract(epoch from v_claim.submitted_at) * 1000)::bigint,
        'week', v_claim.week
      );

      if v_awarded then
        v_reason := 'Lost the claim.';
      elsif v_claim.team_index < 0
         or v_claim.team_index >= v_team_count then
        v_reason := 'The claiming team is no longer valid.';
      elsif exists (
        select 1
        from jsonb_array_elements(v_rosters) roster(value)
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(roster.value) = 'array'
            then roster.value else '[]'::jsonb end
        ) mon(value)
        where lower(coalesce(mon.value ->> 'name', ''))
          = lower(v_claim.add_name)
      ) then
        v_reason := 'No longer available.';
      elsif coalesce((v_settings ->> 'lockTransactionsAtPlayoffs')::boolean, false)
         and v_state -> 'playoffs' is not null
         and v_state -> 'playoffs' <> 'null'::jsonb then
        v_reason := 'Transactions are closed once the playoff bracket is generated.';
      elsif v_deadline_week is not null
         and v_deadline_week > 0
         and v_current_week > v_deadline_week - 1 then
        v_reason := 'The transaction deadline has passed.';
      else
        select
          count(*),
          count(*) filter (
            where coalesce((entry.value ->> 'week')::integer, -1)
              = v_current_week
          )
        into v_total_used, v_week_used
        from jsonb_array_elements(v_transaction_log) entry(value)
        where coalesce((entry.value ->> 'teamIdx')::integer, -1)
          = v_claim.team_index;

        if v_total_limit is not null
           and v_total_limit > 0
           and v_total_used >= v_total_limit then
          v_reason := 'This team has reached its season transaction limit.';
        elsif v_week_limit is not null
           and v_week_limit > 0
           and v_week_used >= v_week_limit then
          v_reason := 'This team has reached its weekly transaction limit.';
        end if;
      end if;

      if v_reason is null then
        v_roster := v_rosters -> v_claim.team_index;
        v_add_mon := null;
        select mon.value
        into v_add_mon
        from jsonb_array_elements(v_pool) mon(value)
        where lower(coalesce(mon.value ->> 'name', ''))
          = lower(v_claim.add_name)
        limit 1;
        if v_add_mon is null
           and jsonb_typeof(v_state #> '{liveDraft,basePool}') = 'array' then
          select mon.value
          into v_add_mon
          from jsonb_array_elements(v_state #> '{liveDraft,basePool}') mon(value)
          where lower(coalesce(mon.value ->> 'name', ''))
            = lower(v_claim.add_name)
          limit 1;
        end if;
        v_drop_mon := null;
        if jsonb_typeof(v_roster) <> 'array'
           or jsonb_typeof(v_add_mon) <> 'object'
           or lower(coalesce(v_add_mon ->> 'name', ''))
             <> lower(v_claim.add_name) then
          v_reason := 'The claim data is no longer valid.';
        elsif exists (
          select 1
          from jsonb_array_elements(
            case
              when jsonb_typeof(v_settings -> 'bannedMons') = 'array'
              then v_settings -> 'bannedMons'
              else '[]'::jsonb
            end
          ) banned(value)
          where lower(banned.value #>> '{}') = lower(v_claim.add_name)
        ) or (
          coalesce((v_add_mon ->> 'isMega')::boolean, false)
          and not coalesce((v_settings ->> 'allowMegas')::boolean, false)
        ) then
          v_reason := 'That Pokemon is no longer legal in this league.';
        end if;

        if v_reason is null and v_claim.drop_name is not null then
          select mon.value
          into v_drop_mon
          from jsonb_array_elements(v_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', ''))
            = lower(v_claim.drop_name)
          limit 1;
          if v_drop_mon is null then
            v_reason := 'The selected drop is no longer on that roster.';
          end if;
        end if;
      end if;

      if v_reason is null then
        select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
        into v_new_roster
        from jsonb_array_elements(v_roster)
          with ordinality mon(value, ordinality)
        where v_claim.drop_name is null
          or lower(coalesce(mon.value ->> 'name', ''))
            <> lower(v_claim.drop_name);

        if jsonb_array_length(v_new_roster)
           >= greatest(1, coalesce((v_settings ->> 'rosterMax')::integer, 1))
           and v_claim.drop_name is null then
          v_reason := 'Roster was full.';
        end if;
      end if;

      if v_reason is null then
        v_add_cost := greatest(0, coalesce((v_add_mon ->> 'cost')::numeric, 0));
        v_drop_cost := greatest(0, coalesce((v_drop_mon ->> 'cost')::numeric, 0));
        v_bid := greatest(0, coalesce(v_claim.bid_amount, 0));
        v_current_budget := greatest(
          0,
          coalesce((v_budgets ->> v_claim.team_index)::numeric, 0)
        );
        v_new_budget := v_current_budget;
        v_current_faab := greatest(
          0,
          coalesce(
            (v_faab_budgets ->> v_claim.team_index)::integer,
            (v_settings ->> 'faabBudget')::integer,
            0
          )
        );
        v_new_faab := v_current_faab;

        if v_uses_budget and not v_skip_tier_cost then
          v_new_budget := v_new_budget + v_drop_cost - v_add_cost;
        end if;
        if v_mode = 'faab' then
          if coalesce(
            (v_settings ->> 'faabUsesLeftoverDraftBudget')::boolean,
            false
          ) then
            v_new_budget := v_new_budget - v_bid;
          else
            v_new_faab := v_new_faab - v_bid;
          end if;
        end if;

        if v_new_budget < 0 then
          v_reason := 'That team does not have enough remaining budget.';
        elsif v_new_faab < 0 then
          v_reason := 'That bid is greater than this team''s available FAAB.';
        end if;
      end if;

      if v_reason is null then
        v_final_cost := case
          when v_skip_tier_cost then v_bid
          else v_add_cost
        end;
        v_awarded_mon := jsonb_set(
          jsonb_set(
            v_add_mon,
            '{cost}',
            to_jsonb(v_final_cost),
            true
          ),
          '{acquiredVia}',
          to_jsonb('freeagency'::text),
          true
        );
        v_new_roster := v_new_roster || jsonb_build_array(v_awarded_mon);
        if not public.snapshot_roster_respects_caps(
          v_new_roster,
          v_settings
        ) then
          v_reason := 'That move would exceed the roster size or a configured roster cap.';
        end if;
      end if;

      if v_reason is null then
        v_rosters := jsonb_set(
          v_rosters,
          array[v_claim.team_index::text],
          v_new_roster,
          false
        );
        v_budgets := jsonb_set(
          v_budgets,
          array[v_claim.team_index::text],
          to_jsonb(v_new_budget),
          false
        );
        if v_mode = 'faab'
           and not coalesce(
             (v_settings ->> 'faabUsesLeftoverDraftBudget')::boolean,
             false
           ) then
          v_faab_budgets := jsonb_set(
            v_faab_budgets,
            array[v_claim.team_index::text],
            to_jsonb(v_new_faab),
            true
          );
        end if;

        v_transaction_log := v_transaction_log || jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'teamIdx', v_claim.team_index,
            'week', v_current_week,
            'timestamp', v_now_ms,
            'addName', v_add_mon ->> 'name',
            'addCost', v_final_cost,
            'dropName', case
              when v_drop_mon is null then null
              else v_drop_mon ->> 'name'
            end,
            'dropCost', case
              when v_drop_mon is null then null
              else v_drop_cost
            end
          )
        );
        select coalesce(
          jsonb_agg(mon.value order by mon.ordinality),
          '[]'::jsonb
        )
        into v_pool
        from jsonb_array_elements(v_pool)
          with ordinality mon(value, ordinality)
        where lower(coalesce(mon.value ->> 'name', ''))
          <> lower(v_claim.add_name);
        if v_drop_mon is not null
           and not exists (
             select 1
             from jsonb_array_elements(v_pool) mon(value)
             where lower(coalesce(mon.value ->> 'name', ''))
               = lower(v_claim.drop_name)
           ) then
          v_pool := v_pool || jsonb_build_array(v_drop_mon);
        end if;
        if v_mode = 'priority' then
          select coalesce(
            jsonb_agg(item.value order by item.ordinality)
              filter (where item.value::integer <> v_claim.team_index),
            '[]'::jsonb
          ) || jsonb_build_array(v_claim.team_index)
          into v_priority
          from jsonb_array_elements(v_priority)
            with ordinality item(value, ordinality);
        end if;

        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'claim', v_result_claim,
            'ok', true,
            'reason', ''
          )
        );
        v_awarded := true;
        v_winner_count := v_winner_count + 1;
      else
        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'claim', v_result_claim,
            'ok', false,
            'reason', v_reason
          )
        );
      end if;
    end loop;
  end loop;

  if v_claim_count = 0 and p_cycle is null then
    return v_state;
  end if;

  if v_claim_count > 0 then
    delete from public.league_free_agent_claims
    where league_id = p_league_id
      and (p_cutoff is null or submitted_at <= p_cutoff);
    v_state := jsonb_set(v_state, '{rosters}', v_rosters, true);
    v_state := jsonb_set(v_state, '{budgets}', v_budgets, true);
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(v_state, '{faabBudgets}', v_faab_budgets, true);
    v_state := jsonb_set(v_state, '{waiverPriority}', v_priority, true);
    v_state := jsonb_set(
      v_state,
      '{transactionLog}',
      v_transaction_log,
      true
    );
    v_state := jsonb_set(v_state, '{lastClaimResults}', v_results, true);
  end if;
  v_state := jsonb_set(v_state, '{pendingClaims}', '[]'::jsonb, true);
  if p_cycle is not null then
    v_state := jsonb_set(
      v_state,
      '{lastAutoClaimCycle}',
      to_jsonb(p_cycle),
      true
    );
  end if;
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case
      when p_cycle is null then 'free_agent_claims_processed'
      else 'scheduled_free_agent_claims_processed'
    end,
    p_actor_id,
    jsonb_build_object(
      'claim_count', v_claim_count,
      'winner_count', v_winner_count,
      'cycle', p_cycle,
      'automatic', p_cycle is not null
    )
  );
  return v_state;
end;
$function$;

CREATE OR REPLACE FUNCTION public.propose_match_schedule(p_league_id uuid, p_season_number integer, p_week integer, p_match integer, p_scheduled_at timestamp with time zone, p_duration_minutes integer, p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_users uuid[];
  v_schedule public.league_match_schedules;
begin
  select state into v_state from public.league_state_snapshots
  where league_id = p_league_id for update;
  if coalesce((v_state ->> 'seasonNumber')::integer, 1) <> p_season_number then
    raise exception 'That season is no longer active.';
  end if;
  v_users := public.match_schedule_participant_users(v_state, p_week, p_match);
  if not (auth.uid() = any(v_users)) then
    raise exception 'Only the two scheduled managers can propose a match time.';
  end if;
  if p_duration_minutes not between 15 and 360 then
    raise exception 'Match duration must be between 15 and 360 minutes.';
  end if;
  perform public.validate_match_schedule_time(v_state, p_week, p_scheduled_at, p_timezone);
  select * into v_schedule from public.league_match_schedules
  where league_id = p_league_id and season_number = p_season_number
    and week_index = p_week and match_index = p_match for update;
  if v_schedule.id is not null then perform public.clear_unsent_match_reminders(v_schedule.id); end if;

  insert into public.league_match_schedules (
    league_id, season_number, week_index, match_index, scheduled_at,
    duration_minutes, display_timezone, status, proposed_by
  ) values (
    p_league_id, p_season_number, p_week, p_match, p_scheduled_at,
    p_duration_minutes, btrim(p_timezone), 'proposed', auth.uid()
  )
  on conflict (league_id, season_number, week_index, match_index)
  do update set scheduled_at = excluded.scheduled_at,
    duration_minutes = excluded.duration_minutes,
    display_timezone = excluded.display_timezone, status = 'proposed',
    proposed_by = auth.uid(), accepted_by = null, staff_override_by = null,
    staff_override_reason = null,
    revision = public.league_match_schedules.revision + 1,
    proposed_at = now(), confirmed_at = null, cancelled_at = null, updated_at = now()
  returning * into v_schedule;
  return public.get_my_match_schedule(p_league_id, p_season_number, p_week, p_match);
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_autonomous_snake_drafts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_job public.scheduled_snake_draft_jobs;
  v_session public.draft_sessions;
  v_state jsonb;
  v_result jsonb;
  v_claims text;
  v_previous_claims text;
  v_now_ms bigint;
  v_limit_minutes integer;
  v_team_index integer;
  v_owner_id uuid;
  v_candidate record;
  v_picked boolean;
  v_started integer := 0;
  v_picked_count integer := 0;
  v_advanced integer := 0;
  v_failed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_previous_claims := current_setting('request.jwt.claims', true);

  for v_job in
    select *
    from public.scheduled_snake_draft_jobs
    where status = 'scheduled'
      and starts_at <= clock_timestamp()
    order by starts_at
    for update skip locked
  loop
    begin
      update public.scheduled_snake_draft_jobs
      set status = 'starting', updated_at = now()
      where league_id = v_job.league_id;

      v_claims := json_build_object(
        'sub', v_job.commissioner_id::text,
        'role', 'authenticated'
      )::text;
      perform set_config('request.jwt.claims', v_claims, true);

      v_result := public.provision_live_snake_draft_v2(
        v_job.league_id,
        v_job.teams,
        v_job.pokemon,
        v_job.pick_order,
        v_job.settings,
        v_job.keepers,
        v_job.started_state
      );

      v_limit_minutes := public.draft_setting_nonnegative_integer(
        v_job.settings,
        'pickTimeLimitMinutes',
        0
      );
      update public.draft_sessions
      set updated_at = clock_timestamp()
      where id = (v_result ->> 'draft_session_id')::uuid;

      update public.league_state_snapshots
      set state = jsonb_set(
                    jsonb_set(state, '{settings,draftScheduledAt}', 'null'::jsonb, true),
                    '{pickDeadline}',
                    case when v_limit_minutes > 0
                      then to_jsonb(v_now_ms + v_limit_minutes::bigint * 60000)
                      else 'null'::jsonb
                    end,
                    true
                  ),
          revision = revision + 1,
          updated_at = now()
      where league_id = v_job.league_id;

      update public.leagues
      set draft_starts_at = null, updated_at = now()
      where id = v_job.league_id;
      update public.scheduled_snake_draft_jobs
      set status = 'started', last_error = null, updated_at = now()
      where league_id = v_job.league_id;
      v_started := v_started + 1;
    exception when others then
      update public.scheduled_snake_draft_jobs
      set status = 'failed', last_error = sqlerrm, updated_at = now()
      where league_id = v_job.league_id;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_job.league_id,
        'draft_start_failed',
        null,
        jsonb_build_object('error', sqlerrm)
      );
      v_failed := v_failed + 1;
    end;
  end loop;

  for v_session in
    select session.*
    from public.draft_sessions session
    join public.leagues league on league.id = session.league_id
    join public.teams active_team on active_team.id = session.current_team_id
    join public.league_state_snapshots snapshot
      on snapshot.league_id = session.league_id
    where session.mode = 'snake'
      and session.status = 'active'
      and (
        active_team.owner_membership_id is null
        or lower(coalesce(
          snapshot.state #>> array['teams', active_team.source_key, 'autoDraft'],
          'false'
        )) in ('true', 't', '1', 'yes', 'on')
        or (
          public.draft_setting_nonnegative_integer(
            league.settings,
            'pickTimeLimitMinutes',
            0
          ) > 0
          and session.updated_at + make_interval(
            mins => public.draft_setting_nonnegative_integer(
              league.settings,
              'pickTimeLimitMinutes',
              0
            )
          ) <= clock_timestamp()
        )
      )
    order by session.updated_at
    for update of session skip locked
  loop
    begin
      select snapshot.state
      into v_state
      from public.league_state_snapshots snapshot
      where snapshot.league_id = v_session.league_id
      for update of snapshot;

      if lower(coalesce(v_state ->> 'paused', 'false'))
        in ('true', 't', '1', 'yes', 'on') then
        continue;
      end if;

      select team.source_key::integer, membership.user_id
      into v_team_index, v_owner_id
      from public.teams team
      left join public.league_memberships membership
        on membership.id = team.owner_membership_id
      where team.id = v_session.current_team_id;

      if v_owner_id is null then
        select league.created_by
        into v_owner_id
        from public.leagues league
        where league.id = v_session.league_id;
      end if;

      v_claims := json_build_object(
        'sub', v_owner_id::text,
        'role', 'authenticated'
      )::text;
      perform set_config('request.jwt.claims', v_claims, true);
      v_picked := false;

      for v_candidate in
        with choices as (
          select
            pokemon.id,
            queue.position::bigint as choice_order,
            0 as source_order
          from public.private_draft_queue_items queue
          join public.league_pokemon pokemon
            on pokemon.league_id = queue.league_id
          join public.pokemon_catalogue catalogue
            on catalogue.id = pokemon.pokemon_id
           and lower(catalogue.display_name) = lower(queue.pokemon_name)
          where queue.league_id = v_session.league_id
            and queue.user_id = v_owner_id
            and queue.team_index = v_team_index

          union all

          select
            pokemon.id,
            pool.ordinality::bigint as choice_order,
            1 as source_order
          from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
            with ordinality pool(mon, ordinality)
          join public.league_pokemon pokemon
            on pokemon.league_id = v_session.league_id
           and pokemon.source_key = pool.mon ->> 'id'
        ),
        ranked as (
          select
            choices.id,
            min(choices.source_order) as source_order,
            min(choices.choice_order) filter (
              where choices.source_order = (
                select min(inner_choice.source_order)
                from choices inner_choice
                where inner_choice.id = choices.id
              )
            ) as choice_order
          from choices
          group by choices.id
        )
        select ranked.id
        from ranked
        join public.league_pokemon pokemon on pokemon.id = ranked.id
        where pokemon.is_allowed and not pokemon.is_drafted
        order by ranked.source_order, ranked.choice_order
      loop
        begin
          perform public.make_snake_pick(v_session.id, v_candidate.id);
          delete from public.private_draft_queue_items
          where league_id = v_session.league_id
            and pokemon_name = (
              select catalogue.display_name
              from public.league_pokemon pokemon
              join public.pokemon_catalogue catalogue
                on catalogue.id = pokemon.pokemon_id
              where pokemon.id = v_candidate.id
            );
          v_picked := true;
          v_picked_count := v_picked_count + 1;
          exit;
        exception when others then
          null;
        end;
      end loop;

      if not v_picked then
        select league.created_by into v_owner_id
        from public.leagues league
        where league.id = v_session.league_id;
        perform set_config(
          'request.jwt.claims',
          json_build_object(
            'sub', v_owner_id::text,
            'role', 'authenticated'
          )::text,
          true
        );
        perform public.advance_live_snake_turn(v_session.league_id);
        v_advanced := v_advanced + 1;
      end if;

      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_session.league_id,
        'draft_clock_resolved',
        null,
        jsonb_build_object(
          'pick_number', v_session.current_pick_number,
          'team_id', v_session.current_team_id,
          'resolution', case
            when v_picked then 'automatic_pick'
            else 'advanced'
          end
        )
      );
    exception when others then
      v_failed := v_failed + 1;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_session.league_id,
        'draft_clock_resolution_failed',
        null,
        jsonb_build_object(
          'pick_number', v_session.current_pick_number,
          'team_id', v_session.current_team_id,
          'error', sqlerrm
        )
      );
    end;
  end loop;

  perform set_config(
    'request.jwt.claims',
    coalesce(nullif(v_previous_claims, ''), '{}'),
    true
  );
  return jsonb_build_object(
    'started', v_started,
    'automatic_picks', v_picked_count,
    'advanced', v_advanced,
    'failed', v_failed
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.report_operational_issue(p_kind text, p_message text, p_league_id uuid DEFAULT NULL::uuid, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_context jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in before reporting an operational issue.';
  end if;
  if p_kind not in (
    'league_save_failed',
    'draft_operation_failed',
    'result_save_failed',
    'client_runtime_error'
  ) then
    raise exception 'Unsupported operational issue category.';
  end if;
  if p_league_id is not null and not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;
  if (
    select count(*)
    from public.operational_health_events
    where actor_id = auth.uid()
      and occurred_at > now() - interval '1 hour'
  ) >= 20 then
    return;
  end if;

  select coalesce(jsonb_object_agg(entry.key,
    case when jsonb_typeof(entry.value) = 'string'
      then to_jsonb(left(entry.value #>> '{}', 200))
      else entry.value
    end
  ), '{}'::jsonb)
  into v_context
  from jsonb_each(case when jsonb_typeof(p_context) = 'object' then p_context else '{}'::jsonb end) as entry
  where entry.key in ('revision', 'tab', 'draft_type', 'action', 'phase', 'status');

  insert into public.operational_health_events(actor_id, league_id, kind, message, context)
  values (auth.uid(), p_league_id, p_kind, public.sanitize_operational_error_message(p_message), v_context);
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_my_match_availability(p_league_id uuid, p_season_number integer, p_week integer, p_match integer, p_slots jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_actor_team integer;
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_slot jsonb;
  v_start timestamptz;
  v_end timestamptz;
begin
  if jsonb_typeof(coalesce(p_slots, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_slots, '[]'::jsonb)) > 12 then
    raise exception 'Save no more than 12 availability windows.';
  end if;
  select state into v_state from public.league_state_snapshots
  where league_id = p_league_id for update;
  v_actor_team := public.match_availability_actor_team(
    p_league_id, v_state, p_week, p_match
  );
  if v_actor_team is null then
    raise exception 'Only the two scheduled managers can coordinate this match.';
  end if;
  if coalesce((v_state ->> 'seasonNumber')::integer, 1) <> p_season_number then
    raise exception 'That season is no longer active.';
  end if;
  begin
    v_week_start := (v_state #>> '{settings,seasonStartsAt}')::timestamptz
      + make_interval(days => p_week * 7);
  exception when others then
    raise exception 'This league needs a weekly season start before availability can be saved.';
  end;
  v_week_end := v_week_start + interval '7 days';

  for v_slot in select value from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb))
  loop
    begin
      v_start := (v_slot ->> 'starts_at')::timestamptz;
      v_end := (v_slot ->> 'ends_at')::timestamptz;
    exception when others then
      raise exception 'Choose valid availability dates and times.';
    end;
    if v_start < v_week_start or v_end > v_week_end
       or v_end <= v_start or v_end > v_start + interval '12 hours' then
      raise exception 'Availability must fall within this match week and last no more than 12 hours.';
    end if;
  end loop;

  delete from public.league_match_availability
  where league_id = p_league_id
    and season_number = p_season_number
    and week_index = p_week
    and match_index = p_match
    and user_id = auth.uid();

  insert into public.league_match_availability (
    league_id, season_number, week_index, match_index, user_id, starts_at, ends_at
  )
  select p_league_id, p_season_number, p_week, p_match, auth.uid(),
    (value ->> 'starts_at')::timestamptz,
    (value ->> 'ends_at')::timestamptz
  from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb));

  return public.get_my_match_availability(
    p_league_id, p_season_number, p_week, p_match
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_my_match_reminder_preferences(p_enabled boolean, p_offsets_minutes integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_offsets integer[];
  v_schedule_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to manage reminders.'; end if;
  if array_position(coalesce(p_offsets_minutes, array[]::integer[]), null) is not null then
    raise exception 'Reminder offsets cannot be empty values.';
  end if;
  select coalesce(array_agg(distinct value order by value desc), array[]::integer[])
  into v_offsets from unnest(coalesce(p_offsets_minutes, array[]::integer[])) value;
  if cardinality(v_offsets) > 4 or not (v_offsets <@ array[2880, 1440, 120, 60]) then
    raise exception 'Choose up to four supported reminder offsets.';
  end if;
  insert into public.match_reminder_preferences(user_id, enabled, offsets_minutes)
  values(auth.uid(), coalesce(p_enabled, false), v_offsets)
  on conflict(user_id) do update set enabled = excluded.enabled,
    offsets_minutes = excluded.offsets_minutes, updated_at = now();
  for v_schedule_id in
    select schedule.id
    from public.league_match_schedules schedule
    join public.league_state_snapshots snapshot on snapshot.league_id = schedule.league_id
    where schedule.status = 'confirmed'
      and schedule.scheduled_at > now()
      and auth.uid() = any(public.match_schedule_participant_users(
        snapshot.state, schedule.week_index, schedule.match_index
      ))
  loop
    perform public.enqueue_match_schedule_reminders(v_schedule_id);
  end loop;
  return jsonb_build_object('enabled', coalesce(p_enabled, false), 'offsets_minutes', v_offsets);
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_tester_feedback(p_tester_alias text, p_reported_at timestamp with time zone, p_reporter_timezone text, p_device_browser text, p_account_role text, p_league_id uuid, p_league_name text, p_draft_type text, p_attempted text, p_expected_result text, p_actual_result text, p_refresh_fixed text, p_evidence_url text, p_severity text, p_release text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_feedback public.tester_feedback;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before submitting tester feedback.';
  end if;
  if p_league_id is not null and not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;
  if (
    select count(*)
    from public.tester_feedback
    where reporter_id = auth.uid()
      and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Too many reports were submitted recently. Please wait before trying again.';
  end if;
  if p_severity not in ('Blocker', 'Major', 'Minor', 'Suggestion') then
    raise exception 'Choose a valid severity.';
  end if;
  if p_draft_type not in ('snake', 'auction', 'not_applicable', 'unknown') then
    raise exception 'Choose a valid draft type.';
  end if;
  if p_refresh_fixed not in ('yes', 'no', 'not_tried') then
    raise exception 'Choose whether refreshing fixed the problem.';
  end if;
  if p_evidence_url is not null
     and btrim(p_evidence_url) <> ''
     and btrim(p_evidence_url) !~* '^https?://' then
    raise exception 'Screenshot or recording links must start with http:// or https://.';
  end if;
  if p_league_id is not null then
    select m.role::text into v_role
      from public.league_memberships m
      where m.league_id = p_league_id and m.user_id = auth.uid()
      limit 1;
  end if;

  insert into public.tester_feedback (
    reporter_id,
    league_id,
    severity,
    tester_alias,
    reported_at,
    reporter_timezone,
    device_browser,
    account_role,
    league_name,
    draft_type,
    attempted,
    expected_result,
    actual_result,
    refresh_fixed,
    evidence_url,
    release
  ) values (
    auth.uid(),
    p_league_id,
    p_severity,
    left(coalesce(nullif(btrim(p_tester_alias), ''), 'Anonymous tester'), 100),
    coalesce(p_reported_at, now()),
    left(coalesce(nullif(btrim(p_reporter_timezone), ''), 'UTC'), 100),
    left(coalesce(nullif(btrim(p_device_browser), ''), 'Unknown device and browser'), 160),
    left(coalesce(v_role, nullif(btrim(p_account_role), ''), 'unknown'), 40),
    left(coalesce(nullif(btrim(p_league_name), ''), 'No league selected'), 160),
    p_draft_type,
    left(coalesce(nullif(btrim(p_attempted), ''), 'Not supplied'), 2000),
    left(coalesce(nullif(btrim(p_expected_result), ''), 'Not supplied'), 2000),
    left(coalesce(nullif(btrim(p_actual_result), ''), 'Not supplied'), 4000),
    p_refresh_fixed,
    nullif(left(btrim(p_evidence_url), 1000), ''),
    left(coalesce(nullif(btrim(p_release), ''), 'unknown'), 120)
  )
  returning * into v_feedback;

  return jsonb_build_object(
    'issue_number', 'DC-' || lpad(v_feedback.id::text, 6, '0'),
    'status', v_feedback.status,
    'created_at', v_feedback.created_at,
    'correlation_id', v_feedback.correlation_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.teardown_league_match_schedule_rehearsal(p_league_id uuid, p_remove_participant_preferences boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_events integer := 0;
  v_schedules integer := 0;
  v_preferences integer := 0;
  v_users uuid[];
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can run scheduling rehearsal teardown.';
  end if;
  select coalesce(array_agg(distinct participant), array[]::uuid[])
  into v_users
  from public.league_match_schedules schedule
  join public.league_state_snapshots snapshot on snapshot.league_id = schedule.league_id
  cross join lateral unnest(public.match_schedule_participant_users(
    snapshot.state, schedule.week_index, schedule.match_index
  )) participant
  where schedule.league_id = p_league_id;

  delete from public.notification_events
  where league_id = p_league_id and kind = 'match_reminder'
    and payload ? 'match_schedule_id';
  get diagnostics v_events = row_count;

  delete from public.league_match_schedules where league_id = p_league_id;
  get diagnostics v_schedules = row_count;

  if coalesce(p_remove_participant_preferences, false) then
    delete from public.match_reminder_preferences where user_id = any(v_users);
    get diagnostics v_preferences = row_count;
  end if;

  return jsonb_build_object(
    'notification_events_deleted', v_events,
    'schedules_deleted', v_schedules,
    'preferences_deleted', v_preferences
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_tester_feedback_status(p_issue_number text, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_feedback public.tester_feedback;
begin
  if p_status not in (
    'New',
    'Needs reproduction',
    'Confirmed',
    'Fixing',
    'Ready to retest',
    'Verified',
    'Deferred'
  ) then
    raise exception 'Choose a valid issue status.';
  end if;
  if upper(btrim(p_issue_number)) !~ '^DC-[0-9]+$' then
    raise exception 'Choose a valid DraftCenter issue number.';
  end if;
  v_id := substring(upper(btrim(p_issue_number)) from '^DC-([0-9]+)$')::bigint;
  select * into v_feedback
    from public.tester_feedback
    where id = v_id;
  if v_feedback.id is null then
    raise exception 'Tester report not found.';
  end if;
  if v_feedback.league_id is null or not public.is_league_staff(v_feedback.league_id) then
    raise exception 'Only league staff can triage this report.';
  end if;
  update public.tester_feedback
    set status = p_status, updated_at = now()
    where id = v_id
    returning * into v_feedback;
  return jsonb_build_object(
    'issue_number', 'DC-' || lpad(v_feedback.id::text, 6, '0'),
    'status', v_feedback.status,
    'updated_at', v_feedback.updated_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_match_schedule_time(p_state jsonb, p_week integer, p_scheduled_at timestamp with time zone, p_timezone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_week_start timestamptz;
begin
  if not exists (
    select 1 from pg_timezone_names where name = nullif(btrim(p_timezone), '')
  ) then raise exception 'Choose a valid time zone.'; end if;
  begin
    v_week_start := (p_state #>> '{settings,seasonStartsAt}')::timestamptz
      + make_interval(days => p_week * 7);
  exception when others then
    raise exception 'This league needs a weekly season start before a match can be scheduled.';
  end;
  if p_scheduled_at < v_week_start or p_scheduled_at >= v_week_start + interval '7 days' then
    raise exception 'The match time must fall within its scheduled week.';
  end if;
end;
$function$;

drop function if exists public.reset_current_weekly_claim_cycle(uuid);

commit;

notify pgrst, 'reload schema';
