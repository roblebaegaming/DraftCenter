-- Keep hosted commissioner claims compatible with the league activity feed's
-- audit-entry shape, and repair entries written by migration 230.

begin;

create or replace function public.claim_vacant_league_commissioner(
  p_league_id uuid
)
returns public.league_memberships
language plpgsql
security definer
set search_path = public
as $$
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
$$;

with repaired as (
  select
    snapshot.league_id,
    jsonb_agg(
      case
        when entry.item ->> 'action' = 'Claimed vacant hosted league commissioner role'
          and not (entry.item ? 'ts')
        then
          (entry.item - 'timestamp')
          || jsonb_build_object(
            'id',
            coalesce(
              nullif(entry.item ->> 'id', ''),
              'commissioner-claim-repaired-' || entry.ordinality::text
            ),
            'ts',
            floor(
              extract(
                epoch from coalesce(
                  nullif(entry.item ->> 'timestamp', '')::timestamptz,
                  snapshot.updated_at
                )
              ) * 1000
            )::bigint,
            'detail',
            coalesce(entry.item ->> 'detail', '')
          )
        else entry.item
      end
      order by entry.ordinality
    ) as audit_log
  from public.league_state_snapshots snapshot
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'auditLog', '[]'::jsonb)
  ) with ordinality as entry(item, ordinality)
  where entry.item ->> 'action' = 'Claimed vacant hosted league commissioner role'
    and not (entry.item ? 'ts')
  group by snapshot.league_id
)
update public.league_state_snapshots snapshot
set state = jsonb_set(snapshot.state, '{auditLog}', repaired.audit_log, true),
    revision = snapshot.revision + 1,
    updated_at = now()
from repaired
where repaired.league_id = snapshot.league_id;

revoke all on function public.claim_vacant_league_commissioner(uuid) from public, anon;
grant execute on function public.claim_vacant_league_commissioner(uuid) to authenticated;

commit;
