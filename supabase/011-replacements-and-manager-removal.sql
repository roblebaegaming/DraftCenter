-- DraftCenter milestone 8: replacements and safe manager removal.
-- Run once AFTER migrations 001-010.

create or replace function public.auto_assign_open_team(p_league_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_state jsonb; v_index integer; v_name text; v_username text; v_team_id uuid; v_membership_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select display_name, username into v_name, v_username from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), nullif(v_username, ''), 'Coach');
  insert into public.league_memberships (league_id, user_id, role) values (p_league_id, auth.uid(), 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end
    returning id into v_membership_id;

  -- Prefer the relational team table when a live draft has been provisioned.
  if exists (select 1 from public.draft_sessions where league_id = p_league_id) then
    select id into v_team_id from public.teams where league_id = p_league_id and owner_membership_id is null order by random() limit 1 for update skip locked;
    if v_team_id is null then return jsonb_build_object('assigned', false); end if;
    update public.teams set owner_membership_id = v_membership_id where id = v_team_id;
    select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
    if v_state is not null then
      select source_key::integer into v_index from public.teams where id = v_team_id;
      v_state := jsonb_set(v_state, array['teams', v_index::text, 'claimedBy'], to_jsonb(v_name), true);
      update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
    end if;
    insert into public.league_events(league_id, kind, actor_id, payload) values (p_league_id, 'replacement_assigned', auth.uid(), jsonb_build_object('team_id', v_team_id));
    return jsonb_build_object('assigned', true, 'team_id', v_team_id);
  end if;

  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  -- A replacement may be needed after a manual/off-platform draft has locked
  -- the saved prototype state, so an open saved team remains claimable here.
  if v_state is null then return jsonb_build_object('assigned', false); end if;
  select ordinality - 1 into v_index from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) with ordinality
    where nullif(trim(value ->> 'claimedBy'), '') is null order by random() limit 1;
  if v_index is null then return jsonb_build_object('assigned', false); end if;
  v_state := jsonb_set(v_state, array['teams', v_index::text, 'claimedBy'], to_jsonb(v_name), true);
  update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  return jsonb_build_object('assigned', true, 'team_index', v_index);
end;
$$;

create or replace function public.remove_league_manager(p_league_id uuid, p_username text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_target_id uuid; v_target public.league_memberships; v_actor_role public.membership_role; v_state jsonb; v_name text;
begin
  select role into v_actor_role from public.league_memberships where league_id = p_league_id and user_id = auth.uid();
  if v_actor_role not in ('commissioner', 'co_commissioner') then raise exception 'Only league commissioners can remove managers.'; end if;
  select id, display_name into v_target_id, v_name from public.profiles where lower(username) = lower(trim(p_username));
  if v_target_id is null then raise exception 'No DraftCenter account has that username.'; end if;
  select * into v_target from public.league_memberships where league_id = p_league_id and user_id = v_target_id for update;
  if v_target.id is null then raise exception 'That user is not in this league.'; end if;
  if v_target.user_id = auth.uid() then raise exception 'You cannot remove yourself.'; end if;
  if v_target.role = 'commissioner' then raise exception 'The primary commissioner cannot be removed.'; end if;
  if v_actor_role = 'co_commissioner' and v_target.role <> 'coach' then raise exception 'Only the primary commissioner can remove a co-commissioner.'; end if;
  update public.teams set owner_membership_id = null where league_id = p_league_id and owner_membership_id = v_target.id;
  delete from public.team_assignments where assigned_to = v_target_id and team_id in (select id from public.teams where league_id = p_league_id);
  delete from public.league_memberships where id = v_target.id;
  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  if v_state is not null then
    v_state := jsonb_set(v_state, '{teams}', coalesce((select jsonb_agg(case when lower(coalesce(team.value ->> 'claimedBy', '')) = lower(coalesce(v_name, '')) then jsonb_set(team.value, '{claimedBy}', 'null'::jsonb, true) else team.value end order by team.ordinality) from jsonb_array_elements(v_state -> 'teams') with ordinality as team(value, ordinality)), '[]'::jsonb));
    update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  end if;
  insert into public.league_events(league_id, kind, actor_id, payload) values (p_league_id, 'manager_removed', auth.uid(), jsonb_build_object('username', lower(trim(p_username))));
end;
$$;

grant execute on function public.auto_assign_open_team(uuid) to authenticated;
grant execute on function public.remove_league_manager(uuid, text) to authenticated;
