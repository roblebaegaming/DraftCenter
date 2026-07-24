-- Save one playoff result without replacing another user's newer league state.

begin;

create or replace function public.save_playoff_result(
  p_league_id uuid,
  p_result_key text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_revision bigint;
  v_games_a integer;
  v_games_b integer;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Only league members can report playoff results.';
  end if;

  if p_result_key !~ '^[0-9]+-[0-9]+$' then
    raise exception 'Invalid playoff matchup.';
  end if;

  if jsonb_typeof(p_result) <> 'object' then
    raise exception 'A playoff result object is required.';
  end if;

  v_games_a := coalesce((p_result ->> 'gamesA')::integer, 0);
  v_games_b := coalesce((p_result ->> 'gamesB')::integer, 0);

  if v_games_a < 0 or v_games_b < 0 or v_games_a = v_games_b
     or v_games_a > 3 or v_games_b > 3 then
    raise exception 'Enter a completed best-of-1, best-of-3, or best-of-5 result.';
  end if;

  select state, revision
  into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null or jsonb_typeof(v_state -> 'playoffs') <> 'object' then
    raise exception 'The playoff bracket was not found.';
  end if;

  v_state := jsonb_set(
    v_state,
    array['playoffs', 'results', p_result_key],
    p_result,
    true
  );
  v_state := jsonb_set(
    v_state,
    array['rev'],
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = coalesce(v_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  return v_state;
end;
$$;

revoke all on function public.save_playoff_result(uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.save_playoff_result(uuid, text, jsonb)
  to authenticated;

commit;

notify pgrst, 'reload schema';
