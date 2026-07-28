-- Allow an existing manager to restore staff ownership of an orphaned hosted
-- league. The league row lock serializes concurrent claims so only one member
-- can become the primary commissioner.

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
          'actor', v_identity,
          'action', 'Claimed vacant hosted league commissioner role',
          'timestamp', now()
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

revoke all on function public.claim_vacant_league_commissioner(uuid) from public, anon;
grant execute on function public.claim_vacant_league_commissioner(uuid) to authenticated;

commit;
