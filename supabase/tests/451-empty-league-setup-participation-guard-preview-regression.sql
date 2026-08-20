begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_league uuid;
  v_state jsonb;
  v_initialized jsonb;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_league(
    'Empty Setup Guard Preview',
    'empty-setup-guard-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    'Rollback-only regression fixture',
    'Preview',
    'private',
    true,
    null
  ) into v_league;

  select state into v_state
  from public.league_state_snapshots
  where league_id = v_league;
  if jsonb_typeof(v_state -> 'teams') is not null then
    raise exception 'New league fixture did not begin with an empty snapshot.';
  end if;

  -- This is the same empty-snapshot-to-initial-setup transition used by a
  -- newly created league. It must not enter the retirement loop.
  v_state := jsonb_build_object(
    'rev', 0,
    'seasonNumber', 1,
    'settings', jsonb_build_object(
      'draftType', 'snake',
      'leagueScaleMode', 'standard',
      'divisions', '[]'::jsonb
    ),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Setup A'),
      jsonb_build_object('id', 1, 'name', 'Setup B')
    ),
    'locked', false,
    'rosters', '[]'::jsonb,
    'schedule', '[]'::jsonb,
    'matchResults', '{}'::jsonb,
    'playoffs', 'null'::jsonb,
    'seasonHistory', '[]'::jsonb,
    'pendingClaims', '[]'::jsonb
  );

  select public.initialize_league_setup_if_empty(v_league, v_state)
  into v_initialized;
  if jsonb_array_length(v_initialized -> 'teams') <> 2
     or coalesce((v_initialized ->> 'rev')::bigint, -1) <> 1 then
    raise exception 'Empty league setup did not persist both initial teams at revision 1.';
  end if;

  begin
    update public.league_state_snapshots
    set state = jsonb_set(
      state,
      '{teams,0,seasonStatus}',
      '{"status":"retired","effectiveAfter":0}'::jsonb,
      true
    )
    where league_id = v_league;
    raise exception 'Direct retirement mutation unexpectedly succeeded.';
  exception
    when others then
      if sqlerrm <> 'Season participation can only be changed from Commissioner Tools.' then
        raise;
      end if;
  end;
end;
$$;

rollback;

select 'empty_league_setup_participation_guard' as result;
