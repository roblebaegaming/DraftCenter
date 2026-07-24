-- Role-safe in-league predictions.
-- Spectators may save only their own prediction for an unfinished match.
-- This does not grant access to messages, team claims, results, drafts,
-- transactions, settings, or any other league-state field.

create or replace function public.save_league_prediction(
  p_league_id uuid,
  p_week integer,
  p_match_index integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_name text;
  v_key text;
  v_match jsonb;
  v_existing jsonb;
  v_safe_patch jsonb := '{}'::jsonb;
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to predict.';
  end if;

  if not exists (
    select 1
    from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
      and role in ('commissioner', 'co_commissioner', 'coach', 'viewer')
  ) then
    raise exception 'Join or watch this league before predicting.';
  end if;

  if p_week < 0 or p_match_index < 0 then
    raise exception 'That matchup does not exist.';
  end if;

  select state, revision
    into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_match := v_state #> array['schedule', p_week::text, p_match_index::text];
  if v_match is null or jsonb_typeof(v_match) <> 'array' or jsonb_array_length(v_match) <> 2 then
    raise exception 'That matchup does not exist.';
  end if;

  v_key := p_week::text || '-' || p_match_index::text;
  if v_state #> array['matchResults', v_key] is not null then
    raise exception 'Predictions are closed because this result is final.';
  end if;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Coach')
    into v_name
  from public.profiles
  where id = auth.uid();

  if p_patch ? 'side' then
    if p_patch ->> 'side' not in ('A', 'B') then
      raise exception 'Prediction side must be A or B.';
    end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('side', p_patch -> 'side');
  end if;

  if p_patch ? 'setScore' then
    if jsonb_typeof(p_patch -> 'setScore') not in ('string', 'null') then
      raise exception 'The predicted score is invalid.';
    end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('setScore', p_patch -> 'setScore');
  end if;

  if p_patch ? 'monsAlive' then
    if jsonb_typeof(p_patch -> 'monsAlive') not in ('number', 'null')
       or (jsonb_typeof(p_patch -> 'monsAlive') = 'number' and (p_patch ->> 'monsAlive')::integer not between 0 and 6) then
      raise exception 'Mons remaining must be between 0 and 6.';
    end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('monsAlive', p_patch -> 'monsAlive');
  end if;

  if p_patch ? 'gameMargins' then
    if jsonb_typeof(p_patch -> 'gameMargins') not in ('array', 'null') then
      raise exception 'Per-game predictions are invalid.';
    end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('gameMargins', p_patch -> 'gameMargins');
  end if;

  if v_safe_patch = '{}'::jsonb then
    raise exception 'No supported prediction fields were supplied.';
  end if;

  v_existing := coalesce(v_state #> array['predictions', v_key, v_name], '{}'::jsonb);
  v_state := jsonb_set(
    v_state,
    array['predictions', v_key, v_name],
    v_existing || v_safe_patch,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, v_revision, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  return v_state;
end;
$$;

revoke all on function public.save_league_prediction(uuid, integer, integer, jsonb) from public;
revoke all on function public.save_league_prediction(uuid, integer, integer, jsonb) from anon;
grant execute on function public.save_league_prediction(uuid, integer, integer, jsonb) to authenticated;
