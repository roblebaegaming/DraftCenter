-- Treat snapshot account ownership as authoritative for team-scoped actions.
-- This preserves relational ownership and legacy display-name fallbacks while
-- repairing teams that were reclaimed through claimedByUserId.

begin;

create or replace function public.league_actor_can_control_snapshot_team(
  p_league_id uuid,
  p_state jsonb,
  p_team_index integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claimed_by text;
  v_claimed_by_user_id text;
  v_display_name text;
  v_username text;
begin
  if public.is_league_staff(p_league_id) then
    return true;
  end if;
  if auth.uid() is null
     or not public.is_league_member(p_league_id)
     or p_team_index is null
     or p_team_index < 0
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or p_team_index >= jsonb_array_length(p_state -> 'teams') then
    return false;
  end if;

  v_claimed_by_user_id := nullif(
    btrim(p_state #>> array['teams', p_team_index::text, 'claimedByUserId']),
    ''
  );
  if v_claimed_by_user_id = auth.uid()::text then
    return true;
  end if;

  if exists (
    select 1
    from public.teams t
    join public.league_memberships membership
      on membership.id = t.owner_membership_id
    where t.league_id = p_league_id
      and t.source_key = p_team_index::text
      and membership.user_id = auth.uid()
  ) then
    return true;
  end if;

  select display_name, username
  into v_display_name, v_username
  from public.profiles
  where id = auth.uid();

  v_claimed_by := nullif(
    btrim(p_state #>> array['teams', p_team_index::text, 'claimedBy']),
    ''
  );
  return v_claimed_by is not null
    and (
      lower(v_claimed_by) = lower(coalesce(v_username, ''))
      or lower(v_claimed_by) = lower(coalesce(v_display_name, ''))
    );
end;
$$;

revoke all on function public.league_actor_can_control_snapshot_team(
  uuid, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.league_actor_can_control_snapshot_team(
  uuid, jsonb, integer
) to authenticated;

commit;
