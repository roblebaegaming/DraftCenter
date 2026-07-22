-- DraftCenter milestone 7: real co-commissioner roles and random setup-team assignment.
-- Run once AFTER migrations 001-009.

create or replace function public.auto_assign_setup_team(p_league_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_state jsonb; v_index integer; v_name text; v_username text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  if v_state is null or coalesce((v_state ->> 'locked')::boolean, false) then return null; end if;
  select display_name, username into v_name, v_username from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), nullif(v_username, ''), 'Coach');
  if exists (select 1 from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) as team where lower(coalesce(team ->> 'claimedBy', '')) = lower(v_name)) then return v_state; end if;
  select team_index into v_index from (
    select ordinality - 1 as team_index
    from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) with ordinality
    where nullif(trim(value ->> 'claimedBy'), '') is null
    order by random() limit 1
  ) available_team;
  if v_index is null then return v_state; end if;
  insert into public.league_memberships (league_id, user_id, role) values (p_league_id, auth.uid(), 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end;
  v_state := jsonb_set(v_state, array['teams', v_index::text, 'claimedBy'], to_jsonb(v_name), true);
  update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  return v_state;
end;
$$;

create or replace function public.set_co_commissioner(p_league_id uuid, p_username text, p_enabled boolean)
returns public.league_memberships
language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid; v_membership public.league_memberships;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only a commissioner can manage co-commissioners.'; end if;
  select id into v_user_id from public.profiles where lower(username) = lower(trim(p_username));
  if v_user_id is null then raise exception 'No DraftCenter account has that username.'; end if;
  select * into v_membership from public.league_memberships where league_id = p_league_id and user_id = v_user_id for update;
  if v_membership.id is null then raise exception 'That user must join the league before they can become a co-commissioner.'; end if;
  if v_membership.role = 'commissioner' then raise exception 'The primary commissioner cannot be changed here.'; end if;
  update public.league_memberships set role = case when p_enabled then 'co_commissioner'::public.membership_role else 'coach'::public.membership_role end
    where id = v_membership.id returning * into v_membership;
  return v_membership;
end;
$$;

grant execute on function public.auto_assign_setup_team(uuid) to authenticated;
grant execute on function public.set_co_commissioner(uuid, text, boolean) to authenticated;
