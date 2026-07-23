-- Atomic league communication for coaches and commissioners.
-- Spectators are intentionally excluded.

create or replace function public.mutate_league_communication(
  p_league_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.membership_role;
  v_name text;
  v_state jsonb;
  v_messages jsonb;
  v_receipts jsonb;
  v_board jsonb;
  v_direct jsonb;
  v_key text;
  v_other text;
  v_text text;
  v_id text;
  v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_revision bigint;
begin
  select role into v_role
  from public.league_memberships
  where league_id = p_league_id and user_id = auth.uid();
  if v_role is null or v_role::text = 'viewer' then
    raise exception 'Spectators cannot use league messages.';
  end if;
  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Coach')
    into v_name from public.profiles where id = auth.uid();
  select state into v_state from public.league_state_snapshots
    where league_id = p_league_id for update;
  if v_state is null then raise exception 'League state was not found.'; end if;
  v_messages := coalesce(v_state -> 'messages', '{"board":[],"direct":{}}'::jsonb);
  v_receipts := coalesce(v_state -> 'readReceipts', '{}'::jsonb);
  v_board := coalesce(v_messages -> 'board', '[]'::jsonb);
  v_direct := coalesce(v_messages -> 'direct', '{}'::jsonb);

  if p_action = 'board_post' then
    v_text := trim(p_payload ->> 'text');
    if char_length(v_text) not between 1 and 1000 then raise exception 'Enter a message up to 1,000 characters.'; end if;
    v_id := gen_random_uuid()::text;
    v_board := v_board || jsonb_build_array(jsonb_build_object('id', v_id, 'author', v_name, 'text', v_text, 'ts', v_now));
    v_messages := jsonb_set(v_messages, '{board}', v_board, true);
  elsif p_action = 'board_delete' then
    v_id := p_payload ->> 'id';
    if v_role::text not in ('commissioner', 'co_commissioner') and not exists (
      select 1 from jsonb_array_elements(v_board) m where m ->> 'id' = v_id and m ->> 'author' = v_name
    ) then raise exception 'You cannot delete that post.'; end if;
    select coalesce(jsonb_agg(m), '[]'::jsonb) into v_board from jsonb_array_elements(v_board) m where m ->> 'id' <> v_id;
    v_messages := jsonb_set(v_messages, '{board}', v_board, true);
  elsif p_action = 'direct_send' then
    v_other := trim(p_payload ->> 'to');
    v_text := trim(p_payload ->> 'text');
    if v_other = '' or char_length(v_text) not between 1 and 1000 then raise exception 'Choose a manager and enter a message.'; end if;
    v_key := case when v_name < v_other then v_name || '||' || v_other else v_other || '||' || v_name end;
    v_direct := jsonb_set(v_direct, array[v_key],
      coalesce(v_direct -> v_key, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('from', v_name, 'text', v_text, 'ts', v_now)), true);
    v_messages := jsonb_set(v_messages, '{direct}', v_direct, true);
  elsif p_action = 'board_read' then
    v_receipts := jsonb_set(v_receipts, array[v_name],
      coalesce(v_receipts -> v_name, '{}'::jsonb) || jsonb_build_object('board', v_now), true);
  elsif p_action = 'direct_read' then
    v_other := trim(p_payload ->> 'other');
    if v_other = '' then raise exception 'Choose a message thread.'; end if;
    v_key := case when v_name < v_other then v_name || '||' || v_other else v_other || '||' || v_name end;
    v_receipts := jsonb_set(v_receipts, array[v_name],
      jsonb_set(
        coalesce(v_receipts -> v_name, '{}'::jsonb),
        '{direct}',
        jsonb_set(coalesce(v_receipts #> array[v_name, 'direct'], '{}'::jsonb), array[v_key], to_jsonb(v_now), true),
        true
      ),
      true
    );
  else
    raise exception 'Unknown communication action.';
  end if;

  v_state := jsonb_set(jsonb_set(v_state, '{messages}', v_messages, true), '{readReceipts}', v_receipts, true);
  update public.league_state_snapshots
    set state = v_state, revision = revision + 1, updated_at = now()
    where league_id = p_league_id
    returning revision into v_revision;
  return jsonb_build_object('state', v_state, 'revision', v_revision);
end;
$$;

grant execute on function public.mutate_league_communication(uuid, text, jsonb) to authenticated;

-- Preserve atomically-written communication fields when a commissioner saves
-- an older in-memory league snapshot.
create or replace function public.save_league_snapshot(p_league_id uuid, p_state jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_revision bigint;
  v_existing jsonb;
  v_next jsonb := p_state;
  v_key text;
  v_protected_keys text[] := array[
    'locked', 'rosters', 'budgets', 'pool', 'auctionNominationOrder',
    'auctionNominationIdx', 'nominationDeadline', 'nominee', 'paused',
    'pausedAt', 'pauseIsOvernight', 'auctionEnded'
  ];
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can save the prototype state.';
  end if;
  select state into v_existing from public.league_state_snapshots where league_id = p_league_id for update;
  if v_existing ? 'messages' then v_next := jsonb_set(v_next, '{messages}', v_existing -> 'messages', true); end if;
  if v_existing ? 'readReceipts' then v_next := jsonb_set(v_next, '{readReceipts}', v_existing -> 'readReceipts', true); end if;
  if coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and coalesce((p_state ->> 'locked')::boolean, false) then
    foreach v_key in array v_protected_keys loop
      if v_existing ? v_key then v_next := jsonb_set(v_next, array[v_key], v_existing -> v_key, true); end if;
    end loop;
  elsif coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and not coalesce((p_state ->> 'locked')::boolean, false) then
    delete from public.auction_team_owners where league_id = p_league_id;
  end if;
  update public.league_state_snapshots
  set state = v_next, revision = revision + 1, updated_at = now()
  where league_id = p_league_id
  returning revision into v_revision;
  return v_revision;
end;
$$;

grant execute on function public.save_league_snapshot(uuid, jsonb) to authenticated;
