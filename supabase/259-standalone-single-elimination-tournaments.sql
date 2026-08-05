-- Standalone single-elimination tournaments with atomic confirmed advancement.
begin;

create extension if not exists pgcrypto with schema extensions;

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{4,80}$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  visibility text not null default 'public' check (visibility in ('public','private')),
  format text not null default 'single-elimination' check (format='single-elimination'),
  status text not null default 'registration' check (status in ('registration','active','complete','archived')),
  rules text not null default '' check (char_length(rules) <= 10000),
  best_of smallint not null default 3 check (best_of in (1,3)),
  entrant_limit smallint not null default 16 check (entrant_limit between 2 and 64),
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_entrants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  registered_team_id uuid references public.personal_teams(id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  seed smallint check (seed between 1 and 64),
  status text not null default 'registered' check (status in ('registered','dropped','disqualified')),
  registered_at timestamptz not null default now(),
  unique (tournament_id,user_id),
  unique (tournament_id,seed)
);

create table public.tournament_registration_codes (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 10),
  match_number smallint not null check (match_number between 1 and 64),
  entrant_a_id uuid references public.tournament_entrants(id) on delete restrict,
  entrant_b_id uuid references public.tournament_entrants(id) on delete restrict,
  winner_to_match_id uuid references public.tournament_matches(id) on delete restrict,
  winner_to_slot text check (winner_to_slot in ('a','b')),
  best_of smallint not null check (best_of in (1,3)),
  status text not null default 'pending' check (status in ('pending','ready','reported','complete','bye')),
  revision bigint not null default 0,
  games_a smallint check (games_a >= 0),
  games_b smallint check (games_b >= 0),
  winner_id uuid references public.tournament_entrants(id) on delete restrict,
  loser_id uuid references public.tournament_entrants(id) on delete restrict,
  replay_urls text[] not null default '{}',
  mvp text check (mvp is null or char_length(mvp) <= 120),
  completed_at timestamptz,
  unique (tournament_id,round_number,match_number),
  check (entrant_a_id is null or entrant_a_id<>entrant_b_id),
  check ((winner_to_match_id is null)=(winner_to_slot is null))
);

create table public.tournament_result_submissions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.tournament_matches(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  expected_match_revision bigint not null,
  games_a smallint not null check (games_a >= 0),
  games_b smallint not null check (games_b >= 0),
  replay_urls text[] not null default '{}',
  mvp text check (mvp is null or char_length(mvp) <= 120),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  confirmed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.tournament_audit_events (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (char_length(kind) between 2 and 80),
  payload jsonb not null default '{}' check (jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now()
);

create index tournaments_owner_updated_idx on public.tournaments(owner_id,updated_at desc);
create index tournaments_public_status_idx on public.tournaments(visibility,status,updated_at desc);
create index tournament_entrants_tournament_idx on public.tournament_entrants(tournament_id,seed,registered_at);
create index tournament_entrants_user_idx on public.tournament_entrants(user_id,tournament_id);
create index tournament_matches_bracket_idx on public.tournament_matches(tournament_id,round_number,match_number);
create index tournament_result_submissions_pending_idx on public.tournament_result_submissions(match_id,status,created_at desc);
create index tournament_audit_tournament_idx on public.tournament_audit_events(tournament_id,created_at desc);

alter table public.tournaments enable row level security;
alter table public.tournament_entrants enable row level security;
alter table public.tournament_registration_codes enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_result_submissions enable row level security;
alter table public.tournament_audit_events enable row level security;
revoke all on public.tournaments,public.tournament_entrants,public.tournament_registration_codes,public.tournament_matches,public.tournament_result_submissions,public.tournament_audit_events from public,anon,authenticated;
grant all on public.tournaments,public.tournament_entrants,public.tournament_registration_codes,public.tournament_matches,public.tournament_result_submissions,public.tournament_audit_events to service_role;
grant usage,select on sequence public.tournament_audit_events_id_seq to service_role;

create or replace function public.can_view_tournament(p_tournament_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.tournaments t where t.id=p_tournament_id and (t.visibility='public' or t.owner_id=auth.uid() or exists(select 1 from public.tournament_entrants e where e.tournament_id=t.id and e.user_id=auth.uid()))) $$;
revoke all on function public.can_view_tournament(uuid) from public,anon,authenticated;
grant execute on function public.can_view_tournament(uuid) to anon,authenticated;

create policy tournaments_visible_read on public.tournaments for select to anon,authenticated using (public.can_view_tournament(id));
create policy tournament_entrants_visible_read on public.tournament_entrants for select to anon,authenticated using (public.can_view_tournament(tournament_id));
create policy tournament_matches_visible_read on public.tournament_matches for select to anon,authenticated using (public.can_view_tournament(tournament_id));
create policy tournament_submissions_participant_read on public.tournament_result_submissions for select to authenticated using (exists(select 1 from public.tournaments t join public.tournament_matches m on m.tournament_id=t.id join public.tournament_entrants a on a.id=m.entrant_a_id join public.tournament_entrants b on b.id=m.entrant_b_id where t.id=tournament_result_submissions.tournament_id and (t.owner_id=auth.uid() or a.user_id=auth.uid() or b.user_id=auth.uid())));
create policy tournament_audit_owner_read on public.tournament_audit_events for select to authenticated using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.owner_id=auth.uid()));

create or replace function public.create_single_elimination_tournament(p_name text,p_description text default '',p_visibility text default 'public',p_best_of integer default 3,p_entrant_limit integer default 16,p_rules text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_id uuid:=gen_random_uuid();v_slug text;v_name text:=btrim(p_name);v_slug_base text;v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in to create a tournament.';end if;
  if nullif(v_name,'') is null or char_length(v_name) not between 2 and 120 or p_visibility not in ('public','private') or p_best_of not in (1,3) or p_entrant_limit not between 2 and 64 or char_length(coalesce(p_description,''))>2000 or char_length(coalesce(p_rules,''))>10000 then raise exception 'Tournament settings are invalid.';end if;
  v_slug_base:=left(trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g')),60);if v_slug_base='' then v_slug_base:='tournament';end if;v_slug:=v_slug_base||'-'||left(replace(v_id::text,'-',''),8);
  insert into public.tournaments(id,slug,owner_id,name,description,visibility,best_of,entrant_limit,rules) values(v_id,v_slug,auth.uid(),v_name,coalesce(p_description,''),p_visibility,p_best_of,p_entrant_limit,coalesce(p_rules,''));
  if p_visibility='private' then v_code:=left(replace(gen_random_uuid()::text,'-',''),16);insert into public.tournament_registration_codes(tournament_id,code_hash)values(v_id,encode(digest(v_code,'sha256'),'hex'));end if;
  insert into public.tournament_audit_events(tournament_id,actor_id,kind) values(v_id,auth.uid(),'tournament_created');return jsonb_build_object('slug',v_slug,'registration_code',v_code);
end $$;

create or replace function public.join_tournament(p_tournament_id uuid,p_display_name text,p_registered_team_id uuid default null,p_access_code text default null)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare v_t public.tournaments%rowtype;v_id uuid;v_name text:=btrim(p_display_name);
begin
  if auth.uid() is null then raise exception 'Sign in to register.';end if;select * into v_t from public.tournaments where id=p_tournament_id for update;
  if not found or v_t.status<>'registration' then raise exception 'Registration is closed.';end if;if v_t.visibility<>'public' and v_t.owner_id<>auth.uid() and not exists(select 1 from public.tournament_registration_codes c where c.tournament_id=v_t.id and c.code_hash=encode(digest(coalesce(p_access_code,''),'sha256'),'hex')) then raise exception 'This private registration link is invalid.';end if;
  if char_length(v_name) not between 1 and 100 then raise exception 'Enter a display name.';end if;if(select count(*) from public.tournament_entrants where tournament_id=v_t.id and status='registered')>=v_t.entrant_limit then raise exception 'This tournament is full.';end if;
  if p_registered_team_id is not null and not exists(select 1 from public.personal_teams where id=p_registered_team_id and owner_id=auth.uid()) then raise exception 'Choose one of your own registered teams.';end if;
  insert into public.tournament_entrants(tournament_id,user_id,registered_team_id,display_name) values(v_t.id,auth.uid(),p_registered_team_id,v_name) returning id into v_id;
  insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(v_t.id,auth.uid(),'entrant_registered',jsonb_build_object('entrant_id',v_id));return v_id;
exception when unique_violation then raise exception 'You are already registered.';end $$;

create or replace function public.rotate_tournament_registration_code(p_tournament_id uuid)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare v_code text;
begin
  if auth.uid() is null or not exists(select 1 from public.tournaments where id=p_tournament_id and owner_id=auth.uid() and visibility='private' and status='registration') then raise exception 'Only the owner can replace a private registration link while registration is open.';end if;
  v_code:=left(replace(gen_random_uuid()::text,'-',''),16);
  insert into public.tournament_registration_codes(tournament_id,code_hash) values(p_tournament_id,encode(digest(v_code,'sha256'),'hex')) on conflict(tournament_id) do update set code_hash=excluded.code_hash,created_at=now();
  insert into public.tournament_audit_events(tournament_id,actor_id,kind) values(p_tournament_id,auth.uid(),'registration_code_rotated');
  return v_code;
end $$;

create or replace function public.set_tournament_seed(p_tournament_id uuid,p_entrant_id uuid,p_seed integer)
returns void language plpgsql security definer set search_path=public as $$
declare v_old_seed integer;v_other uuid;
begin
  if auth.uid() is null then raise exception 'Only the tournament owner can seed registration.';end if;perform 1 from public.tournaments where id=p_tournament_id and owner_id=auth.uid() and status='registration' for update;if not found then raise exception 'Only the tournament owner can seed registration.';end if;
  if p_seed not between 1 and 64 then raise exception 'Choose a valid seed.';end if;select seed into v_old_seed from public.tournament_entrants where id=p_entrant_id and tournament_id=p_tournament_id and status='registered';if not found then raise exception 'Entrant not found.';end if;
  select id into v_other from public.tournament_entrants where tournament_id=p_tournament_id and status='registered' and seed=p_seed and id<>p_entrant_id;update public.tournament_entrants set seed=null where id=v_other;update public.tournament_entrants set seed=p_seed where id=p_entrant_id;if v_other is not null and v_old_seed is not null then update public.tournament_entrants set seed=v_old_seed where id=v_other;end if;
  update public.tournaments set revision=revision+1,updated_at=now() where id=p_tournament_id;insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(p_tournament_id,auth.uid(),'seed_changed',jsonb_build_object('entrant_id',p_entrant_id,'seed',p_seed));
end $$;

create or replace function public.randomize_tournament_seeds(p_tournament_id uuid,p_random_key text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order uuid[];v_index integer;
begin
  if auth.uid() is null then raise exception 'Only the tournament owner can shuffle seeds.';end if;perform 1 from public.tournaments where id=p_tournament_id and owner_id=auth.uid() and status='registration' for update;if not found then raise exception 'Only the tournament owner can shuffle seeds.';end if;
  if char_length(coalesce(p_random_key,'')) not between 8 and 120 then raise exception 'A valid shuffle key is required.';end if;select array_agg(id order by md5(p_random_key||':'||id::text),id) into v_order from public.tournament_entrants where tournament_id=p_tournament_id and status='registered';if coalesce(array_length(v_order,1),0)<2 then raise exception 'At least two entrants are required.';end if;
  update public.tournament_entrants set seed=null where tournament_id=p_tournament_id;for v_index in 1..array_length(v_order,1) loop update public.tournament_entrants set seed=v_index where id=v_order[v_index];end loop;update public.tournaments set revision=revision+1,updated_at=now() where id=p_tournament_id;insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(p_tournament_id,auth.uid(),'seeds_randomized',jsonb_build_object('entrants',array_length(v_order,1)));
end $$;

create or replace function public.single_elimination_seed_order(p_size integer)
returns integer[] language plpgsql immutable set search_path='' as $$ declare v_order integer[]:=array[1,2];v_next integer[];v_size integer;v_seed integer;begin if p_size<2 or p_size>64 or (p_size&(p_size-1))<>0 then raise exception 'Bracket size must be a power of two.';end if;while array_length(v_order,1)<p_size loop v_size:=array_length(v_order,1)*2;v_next:='{}';foreach v_seed in array v_order loop v_next:=v_next||v_seed||(v_size+1-v_seed);end loop;v_order:=v_next;end loop;return v_order;end $$;

create or replace function public.lock_single_elimination_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_t public.tournaments%rowtype;v_count integer;v_size integer:=2;v_rounds integer:=1;v_round integer;v_match integer;v_matches integer;v_order integer[];v_entrant_order uuid[];v_index integer;v_a uuid;v_b uuid;v_current uuid;v_next uuid;v_winner uuid;
begin
  select * into v_t from public.tournaments where id=p_tournament_id for update;if not found or v_t.owner_id<>auth.uid() or v_t.status<>'registration' then raise exception 'Only the owner can lock open registration.';end if;
  select count(*) into v_count from public.tournament_entrants where tournament_id=p_tournament_id and status='registered';if v_count<2 then raise exception 'At least two entrants are required.';end if;
  select array_agg(id order by seed nulls last,registered_at,id) into v_entrant_order from public.tournament_entrants where tournament_id=p_tournament_id and status='registered';update public.tournament_entrants set seed=null where tournament_id=p_tournament_id;for v_index in 1..array_length(v_entrant_order,1) loop update public.tournament_entrants set seed=v_index where id=v_entrant_order[v_index];end loop;
  while v_size<v_count loop v_size:=v_size*2;v_rounds:=v_rounds+1;end loop;v_order:=public.single_elimination_seed_order(v_size);
  for v_round in 1..v_rounds loop v_matches:=v_size/(power(2,v_round)::integer);for v_match in 1..v_matches loop insert into public.tournament_matches(tournament_id,round_number,match_number,best_of) values(p_tournament_id,v_round,v_match,v_t.best_of);end loop;end loop;
  update public.tournament_matches m set winner_to_match_id=n.id,winner_to_slot=case when m.match_number%2=1 then 'a' else 'b' end from public.tournament_matches n where m.tournament_id=p_tournament_id and n.tournament_id=m.tournament_id and n.round_number=m.round_number+1 and n.match_number=ceil(m.match_number/2.0) and m.round_number<v_rounds;
  for v_match in 1..(v_size/2) loop select id into v_a from public.tournament_entrants where tournament_id=p_tournament_id and seed=v_order[(v_match-1)*2+1];select id into v_b from public.tournament_entrants where tournament_id=p_tournament_id and seed=v_order[(v_match-1)*2+2];update public.tournament_matches set entrant_a_id=v_a,entrant_b_id=v_b,status=case when v_a is not null and v_b is not null then 'ready' when v_a is not null or v_b is not null then 'bye' else 'pending' end where tournament_id=p_tournament_id and round_number=1 and match_number=v_match returning id,winner_to_match_id into v_current,v_next;if (v_a is null)<>(v_b is null) then v_winner:=coalesce(v_a,v_b);update public.tournament_matches set winner_id=v_winner,completed_at=now() where id=v_current;if v_next is not null then update public.tournament_matches set entrant_a_id=case when (select winner_to_slot from public.tournament_matches where id=v_current)='a' then v_winner else entrant_a_id end,entrant_b_id=case when (select winner_to_slot from public.tournament_matches where id=v_current)='b' then v_winner else entrant_b_id end where id=v_next;end if;end if;v_a:=null;v_b:=null;end loop;
  update public.tournament_matches set status='ready' where tournament_id=p_tournament_id and entrant_a_id is not null and entrant_b_id is not null and status='pending';update public.tournaments set status='active',revision=revision+1,updated_at=now() where id=p_tournament_id;insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(p_tournament_id,auth.uid(),'bracket_locked',jsonb_build_object('entrants',v_count,'bracket_size',v_size));
end $$;

create or replace function public.submit_tournament_result(p_match_id uuid,p_expected_revision bigint,p_games_a integer,p_games_b integer,p_replay_urls text[] default '{}',p_mvp text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_m public.tournament_matches%rowtype;v_t public.tournaments%rowtype;v_wins integer;v_id uuid;
begin if auth.uid() is null then raise exception 'Sign in to report a result.';end if;select * into v_m from public.tournament_matches where id=p_match_id for update;if not found then raise exception 'Match not found.';end if;select * into v_t from public.tournaments where id=v_m.tournament_id;if v_m.status<>'ready' or v_m.revision<>p_expected_revision then raise exception 'That match changed. Refresh before reporting.';end if;if v_t.owner_id<>auth.uid() and not exists(select 1 from public.tournament_entrants where id in(v_m.entrant_a_id,v_m.entrant_b_id) and user_id=auth.uid()) then raise exception 'Only a participant can report this match.';end if;v_wins:=(v_m.best_of+1)/2;if not((p_games_a=v_wins and p_games_b between 0 and v_wins-1)or(p_games_b=v_wins and p_games_a between 0 and v_wins-1))then raise exception 'Enter a completed series score.';end if;if coalesce(array_length(p_replay_urls,1),0)>3 or exists(select 1 from unnest(coalesce(p_replay_urls,'{}')) u where char_length(u)>2000 or u!~*'^https://')or char_length(coalesce(p_mvp,''))>120 then raise exception 'Replay or MVP details are invalid.';end if;
update public.tournament_result_submissions set status='rejected',resolved_at=now(),confirmed_by=auth.uid() where match_id=v_m.id and status='pending';insert into public.tournament_result_submissions(tournament_id,match_id,submitted_by,expected_match_revision,games_a,games_b,replay_urls,mvp) values(v_m.tournament_id,v_m.id,auth.uid(),v_m.revision,p_games_a,p_games_b,coalesce(p_replay_urls,'{}'),nullif(btrim(p_mvp),'')) returning id into v_id;update public.tournament_matches set status='reported' where id=v_m.id;insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(v_m.tournament_id,auth.uid(),'result_submitted',jsonb_build_object('match_id',v_m.id,'submission_id',v_id));return v_id;end $$;

create or replace function public.confirm_tournament_result(p_submission_id uuid,p_expected_match_revision bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_s public.tournament_result_submissions%rowtype;v_m public.tournament_matches%rowtype;v_t public.tournaments%rowtype;v_winner uuid;v_loser uuid;v_next public.tournament_matches%rowtype;
begin if auth.uid() is null then raise exception 'Sign in to confirm a result.';end if;select * into v_s from public.tournament_result_submissions where id=p_submission_id for update;if not found then raise exception 'Result submission not found.';end if;select * into v_m from public.tournament_matches where id=v_s.match_id for update;select * into v_t from public.tournaments where id=v_m.tournament_id;if v_s.status='confirmed' then if v_t.owner_id=auth.uid() or v_s.confirmed_by=auth.uid() then return v_s.match_id;end if;raise exception 'That result is no longer awaiting confirmation.';end if;if v_s.status<>'pending' then raise exception 'That result is no longer awaiting confirmation.';end if;if v_m.status<>'reported' or v_m.revision<>p_expected_match_revision or v_s.expected_match_revision<>v_m.revision then raise exception 'That match changed. Refresh before confirming.';end if;if v_t.owner_id<>auth.uid() and not exists(select 1 from public.tournament_entrants where id in(v_m.entrant_a_id,v_m.entrant_b_id) and user_id=auth.uid() and user_id<>v_s.submitted_by) then raise exception 'The opponent or tournament owner must confirm this result.';end if;v_winner:=case when v_s.games_a>v_s.games_b then v_m.entrant_a_id else v_m.entrant_b_id end;v_loser:=case when v_winner=v_m.entrant_a_id then v_m.entrant_b_id else v_m.entrant_a_id end;
update public.tournament_matches set status='complete',games_a=v_s.games_a,games_b=v_s.games_b,winner_id=v_winner,loser_id=v_loser,replay_urls=v_s.replay_urls,mvp=v_s.mvp,revision=revision+1,completed_at=now() where id=v_m.id;update public.tournament_result_submissions set status='confirmed',confirmed_by=auth.uid(),resolved_at=now() where id=v_s.id;
if v_m.winner_to_match_id is not null then select * into v_next from public.tournament_matches where id=v_m.winner_to_match_id for update;if(v_m.winner_to_slot='a' and v_next.entrant_a_id is not null and v_next.entrant_a_id<>v_winner)or(v_m.winner_to_slot='b' and v_next.entrant_b_id is not null and v_next.entrant_b_id<>v_winner)then raise exception 'The next bracket slot is already occupied.';end if;update public.tournament_matches set entrant_a_id=case when v_m.winner_to_slot='a' then v_winner else entrant_a_id end,entrant_b_id=case when v_m.winner_to_slot='b' then v_winner else entrant_b_id end,status=case when (case when v_m.winner_to_slot='a' then v_winner else entrant_a_id end)is not null and(case when v_m.winner_to_slot='b' then v_winner else entrant_b_id end)is not null then 'ready' else 'pending' end where id=v_next.id;else update public.tournaments set status='complete',revision=revision+1,updated_at=now() where id=v_m.tournament_id;end if;insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(v_m.tournament_id,auth.uid(),'result_confirmed',jsonb_build_object('match_id',v_m.id,'winner_id',v_winner,'submission_id',v_s.id));return v_m.id;end $$;

create or replace function public.correct_tournament_result(p_match_id uuid,p_expected_revision bigint,p_games_a integer,p_games_b integer,p_replay_urls text[] default '{}',p_mvp text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_m public.tournament_matches%rowtype;v_t public.tournaments%rowtype;v_next public.tournament_matches%rowtype;v_wins integer;v_winner uuid;v_loser uuid;v_submission uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to correct a result.';end if;
  select * into v_m from public.tournament_matches where id=p_match_id for update;if not found then raise exception 'Match not found.';end if;
  select * into v_t from public.tournaments where id=v_m.tournament_id;if v_t.owner_id<>auth.uid() then raise exception 'Only the tournament owner can correct a result.';end if;
  if v_m.status<>'complete' or v_m.revision<>p_expected_revision then raise exception 'That result changed. Refresh before correcting it.';end if;
  v_wins:=(v_m.best_of+1)/2;if not((p_games_a=v_wins and p_games_b between 0 and v_wins-1)or(p_games_b=v_wins and p_games_a between 0 and v_wins-1))then raise exception 'Enter a completed series score.';end if;
  if coalesce(array_length(p_replay_urls,1),0)>3 or exists(select 1 from unnest(coalesce(p_replay_urls,'{}')) u where char_length(u)>2000 or u!~*'^https://')or char_length(coalesce(p_mvp,''))>120 then raise exception 'Replay or MVP details are invalid.';end if;
  v_winner:=case when p_games_a>p_games_b then v_m.entrant_a_id else v_m.entrant_b_id end;v_loser:=case when v_winner=v_m.entrant_a_id then v_m.entrant_b_id else v_m.entrant_a_id end;
  if v_m.winner_to_match_id is not null then
    select * into v_next from public.tournament_matches where id=v_m.winner_to_match_id for update;if not found or v_next.status not in('pending','ready') or v_next.winner_id is not null then raise exception 'The next match has already started. Its earlier result cannot be corrected safely.';end if;
    if(v_m.winner_to_slot='a' and v_next.entrant_a_id is distinct from v_m.winner_id)or(v_m.winner_to_slot='b' and v_next.entrant_b_id is distinct from v_m.winner_id)then raise exception 'The next bracket slot no longer matches this result.';end if;
    update public.tournament_matches set entrant_a_id=case when v_m.winner_to_slot='a' then v_winner else entrant_a_id end,entrant_b_id=case when v_m.winner_to_slot='b' then v_winner else entrant_b_id end,status=case when (case when v_m.winner_to_slot='a' then v_winner else entrant_a_id end)is not null and(case when v_m.winner_to_slot='b' then v_winner else entrant_b_id end)is not null then 'ready' else 'pending' end,revision=revision+1 where id=v_next.id;
  end if;
  update public.tournament_matches set games_a=p_games_a,games_b=p_games_b,winner_id=v_winner,loser_id=v_loser,replay_urls=coalesce(p_replay_urls,'{}'),mvp=nullif(btrim(p_mvp),''),revision=revision+1,completed_at=now() where id=v_m.id;
  insert into public.tournament_result_submissions(tournament_id,match_id,submitted_by,expected_match_revision,games_a,games_b,replay_urls,mvp,status,confirmed_by,resolved_at) values(v_m.tournament_id,v_m.id,auth.uid(),v_m.revision,p_games_a,p_games_b,coalesce(p_replay_urls,'{}'),nullif(btrim(p_mvp),''),'confirmed',auth.uid(),now()) returning id into v_submission;
  update public.tournaments set revision=revision+1,updated_at=now() where id=v_m.tournament_id;
  insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(v_m.tournament_id,auth.uid(),'result_corrected',jsonb_build_object('match_id',v_m.id,'previous_winner_id',v_m.winner_id,'winner_id',v_winner,'submission_id',v_submission));return v_m.id;
end $$;

create or replace function public.reject_tournament_result(p_submission_id uuid,p_expected_match_revision bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_s public.tournament_result_submissions%rowtype;v_m public.tournament_matches%rowtype;v_t public.tournaments%rowtype;
begin if auth.uid() is null then raise exception 'Sign in to reject a result.';end if;select * into v_s from public.tournament_result_submissions where id=p_submission_id for update;if not found then raise exception 'Result submission not found.';end if;if v_s.status<>'pending' then raise exception 'That result is no longer awaiting review.';end if;select * into v_m from public.tournament_matches where id=v_s.match_id for update;select * into v_t from public.tournaments where id=v_m.tournament_id;if v_m.status<>'reported' or v_m.revision<>p_expected_match_revision then raise exception 'That match changed. Refresh before rejecting.';end if;if v_t.owner_id<>auth.uid() and not exists(select 1 from public.tournament_entrants where id in(v_m.entrant_a_id,v_m.entrant_b_id) and user_id=auth.uid() and user_id<>v_s.submitted_by) then raise exception 'The opponent or tournament owner must review this result.';end if;update public.tournament_result_submissions set status='rejected',confirmed_by=auth.uid(),resolved_at=now() where id=v_s.id;update public.tournament_matches set status='ready',revision=revision+1 where id=v_m.id;insert into public.tournament_audit_events(tournament_id,actor_id,kind,payload) values(v_m.tournament_id,auth.uid(),'result_rejected',jsonb_build_object('match_id',v_m.id,'submission_id',v_s.id));return v_m.id;end $$;

create or replace function public.archive_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin if auth.uid() is null or not exists(select 1 from public.tournaments where id=p_tournament_id and owner_id=auth.uid())then raise exception 'Only the tournament owner can archive it.';end if;update public.tournaments set status='archived',revision=revision+1,updated_at=now() where id=p_tournament_id and status in('registration','complete');if not found then raise exception 'Finish active matches before archiving.';end if;insert into public.tournament_audit_events(tournament_id,actor_id,kind)values(p_tournament_id,auth.uid(),'tournament_archived');end $$;

create or replace function public.list_tournaments()
returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name,'description',t.description,'visibility',t.visibility,'status',t.status,'best_of',t.best_of,'entrant_limit',t.entrant_limit,'entrant_count',(select count(*) from public.tournament_entrants e where e.tournament_id=t.id and e.status='registered'))order by t.updated_at desc),'[]'::jsonb) from(select * from public.tournaments source where public.can_view_tournament(source.id) order by source.updated_at desc limit 100)t
$$;

create or replace function public.get_tournament_workspace(p_slug text,p_access_code text default null)
returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$ declare v_t public.tournaments%rowtype;begin select * into v_t from public.tournaments where slug=p_slug;if not found or (not public.can_view_tournament(v_t.id) and not(v_t.status='registration' and exists(select 1 from public.tournament_registration_codes c where c.tournament_id=v_t.id and c.code_hash=encode(digest(coalesce(p_access_code,''),'sha256'),'hex'))))then return null;end if;return jsonb_build_object('tournament',jsonb_build_object('id',v_t.id,'slug',v_t.slug,'name',v_t.name,'description',v_t.description,'visibility',v_t.visibility,'format',v_t.format,'status',v_t.status,'rules',v_t.rules,'best_of',v_t.best_of,'entrant_limit',v_t.entrant_limit,'revision',v_t.revision,'is_owner',v_t.owner_id=auth.uid()),'entrants',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'display_name',e.display_name,'seed',e.seed,'status',e.status,'is_me',e.user_id=auth.uid())order by e.seed nulls last,e.registered_at)from public.tournament_entrants e where e.tournament_id=v_t.id),'[]'),'matches',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'round_number',m.round_number,'match_number',m.match_number,'entrant_a_id',m.entrant_a_id,'entrant_b_id',m.entrant_b_id,'winner_id',m.winner_id,'games_a',m.games_a,'games_b',m.games_b,'best_of',m.best_of,'status',m.status,'revision',m.revision,'replay_urls',m.replay_urls,'mvp',m.mvp)order by m.round_number,m.match_number)from public.tournament_matches m where m.tournament_id=v_t.id),'[]'),'submissions',case when auth.uid() is null then'[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'match_id',s.match_id,'submitted_by_me',s.submitted_by=auth.uid(),'games_a',s.games_a,'games_b',s.games_b,'replay_urls',s.replay_urls,'mvp',s.mvp,'status',s.status,'expected_match_revision',s.expected_match_revision))from public.tournament_result_submissions s join public.tournament_matches m on m.id=s.match_id where s.tournament_id=v_t.id and s.status='pending' and(v_t.owner_id=auth.uid() or exists(select 1 from public.tournament_entrants e where e.id in(m.entrant_a_id,m.entrant_b_id)and e.user_id=auth.uid()))),'[]')end);end $$;

revoke all on function public.create_single_elimination_tournament(text,text,text,integer,integer,text),public.join_tournament(uuid,text,uuid,text),public.rotate_tournament_registration_code(uuid),public.set_tournament_seed(uuid,uuid,integer),public.randomize_tournament_seeds(uuid,text),public.single_elimination_seed_order(integer),public.lock_single_elimination_tournament(uuid),public.submit_tournament_result(uuid,bigint,integer,integer,text[],text),public.confirm_tournament_result(uuid,bigint),public.correct_tournament_result(uuid,bigint,integer,integer,text[],text),public.reject_tournament_result(uuid,bigint),public.archive_tournament(uuid),public.list_tournaments(),public.get_tournament_workspace(text,text) from public,anon,authenticated;
grant execute on function public.create_single_elimination_tournament(text,text,text,integer,integer,text),public.join_tournament(uuid,text,uuid,text),public.rotate_tournament_registration_code(uuid),public.set_tournament_seed(uuid,uuid,integer),public.randomize_tournament_seeds(uuid,text),public.lock_single_elimination_tournament(uuid),public.submit_tournament_result(uuid,bigint,integer,integer,text[],text),public.confirm_tournament_result(uuid,bigint),public.correct_tournament_result(uuid,bigint,integer,integer,text[],text),public.reject_tournament_result(uuid,bigint),public.archive_tournament(uuid) to authenticated;
grant execute on function public.list_tournaments(),public.get_tournament_workspace(text,text) to anon,authenticated;
grant execute on function public.single_elimination_seed_order(integer) to authenticated;

commit;
notify pgrst,'reload schema';
