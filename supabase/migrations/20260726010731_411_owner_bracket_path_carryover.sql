-- Migration 411: permit the approving owner to carry a privately archived
-- bracket into a smaller replacement field by preserving bracket-side choices.
-- The carried entry is explicitly labeled and audited; ordinary locked-entry
-- saving remains unchanged.

begin;

alter table public.prediction_bracket_audit_log
  drop constraint prediction_bracket_audit_log_action_check;
alter table public.prediction_bracket_audit_log
  add constraint prediction_bracket_audit_log_action_check
  check (action in (
    'published', 'superseded', 'entry_carried_forward',
    'result_recorded', 'result_corrected', 'finalized'
  ));

create or replace function public.carry_forward_prediction_bracket_entry(
  p_event_id text,
  p_source_revision integer,
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
  v_archived public.prediction_bracket_audit_log%rowtype;
  v_source_publication public.prediction_bracket_audit_log%rowtype;
  v_source_picks jsonb;
  v_target_picks jsonb := '{}'::jsonb;
  v_source_capacity integer;
  v_target_round_count integer;
  v_target_round integer;
  v_source_round integer;
  v_match integer;
  v_match_count integer;
  v_source_choice text;
  v_source_left text;
  v_source_right text;
  v_target_left text;
  v_target_right text;
  v_target_winner text;
  v_display_name text;
begin
  if p_confirmation_text <> 'CARRY FORWARD ARCHIVED OWNER ENTRY' then
    raise exception 'Confirm the archived owner-entry carry-forward.' using errcode = '22023';
  end if;
  if p_approved_by is null then
    raise exception 'An owner identity is required.' using errcode = '42501';
  end if;

  select * into v_event
  from public.prediction_bracket_events
  where event_id = p_event_id
  for update;
  if not found or v_event.revision = 0 then
    raise exception 'The replacement bracket has not been published.' using errcode = '22023';
  end if;
  if v_event.status in ('final', 'cancelled') then
    raise exception 'This bracket can no longer accept a carry-forward entry.' using errcode = '22023';
  end if;
  if now() < v_event.locks_at then
    raise exception 'Use the ordinary entry flow before the bracket locks.' using errcode = '22023';
  end if;
  if p_source_revision < 1 or p_source_revision >= v_event.revision then
    raise exception 'Choose an earlier archived bracket revision.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.prediction_bracket_entries
    where event_id = p_event_id and bracket_revision = v_event.revision
  ) then
    raise exception 'Carry-forward requires an empty replacement leaderboard.' using errcode = '22023';
  end if;

  select * into v_archived
  from public.prediction_bracket_audit_log
  where event_id = p_event_id
    and bracket_revision = p_source_revision
    and action = 'superseded'
    and actor_user_id = p_approved_by
  order by created_at desc
  limit 1;
  if not found then
    raise exception 'No archived entry belongs to the approving owner.' using errcode = '42501';
  end if;

  select * into v_source_publication
  from public.prediction_bracket_audit_log
  where event_id = p_event_id
    and bracket_revision = p_source_revision
    and action = 'published'
  order by created_at desc
  limit 1;
  if not found then
    raise exception 'The archived bracket publication is unavailable.' using errcode = '22023';
  end if;

  v_source_picks := v_archived.details -> 'picks';
  v_source_capacity := (v_source_publication.details ->> 'bracket_capacity')::integer;
  if jsonb_typeof(v_source_picks) <> 'object'
     or v_source_capacity <> v_event.bracket_capacity * 2
     or (v_source_publication.details ->> 'field_size')::integer <> v_source_capacity
     or (select count(*) from jsonb_object_keys(v_source_picks)) <> v_source_capacity - 1
     or (select count(*) from public.prediction_bracket_slots
         where event_id = p_event_id and bracket_revision = v_event.revision) <> v_event.bracket_capacity then
    raise exception 'Only a complete bracket may carry into its full next-round field.' using errcode = '22023';
  end if;

  v_target_round_count := public.prediction_bracket_round_count(v_event.bracket_capacity);
  for v_target_round in 1..v_target_round_count loop
    v_source_round := v_target_round + 1;
    v_match_count := v_event.bracket_capacity / power(2, v_target_round)::integer;
    for v_match in 1..v_match_count loop
      v_source_choice := v_source_picks ->> format('r%s-m%s', v_source_round, v_match);
      v_source_left := v_source_picks ->> format('r%s-m%s', v_source_round - 1, (v_match - 1) * 2 + 1);
      v_source_right := v_source_picks ->> format('r%s-m%s', v_source_round - 1, (v_match - 1) * 2 + 2);

      if v_target_round = 1 then
        select competitor_id into v_target_left
        from public.prediction_bracket_slots
        where event_id = p_event_id and bracket_revision = v_event.revision
          and slot_number = (v_match - 1) * 2 + 1;
        select competitor_id into v_target_right
        from public.prediction_bracket_slots
        where event_id = p_event_id and bracket_revision = v_event.revision
          and slot_number = (v_match - 1) * 2 + 2;
      else
        v_target_left := v_target_picks ->> format('r%s-m%s', v_target_round - 1, (v_match - 1) * 2 + 1);
        v_target_right := v_target_picks ->> format('r%s-m%s', v_target_round - 1, (v_match - 1) * 2 + 2);
      end if;

      if v_source_choice = v_source_left then
        v_target_winner := v_target_left;
      elsif v_source_choice = v_source_right then
        v_target_winner := v_target_right;
      else
        raise exception 'The archived choices do not form a valid bracket path.' using errcode = '22023';
      end if;
      if v_target_winner is null then
        raise exception 'The replacement bracket contains an empty carry-forward path.' using errcode = '22023';
      end if;
      v_target_picks := jsonb_set(
        v_target_picks,
        array[format('r%s-m%s', v_target_round, v_match)],
        to_jsonb(v_target_winner),
        true
      );
      v_source_choice := null;
      v_source_left := null;
      v_source_right := null;
      v_target_left := null;
      v_target_right := null;
      v_target_winner := null;
    end loop;
  end loop;

  v_display_name := left(
    coalesce(nullif(btrim(v_archived.details ->> 'display_name'), ''), 'Trainer')
      || ' · Top 16 carryover',
    60
  );
  insert into public.prediction_bracket_entries (
    event_id, user_id, bracket_revision, display_name, picks
  ) values (
    p_event_id, p_approved_by, v_event.revision, v_display_name, v_target_picks
  );

  insert into public.prediction_bracket_audit_log (
    event_id, bracket_revision, action, actor_user_id, source_url, details
  ) values (
    p_event_id,
    v_event.revision,
    'entry_carried_forward',
    p_approved_by,
    v_event.official_bracket_url,
    jsonb_build_object(
      'source_revision', p_source_revision,
      'target_revision', v_event.revision,
      'original_created_at', v_archived.details -> 'created_at',
      'mapping_policy', 'Preserve each archived next-round bracket-side choice.',
      'display_name', v_display_name,
      'picks', v_target_picks
    )
  );

  return jsonb_build_object(
    'ok', true,
    'source_revision', p_source_revision,
    'target_revision', v_event.revision,
    'display_name', v_display_name,
    'picks', v_target_picks
  );
end;
$$;

revoke all on function public.carry_forward_prediction_bracket_entry(
  text, integer, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.carry_forward_prediction_bracket_entry(
  text, integer, uuid, text
) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.carry_forward_prediction_bracket_entry(text,integer,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.carry_forward_prediction_bracket_entry(text,integer,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.carry_forward_prediction_bracket_entry(text,integer,uuid,text)', 'execute') then
    raise exception 'Bracket carry-forward grants changed unexpectedly';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
