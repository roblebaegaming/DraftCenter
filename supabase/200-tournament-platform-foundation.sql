-- Isolated tournament platform foundation.
-- Apply only after review in a safe project; it does not alter league tables.
begin;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,100}$'),
  description text not null default '' check (char_length(description) <= 5000),
  format_name text not null check (char_length(btrim(format_name)) between 1 and 100),
  structure text not null check (structure in ('swiss','swiss_top_cut','regional','single_elimination')),
  status text not null default 'registration' check (status in ('registration','active','complete','cancelled')),
  swiss_rounds integer not null default 5 check (swiss_rounds between 1 and 15),
  top_cut_size integer not null default 0 check (top_cut_size in (0,4,8,16,32)),
  best_of integer not null default 3 check (best_of in (1,3,5,7)),
  max_players integer not null default 64 check (max_players between 2 and 1024),
  team_sheet_policy text not null default 'open_on_pairing' check (team_sheet_policy in ('closed','open_on_pairing','open')),
  starts_at timestamptz,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_entrants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  checked_in boolean not null default false,
  seed integer,
  dropped_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id,user_id)
);

create table if not exists public.tournament_team_sheets (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entrant_id uuid not null references public.tournament_entrants(id) on delete cascade,
  team_name text not null check (char_length(btrim(team_name)) between 1 and 120),
  pokemon jsonb not null check (jsonb_typeof(pokemon) = 'array' and jsonb_array_length(pokemon) between 1 and 20),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 100000),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id,entrant_id)
);

create table if not exists public.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  stage text not null check (stage in ('swiss','top_cut')),
  status text not null default 'active' check (status in ('active','complete')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (tournament_id,round_number)
);

create table if not exists public.tournament_pairings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.tournament_rounds(id) on delete cascade,
  table_number integer not null check (table_number > 0),
  entrant_a_id uuid not null references public.tournament_entrants(id) on delete restrict,
  entrant_b_id uuid references public.tournament_entrants(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','reported','confirmed','disputed','bye')),
  games_a integer,
  games_b integer,
  winner_entrant_id uuid references public.tournament_entrants(id) on delete restrict,
  reported_by_entrant_id uuid references public.tournament_entrants(id) on delete restrict,
  replay_url text,
  reported_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id,table_number),
  check (entrant_b_id is null or entrant_a_id <> entrant_b_id),
  check (replay_url is null or replay_url ~ '^https://')
);

create table if not exists public.tournament_events (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tournament_entrants_event_idx on public.tournament_entrants(tournament_id);
create index if not exists tournament_rounds_event_idx on public.tournament_rounds(tournament_id,round_number);
create index if not exists tournament_pairings_event_idx on public.tournament_pairings(tournament_id,round_id);

create or replace function public.is_tournament_organizer(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.tournaments where id=p_tournament_id and organizer_id=auth.uid()) $$;

create or replace function public.is_tournament_entrant(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.tournament_entrants where tournament_id=p_tournament_id and user_id=auth.uid()) $$;

alter table public.tournaments enable row level security;
alter table public.tournament_entrants enable row level security;
alter table public.tournament_team_sheets enable row level security;
alter table public.tournament_rounds enable row level security;
alter table public.tournament_pairings enable row level security;
alter table public.tournament_events enable row level security;

revoke all on public.tournaments,public.tournament_entrants,public.tournament_team_sheets,public.tournament_rounds,public.tournament_pairings,public.tournament_events from public,anon,authenticated;
grant select on public.tournaments,public.tournament_entrants,public.tournament_rounds,public.tournament_pairings to anon,authenticated;
grant select on public.tournament_events to authenticated;
grant select on public.tournament_team_sheets to authenticated;

create policy "Tournament listings are readable" on public.tournaments for select using (true);
create policy "Tournament entrants are readable" on public.tournament_entrants for select using (true);
create policy "Tournament rounds are readable" on public.tournament_rounds for select using (true);
create policy "Tournament pairings are readable" on public.tournament_pairings for select using (true);
create policy "Organizers read tournament audit" on public.tournament_events for select to authenticated using (public.is_tournament_organizer(tournament_id));
create policy "Authorized team sheet visibility" on public.tournament_team_sheets for select to authenticated using (
  public.is_tournament_organizer(tournament_id)
  or entrant_id in (select id from public.tournament_entrants where tournament_id=tournament_team_sheets.tournament_id and user_id=auth.uid())
  or (
    locked_at is not null and exists (
      select 1 from public.tournaments t where t.id=tournament_id and (
        t.team_sheet_policy='open'
        or (t.team_sheet_policy='open_on_pairing' and exists (
          select 1 from public.tournament_pairings p
          join public.tournament_entrants mine on mine.tournament_id=p.tournament_id and mine.user_id=auth.uid()
          where p.tournament_id=tournament_team_sheets.tournament_id
            and ((p.entrant_a_id=entrant_id and p.entrant_b_id=mine.id) or (p.entrant_b_id=entrant_id and p.entrant_a_id=mine.id))
        ))
      )
    )
  )
);

create or replace function public.create_tournament(p_settings jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to create a tournament.'; end if;
  insert into public.profiles(id,display_name) values(auth.uid(),'Organizer') on conflict(id) do nothing;
  insert into public.tournaments(organizer_id,name,slug,description,format_name,structure,swiss_rounds,top_cut_size,best_of,max_players,team_sheet_policy)
  values(auth.uid(),btrim(p_settings->>'name'),btrim(p_settings->>'slug'),coalesce(p_settings->>'description',''),
    btrim(p_settings->>'format_name'),p_settings->>'structure',coalesce((p_settings->>'swiss_rounds')::integer,5),
    coalesce((p_settings->>'top_cut_size')::integer,0),coalesce((p_settings->>'best_of')::integer,3),
    coalesce((p_settings->>'max_players')::integer,64),coalesce(p_settings->>'team_sheet_policy','open_on_pairing'))
  returning id into v_id;
  insert into public.tournament_events(tournament_id,event_type,actor_id) values(v_id,'tournament_created',auth.uid());
  return jsonb_build_object('id',v_id,'tournament_id',v_id);
end $$;

create or replace function public.register_for_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_event public.tournaments; v_name text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to register.'; end if;
  select * into v_event from public.tournaments where id=p_tournament_id for update;
  if v_event.status<>'registration' then raise exception 'Registration is closed.'; end if;
  if (select count(*) from public.tournament_entrants where tournament_id=p_tournament_id)>=v_event.max_players then raise exception 'This tournament is full.'; end if;
  select coalesce(nullif(display_name,''),username,'Player') into v_name from public.profiles where id=auth.uid();
  insert into public.tournament_entrants(tournament_id,user_id,display_name) values(p_tournament_id,auth.uid(),v_name)
  on conflict(tournament_id,user_id) do update set dropped_at=null returning id into v_id;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload) values(p_tournament_id,'entrant_registered',auth.uid(),jsonb_build_object('entrant_id',v_id));
  return jsonb_build_object('tournament_id',p_tournament_id,'entrant_id',v_id);
end $$;

create or replace function public.check_in_tournament_entrant(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  update public.tournament_entrants e set checked_in=true
  where e.tournament_id=p_tournament_id and e.user_id=auth.uid()
    and exists(select 1 from public.tournaments t where t.id=p_tournament_id and t.status='registration');
  if not found then raise exception 'You are not eligible to check in.'; end if;
  return jsonb_build_object('tournament_id',p_tournament_id);
end $$;

create or replace function public.save_tournament_team_sheet(p_tournament_id uuid,p_team_name text,p_pokemon jsonb,p_details jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_entrant uuid;
begin
  select e.id into v_entrant from public.tournament_entrants e join public.tournaments t on t.id=e.tournament_id
  where e.tournament_id=p_tournament_id and e.user_id=auth.uid() and t.status='registration';
  if v_entrant is null then raise exception 'Team sheets can only be changed by registered players before the event starts.'; end if;
  insert into public.tournament_team_sheets(tournament_id,entrant_id,team_name,pokemon,details)
  values(p_tournament_id,v_entrant,btrim(p_team_name),p_pokemon,coalesce(p_details,'{}'))
  on conflict(tournament_id,entrant_id) do update set team_name=excluded.team_name,pokemon=excluded.pokemon,details=excluded.details,updated_at=now()
  where public.tournament_team_sheets.locked_at is null;
  if not found then raise exception 'This team sheet is locked.'; end if;
  return jsonb_build_object('tournament_id',p_tournament_id);
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
  ), totals as (
    select e.id,e.display_name,coalesce(sum(r.points),0)::integer points,count(r.entrant_id)::integer played
    from public.tournament_entrants e left join results r on r.entrant_id=e.id
    where e.tournament_id=p_tournament_id group by e.id,e.display_name
  )
  select t.id,t.display_name,t.points,t.played,
    coalesce(avg(greatest(33.33,least(100,(opp.points::numeric/greatest(opp.played*3,1))*100))) filter(where r.opponent_id is not null),0)::numeric(6,2)
  from totals t left join results r on r.entrant_id=t.id left join totals opp on opp.id=r.opponent_id
  group by t.id,t.display_name,t.points,t.played order by t.points desc,5 desc,t.display_name
$$;

create or replace function public.start_tournament_round(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_event public.tournaments; v_active public.tournament_rounds; v_round integer; v_round_id uuid;
  v_stage text; v_table integer:=1; v_a uuid; v_b uuid; v_count integer;
begin
  select * into v_event from public.tournaments where id=p_tournament_id for update;
  if v_event.id is null or v_event.organizer_id<>auth.uid() then raise exception 'Only the organizer can pair rounds.'; end if;
  select * into v_active from public.tournament_rounds where tournament_id=p_tournament_id and status='active' order by round_number desc limit 1 for update;
  if v_active.id is not null then
    if exists(select 1 from public.tournament_pairings where round_id=v_active.id and status not in ('confirmed','bye')) then
      raise exception 'Every table must have a confirmed result before the next round.';
    end if;
    update public.tournament_rounds set status='complete',completed_at=now() where id=v_active.id;
  end if;
  v_round:=coalesce(v_active.round_number,0)+1;
  if v_event.status='registration' then
    if (select count(*) from public.tournament_entrants where tournament_id=p_tournament_id and checked_in and dropped_at is null)<2 then raise exception 'At least two checked-in players are required.'; end if;
    if exists(select 1 from public.tournament_entrants e where e.tournament_id=p_tournament_id and e.checked_in and not exists(select 1 from public.tournament_team_sheets s where s.entrant_id=e.id)) then
      raise exception 'Every checked-in player must submit a team sheet.';
    end if;
    update public.tournament_team_sheets set locked_at=now() where tournament_id=p_tournament_id;
    update public.tournaments set status='active',revision=revision+1,updated_at=now() where id=p_tournament_id;
  end if;
  if v_event.structure='single_elimination' then
    v_stage:='top_cut';
  elsif v_round<=v_event.swiss_rounds then
    v_stage:='swiss';
  elsif v_event.structure in ('swiss_top_cut','regional') and v_event.top_cut_size>=2 then
    v_stage:='top_cut';
  else
    update public.tournaments set status='complete',revision=revision+1,updated_at=now() where id=p_tournament_id;
    insert into public.tournament_events(tournament_id,event_type,actor_id) values(p_tournament_id,'tournament_completed',auth.uid());
    return jsonb_build_object('tournament_id',p_tournament_id,'complete',true);
  end if;
  create temporary table pairing_pool(id uuid primary key,points integer,omw numeric,paired boolean default false) on commit drop;
  if v_stage='top_cut' and v_active.stage='top_cut' then
    insert into pairing_pool(id,points,omw)
    select winner_entrant_id,0,0 from public.tournament_pairings where round_id=v_active.id and winner_entrant_id is not null;
  else
    insert into pairing_pool(id,points,omw)
    select s.entrant_id,s.match_points,s.opponent_match_win_pct from public.get_tournament_standings(p_tournament_id) s
    join public.tournament_entrants e on e.id=s.entrant_id
    where e.checked_in and e.dropped_at is null
    order by s.match_points desc,s.opponent_match_win_pct desc
    limit case when v_stage='top_cut' then greatest(v_event.top_cut_size,2) else 1024 end;
  end if;
  select count(*) into v_count from pairing_pool;
  if v_stage='top_cut' and v_count=1 then
    update public.tournaments set status='complete',revision=revision+1,updated_at=now() where id=p_tournament_id;
    insert into public.tournament_events(tournament_id,event_type,actor_id,payload) values(p_tournament_id,'tournament_completed',auth.uid(),jsonb_build_object('champion_entrant_id',(select id from pairing_pool)));
    return jsonb_build_object('tournament_id',p_tournament_id,'complete',true);
  end if;
  insert into public.tournament_rounds(tournament_id,round_number,stage) values(p_tournament_id,v_round,v_stage) returning id into v_round_id;
  while exists(select 1 from pairing_pool where not paired) loop
    select id into v_a from pairing_pool where not paired order by points desc,omw desc,id limit 1;
    update pairing_pool set paired=true where id=v_a;
    select p.id into v_b from pairing_pool p where not p.paired and not exists(
      select 1 from public.tournament_pairings old where old.tournament_id=p_tournament_id
      and ((old.entrant_a_id=v_a and old.entrant_b_id=p.id) or (old.entrant_a_id=p.id and old.entrant_b_id=v_a))
    ) order by p.points desc,p.omw desc,p.id limit 1;
    if v_b is null then select id into v_b from pairing_pool where not paired order by points desc,omw desc,id limit 1; end if;
    if v_b is null then
      insert into public.tournament_pairings(tournament_id,round_id,table_number,entrant_a_id,status,games_a,games_b,winner_entrant_id,confirmed_at)
      values(p_tournament_id,v_round_id,v_table,v_a,'bye',1,0,v_a,now());
    else
      update pairing_pool set paired=true where id=v_b;
      insert into public.tournament_pairings(tournament_id,round_id,table_number,entrant_a_id,entrant_b_id) values(p_tournament_id,v_round_id,v_table,v_a,v_b);
    end if;
    v_table:=v_table+1; v_b:=null;
  end loop;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload) values(p_tournament_id,'round_started',auth.uid(),jsonb_build_object('round',v_round,'stage',v_stage));
  return jsonb_build_object('tournament_id',p_tournament_id,'round_id',v_round_id);
end $$;

create or replace function public.report_tournament_match(p_pairing_id uuid,p_games_a integer,p_games_b integer,p_replay_url text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_pair public.tournament_pairings; v_event public.tournaments; v_me uuid; v_winner uuid; v_needed integer;
begin
  select * into v_pair from public.tournament_pairings where id=p_pairing_id for update;
  select * into v_event from public.tournaments where id=v_pair.tournament_id;
  select id into v_me from public.tournament_entrants where tournament_id=v_pair.tournament_id and user_id=auth.uid();
  if v_me not in (v_pair.entrant_a_id,v_pair.entrant_b_id) and v_event.organizer_id<>auth.uid() then raise exception 'Only a participant or organizer can report this match.'; end if;
  if v_pair.status in ('confirmed','bye') then raise exception 'This result is already final.'; end if;
  v_needed:=ceil(v_event.best_of::numeric/2);
  if p_games_a<0 or p_games_b<0 or p_games_a=p_games_b or greatest(p_games_a,p_games_b)<>v_needed or least(p_games_a,p_games_b)>=v_needed then raise exception 'Enter a valid best-of-% score.',v_event.best_of; end if;
  if p_replay_url is not null and p_replay_url !~ '^https://' then raise exception 'Replay links must use HTTPS.'; end if;
  v_winner:=case when p_games_a>p_games_b then v_pair.entrant_a_id else v_pair.entrant_b_id end;
  update public.tournament_pairings set status=case when v_event.organizer_id=auth.uid() then 'confirmed' else 'reported' end,
    games_a=p_games_a,games_b=p_games_b,winner_entrant_id=v_winner,reported_by_entrant_id=v_me,replay_url=nullif(btrim(p_replay_url),''),
    reported_at=now(),confirmed_at=case when v_event.organizer_id=auth.uid() then now() else null end where id=p_pairing_id;
  return jsonb_build_object('tournament_id',v_pair.tournament_id);
end $$;

create or replace function public.confirm_tournament_match(p_pairing_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_pair public.tournament_pairings; v_me uuid;
begin
  select * into v_pair from public.tournament_pairings where id=p_pairing_id for update;
  select id into v_me from public.tournament_entrants where tournament_id=v_pair.tournament_id and user_id=auth.uid();
  if v_pair.status<>'reported' or v_me not in (v_pair.entrant_a_id,v_pair.entrant_b_id) or v_pair.reported_by_entrant_id=v_me then raise exception 'Only the opposing player can confirm this report.'; end if;
  update public.tournament_pairings set status='confirmed',confirmed_at=now() where id=p_pairing_id;
  insert into public.tournament_events(tournament_id,event_type,actor_id,payload) values(v_pair.tournament_id,'result_confirmed',auth.uid(),jsonb_build_object('pairing_id',p_pairing_id));
  return jsonb_build_object('tournament_id',v_pair.tournament_id);
end $$;

revoke all on function public.is_tournament_organizer(uuid),public.is_tournament_entrant(uuid),public.create_tournament(jsonb),public.register_for_tournament(uuid),public.check_in_tournament_entrant(uuid),public.save_tournament_team_sheet(uuid,text,jsonb,jsonb),public.get_tournament_standings(uuid),public.start_tournament_round(uuid),public.report_tournament_match(uuid,integer,integer,text),public.confirm_tournament_match(uuid) from public,anon,authenticated;
grant execute on function public.is_tournament_organizer(uuid),public.is_tournament_entrant(uuid),public.create_tournament(jsonb),public.register_for_tournament(uuid),public.check_in_tournament_entrant(uuid),public.save_tournament_team_sheet(uuid,text,jsonb,jsonb),public.start_tournament_round(uuid),public.report_tournament_match(uuid,integer,integer,text),public.confirm_tournament_match(uuid) to authenticated;
grant execute on function public.get_tournament_standings(uuid) to anon,authenticated;

commit;
notify pgrst,'reload schema';
