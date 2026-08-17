begin;
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  execute_after timestamptz not null default (now()+interval '7 days'),
  cancelled_at timestamptz,
  last_error text
);
create table if not exists public.account_deletion_audit (
  request_id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null,
  completed_at timestamptz not null default now(),
  result text not null default 'deleted'
);
alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_audit enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
revoke all on public.account_deletion_audit from public,anon,authenticated;

create or replace function public.transfer_league_commissioner(p_league_id uuid,p_new_username text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_old uuid:=auth.uid();v_new uuid;v_old_name text;v_new_name text;
begin
 if v_old is null then raise exception 'Sign in first.'; end if;
 if not exists(select 1 from public.leagues l join public.league_memberships m on m.league_id=l.id and m.user_id=v_old where l.id=p_league_id and l.created_by=v_old and m.role='commissioner') then raise exception 'Only the original commissioner can transfer this league.'; end if;
 select id,coalesce(nullif(display_name,''),username) into v_new,v_new_name from public.profiles where lower(username)=lower(trim(p_new_username));
 if v_new is null or v_new=v_old then raise exception 'Choose another existing league member.'; end if;
 if not exists(select 1 from public.league_memberships where league_id=p_league_id and user_id=v_new and role in ('coach','co_commissioner')) then raise exception 'The new commissioner must already be a manager or co-commissioner in this league.'; end if;
 select coalesce(nullif(display_name,''),username) into v_old_name from public.profiles where id=v_old;
 update public.league_memberships set role='co_commissioner' where league_id=p_league_id and user_id=v_old;
 update public.league_memberships set role='commissioner' where league_id=p_league_id and user_id=v_new;
 update public.leagues set created_by=v_new,updated_at=now() where id=p_league_id;
 update public.scheduled_snake_draft_jobs set commissioner_id=v_new where league_id=p_league_id;
 update public.scheduled_auction_draft_jobs set commissioner_id=v_new where league_id=p_league_id;
 update public.league_state_snapshots set state=jsonb_set(jsonb_set(state,'{commissioner}',to_jsonb(v_new_name),true),'{coCommissioners}',coalesce((select jsonb_agg(value) from jsonb_array_elements_text(coalesce(state->'coCommissioners','[]'::jsonb)) value where lower(value)<>lower(v_new_name)),'[]'::jsonb),true),revision=revision+1,updated_at=now() where league_id=p_league_id;
 return jsonb_build_object('league_id',p_league_id,'new_commissioner_id',v_new,'new_commissioner',v_new_name,'previous_commissioner',v_old_name);
end;$$;
revoke all on function public.transfer_league_commissioner(uuid,text) from public,anon,authenticated;
grant execute on function public.transfer_league_commissioner(uuid,text) to authenticated;
commit;
