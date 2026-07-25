-- Reliable manager queues, reusable general manager links, and safely
-- reopenable invitations addressed to one email recipient.
begin;

alter table public.league_invites add column if not exists accepted_by uuid references auth.users(id) on delete set null;

create or replace function public.preview_league_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_invite public.league_invites; v_league public.leagues; v_email text; v_already_joined boolean := false;
begin
  if auth.uid() is null then raise exception 'Sign in before opening an invite.'; end if;
  select * into v_invite from public.league_invites where token=p_token;
  if v_invite.id is null then raise exception 'This invite is no longer available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at<now() then raise exception 'This invite has expired.'; end if;
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  if v_invite.email is not null and v_invite.email<>v_email then raise exception 'This invite was sent to a different email address.'; end if;
  v_already_joined:=exists(
    select 1 from public.league_memberships
    where league_id=v_invite.league_id and user_id=auth.uid()
  );
  if v_invite.email is not null
     and v_invite.accepted_at is not null
     and not (
       v_already_joined
       and (v_invite.accepted_by=auth.uid() or (v_invite.accepted_by is null and v_invite.email=v_email))
     ) then
    raise exception 'This invite has already been accepted.';
  end if;
  select * into v_league from public.leagues where id=v_invite.league_id;
  return jsonb_build_object('token',v_invite.token,'league_id',v_league.id,'league_name',v_league.name,'season_label',v_league.season_label,'role',v_invite.role,'is_spectator',v_invite.role='viewer','expires_at',v_invite.expires_at,'already_joined',v_already_joined);
end; $$;

create or replace function public.accept_league_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_invite public.league_invites; v_email text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to accept an invite.'; end if;
  select * into v_invite from public.league_invites where token=p_token for update;
  if v_invite.id is null then raise exception 'This invite is no longer available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at<now() then raise exception 'This invite has expired.'; end if;
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  if v_invite.email is not null and v_invite.email<>v_email then raise exception 'This invite was sent to a different email address.'; end if;
  if v_invite.email is not null and v_invite.accepted_at is not null then
    if (v_invite.accepted_by=auth.uid() or (v_invite.accepted_by is null and v_invite.email is not null and v_invite.email=v_email))
       and exists(select 1 from public.league_memberships where league_id=v_invite.league_id and user_id=auth.uid()) then
      update public.league_invites set accepted_by=auth.uid() where id=v_invite.id and accepted_by is null;
      return v_invite.league_id;
    end if;
    raise exception 'This invite has already been accepted.';
  end if;
  insert into public.profiles(id,display_name) values(auth.uid(),coalesce(nullif(split_part(v_email,'@',1),''),'Coach')) on conflict(id) do nothing;
  insert into public.league_memberships(league_id,user_id,role) values(v_invite.league_id,auth.uid(),v_invite.role)
  on conflict(league_id,user_id) do update set role=case
    when public.league_memberships.role='commissioner' then public.league_memberships.role
    when excluded.role='co_commissioner' then 'co_commissioner'::public.membership_role
    when public.league_memberships.role='viewer' then excluded.role else public.league_memberships.role end;
  -- General links have no email address and deliberately remain reusable
  -- until expiry. Addressed invitations retain single-recipient acceptance.
  if v_invite.email is not null then
    update public.league_invites
    set accepted_at=now(),accepted_by=auth.uid()
    where id=v_invite.id;
  end if;
  return v_invite.league_id;
end; $$;

create or replace function public.mutate_my_draft_queue(p_league_id uuid,p_team_index integer,p_action text,p_pokemon_name text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_state jsonb; v_identity text; v_queue jsonb; v_queues jsonb; v_position integer; v_target integer; v_item jsonb; v_revision bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to update your draft queue.'; end if;
  if p_team_index<0 then raise exception 'Choose a valid team.'; end if;
  p_pokemon_name:=nullif(trim(p_pokemon_name),'');
  if p_pokemon_name is null or char_length(p_pokemon_name)>120 then raise exception 'Choose a valid Pokemon.'; end if;
  select coalesce(nullif(display_name,''),username) into v_identity from public.profiles where id=auth.uid();
  select state into v_state from public.league_state_snapshots where league_id=p_league_id for update;
  if v_state is null then raise exception 'League state was not found.'; end if;
  if not exists(select 1 from public.league_memberships where league_id=p_league_id and user_id=auth.uid()) then raise exception 'You are not a member of this league.'; end if;
  if lower(coalesce(v_state#>>array['teams',p_team_index::text,'claimedBy'],''))<>lower(v_identity) then raise exception 'You can only update your own team queue.'; end if;
  v_queues:=case when jsonb_typeof(v_state->'queues')='object' then v_state->'queues' else '{}'::jsonb end;
  v_queue:=case when jsonb_typeof(v_queues->p_team_index::text)='array' then v_queues->p_team_index::text else '[]'::jsonb end;
  select ordinality::integer-1 into v_position from jsonb_array_elements_text(v_queue) with ordinality item(value,ordinality) where value=p_pokemon_name limit 1;
  if p_action='add' then
    if v_position is null then
      if jsonb_array_length(v_queue)>=100 then raise exception 'Draft queues can hold up to 100 Pokemon.'; end if;
      v_queue:=v_queue||to_jsonb(p_pokemon_name);
    end if;
  elsif p_action='remove' then
    v_queue:=coalesce((select jsonb_agg(value order by ordinality) from jsonb_array_elements_text(v_queue) with ordinality item(value,ordinality) where value<>p_pokemon_name),'[]'::jsonb);
  elsif p_action in ('up','down') then
    if v_position is not null then
      v_target:=v_position+case when p_action='up' then -1 else 1 end;
      if v_target>=0 and v_target<jsonb_array_length(v_queue) then
        v_item:=v_queue->v_target;
        v_queue:=jsonb_set(v_queue,array[v_target::text],v_queue->v_position,false);
        v_queue:=jsonb_set(v_queue,array[v_position::text],v_item,false);
      end if;
    end if;
  else raise exception 'Unknown queue action.';
  end if;
  v_queues:=jsonb_set(v_queues,array[p_team_index::text],v_queue,true);
  v_state:=jsonb_set(v_state,'{queues}',v_queues,true);
  v_state:=jsonb_set(v_state,'{rev}',to_jsonb(greatest(coalesce((v_state->>'rev')::bigint,0)+1,1)),true);
  update public.league_state_snapshots set state=v_state,revision=revision+1,updated_at=now() where league_id=p_league_id returning revision into v_revision;
  return jsonb_build_object('state',v_state,'revision',v_revision);
end; $$;

-- Budget-aware server-authoritative live snake picks. The server checks the
-- active team's remaining budget and skips future turns for teams that are
-- full or genuinely cannot afford any remaining Pokemon.
create or replace function public.make_snake_pick(p_draft_session_id uuid,p_league_pokemon_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_league uuid; v_team uuid; v_pick integer; v_config jsonb; v_order jsonb; v_total integer;
  v_next_team uuid; v_candidate uuid; v_pokemon public.league_pokemon; v_pick_id uuid;
  v_settings jsonb; v_budget_enabled boolean; v_budget numeric; v_spent numeric; v_cost numeric;
  v_roster_max integer; v_roster_count integer; v_scan integer; v_can_pick boolean;
begin
  select league_id,current_team_id,current_pick_number,configuration
  into v_league,v_team,v_pick,v_config
  from public.draft_sessions
  where id=p_draft_session_id and status='active' and mode='snake'
  for update;
  if v_league is null then raise exception 'No active snake draft found.'; end if;
  if not public.is_league_staff(v_league) and not exists(
    select 1 from public.teams t join public.league_memberships m on m.id=t.owner_membership_id
    where t.id=v_team and m.user_id=auth.uid()
  ) then raise exception 'It is not your team''s turn.'; end if;

  select settings into v_settings from public.leagues where id=v_league;
  v_budget_enabled:=coalesce((v_settings->>'snakeBudgetEnabled')::boolean,false);
  v_budget:=greatest(0,coalesce((v_settings->>'budget')::numeric,0));
  v_roster_max:=greatest(1,coalesce((v_settings->>'rosterMax')::integer,1));

  select * into v_pokemon from public.league_pokemon
  where id=p_league_pokemon_id and league_id=v_league for update;
  if v_pokemon.id is null or not v_pokemon.is_allowed or v_pokemon.is_drafted then raise exception 'That Pokemon is no longer available.'; end if;
  v_cost:=coalesce(v_pokemon.cost,0);
  select count(*) into v_roster_count from public.roster_entries where team_id=v_team and released_at is null;
  if v_roster_count>=v_roster_max then raise exception 'That roster is full.'; end if;
  if v_budget_enabled then
    select coalesce(sum(lp.cost),0) into v_spent
    from public.roster_entries re join public.league_pokemon lp on lp.id=re.league_pokemon_id
    where re.team_id=v_team and re.released_at is null;
    if v_cost>v_budget-v_spent then raise exception 'That Pokemon costs more than this team''s remaining budget.'; end if;
  end if;

  update public.league_pokemon set is_drafted=true where id=p_league_pokemon_id;
  insert into public.draft_picks(draft_session_id,team_id,league_pokemon_id,pick_number,made_by)
  values(p_draft_session_id,v_team,p_league_pokemon_id,v_pick,auth.uid()) returning id into v_pick_id;
  insert into public.roster_entries(team_id,league_pokemon_id,acquisition_type) values(v_team,p_league_pokemon_id,'draft');

  v_order:=v_config->'team_order'; v_total:=jsonb_array_length(v_order); v_scan:=v_pick+1; v_next_team:=null;
  while v_scan<v_total loop
    v_candidate:=(v_order->>v_scan)::uuid;
    select count(*) into v_roster_count from public.roster_entries where team_id=v_candidate and released_at is null;
    v_can_pick:=v_roster_count<v_roster_max;
    if v_can_pick and v_budget_enabled then
      select coalesce(sum(lp.cost),0) into v_spent
      from public.roster_entries re join public.league_pokemon lp on lp.id=re.league_pokemon_id
      where re.team_id=v_candidate and re.released_at is null;
      v_can_pick:=exists(
        select 1 from public.league_pokemon lp
        where lp.league_id=v_league and lp.is_allowed and not lp.is_drafted and coalesce(lp.cost,0)<=v_budget-v_spent
      );
    end if;
    if v_can_pick then v_next_team:=v_candidate; exit; end if;
    v_scan:=v_scan+1;
  end loop;

  if v_next_team is null then
    update public.draft_sessions set status='complete',current_pick_number=v_scan,current_team_id=null,updated_at=now() where id=p_draft_session_id;
  else
    update public.draft_sessions set current_pick_number=v_scan,current_team_id=v_next_team,updated_at=now() where id=p_draft_session_id;
  end if;
  insert into public.league_events(league_id,kind,actor_id,payload)
  values(v_league,'draft_pick',auth.uid(),jsonb_build_object('draft_pick_id',v_pick_id,'team_id',v_team,'league_pokemon_id',p_league_pokemon_id,'pick_number',v_pick));
  return v_pick_id;
end; $$;

revoke all on function public.preview_league_invite(uuid) from public,anon,authenticated;
revoke all on function public.accept_league_invite(uuid) from public,anon,authenticated;
revoke all on function public.mutate_my_draft_queue(uuid,integer,text,text) from public,anon,authenticated;
revoke all on function public.make_snake_pick(uuid,uuid) from public,anon,authenticated;
grant execute on function public.preview_league_invite(uuid) to authenticated;
grant execute on function public.accept_league_invite(uuid) to authenticated;
grant execute on function public.mutate_my_draft_queue(uuid,integer,text,text) to authenticated;
grant execute on function public.make_snake_pick(uuid,uuid) to authenticated;
commit;
notify pgrst,'reload schema';
