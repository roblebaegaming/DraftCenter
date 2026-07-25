-- Private match preparation and auditable judge calls.
-- Additive to migration 200; does not alter league records.
begin;

create table if not exists public.tournament_match_companions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pairing_id uuid not null references public.tournament_pairings(id) on delete cascade,
  entrant_id uuid not null references public.tournament_entrants(id) on delete cascade,
  matchup_plan text not null default '' check (char_length(matchup_plan) <= 20000),
  post_match_notes text not null default '' check (char_length(post_match_notes) <= 20000),
  game_selections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(game_selections)='array' and jsonb_array_length(game_selections)<=7 and octet_length(game_selections::text)<=30000),
  updated_at timestamptz not null default now(),
  unique(pairing_id,entrant_id)
);

create table if not exists public.tournament_disputes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pairing_id uuid not null references public.tournament_pairings(id) on delete restrict,
  opened_by_entrant_id uuid not null references public.tournament_entrants(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 5000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolution text check (resolution is null or char_length(resolution)<=10000),
  resolved_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.tournament_announcements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  audience text not null default 'all' check (audience in ('all','players','staff')),
  created_at timestamptz not null default now()
);

create index if not exists tournament_companions_owner_idx on public.tournament_match_companions(entrant_id,updated_at desc);
create index if not exists tournament_disputes_event_idx on public.tournament_disputes(tournament_id,status,opened_at);
create unique index if not exists tournament_disputes_one_open_idx on public.tournament_disputes(pairing_id) where status='open';
create index if not exists tournament_announcements_event_idx on public.tournament_announcements(tournament_id,created_at desc);

alter table public.tournament_match_companions enable row level security;
alter table public.tournament_disputes enable row level security;
alter table public.tournament_announcements enable row level security;

revoke all on public.tournament_match_companions,public.tournament_disputes,public.tournament_announcements from public,anon,authenticated;
grant select on public.tournament_match_companions,public.tournament_disputes,public.tournament_announcements to authenticated;

create policy "Players read only their match companion"
on public.tournament_match_companions for select to authenticated using (
  entrant_id in (select id from public.tournament_entrants where user_id=auth.uid())
);

create policy "Players and organizer read relevant disputes"
on public.tournament_disputes for select to authenticated using (
  public.is_tournament_organizer(tournament_id)
  or opened_by_entrant_id in (select id from public.tournament_entrants where user_id=auth.uid())
  or exists (
    select 1 from public.tournament_pairings p
    join public.tournament_entrants e on e.user_id=auth.uid()
    where p.id=pairing_id and e.id in (p.entrant_a_id,p.entrant_b_id)
  )
);

create policy "Tournament announcements are visible to their audience"
on public.tournament_announcements for select to authenticated using (
  audience='all'
  or (audience='players' and public.is_tournament_entrant(tournament_id))
  or (audience='staff' and public.is_tournament_organizer(tournament_id))
);

create or replace function public.save_tournament_match_companion(
  p_pairing_id uuid,
  p_matchup_plan text,
  p_post_match_notes text default '',
  p_game_selections jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_pair public.tournament_pairings; v_entrant uuid;
begin
  select * into v_pair from public.tournament_pairings where id=p_pairing_id;
  select id into v_entrant from public.tournament_entrants
    where tournament_id=v_pair.tournament_id and user_id=auth.uid()
      and id in (v_pair.entrant_a_id,v_pair.entrant_b_id);
  if v_entrant is null then raise exception 'Only match participants can save this private companion.'; end if;
  insert into public.tournament_match_companions(tournament_id,pairing_id,entrant_id,matchup_plan,post_match_notes,game_selections)
  values(v_pair.tournament_id,p_pairing_id,v_entrant,coalesce(p_matchup_plan,''),coalesce(p_post_match_notes,''),coalesce(p_game_selections,'[]'))
  on conflict(pairing_id,entrant_id) do update set matchup_plan=excluded.matchup_plan,
    post_match_notes=excluded.post_match_notes,game_selections=excluded.game_selections,updated_at=now();
  return jsonb_build_object('tournament_id',v_pair.tournament_id);
end $$;

create or replace function public.open_tournament_dispute(p_pairing_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_pair public.tournament_pairings; v_entrant uuid; v_id uuid;
begin
  select * into v_pair from public.tournament_pairings where id=p_pairing_id for update;
  select id into v_entrant from public.tournament_entrants where tournament_id=v_pair.tournament_id
    and user_id=auth.uid() and id in(v_pair.entrant_a_id,v_pair.entrant_b_id);
  if v_entrant is null then raise exception 'Only match participants can request a judge.'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Briefly describe why a judge is needed.'; end if;
  insert into public.tournament_disputes(tournament_id,pairing_id,opened_by_entrant_id,reason)
  values(v_pair.tournament_id,p_pairing_id,v_entrant,btrim(p_reason)) returning id into v_id;
  update public.tournament_pairings set status='disputed' where id=p_pairing_id and status not in('confirmed','bye');
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(v_pair.tournament_id,'judge_requested',auth.uid(),jsonb_build_object('pairing_id',p_pairing_id,'dispute_id',v_id));
  return jsonb_build_object('tournament_id',v_pair.tournament_id,'dispute_id',v_id);
end $$;

create or replace function public.resolve_tournament_dispute(
  p_dispute_id uuid,p_resolution text,p_games_a integer default null,p_games_b integer default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_dispute public.tournament_disputes; v_pair public.tournament_pairings; v_event public.tournaments; v_winner uuid;
begin
  select * into v_dispute from public.tournament_disputes where id=p_dispute_id for update;
  select * into v_event from public.tournaments where id=v_dispute.tournament_id;
  if v_event.organizer_id<>auth.uid() then raise exception 'Only the organizer can resolve a judge call.'; end if;
  if v_dispute.status<>'open' then raise exception 'This judge call is already closed.'; end if;
  if char_length(btrim(coalesce(p_resolution,'')))<3 then raise exception 'Record the judge decision.'; end if;
  select * into v_pair from public.tournament_pairings where id=v_dispute.pairing_id for update;
  if p_games_a is not null or p_games_b is not null then
    if p_games_a is null or p_games_b is null or p_games_a=p_games_b or least(p_games_a,p_games_b)<0 then
      raise exception 'Provide a complete non-tied score.';
    end if;
    v_winner:=case when p_games_a>p_games_b then v_pair.entrant_a_id else v_pair.entrant_b_id end;
    update public.tournament_pairings set games_a=p_games_a,games_b=p_games_b,winner_entrant_id=v_winner,
      status='confirmed',confirmed_at=now() where id=v_pair.id;
  else
    update public.tournament_pairings set status=case when games_a is null then 'pending' else 'reported' end where id=v_pair.id;
  end if;
  update public.tournament_disputes set status='resolved',resolution=btrim(p_resolution),
    resolved_by=auth.uid(),resolved_at=now() where id=p_dispute_id;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload)
  values(v_dispute.tournament_id,'judge_resolved',auth.uid(),jsonb_build_object('pairing_id',v_pair.id,'dispute_id',p_dispute_id));
  return jsonb_build_object('tournament_id',v_dispute.tournament_id);
end $$;

revoke all on function public.save_tournament_match_companion(uuid,text,text,jsonb),
  public.open_tournament_dispute(uuid,text),public.resolve_tournament_dispute(uuid,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.save_tournament_match_companion(uuid,text,text,jsonb),
  public.open_tournament_dispute(uuid,text),public.resolve_tournament_dispute(uuid,text,integer,integer)
  to authenticated;

commit;
notify pgrst,'reload schema';
