-- A finalized season has already added its archive before rollover. Accept
-- either that frozen archive or the legacy one-step archive-and-rollover path.

begin;

create or replace function public.transition_league_to_new_season(
  p_league_id uuid,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_existing_revision bigint;
  v_existing_rev bigint;
  v_incoming_rev bigint;
  v_existing_season integer;
  v_incoming_season integer;
  v_existing_history jsonb;
  v_incoming_history jsonb;
  v_existing_history_length integer;
  v_incoming_history_length integer;
  v_archive_was_already_finalized boolean;
  v_existing_team jsonb;
  v_incoming_team jsonb;
  v_index integer;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can start a new season.';
  end if;
  if jsonb_typeof(p_state) <> 'object'
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or jsonb_typeof(p_state -> 'seasonHistory') <> 'array' then
    raise exception 'The new-season archive is incomplete.';
  end if;

  select state, revision
  into v_existing, v_existing_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;

  v_existing_rev := coalesce((v_existing ->> 'rev')::bigint, 0);
  v_incoming_rev := coalesce((p_state ->> 'rev')::bigint, 0);
  if v_incoming_rev <> v_existing_rev + 1 then
    raise exception 'This league changed in another session. Refresh before starting the new season.';
  end if;

  v_existing_season := greatest(1, coalesce((v_existing ->> 'seasonNumber')::integer, 1));
  v_incoming_season := coalesce((p_state ->> 'seasonNumber')::integer, 0);
  if v_incoming_season <> v_existing_season + 1 then
    raise exception 'The new season number is invalid.';
  end if;

  v_existing_history := coalesce(v_existing -> 'seasonHistory', '[]'::jsonb);
  v_incoming_history := p_state -> 'seasonHistory';
  if jsonb_typeof(v_existing_history) <> 'array' then
    raise exception 'Existing season history is invalid.';
  end if;
  v_existing_history_length := jsonb_array_length(v_existing_history);
  v_incoming_history_length := jsonb_array_length(v_incoming_history);
  v_archive_was_already_finalized :=
    nullif(v_existing ->> 'seasonFinalizedAt', '') is not null
    and v_existing_history_length > 0
    and coalesce((v_existing_history -> (v_existing_history_length - 1) ->> 'seasonNumber')::integer, 0) = v_existing_season;

  if not (
    v_incoming_history_length = v_existing_history_length + 1
    or (v_archive_was_already_finalized and v_incoming_history_length = v_existing_history_length)
  ) then
    raise exception 'Exactly one season archive must be added, unless this season was already finalized.';
  end if;
  if exists (
    select 1
    from generate_series(0, v_existing_history_length - 1) as series(history_index)
    where (v_incoming_history -> series.history_index) is distinct from (v_existing_history -> series.history_index)
  ) then
    raise exception 'Existing season history cannot be rewritten during rollover.';
  end if;
  if v_incoming_history_length = 0
     or coalesce((v_incoming_history -> (v_incoming_history_length - 1) ->> 'seasonNumber')::integer, 0) <> v_existing_season then
    raise exception 'The final archive does not describe the season being closed.';
  end if;

  if jsonb_typeof(v_existing -> 'teams') <> 'array'
     or jsonb_array_length(p_state -> 'teams') <> jsonb_array_length(v_existing -> 'teams') then
    raise exception 'Team identity cannot change during season rollover.';
  end if;
  for v_index in 0..jsonb_array_length(v_existing -> 'teams') - 1 loop
    v_existing_team := v_existing #> array['teams', v_index::text];
    v_incoming_team := p_state #> array['teams', v_index::text];
    if coalesce(v_incoming_team ->> 'id', '') <> coalesce(v_existing_team ->> 'id', '')
       or coalesce(v_incoming_team ->> 'claimedBy', '') <> coalesce(v_existing_team ->> 'claimedBy', '') then
      raise exception 'Team identity and ownership must carry into the new season.';
    end if;
  end loop;

  delete from public.roster_entries entry using public.teams team
  where entry.team_id = team.id and team.league_id = p_league_id;
  delete from public.draft_picks pick using public.draft_sessions session
  where pick.draft_session_id = session.id and session.league_id = p_league_id;
  delete from public.draft_sessions where league_id = p_league_id;
  update public.league_pokemon set is_drafted = false where league_id = p_league_id;
  delete from public.auction_team_owners where league_id = p_league_id;

  update public.league_state_snapshots
  set state = p_state, revision = coalesce(v_existing_revision, 0) + 1, updated_at = now()
  where league_id = p_league_id;
  update public.leagues
  set settings = coalesce(p_state -> 'settings', '{}'::jsonb), status = 'preseason', draft_starts_at = null, updated_at = now()
  where id = p_league_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (p_league_id, 'season_started', auth.uid(), jsonb_build_object('closed_season', v_existing_season, 'new_season', v_incoming_season));

  return p_state;
end;
$$;

revoke all on function public.transition_league_to_new_season(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.transition_league_to_new_season(uuid, jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';
