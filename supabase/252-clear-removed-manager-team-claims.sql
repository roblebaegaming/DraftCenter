-- Clear both saved ownership markers when league staff remove a manager.

create or replace function public.remove_league_manager(p_league_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
  v_target public.league_memberships;
  v_actor_role public.membership_role;
  v_state jsonb;
  v_name text;
  v_username text;
begin
  select role into v_actor_role
  from public.league_memberships
  where league_id = p_league_id and user_id = auth.uid();

  if v_actor_role not in ('commissioner', 'co_commissioner') then
    raise exception 'Only league commissioners can remove managers.';
  end if;

  select id, display_name, username
  into v_target_id, v_name, v_username
  from public.profiles
  where lower(username) = lower(trim(p_username));

  if v_target_id is null then raise exception 'No DraftCenter account has that username.'; end if;

  select * into v_target
  from public.league_memberships
  where league_id = p_league_id and user_id = v_target_id
  for update;

  if v_target.id is null then raise exception 'That user is not in this league.'; end if;
  if v_target.user_id = auth.uid() then raise exception 'You cannot remove yourself.'; end if;
  if v_target.role = 'commissioner' then raise exception 'The primary commissioner cannot be removed.'; end if;
  if v_actor_role = 'co_commissioner' and v_target.role <> 'coach' then
    raise exception 'Only the primary commissioner can remove a co-commissioner.';
  end if;

  update public.teams
  set owner_membership_id = null
  where league_id = p_league_id and owner_membership_id = v_target.id;

  delete from public.team_assignments
  where assigned_to = v_target_id
    and team_id in (select id from public.teams where league_id = p_league_id);

  delete from public.league_memberships where id = v_target.id;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is not null then
    v_state := jsonb_set(
      v_state,
      '{teams}',
      coalesce((
        select jsonb_agg(
          case
            when team.value ->> 'claimedByUserId' = v_target_id::text
              or (
                nullif(btrim(team.value ->> 'claimedByUserId'), '') is null
                and lower(coalesce(team.value ->> 'claimedBy', '')) in (
                  lower(coalesce(v_name, '')),
                  lower(coalesce(v_username, ''))
                )
              )
            then team.value - 'claimedBy' - 'claimedByUserId'
            else team.value
          end
          order by team.ordinality
        )
        from jsonb_array_elements(v_state -> 'teams') with ordinality as team(value, ordinality)
      ), '[]'::jsonb),
      false
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
    'manager_removed',
    auth.uid(),
    jsonb_build_object('username', lower(trim(p_username)))
  );
end;
$$;

revoke all on function public.remove_league_manager(uuid, text)
  from public, anon, authenticated;
grant execute on function public.remove_league_manager(uuid, text)
  to authenticated;
