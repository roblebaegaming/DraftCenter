-- Let each team rank its own queued claims. The saved rank is private claim
-- data and is honored before submission time when a claim cycle is processed.

begin;

alter table public.league_free_agent_claims
  add column if not exists claim_priority integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by league_id, team_index
      order by submitted_at, id
    )::integer as priority
  from public.league_free_agent_claims
)
update public.league_free_agent_claims claim
set claim_priority = ranked.priority
from ranked
where ranked.id = claim.id
  and claim.claim_priority is null;

alter table public.league_free_agent_claims
  alter column claim_priority set not null;

create or replace function public.assign_free_agent_claim_priority()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.claim_priority is null then
    select coalesce(max(claim_priority), 0) + 1
    into new.claim_priority
    from public.league_free_agent_claims
    where league_id = new.league_id
      and team_index = new.team_index;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_free_agent_claim_priority
  on public.league_free_agent_claims;
create trigger assign_free_agent_claim_priority
before insert on public.league_free_agent_claims
for each row execute function public.assign_free_agent_claim_priority();

drop function if exists public.list_private_free_agent_claims(uuid);
create function public.list_private_free_agent_claims(p_league_id uuid)
returns table (
  id uuid,
  team_index integer,
  add_name text,
  drop_name text,
  bid_amount integer,
  week integer,
  submitted_at timestamptz,
  claim_priority integer,
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
    claim.id,
    claim.team_index,
    claim.add_name,
    claim.drop_name,
    case
      when v_staff
        or public.league_actor_can_control_snapshot_team(
          p_league_id, v_state, claim.team_index
        )
      then claim.bid_amount
      else null
    end,
    claim.week,
    claim.submitted_at,
    claim.claim_priority,
    v_staff
      or public.league_actor_can_control_snapshot_team(
        p_league_id, v_state, claim.team_index
      )
  from public.league_free_agent_claims claim
  where claim.league_id = p_league_id
  order by claim.team_index, claim.claim_priority, claim.submitted_at, claim.id;
end;
$$;

create or replace function public.move_private_free_agent_claim(
  p_league_id uuid,
  p_claim_id uuid,
  p_direction integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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
  where league_id = p_league_id and id = p_claim_id
  for update;
  if v_claim.id is null then
    raise exception 'That pending claim was not found.';
  end if;
  if not public.league_actor_can_control_snapshot_team(
    p_league_id, v_state, v_claim.team_index
  ) then
    raise exception 'Only that team owner or a commissioner can reorder this claim.';
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
$$;

-- Migration 207 owns the authoritative processor. Modify only its group
-- ordering so each team's saved preference is considered before submission
-- time; contested-claim winner rules (FAAB, waiver priority, record, random)
-- remain unchanged.
do $$
declare
  v_definition text;
  v_old_select text :=
    'select lower(add_name) as add_key, min(submitted_at) as first_submitted';
  v_new_select text :=
    'select lower(add_name) as add_key, min(claim_priority) as first_priority, min(submitted_at) as first_submitted';
  v_old_order text := 'order by min(submitted_at), lower(add_name)';
  v_new_order text :=
    'order by min(claim_priority), min(submitted_at), lower(add_name)';
begin
  select pg_get_functiondef(
    'public.process_private_free_agent_claims_internal(uuid,text,timestamp with time zone,uuid)'::regprocedure
  )
  into v_definition;
  if position(v_old_select in v_definition) = 0
     or position(v_old_order in v_definition) = 0 then
    raise exception 'The private claim processor ordering could not be located.';
  end if;
  v_definition := replace(v_definition, v_old_select, v_new_select);
  v_definition := replace(v_definition, v_old_order, v_new_order);
  execute v_definition;
end;
$$;

revoke all on function public.assign_free_agent_claim_priority()
  from public, anon, authenticated;
revoke all on function public.list_private_free_agent_claims(uuid)
  from public, anon, authenticated;
revoke all on function public.move_private_free_agent_claim(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.list_private_free_agent_claims(uuid)
  to authenticated;
grant execute on function public.move_private_free_agent_claim(uuid, uuid, integer)
  to authenticated;

commit;

notify pgrst, 'reload schema';
