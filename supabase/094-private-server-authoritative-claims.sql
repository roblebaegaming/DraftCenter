-- Keep queued free-agent claims, especially FAAB bids, out of the
-- member-readable league snapshot. Claim submission, withdrawal, visibility,
-- and processing finalization are permission-checked and share the snapshot
-- row lock. Winner ordering remains compatible with the existing league UI.

begin;

create table if not exists public.league_free_agent_claims (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_index integer not null check (team_index >= 0),
  add_name text not null,
  add_mon jsonb not null,
  drop_name text,
  bid_amount integer check (bid_amount is null or bid_amount >= 0),
  week integer not null default 0 check (week >= 0),
  submitted_at timestamptz not null default now(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  unique (league_id, team_index, add_name)
);

create index if not exists league_free_agent_claims_league_add_idx
  on public.league_free_agent_claims(league_id, lower(add_name), submitted_at);

alter table public.league_free_agent_claims enable row level security;
revoke all on table public.league_free_agent_claims
  from public, anon, authenticated;

-- No current or older whole-snapshot writer may copy private claims back into
-- the member-readable JSON document.
create or replace function public.strip_private_claims_from_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.state := jsonb_set(
    coalesce(new.state, '{}'::jsonb),
    '{pendingClaims}',
    '[]'::jsonb,
    true
  );
  return new;
end;
$$;

drop trigger if exists strip_private_claims_from_snapshot
  on public.league_state_snapshots;
create trigger strip_private_claims_from_snapshot
before insert or update of state on public.league_state_snapshots
for each row execute function public.strip_private_claims_from_snapshot();

-- Move any queued claims created before this migration into the private table.
-- The snapshot retains no pending-claim payload after the move.
insert into public.league_free_agent_claims(
  id, league_id, team_index, add_name, add_mon, drop_name, bid_amount,
  week, submitted_at, submitted_by
)
select
  case when coalesce(c.value ->> 'id', '') ~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then (c.value ->> 'id')::uuid else gen_random_uuid() end,
  s.league_id,
  (c.value ->> 'teamIdx')::integer,
  c.value ->> 'addName',
  coalesce(
    (
      select mon.value
      from jsonb_array_elements(coalesce(s.state -> 'pool', '[]'::jsonb)) mon(value)
      where lower(mon.value ->> 'name') = lower(c.value ->> 'addName')
      limit 1
    ),
    jsonb_build_object('name', c.value ->> 'addName')
  ),
  nullif(c.value ->> 'dropName', ''),
  case
    when coalesce(c.value ->> 'bidAmount', '') ~ '^\d+$'
    then (c.value ->> 'bidAmount')::integer
    else null
  end,
  case
    when coalesce(c.value ->> 'week', '') ~ '^\d+$'
    then (c.value ->> 'week')::integer
    else 0
  end,
  case
    when coalesce(c.value ->> 'submittedAt', '') ~ '^\d+(\.\d+)?$'
    then to_timestamp((c.value ->> 'submittedAt')::double precision / 1000.0)
    else now()
  end,
  l.created_by
from public.league_state_snapshots s
join public.leagues l on l.id = s.league_id
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(s.state -> 'pendingClaims') = 'array'
    then s.state -> 'pendingClaims'
    else '[]'::jsonb
  end
) c(value)
where nullif(c.value ->> 'addName', '') is not null
  and coalesce(c.value ->> 'teamIdx', '') ~ '^\d+$'
on conflict (league_id, team_index, add_name) do nothing;

update public.league_state_snapshots
set state = jsonb_set(state, '{pendingClaims}', '[]'::jsonb, true),
    revision = revision + 1,
    updated_at = now()
where case
  when jsonb_typeof(state -> 'pendingClaims') = 'array'
  then jsonb_array_length(state -> 'pendingClaims') > 0
  else false
end;

create or replace function public.list_private_free_agent_claims(p_league_id uuid)
returns table (
  id uuid,
  team_index integer,
  add_name text,
  drop_name text,
  bid_amount integer,
  week integer,
  submitted_at timestamptz,
  can_withdraw boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_state jsonb;
  v_staff boolean;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id;
  v_staff := public.is_league_staff(p_league_id);

  return query
  select
    c.id,
    c.team_index,
    c.add_name,
    c.drop_name,
    case
      when v_staff
        or public.league_actor_can_control_snapshot_team(
          p_league_id, v_state, c.team_index
        )
      then c.bid_amount
      else null
    end,
    c.week,
    c.submitted_at,
    v_staff
      or public.league_actor_can_control_snapshot_team(
        p_league_id, v_state, c.team_index
      )
  from public.league_free_agent_claims c
  where c.league_id = p_league_id
  order by c.submitted_at, c.id;
end;
$$;

create or replace function public.submit_private_free_agent_claim(
  p_league_id uuid,
  p_team_index integer,
  p_add_name text,
  p_add_mon jsonb,
  p_drop_name text default null,
  p_bid_amount integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_result jsonb;
  v_claim jsonb;
  v_claim_id uuid;
begin
  -- Reuse migration 091's complete permission, deadline, roster, pool, cap,
  -- and budget validation while holding the same snapshot lock.
  v_result := public.mutate_league_transaction(
    p_league_id,
    'claim_submit',
    jsonb_build_object(
      'team_index', p_team_index,
      'add_name', p_add_name,
      'add_mon', p_add_mon,
      'drop_name', p_drop_name,
      'bid_amount', p_bid_amount
    )
  );

  select value into v_claim
  from jsonb_array_elements(coalesce(v_result -> 'pendingClaims', '[]'::jsonb))
  where (value ->> 'teamIdx')::integer = p_team_index
    and lower(value ->> 'addName') = lower(btrim(p_add_name))
  order by (value ->> 'submittedAt')::bigint desc
  limit 1;
  if v_claim is null then
    raise exception 'The claim could not be created.';
  end if;

  v_claim_id := gen_random_uuid();
  insert into public.league_free_agent_claims(
    id, league_id, team_index, add_name, add_mon, drop_name, bid_amount,
    week, submitted_at, submitted_by
  ) values (
    v_claim_id,
    p_league_id,
    p_team_index,
    v_claim ->> 'addName',
    p_add_mon,
    nullif(v_claim ->> 'dropName', ''),
    nullif(v_claim ->> 'bidAmount', '')::integer,
    greatest(0, coalesce((v_claim ->> 'week')::integer, 0)),
    to_timestamp((v_claim ->> 'submittedAt')::double precision / 1000.0),
    auth.uid()
  );

  -- Private claims never remain in the shared snapshot.
  v_result := jsonb_set(v_result, '{pendingClaims}', '[]'::jsonb, true);
  update public.league_state_snapshots
  set state = v_result
  where league_id = p_league_id;

  return jsonb_build_object('state', v_result, 'claim_id', v_claim_id);
end;
$$;

create or replace function public.cancel_private_free_agent_claim(
  p_league_id uuid,
  p_claim_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_claim public.league_free_agent_claims%rowtype;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  select * into v_claim
  from public.league_free_agent_claims
  where league_id = p_league_id and id = p_claim_id
  for update;
  if v_claim.id is null then
    raise exception 'That pending claim was not found.';
  end if;
  if not public.league_actor_can_control_snapshot_team(
    p_league_id, v_state, v_claim.team_index
  ) then
    raise exception 'Only that team owner or a commissioner can withdraw this claim.';
  end if;
  delete from public.league_free_agent_claims where id = p_claim_id;
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
    'free_agent_claim_withdrawn',
    auth.uid(),
    jsonb_build_object(
      'claim_id', p_claim_id,
      'team_index', v_claim.team_index
    )
  );
  return v_state;
end;
$$;

create or replace function public.finalize_private_free_agent_claims(
  p_league_id uuid,
  p_state jsonb,
  p_claim_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_incoming jsonb := p_state;
  v_expected_ids text[];
  v_actual_ids text[];
  v_sanitized_results jsonb;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can process pending claims.';
  end if;
  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_claim_ids, 'null'::jsonb)) <> 'array' then
    raise exception 'The claim-processing request is invalid.';
  end if;

  select state into v_existing
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;
  if coalesce((p_state ->> 'rev')::bigint, -1)
     <> coalesce((v_existing ->> 'rev')::bigint, 0) + 1 then
    raise exception 'League data changed while claims were processing. Reload and try again.';
  end if;
  if jsonb_typeof(coalesce(p_state -> 'pendingClaims', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_state -> 'pendingClaims', '[]'::jsonb)) <> 0 then
    raise exception 'Processed state must not retain pending claims.';
  end if;

  select coalesce(array_agg(value order by value), array[]::text[])
  into v_expected_ids
  from jsonb_array_elements_text(p_claim_ids);
  select coalesce(array_agg(id::text order by id::text), array[]::text[])
  into v_actual_ids
  from public.league_free_agent_claims
  where league_id = p_league_id;
  if v_expected_ids is distinct from v_actual_ids then
    raise exception 'Pending claims changed while processing. Reload and try again.';
  end if;

  -- Winning bids may be published by league policy later. For now the shared
  -- snapshot records outcomes without copying any private bid into history.
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(result.value -> 'claim') = 'object'
        then jsonb_set(
          result.value,
          '{claim}',
          (result.value -> 'claim') - 'bidAmount',
          false
        )
        else result.value
      end
      order by result.ordinality
    ),
    '[]'::jsonb
  )
  into v_sanitized_results
  from jsonb_array_elements(
    coalesce(p_state -> 'lastClaimResults', '[]'::jsonb)
  ) with ordinality result(value, ordinality);
  v_incoming := jsonb_set(
    v_incoming,
    '{lastClaimResults}',
    v_sanitized_results,
    true
  );
  v_incoming := jsonb_set(v_incoming, '{pendingClaims}', '[]'::jsonb, true);

  update public.league_state_snapshots
  set state = v_incoming,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;
  delete from public.league_free_agent_claims
  where league_id = p_league_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'free_agent_claims_processed',
    auth.uid(),
    jsonb_build_object('claim_count', cardinality(v_actual_ids))
  );
  return v_incoming;
end;
$$;

revoke all on function public.list_private_free_agent_claims(uuid)
  from public, anon, authenticated;
revoke all on function public.strip_private_claims_from_snapshot()
  from public, anon, authenticated;
revoke all on function public.submit_private_free_agent_claim(
  uuid, integer, text, jsonb, text, integer
) from public, anon, authenticated;
revoke all on function public.cancel_private_free_agent_claim(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_private_free_agent_claims(
  uuid, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.list_private_free_agent_claims(uuid)
  to authenticated;
grant execute on function public.submit_private_free_agent_claim(
  uuid, integer, text, jsonb, text, integer
) to authenticated;
grant execute on function public.cancel_private_free_agent_claim(uuid, uuid)
  to authenticated;
grant execute on function public.finalize_private_free_agent_claims(
  uuid, jsonb, jsonb
) to authenticated;

commit;

notify pgrst, 'reload schema';
