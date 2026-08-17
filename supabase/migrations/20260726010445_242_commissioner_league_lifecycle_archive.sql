-- A league-level archive is distinct from each member's personal dashboard
-- archive. It preserves every league row while closing the league for all
-- members and removing it from public discovery.
begin;

alter table public.leagues
  add column if not exists lifecycle_archived_at timestamptz,
  add column if not exists lifecycle_archived_from_status text,
  add column if not exists lifecycle_archived_visibility text;

create or replace function public.set_league_lifecycle_archived(p_league_id uuid,p_archived boolean,p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_league public.leagues; v_restore_status text; v_restore_visibility text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into v_league from public.leagues where id=p_league_id for update;
  if v_league.id is null then raise exception 'That league no longer exists.'; end if;
  if v_league.created_by is distinct from auth.uid() or not exists(
    select 1 from public.league_memberships where league_id=p_league_id and user_id=auth.uid() and role='commissioner'
  ) then raise exception 'Only the primary commissioner can archive this league.'; end if;
  if btrim(coalesce(p_confirmation,''))<>v_league.name then raise exception 'Type the exact league name to confirm this change.'; end if;

  if coalesce(p_archived,false) then
    if v_league.status::text='archived' then return jsonb_build_object('archived',true,'status','archived','league_visibility','private'); end if;
    if exists(select 1 from public.draft_sessions where league_id=p_league_id and status='active') then
      raise exception 'Complete or end the live draft before archiving this league.';
    end if;
    update public.leagues set lifecycle_archived_at=clock_timestamp(),lifecycle_archived_from_status=status::text,
      lifecycle_archived_visibility=league_visibility,status='archived',league_visibility='private',is_public=false,updated_at=now()
    where id=p_league_id;
    insert into public.league_events(league_id,kind,actor_id,payload)
    values(p_league_id,'league_archived',auth.uid(),jsonb_build_object('previous_status',v_league.status::text));
    return jsonb_build_object('archived',true,'status','archived','league_visibility','private');
  end if;

  if v_league.status::text<>'archived' then return jsonb_build_object('archived',false,'status',v_league.status::text,'league_visibility',v_league.league_visibility); end if;
  v_restore_status:=case when coalesce(v_league.lifecycle_archived_from_status,'') in ('setup','drafting','active','completed') then v_league.lifecycle_archived_from_status else 'completed' end;
  v_restore_visibility:=case when coalesce(v_league.lifecycle_archived_visibility,'') in ('private','watch','open') then v_league.lifecycle_archived_visibility else 'private' end;
  execute format('update public.leagues set status=%L::public.league_status,league_visibility=%L,is_public=%L,lifecycle_archived_at=null,lifecycle_archived_from_status=null,lifecycle_archived_visibility=null,updated_at=now() where id=%L',v_restore_status,v_restore_visibility,v_restore_visibility<>'private',p_league_id);
  insert into public.league_events(league_id,kind,actor_id,payload)
  values(p_league_id,'league_reopened',auth.uid(),jsonb_build_object('restored_status',v_restore_status));
  return jsonb_build_object('archived',false,'status',v_restore_status,'league_visibility',v_restore_visibility);
end; $$;

revoke all on function public.set_league_lifecycle_archived(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.set_league_lifecycle_archived(uuid,boolean,text) to authenticated;
commit;
notify pgrst,'reload schema';
