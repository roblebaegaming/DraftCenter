-- Let league staff hand an open bot-controlled team to an already joined,
-- unassigned manager during an active draft without changing picks, rosters,
-- budgets, order, deadlines, or any other draft state.

begin;

create or replace function public.get_live_bot_takeover_options(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_draft_type text;
  v_active boolean := false;
  v_current_team integer;
  v_order jsonb;
  v_order_length integer := 0;
  v_members jsonb := '[]'::jsonb;
  v_teams jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can view live team takeover options.';
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id;

  if v_state is null then
    return jsonb_build_object('active', false, 'members', v_members, 'teams', v_teams);
  end if;

  v_draft_type := coalesce(v_state #>> '{settings,draftType}', 'snake');
  if coalesce((v_state ->> 'locked')::boolean, false) then
    if v_draft_type = 'snake' then
      v_order := coalesce(v_state -> 'snakeOrder', '[]'::jsonb);
      v_order_length := jsonb_array_length(v_order);
      v_active := coalesce((v_state ->> 'pickIndex')::integer, 0) < v_order_length;
      if v_active then
        v_current_team := (v_order ->> coalesce((v_state ->> 'pickIndex')::integer, 0))::integer;
      end if;
    elsif v_draft_type = 'auction' then
      v_order := coalesce(v_state -> 'auctionNominationOrder', '[]'::jsonb);
      v_order_length := jsonb_array_length(v_order);
      v_active := not coalesce((v_state ->> 'auctionEnded')::boolean, false)
        and jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) > 0;
      if v_active and v_order_length > 0 then
        v_current_team := (
          v_order ->> (coalesce((v_state ->> 'auctionNominationIdx')::integer, 0) % v_order_length)
        )::integer;
      end if;
    end if;
  end if;

  if not v_active then
    return jsonb_build_object(
      'active', false,
      'draft_type', v_draft_type,
      'members', v_members,
      'teams', v_teams
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'membership_id', membership.id,
    'username', profile.username,
    'display_name', profile.display_name,
    'role', membership.role
  ) order by coalesce(profile.display_name, profile.username)), '[]'::jsonb)
  into v_members
  from public.league_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.league_id = p_league_id
    and membership.role in ('commissioner', 'co_commissioner', 'coach')
    and not exists (
      select 1
      from public.teams relational_team
      where relational_team.league_id = p_league_id
        and relational_team.owner_membership_id = membership.id
    )
    and not exists (
      select 1
      from public.auction_team_owners auction_owner
      where auction_owner.league_id = p_league_id
        and auction_owner.user_id = membership.user_id
    )
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) snapshot_team(value)
      where snapshot_team.value ->> 'claimedByUserId' = membership.user_id::text
        or (
          nullif(btrim(snapshot_team.value ->> 'claimedByUserId'), '') is null
          and lower(nullif(btrim(snapshot_team.value ->> 'claimedBy'), '')) in (
            lower(coalesce(profile.username, '')),
            lower(coalesce(profile.display_name, ''))
          )
        )
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'team_index', snapshot_team.ordinality - 1,
    'team_name', snapshot_team.value ->> 'name',
    'is_on_clock', snapshot_team.ordinality - 1 = v_current_team
  ) order by snapshot_team.ordinality), '[]'::jsonb)
  into v_teams
  from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb))
    with ordinality as snapshot_team(value, ordinality)
  where nullif(btrim(snapshot_team.value ->> 'claimedBy'), '') is null
    and nullif(btrim(snapshot_team.value ->> 'claimedByUserId'), '') is null
    and not exists (
      select 1
      from public.teams relational_team
      where relational_team.league_id = p_league_id
        and relational_team.source_key = (snapshot_team.ordinality - 1)::text
        and relational_team.owner_membership_id is not null
    )
    and not exists (
      select 1
      from public.auction_team_owners auction_owner
      where auction_owner.league_id = p_league_id
        and auction_owner.team_index = snapshot_team.ordinality - 1
    );

  return jsonb_build_object(
    'active', true,
    'draft_type', v_draft_type,
    'current_team_index', v_current_team,
    'members', v_members,
    'teams', v_teams
  );
end;
$$;

create or replace function public.assign_live_bot_team_to_member(
  p_league_id uuid,
  p_team_index integer,
  p_membership_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_team jsonb;
  v_draft_type text;
  v_active boolean := false;
  v_current_team integer;
  v_order jsonb;
  v_order_length integer := 0;
  v_target_user_id uuid;
  v_target_role public.membership_role;
  v_target_name text;
  v_target_username text;
  v_actor_name text;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can assign an open team during a draft.';
  end if;
  if p_team_index is null or p_team_index < 0 then
    raise exception 'Choose an open bot team.';
  end if;

  select membership.user_id, membership.role, profile.display_name, profile.username
  into v_target_user_id, v_target_role, v_target_name, v_target_username
  from public.league_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.id = p_membership_id
    and membership.league_id = p_league_id
  for update of membership;

  if v_target_user_id is null or v_target_role not in ('commissioner', 'co_commissioner', 'coach') then
    raise exception 'Choose an unassigned manager who already belongs to this league.';
  end if;
  v_target_name := coalesce(nullif(btrim(v_target_name), ''), nullif(btrim(v_target_username), ''), 'Coach');

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;

  if v_state is null or not coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'A live draft must be active before using bot-team takeover.';
  end if;

  v_draft_type := coalesce(v_state #>> '{settings,draftType}', 'snake');
  if v_draft_type = 'snake' then
    v_order := coalesce(v_state -> 'snakeOrder', '[]'::jsonb);
    v_order_length := jsonb_array_length(v_order);
    v_active := coalesce((v_state ->> 'pickIndex')::integer, 0) < v_order_length;
    if v_active then
      v_current_team := (v_order ->> coalesce((v_state ->> 'pickIndex')::integer, 0))::integer;
    end if;
  elsif v_draft_type = 'auction' then
    v_order := coalesce(v_state -> 'auctionNominationOrder', '[]'::jsonb);
    v_order_length := jsonb_array_length(v_order);
    v_active := not coalesce((v_state ->> 'auctionEnded')::boolean, false)
      and jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) > 0;
    if v_active and v_order_length > 0 then
      v_current_team := (
        v_order ->> (coalesce((v_state ->> 'auctionNominationIdx')::integer, 0) % v_order_length)
      )::integer;
    end if;
  end if;

  if not v_active then
    raise exception 'The draft is not active or has already finished.';
  end if;
  if p_team_index = v_current_team then
    raise exception 'Wait until this team''s current pick or nomination has passed, then try again.';
  end if;

  v_team := v_state #> array['teams', p_team_index::text];
  if v_team is null then raise exception 'That team was not found.'; end if;
  if nullif(btrim(v_team ->> 'claimedBy'), '') is not null
     or nullif(btrim(v_team ->> 'claimedByUserId'), '') is not null
     or exists (
       select 1 from public.teams relational_team
       where relational_team.league_id = p_league_id
         and relational_team.source_key = p_team_index::text
         and relational_team.owner_membership_id is not null
     )
     or exists (
       select 1 from public.auction_team_owners auction_owner
       where auction_owner.league_id = p_league_id
         and auction_owner.team_index = p_team_index
     ) then
    raise exception 'That team is already controlled by a manager. Refresh the options and try again.';
  end if;

  if exists (
       select 1 from public.teams relational_team
       where relational_team.league_id = p_league_id
         and relational_team.owner_membership_id = p_membership_id
     )
     or exists (
       select 1 from public.auction_team_owners auction_owner
       where auction_owner.league_id = p_league_id
         and auction_owner.user_id = v_target_user_id
     )
     or exists (
       select 1
       from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) snapshot_team(value)
       where snapshot_team.value ->> 'claimedByUserId' = v_target_user_id::text
         or (
           nullif(btrim(snapshot_team.value ->> 'claimedByUserId'), '') is null
           and lower(nullif(btrim(snapshot_team.value ->> 'claimedBy'), '')) in (
             lower(coalesce(v_target_username, '')),
             lower(coalesce(v_target_name, ''))
           )
         )
     ) then
    raise exception 'That manager already controls a team in this league.';
  end if;

  v_state := jsonb_set(
    v_state,
    array['teams', p_team_index::text],
    v_team || jsonb_build_object(
      'claimedBy', v_target_name,
      'claimedByUserId', v_target_user_id::text,
      'autoDraft', false
    ),
    false
  );

  update public.teams
  set owner_membership_id = p_membership_id
  where league_id = p_league_id
    and source_key = p_team_index::text;

  if v_draft_type = 'auction' then
    insert into public.auction_team_owners (league_id, team_index, user_id)
    values (p_league_id, p_team_index, v_target_user_id)
    on conflict (league_id, team_index) do update
      set user_id = excluded.user_id;
  end if;

  select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Commissioner')
  into v_actor_name
  from public.profiles profile
  where profile.id = auth.uid();

  v_state := jsonb_set(
    v_state,
    '{auditLog}',
    coalesce(v_state -> 'auditLog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'ts', v_now_ms,
      'actor', v_actor_name,
      'action', 'Live bot team assigned',
      'detail', v_target_name || ' took control of ' || coalesce(v_team ->> 'name', 'Team ' || (p_team_index + 1))
    )),
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(greatest(coalesce((v_state ->> 'rev')::bigint, 0) + 1, 1)),
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
    'live_bot_team_assigned',
    auth.uid(),
    jsonb_build_object(
      'team_index', p_team_index,
      'membership_id', p_membership_id,
      'draft_type', v_draft_type
    )
  );

  return jsonb_build_object(
    'state', v_state,
    'team_index', p_team_index,
    'team_name', v_team ->> 'name',
    'manager_name', v_target_name
  );
end;
$$;

revoke all on function public.get_live_bot_takeover_options(uuid)
  from public, anon, authenticated;
revoke all on function public.assign_live_bot_team_to_member(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.get_live_bot_takeover_options(uuid)
  to authenticated;
grant execute on function public.assign_live_bot_team_to_member(uuid, integer, uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
