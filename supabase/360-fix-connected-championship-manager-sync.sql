-- Migration 360: championship manager synchronization cannot call the
-- pre-championship qualifier helper because that helper deliberately closes
-- once a championship mapping exists. Repeat its source roster proof inside
-- the mapped Tournament transaction instead of weakening that guard.
begin;

create or replace function public.sync_league_organization_championship_manager(
  p_qualifier_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_qualifier public.league_organization_qualifiers%rowtype;
  v_mapping public.league_organization_championship_entrants%rowtype;
  v_tournament public.tournaments%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_snapshot public.league_state_snapshots%rowtype;
  v_team jsonb;
  v_roster jsonb;
  v_manager_id uuid;
begin
  select * into v_qualifier
  from public.league_organization_qualifiers
  where id = p_qualifier_id
  for update;
  if not found then raise exception 'Qualifier not found.'; end if;
  select * into v_season
  from public.league_organization_seasons
  where id = v_qualifier.season_id;
  if not public.is_league_organization_admin(v_season.organization_id)
     or not public.is_league_staff(v_qualifier.source_league_id) then
    raise exception 'Synchronizing a championship replacement requires organization and source-league authority.';
  end if;
  select * into v_mapping
  from public.league_organization_championship_entrants
  where qualifier_id = v_qualifier.id
  for update;
  if not found then raise exception 'This qualifier is not connected to a championship entrant.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = v_mapping.tournament_id
  for update;
  if v_tournament.status not in ('registration', 'active')
     or exists (
       select 1 from public.tournament_matches bracket_match
       where bracket_match.tournament_id = v_tournament.id
         and (
           v_mapping.tournament_entrant_id in (bracket_match.winner_id, bracket_match.loser_id)
           or (
             v_mapping.tournament_entrant_id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
             and bracket_match.status not in ('pending', 'ready')
           )
         )
     ) then
    raise exception 'Championship play has begun for this entrant; manager synchronization is closed.';
  end if;

  select * into v_snapshot
  from public.league_state_snapshots
  where league_id = v_qualifier.source_league_id;
  if not found then raise exception 'The source league state is unavailable.'; end if;
  v_team := v_snapshot.state #> array['teams', v_qualifier.source_team_key::text];
  v_roster := v_snapshot.state #> array['rosters', v_qualifier.source_team_key::text];
  if jsonb_typeof(v_team) <> 'object'
     or coalesce(nullif(v_team ->> 'id', ''), v_qualifier.source_team_key::text) <> v_qualifier.source_team_id
     or jsonb_typeof(v_roster) <> 'array'
     or encode(digest(v_roster::text, 'sha256'), 'hex') <> v_qualifier.roster_snapshot_hash then
    raise exception 'The source team or roster changed after qualification; championship synchronization was not applied.';
  end if;
  v_manager_id := case
    when coalesce(v_team ->> 'claimedByUserId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_team ->> 'claimedByUserId')::uuid
    else null
  end;
  if v_manager_id is null then
    raise exception 'Assign the replacement manager in the source league before synchronization.';
  end if;

  update public.league_organization_qualifiers
  set manager_user_id = v_manager_id
  where id = v_qualifier.id;
  update public.tournament_entrants
  set user_id = v_manager_id
  where id = v_mapping.tournament_entrant_id and tournament_id = v_tournament.id;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = v_tournament.id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_tournament.id, auth.uid(), 'connected_championship_manager_synchronized',
    jsonb_build_object('entrant_id', v_mapping.tournament_entrant_id)
  );
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    v_season.organization_id, v_season.id, auth.uid(),
    'championship_manager_synchronized',
    jsonb_build_object('qualifier_id', v_qualifier.id, 'entrant_id', v_mapping.tournament_entrant_id)
  );
  return jsonb_build_object(
    'qualifier_id', v_qualifier.id,
    'tournament_id', v_tournament.id,
    'entrant_id', v_mapping.tournament_entrant_id
  );
exception when unique_violation then
  raise exception 'That manager already controls another championship entrant.';
end;
$$;

revoke all on function public.sync_league_organization_championship_manager(uuid)
  from public, anon, authenticated;
grant execute on function public.sync_league_organization_championship_manager(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
