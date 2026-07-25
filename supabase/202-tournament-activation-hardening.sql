-- Activation hardening: visibility, staff roles, safe judge corrections,
-- operational outcomes, penalties, drops, and recovery exports.
begin;

alter table public.tournaments
  add column if not exists visibility text not null default 'private',
  add column if not exists regulation_version_id uuid,
  drop constraint if exists tournaments_visibility_check,
  add constraint tournaments_visibility_check check (visibility in ('private','public'));

alter table public.tournament_pairings
  add column if not exists outcome_type text,
  add column if not exists outcome_notes text,
  drop constraint if exists tournament_pairings_outcome_type_check,
  add constraint tournament_pairings_outcome_type_check check (
    outcome_type is null or outcome_type in (
      'played','intentional_draw','no_show_a','no_show_b','double_no_show','penalty_win'
    )
  );

create table if not exists public.tournament_staff (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('judge','scorekeeper')),
  appointed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tournament_id,user_id)
);

create table if not exists public.tournament_penalties (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entrant_id uuid not null references public.tournament_entrants(id) on delete restrict,
  pairing_id uuid references public.tournament_pairings(id) on delete set null,
  kind text not null check (kind in ('warning','game_loss','match_loss','disqualification','points_adjustment')),
  points_adjustment integer not null default 0 check (points_adjustment between -99 and 99),
  reason text not null check (char_length(btrim(reason)) between 3 and 5000),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete set null,
  reversal_reason text
);

create table if not exists public.tournament_invites (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tournament_staff_event_idx on public.tournament_staff(tournament_id,role);
create index if not exists tournament_penalties_event_idx on public.tournament_penalties(tournament_id,entrant_id,issued_at);

create or replace function public.is_tournament_staff(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.tournament_staff where tournament_id=p_tournament_id and user_id=auth.uid()) $$;

create or replace function public.can_view_tournament(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.tournaments event
    where event.id=p_tournament_id and (
      event.visibility='public'
      or event.organizer_id=auth.uid()
      or public.is_tournament_staff(event.id)
      or public.is_tournament_entrant(event.id)
    )
  )
$$;

alter table public.tournament_staff enable row level security;
alter table public.tournament_penalties enable row level security;
alter table public.tournament_invites enable row level security;
revoke all on public.tournament_staff,public.tournament_penalties,public.tournament_invites from public,anon,authenticated;
grant select on public.tournament_staff,public.tournament_penalties,public.tournament_invites to authenticated;

drop policy if exists "Tournament listings are readable" on public.tournaments;
create policy "Authorized tournament visibility" on public.tournaments for select using (
  visibility='public' or organizer_id=auth.uid()
  or public.is_tournament_staff(id) or public.is_tournament_entrant(id)
);
drop policy if exists "Tournament entrants are readable" on public.tournament_entrants;
create policy "Authorized tournament entrant visibility" on public.tournament_entrants for select using (public.can_view_tournament(tournament_id));
drop policy if exists "Tournament rounds are readable" on public.tournament_rounds;
create policy "Authorized tournament round visibility" on public.tournament_rounds for select using (public.can_view_tournament(tournament_id));
drop policy if exists "Tournament pairings are readable" on public.tournament_pairings;
create policy "Authorized tournament pairing visibility" on public.tournament_pairings for select using (public.can_view_tournament(tournament_id));
drop policy if exists "Organizers read tournament audit" on public.tournament_events;
create policy "Staff read tournament audit" on public.tournament_events for select to authenticated using (
  public.is_tournament_organizer(tournament_id) or public.is_tournament_staff(tournament_id)
);
create policy "Staff roster is event-visible" on public.tournament_staff for select to authenticated using (public.can_view_tournament(tournament_id));
create policy "Staff read tournament penalties" on public.tournament_penalties for select to authenticated using (
  public.is_tournament_organizer(tournament_id) or public.is_tournament_staff(tournament_id)
);
drop policy if exists "Players and organizer read relevant disputes" on public.tournament_disputes;
create policy "Players and staff read relevant disputes" on public.tournament_disputes for select to authenticated using (
  public.is_tournament_organizer(tournament_id) or public.is_tournament_staff(tournament_id)
  or opened_by_entrant_id in (select id from public.tournament_entrants where user_id=auth.uid())
  or exists (
    select 1 from public.tournament_pairings pairing
    join public.tournament_entrants entrant on entrant.user_id=auth.uid()
    where pairing.id=pairing_id and entrant.id in (pairing.entrant_a_id,pairing.entrant_b_id)
  )
);
drop policy if exists "Authorized team sheet visibility" on public.tournament_team_sheets;
create policy "Authorized team sheet visibility" on public.tournament_team_sheets for select to authenticated using (
  public.is_tournament_organizer(tournament_id) or public.is_tournament_staff(tournament_id)
  or entrant_id in (select id from public.tournament_entrants where tournament_id=tournament_team_sheets.tournament_id and user_id=auth.uid())
  or (
    locked_at is not null and exists (
      select 1 from public.tournaments event where event.id=tournament_id and (
        event.team_sheet_policy='open'
        or (event.team_sheet_policy='open_on_pairing' and exists (
          select 1 from public.tournament_pairings pairing
          join public.tournament_entrants mine on mine.tournament_id=pairing.tournament_id and mine.user_id=auth.uid()
          where pairing.tournament_id=tournament_team_sheets.tournament_id
            and ((pairing.entrant_a_id=entrant_id and pairing.entrant_b_id=mine.id) or (pairing.entrant_b_id=entrant_id and pairing.entrant_a_id=mine.id))
        ))
      )
    )
  )
);
create policy "Organizer reads tournament invites" on public.tournament_invites for select to authenticated using (
  public.is_tournament_organizer(tournament_id)
);

create or replace function public.create_tournament_invite(p_tournament_id uuid,p_expires_at timestamptz default null,p_max_uses integer default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_token uuid;
begin
  if not public.is_tournament_organizer(p_tournament_id) then raise exception 'Only the organizer can create private invitations.'; end if;
  insert into public.tournament_invites(tournament_id,created_by,expires_at,max_uses)
  values(p_tournament_id,auth.uid(),p_expires_at,p_max_uses) returning token into v_token;
  return jsonb_build_object('tournament_id',p_tournament_id,'token',v_token);
end $$;

create or replace function public.accept_tournament_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_invite public.tournament_invites; v_event public.tournaments; v_name text; v_entrant uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this tournament invitation.'; end if;
  select * into v_invite from public.tournament_invites where token=p_token for update;
  if v_invite.id is null or v_invite.revoked_at is not null or (v_invite.expires_at is not null and v_invite.expires_at<now())
    or (v_invite.max_uses is not null and v_invite.use_count>=v_invite.max_uses) then raise exception 'This tournament invitation is invalid or expired.'; end if;
  select * into v_event from public.tournaments where id=v_invite.tournament_id for update;
  if v_event.status<>'registration' then raise exception 'Registration is closed.'; end if;
  select coalesce(nullif(display_name,''),username,'Player') into v_name from public.profiles where id=auth.uid();
  insert into public.tournament_entrants(tournament_id,user_id,display_name)
  values(v_event.id,auth.uid(),v_name)
  on conflict(tournament_id,user_id) do update set dropped_at=null returning id into v_entrant;
  update public.tournament_invites set use_count=use_count+1 where id=v_invite.id;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(v_event.id,'private_invite_accepted',auth.uid(),jsonb_build_object('entrant_id',v_entrant));
  return jsonb_build_object('tournament_id',v_event.id,'entrant_id',v_entrant);
end $$;

create or replace function public.set_tournament_visibility(p_tournament_id uuid,p_visibility text)
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if p_visibility not in ('private','public') then raise exception 'Choose private or public visibility.'; end if;
  update public.tournaments set visibility=p_visibility,revision=revision+1,updated_at=now()
  where id=p_tournament_id and organizer_id=auth.uid();
  if not found then raise exception 'Only the organizer can change event visibility.'; end if;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(p_tournament_id,'visibility_changed',auth.uid(),jsonb_build_object('visibility',p_visibility));
  return jsonb_build_object('tournament_id',p_tournament_id);
end $$;

create or replace function public.appoint_tournament_staff(p_tournament_id uuid,p_username text,p_role text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;
begin
  if not public.is_tournament_organizer(p_tournament_id) then raise exception 'Only the organizer can appoint event staff.'; end if;
  if p_role not in ('judge','scorekeeper') then raise exception 'Choose judge or scorekeeper.'; end if;
  select id into v_user from public.profiles where lower(username)=lower(btrim(p_username));
  if v_user is null then raise exception 'No DraftCenter profile matches that username.'; end if;
  insert into public.tournament_staff(tournament_id,user_id,role,appointed_by)
  values(p_tournament_id,v_user,p_role,auth.uid())
  on conflict(tournament_id,user_id) do update set role=excluded.role,appointed_by=auth.uid(),created_at=now();
  return jsonb_build_object('tournament_id',p_tournament_id);
end $$;

drop function if exists public.resolve_tournament_dispute(uuid,text,integer,integer);
create function public.resolve_tournament_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_games_a integer default null,
  p_games_b integer default null,
  p_invalidate_later_rounds boolean default false
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_dispute public.tournament_disputes;
  v_pair public.tournament_pairings;
  v_event public.tournaments;
  v_round public.tournament_rounds;
  v_winner uuid;
  v_needed integer;
  v_has_later boolean;
begin
  select * into v_dispute from public.tournament_disputes where id=p_dispute_id for update;
  select * into v_event from public.tournaments where id=v_dispute.tournament_id;
  if v_event.organizer_id<>auth.uid() and not public.is_tournament_staff(v_event.id) then
    raise exception 'Only appointed event staff can resolve a judge call.';
  end if;
  if v_dispute.status<>'open' then raise exception 'This judge call is already closed.'; end if;
  if char_length(btrim(coalesce(p_resolution,'')))<3 then raise exception 'Record the judge decision.'; end if;
  select * into v_pair from public.tournament_pairings where id=v_dispute.pairing_id for update;
  select * into v_round from public.tournament_rounds where id=v_pair.round_id for update;

  if p_games_a is not null or p_games_b is not null then
    v_needed:=ceil(v_event.best_of::numeric/2);
    if p_games_a is null or p_games_b is null or p_games_a<0 or p_games_b<0
      or p_games_a=p_games_b or greatest(p_games_a,p_games_b)<>v_needed
      or least(p_games_a,p_games_b)>=v_needed then
      raise exception 'Enter a valid best-of-% score.',v_event.best_of;
    end if;
    v_winner:=case when p_games_a>p_games_b then v_pair.entrant_a_id else v_pair.entrant_b_id end;
    select exists(
      select 1 from public.tournament_rounds later
      where later.tournament_id=v_pair.tournament_id and later.round_number>v_round.round_number
    ) into v_has_later;
    if v_has_later and v_pair.winner_entrant_id is distinct from v_winner and not p_invalidate_later_rounds then
      raise exception 'Later rounds already exist. Choose invalidate later rounds to apply a winner-changing correction safely.';
    end if;
    if v_has_later and v_pair.winner_entrant_id is distinct from v_winner then
      delete from public.tournament_rounds
      where tournament_id=v_pair.tournament_id and round_number>v_round.round_number;
      update public.tournament_rounds set status='active',completed_at=null where id=v_round.id;
      insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
      values(v_pair.tournament_id,'later_rounds_invalidated',auth.uid(),jsonb_build_object('from_round',v_round.round_number+1,'reason',btrim(p_resolution)));
    end if;
    update public.tournament_pairings set games_a=p_games_a,games_b=p_games_b,
      winner_entrant_id=v_winner,status='confirmed',outcome_type='played',
      confirmed_at=now() where id=v_pair.id;
  else
    update public.tournament_pairings set status=case when games_a is null then 'pending' else 'reported' end where id=v_pair.id;
  end if;
  update public.tournament_disputes set status='resolved',resolution=btrim(p_resolution),
    resolved_by=auth.uid(),resolved_at=now() where id=p_dispute_id;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(v_dispute.tournament_id,'judge_resolved',auth.uid(),jsonb_build_object('pairing_id',v_pair.id,'dispute_id',p_dispute_id,'score',jsonb_build_array(p_games_a,p_games_b)));
  return jsonb_build_object('tournament_id',v_dispute.tournament_id);
end $$;

create or replace function public.record_tournament_match_outcome(
  p_pairing_id uuid,p_outcome text,p_notes text default ''
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_pair public.tournament_pairings; v_event public.tournaments; v_winner uuid;
begin
  select * into v_pair from public.tournament_pairings where id=p_pairing_id for update;
  select * into v_event from public.tournaments where id=v_pair.tournament_id;
  if v_event.organizer_id<>auth.uid() and not public.is_tournament_staff(v_event.id) then raise exception 'Only event staff can record operational outcomes.'; end if;
  if p_outcome not in ('intentional_draw','no_show_a','no_show_b','double_no_show') then raise exception 'Unknown operational outcome.'; end if;
  v_winner:=case when p_outcome='no_show_a' then v_pair.entrant_b_id when p_outcome='no_show_b' then v_pair.entrant_a_id else null end;
  update public.tournament_pairings set status='confirmed',games_a=case when v_winner=v_pair.entrant_a_id then 1 else 0 end,
    games_b=case when v_winner=v_pair.entrant_b_id then 1 else 0 end,winner_entrant_id=v_winner,
    outcome_type=p_outcome,outcome_notes=nullif(btrim(p_notes),''),confirmed_at=now()
  where id=p_pairing_id;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(v_pair.tournament_id,p_outcome,auth.uid(),jsonb_build_object('pairing_id',p_pairing_id,'notes',nullif(btrim(p_notes),'')));
  return jsonb_build_object('tournament_id',v_pair.tournament_id);
end $$;

create or replace function public.set_tournament_entrant_drop(p_entrant_id uuid,p_dropped boolean,p_reason text default '')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_entrant public.tournament_entrants;
begin
  select * into v_entrant from public.tournament_entrants where id=p_entrant_id for update;
  if not public.is_tournament_organizer(v_entrant.tournament_id) and not public.is_tournament_staff(v_entrant.tournament_id) then raise exception 'Only event staff can change drop status.'; end if;
  update public.tournament_entrants set dropped_at=case when p_dropped then now() else null end where id=p_entrant_id;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(v_entrant.tournament_id,case when p_dropped then 'entrant_dropped' else 'entrant_reinstated' end,auth.uid(),jsonb_build_object('entrant_id',p_entrant_id,'reason',nullif(btrim(p_reason),'')));
  return jsonb_build_object('tournament_id',v_entrant.tournament_id);
end $$;

create or replace function public.issue_tournament_penalty(
  p_entrant_id uuid,p_pairing_id uuid,p_kind text,p_points_adjustment integer,p_reason text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_entrant public.tournament_entrants; v_id uuid;
begin
  select * into v_entrant from public.tournament_entrants where id=p_entrant_id;
  if not public.is_tournament_organizer(v_entrant.tournament_id) and not public.is_tournament_staff(v_entrant.tournament_id) then raise exception 'Only event staff can issue penalties.'; end if;
  if p_kind not in ('warning','game_loss','match_loss','disqualification','points_adjustment') then raise exception 'Unknown penalty type.'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Record the penalty reason.'; end if;
  insert into public.tournament_penalties(tournament_id,entrant_id,pairing_id,kind,points_adjustment,reason,issued_by)
  values(v_entrant.tournament_id,p_entrant_id,p_pairing_id,p_kind,coalesce(p_points_adjustment,0),btrim(p_reason),auth.uid())
  returning id into v_id;
  if p_kind='disqualification' then update public.tournament_entrants set dropped_at=now() where id=p_entrant_id; end if;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(v_entrant.tournament_id,'penalty_issued',auth.uid(),jsonb_build_object('penalty_id',v_id,'entrant_id',p_entrant_id,'kind',p_kind,'points_adjustment',coalesce(p_points_adjustment,0)));
  return jsonb_build_object('tournament_id',v_entrant.tournament_id,'penalty_id',v_id);
end $$;

create or replace function public.export_tournament_recovery(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.is_tournament_organizer(p_tournament_id) then raise exception 'Only the organizer can export a recovery package.'; end if;
  return jsonb_build_object(
    'format','draftcenter-tournament-recovery','version',1,'exported_at',now(),
    'tournament',(select to_jsonb(event) from public.tournaments event where id=p_tournament_id),
    'entrants',coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at) from public.tournament_entrants row where tournament_id=p_tournament_id),'[]'::jsonb),
    'team_sheets',coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at) from public.tournament_team_sheets row where tournament_id=p_tournament_id),'[]'::jsonb),
    'rounds',coalesce((select jsonb_agg(to_jsonb(row) order by row.round_number) from public.tournament_rounds row where tournament_id=p_tournament_id),'[]'::jsonb),
    'pairings',coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at) from public.tournament_pairings row where tournament_id=p_tournament_id),'[]'::jsonb),
    'disputes',coalesce((select jsonb_agg(to_jsonb(row) order by row.opened_at) from public.tournament_disputes row where tournament_id=p_tournament_id),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at) from public.tournament_staff row where tournament_id=p_tournament_id),'[]'::jsonb),
    'penalties',coalesce((select jsonb_agg(to_jsonb(row) order by row.issued_at) from public.tournament_penalties row where tournament_id=p_tournament_id),'[]'::jsonb),
    'audit_events',coalesce((select jsonb_agg(to_jsonb(row) order by row.id) from public.tournament_events row where tournament_id=p_tournament_id),'[]'::jsonb)
  );
end $$;

create or replace function public.get_tournament_standings(p_tournament_id uuid)
returns table(entrant_id uuid,display_name text,match_points integer,matches_played integer,opponent_match_win_pct numeric)
language sql stable security definer set search_path=''
as $$
  with results as (
    select p.entrant_a_id entrant_id,p.entrant_b_id opponent_id,
      case when p.winner_entrant_id=p.entrant_a_id then 3 when p.winner_entrant_id is null then 1 else 0 end points
    from public.tournament_pairings p where p.tournament_id=p_tournament_id and p.status in ('confirmed','bye')
    union all
    select p.entrant_b_id,p.entrant_a_id,
      case when p.winner_entrant_id=p.entrant_b_id then 3 when p.winner_entrant_id is null then 1 else 0 end
    from public.tournament_pairings p where p.tournament_id=p_tournament_id and p.status='confirmed' and p.entrant_b_id is not null
  ), adjustments as (
    select entrant_id,coalesce(sum(points_adjustment),0)::integer points
    from public.tournament_penalties where tournament_id=p_tournament_id and reversed_at is null group by entrant_id
  ), totals as (
    select e.id,e.display_name,(coalesce(sum(r.points),0)+coalesce(a.points,0))::integer points,count(r.entrant_id)::integer played
    from public.tournament_entrants e left join results r on r.entrant_id=e.id left join adjustments a on a.entrant_id=e.id
    where e.tournament_id=p_tournament_id group by e.id,e.display_name,a.points
  )
  select t.id,t.display_name,t.points,t.played,
    coalesce(avg(greatest(33.33,least(100,(opp.points::numeric/greatest(opp.played*3,1))*100))) filter(where r.opponent_id is not null),0)::numeric(6,2)
  from totals t left join results r on r.entrant_id=t.id left join totals opp on opp.id=r.opponent_id
  group by t.id,t.display_name,t.points,t.played order by t.points desc,5 desc,t.display_name
$$;

revoke all on function public.is_tournament_staff(uuid),public.can_view_tournament(uuid),
  public.set_tournament_visibility(uuid,text),public.appoint_tournament_staff(uuid,text,text),
  public.create_tournament_invite(uuid,timestamptz,integer),public.accept_tournament_invite(uuid),
  public.resolve_tournament_dispute(uuid,text,integer,integer,boolean),
  public.record_tournament_match_outcome(uuid,text,text),
  public.set_tournament_entrant_drop(uuid,boolean,text),
  public.issue_tournament_penalty(uuid,uuid,text,integer,text),
  public.export_tournament_recovery(uuid)
  from public,anon,authenticated;
grant execute on function public.is_tournament_staff(uuid),public.can_view_tournament(uuid),
  public.set_tournament_visibility(uuid,text),public.appoint_tournament_staff(uuid,text,text),
  public.create_tournament_invite(uuid,timestamptz,integer),public.accept_tournament_invite(uuid),
  public.resolve_tournament_dispute(uuid,text,integer,integer,boolean),
  public.record_tournament_match_outcome(uuid,text,text),
  public.set_tournament_entrant_drop(uuid,boolean,text),
  public.issue_tournament_penalty(uuid,uuid,text,integer,text),
  public.export_tournament_recovery(uuid)
  to authenticated;

commit;
notify pgrst,'reload schema';
