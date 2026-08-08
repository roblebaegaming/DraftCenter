-- Preview-only transactional matrix for migration 354.
-- Run only in an isolated Supabase branch after the production baseline and
-- migrations 340 and 350-354 exist. Every synthetic row is removed before
-- commit; any failed assertion aborts the transaction.

begin;

create temp table dc_tournament_recovery_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_players uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  v_tournament_one uuid;
  v_tournament_two uuid;
  v_tournament_three uuid;
  v_payload jsonb;
  v_match public.tournament_matches%rowtype;
  v_submission uuid;
  v_old_revision bigint;
  v_current_revision bigint;
  v_outgoing uuid;
  v_replacement uuid;
  v_claim_code text;
  v_stale_denied boolean := false;
  v_started_replacement_denied boolean := false;
  v_duplicate_claim_denied boolean := false;
  v_rls_ok boolean;
  v_grants_ok boolean;
  v_forfeit_ok boolean;
  v_disqualification_ok boolean;
  v_replacement_ok boolean;
  v_waiting_drop_ok boolean;
  v_projection_safe boolean;
  v_cleanup_ok boolean;
begin
  select c.relrowsecurity
  into v_rls_ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'tournament_entrant_replacements';
  if v_rls_ok is distinct from true then
    raise exception 'Replacement storage must have RLS enabled.';
  end if;

  select
    not has_table_privilege('anon', 'public.tournament_entrant_replacements', 'select')
    and not has_table_privilege('authenticated', 'public.tournament_entrant_replacements', 'select')
    and has_table_privilege('service_role', 'public.tournament_entrant_replacements', 'select')
    and has_function_privilege(
      'authenticated',
      'public.forfeit_tournament_match(uuid,bigint,bigint,uuid,text)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.forfeit_tournament_match(uuid,bigint,bigint,uuid,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.resolve_tournament_forfeit_chain(uuid,uuid,uuid,text,text)',
      'execute'
    )
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Recovery grants do not match the browser boundary.';
  end if;

  insert into auth.users(id, aud, role)
  select identity, 'authenticated', 'authenticated'
  from unnest(array[v_owner] || v_players) identity;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_single_elimination_tournament(
    'Recovery Preview One', '', 'public', 3, 8, 'Synthetic recovery matrix'
  ) into v_payload;
  select id into v_tournament_one
  from public.tournaments
  where slug = v_payload ->> 'slug';
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  values
    (v_tournament_one, v_players[1], 'Recovery One A', 1),
    (v_tournament_one, v_players[2], 'Recovery One B', 2),
    (v_tournament_one, v_players[3], 'Recovery One C', 3),
    (v_tournament_one, v_players[4], 'Recovery One D', 4);
  perform public.lock_single_elimination_tournament(v_tournament_one);

  select revision into v_old_revision from public.tournaments where id = v_tournament_one;
  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_one and round_number = 1 and match_number = 1;
  perform public.forfeit_tournament_match(
    v_match.id,
    v_old_revision,
    v_match.revision,
    v_match.entrant_b_id,
    'Synthetic no-show'
  );
  select status = 'complete'
    and winner_id = v_match.entrant_a_id
    and loser_id = v_match.entrant_b_id
    and games_a = 2
    and games_b = 0
  into v_forfeit_ok
  from public.tournament_matches
  where id = v_match.id;
  if v_forfeit_ok is distinct from true then
    raise exception 'Explicit match forfeit did not resolve deterministically.';
  end if;

  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_one and round_number = 1 and match_number = 2;
  begin
    perform public.set_tournament_entrant_status(
      v_tournament_one,
      v_match.entrant_b_id,
      v_old_revision,
      'disqualified',
      'Synthetic stale revision'
    );
  exception when others then
    v_stale_denied := sqlerrm = 'The tournament changed. Refresh before changing entrant status.';
  end;
  if not v_stale_denied then
    raise exception 'Stale tournament recovery was not rejected.';
  end if;

  select revision into v_current_revision from public.tournaments where id = v_tournament_one;
  perform public.set_tournament_entrant_status(
    v_tournament_one,
    v_match.entrant_b_id,
    v_current_revision,
    'disqualified',
    'Synthetic rules violation'
  );
  select entrant.status = 'disqualified'
    and bracket_match.status = 'complete'
    and bracket_match.winner_id = v_match.entrant_a_id
  into v_disqualification_ok
  from public.tournament_entrants entrant
  join public.tournament_matches bracket_match on bracket_match.id = v_match.id
  where entrant.id = v_match.entrant_b_id;
  if v_disqualification_ok is distinct from true then
    raise exception 'Disqualification did not preserve status and advance the opponent.';
  end if;

  begin
    select revision into v_current_revision from public.tournaments where id = v_tournament_one;
    perform public.replace_tournament_entrant(
      v_tournament_one,
      v_match.entrant_a_id,
      v_current_revision,
      'Unsafe Replacement',
      'retain-roster',
      'Synthetic unsafe replacement'
    );
  exception when others then
    v_started_replacement_denied := sqlerrm = 'That entrant or their next opponent has already begun play. Use a drop or disqualification instead.';
  end;
  if not v_started_replacement_denied then
    raise exception 'Replacement was not blocked after play began.';
  end if;

  select public.create_single_elimination_tournament(
    'Recovery Preview Two', '', 'public', 1, 8, 'Synthetic replacement matrix'
  ) into v_payload;
  select id into v_tournament_two
  from public.tournaments
  where slug = v_payload ->> 'slug';
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  values
    (v_tournament_two, v_players[1], 'Outgoing Entrant', 1),
    (v_tournament_two, v_players[2], 'Other Entrant', 2);
  select id into v_outgoing
  from public.tournament_entrants
  where tournament_id = v_tournament_two and user_id = v_players[1];
  select revision into v_current_revision from public.tournaments where id = v_tournament_two;
  select public.replace_tournament_entrant(
    v_tournament_two,
    v_outgoing,
    v_current_revision,
    'Claiming Entrant',
    'replacement-selects-roster',
    'Synthetic approved replacement'
  ) into v_payload;
  v_replacement := (v_payload ->> 'replacement_entrant_id')::uuid;
  v_claim_code := v_payload ->> 'claim_code';

  perform set_config('request.jwt.claim.sub', v_players[5]::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_players[5], 'role', 'authenticated')::text,
    true
  );
  perform public.claim_tournament_replacement(v_replacement, v_claim_code, null);
  select outgoing.status = 'replaced'
    and replacement.status = 'registered'
    and replacement.user_id = v_players[5]
    and record.claimed_by = v_players[5]
    and record.code_hash is null
  into v_replacement_ok
  from public.tournament_entrant_replacements record
  join public.tournament_entrants outgoing on outgoing.id = record.outgoing_entrant_id
  join public.tournament_entrants replacement on replacement.id = record.replacement_entrant_id
  where record.replacement_entrant_id = v_replacement;
  if v_replacement_ok is distinct from true then
    raise exception 'Replacement claim did not preserve the explicit identity transition.';
  end if;
  begin
    perform public.claim_tournament_replacement(v_replacement, v_claim_code, null);
  exception when others then
    v_duplicate_claim_denied := sqlerrm = 'This replacement invitation is invalid or expired.';
  end;
  if not v_duplicate_claim_denied then
    raise exception 'A used replacement claim code remained reusable.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  select public.create_single_elimination_tournament(
    'Recovery Preview Three', '', 'public', 1, 8, 'Synthetic waiting-drop matrix'
  ) into v_payload;
  select id into v_tournament_three
  from public.tournaments
  where slug = v_payload ->> 'slug';
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  values
    (v_tournament_three, v_players[1], 'Waiting One A', 1),
    (v_tournament_three, v_players[2], 'Waiting One B', 2),
    (v_tournament_three, v_players[3], 'Waiting One C', 3),
    (v_tournament_three, v_players[4], 'Waiting One D', 4);
  perform public.lock_single_elimination_tournament(v_tournament_three);

  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_three and round_number = 1 and match_number = 1;
  select revision into v_current_revision from public.tournaments where id = v_tournament_three;
  perform public.forfeit_tournament_match(
    v_match.id, v_current_revision, v_match.revision, v_match.entrant_b_id, 'Synthetic opening forfeit'
  );
  select revision into v_current_revision from public.tournaments where id = v_tournament_three;
  perform public.set_tournament_entrant_status(
    v_tournament_three,
    v_match.entrant_a_id,
    v_current_revision,
    'dropped',
    'Synthetic withdrawal while awaiting opponent'
  );

  select * into v_match
  from public.tournament_matches
  where tournament_id = v_tournament_three and round_number = 1 and match_number = 2;
  select public.submit_tournament_result(v_match.id, v_match.revision, 1, 0, '{}', null)
  into v_submission;
  perform public.confirm_tournament_result(v_submission, v_match.revision);
  select tournament.status = 'complete'
    and final_match.status = 'complete'
    and loser.status = 'dropped'
    and final_match.loser_id = loser.id
  into v_waiting_drop_ok
  from public.tournaments tournament
  join public.tournament_matches final_match
    on final_match.tournament_id = tournament.id and final_match.round_number = 2
  join public.tournament_entrants loser on loser.id = final_match.loser_id
  where tournament.id = v_tournament_three;
  if v_waiting_drop_ok is distinct from true then
    raise exception 'A waiting dropped entrant was not forfeited when the opponent advanced.';
  end if;

  select public.get_tournament_workspace(slug, null) into v_payload
  from public.tournaments where id = v_tournament_two;
  v_projection_safe := v_payload is not null
    and v_payload::text not like '%code_hash%'
    and v_payload::text not like '%claim_code%'
    and v_payload::text not like '%registered_team_id%'
    and v_payload::text not like '%user_id%';
  if v_projection_safe is distinct from true then
    raise exception 'The workspace exposed replacement identity or claim secrets.';
  end if;

  delete from public.tournaments
  where id in (v_tournament_one, v_tournament_two, v_tournament_three);
  delete from auth.users where id = any(array[v_owner] || v_players);
  select not exists (
    select 1 from public.tournaments
    where id in (v_tournament_one, v_tournament_two, v_tournament_three)
  ) and not exists (
    select 1 from auth.users where id = any(array[v_owner] || v_players)
  ) into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Synthetic recovery fixtures were not fully removed.';
  end if;

  insert into dc_tournament_recovery_results(result)
  values (jsonb_build_object(
    'rls', v_rls_ok,
    'grants', v_grants_ok,
    'forfeit', v_forfeit_ok,
    'stale_revision_denied', v_stale_denied,
    'disqualification', v_disqualification_ok,
    'unsafe_replacement_denied', v_started_replacement_denied,
    'replacement_claim', v_replacement_ok,
    'duplicate_claim_denied', v_duplicate_claim_denied,
    'waiting_drop', v_waiting_drop_ok,
    'projection_safe', v_projection_safe,
    'cleanup', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_tournament_recovery_results;
