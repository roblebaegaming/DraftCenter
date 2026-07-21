-- Draft.League development milestone 2
-- Run AFTER 003-league-hub-and-state-bridge.sql.
-- Adds server-authoritative team claims and snake-draft actions.

create table if not exists public.league_events (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  kind text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists league_events_feed_idx on public.league_events(league_id, id desc);

create unique index if not exists active_roster_ownership_idx
  on public.roster_entries(league_pokemon_id) where released_at is null;

alter table public.league_events enable row level security;

create policy "members read league events"
  on public.league_events for select to authenticated
  using (public.is_league_member(league_id));

create or replace function public.claim_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_membership uuid; v_league uuid; v_owner uuid;
begin
  select league_id, owner_membership_id into v_league, v_owner from public.teams where id = p_team_id for update;
  if v_league is null then raise exception 'Team not found.'; end if;
  select id into v_membership from public.league_memberships
    where league_id = v_league and user_id = auth.uid();
  if v_membership is null then raise exception 'You must join this league before claiming a team.'; end if;
  if v_owner is not null then raise exception 'That team is already claimed.'; end if;
  if exists (select 1 from public.teams where owner_membership_id = v_membership) then
    raise exception 'You already own a team in this league.';
  end if;
  update public.teams set owner_membership_id = v_membership where id = p_team_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
    values (v_league, 'team_claimed', auth.uid(), jsonb_build_object('team_id', p_team_id));
end; $$;

create or replace function public.start_snake_draft(p_league_id uuid, p_team_order uuid[])
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_session uuid; v_count int; v_first uuid; v_rounds int; v_full_order jsonb;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can start a draft.'; end if;
  select count(*) into v_count from public.teams where league_id = p_league_id;
  if v_count < 2 or array_length(p_team_order, 1) <> v_count then
    raise exception 'Draft order must contain each team exactly once.';
  end if;
  if (select count(distinct value::uuid) from unnest(p_team_order) as value) <> v_count
     or exists (select 1 from unnest(p_team_order) as x where not exists (select 1 from public.teams t where t.id = x and t.league_id = p_league_id)) then
    raise exception 'Draft order contains an invalid team.';
  end if;
  select greatest(1, coalesce((settings ->> 'rosterMax')::int, 11)) into v_rounds from public.leagues where id = p_league_id;
  select jsonb_agg(team_id order by pick_number) into v_full_order
  from (
    select ((r - 1) * v_count + p) as pick_number,
      case when r % 2 = 1 then p_team_order[p] else p_team_order[v_count - p + 1] end as team_id
    from generate_series(1, v_rounds) as r cross join generate_series(1, v_count) as p
  ) ordered_picks;
  v_first := p_team_order[1];
  insert into public.draft_sessions(league_id, mode, status, current_pick_number, current_team_id, configuration)
    values (p_league_id, 'snake', 'active', 0, v_first, jsonb_build_object('team_order', v_full_order))
  on conflict (league_id) do update set mode = 'snake', status = 'active', current_pick_number = 0,
    current_team_id = v_first, configuration = excluded.configuration, updated_at = now()
  returning id into v_session;
  update public.leagues set status = 'drafting', updated_at = now() where id = p_league_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
    values (p_league_id, 'draft_started', auth.uid(), jsonb_build_object('draft_session_id', v_session));
  return v_session;
end; $$;

create or replace function public.make_snake_pick(p_draft_session_id uuid, p_league_pokemon_id uuid)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_league uuid; v_team uuid; v_pick int; v_config jsonb; v_order jsonb; v_total int;
  v_next_team uuid; v_pokemon record; v_pick_id bigint;
begin
  select league_id, current_team_id, current_pick_number, configuration into v_league, v_team, v_pick, v_config
    from public.draft_sessions where id = p_draft_session_id and status = 'active' and mode = 'snake' for update;
  if v_league is null then raise exception 'No active snake draft found.'; end if;
  if not public.is_league_staff(v_league) and not exists (
    select 1 from public.teams t join public.league_memberships m on m.id = t.owner_membership_id
    where t.id = v_team and m.user_id = auth.uid()
  ) then raise exception 'It is not your team''s turn.'; end if;
  select * into v_pokemon from public.league_pokemon where id = p_league_pokemon_id and league_id = v_league for update;
  if v_pokemon.id is null or not v_pokemon.is_allowed or v_pokemon.is_drafted then raise exception 'That Pokémon is no longer available.'; end if;
  update public.league_pokemon set is_drafted = true where id = p_league_pokemon_id;
  insert into public.draft_picks(draft_session_id, team_id, league_pokemon_id, pick_number, made_by)
    values (p_draft_session_id, v_team, p_league_pokemon_id, v_pick, auth.uid()) returning id into v_pick_id;
  insert into public.roster_entries(team_id, league_pokemon_id, acquisition_type) values (v_team, p_league_pokemon_id, 'draft');
  v_order := v_config -> 'team_order'; v_total := jsonb_array_length(v_order);
  if v_pick + 1 >= v_total then
    update public.draft_sessions set status = 'complete', current_pick_number = v_pick + 1, current_team_id = null, updated_at = now() where id = p_draft_session_id;
  else
    v_next_team := (v_order ->> (v_pick + 1))::uuid;
    update public.draft_sessions set current_pick_number = v_pick + 1, current_team_id = v_next_team, updated_at = now() where id = p_draft_session_id;
  end if;
  insert into public.league_events(league_id, kind, actor_id, payload)
    values (v_league, 'draft_pick', auth.uid(), jsonb_build_object('draft_pick_id', v_pick_id, 'team_id', v_team, 'league_pokemon_id', p_league_pokemon_id, 'pick_number', v_pick));
  return v_pick_id;
end; $$;

grant execute on function public.claim_team(uuid) to authenticated;
grant execute on function public.start_snake_draft(uuid, uuid[]) to authenticated;
grant execute on function public.make_snake_pick(uuid, uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.league_events, public.draft_sessions, public.draft_picks, public.roster_entries;
exception when duplicate_object then null;
end $$;
