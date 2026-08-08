-- Preview-only regression for multi-pod migrations 350-353.
--
-- Run after the production baseline and migrations 340, 350, 351, 352, and 353 exist
-- in an isolated Supabase branch. The script creates only synthetic identities
-- and practice leagues, removes every permanent fixture before commit, and
-- returns one JSON result row. Any failed assertion aborts the transaction.

begin;

create temp table dc_multi_pod_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_private_organization uuid;
  v_public_organization uuid;
  v_private_payload jsonb;
  v_public_payload jsonb;
  v_primary_season uuid;
  v_secondary_season uuid;
  v_league_a uuid;
  v_league_b uuid;
  v_pod_a uuid;
  v_pod_b uuid;
  v_season_revision bigint;
  v_qualifier_a uuid;
  v_qualifier_b uuid;
  v_tournament_a uuid;
  v_tournament_b uuid;
  v_tournament_payload jsonb;
  v_tournament_entrant_a uuid;
  v_tournament_entrant_b uuid;
  v_championship_a uuid;
  v_championship_b uuid;
  v_workspace jsonb;
  v_invite_payload jsonb;
  v_invite_preview jsonb;
  v_roster jsonb := jsonb_build_array(
    jsonb_build_object('pokemon', 'Garchomp', 'species_id', 445)
  );
  v_non_admin_denied boolean := false;
  v_non_commissioner_denied boolean := false;
  v_invalid_settings_denied boolean := false;
  v_null_tiebreaker_denied boolean := false;
  v_duplicate_tiebreaker_denied boolean := false;
  v_multidimensional_tiebreaker_denied boolean := false;
  v_cross_mapping_denied boolean := false;
  v_rls_ok boolean;
  v_direct_access_denied boolean;
  v_sequence_access_denied boolean;
  v_service_access_ok boolean;
  v_service_sequence_access_ok boolean;
  v_rpc_grants_ok boolean;
  v_private_hidden boolean;
  v_public_visible boolean;
  v_settings_ok boolean;
  v_duplicate_rosters_ok boolean;
  v_audit_ok boolean;
  v_cleanup_ok boolean;
  v_practice_ok boolean;
  v_invite_accept_ok boolean := false;
  v_non_owner_invite_denied boolean := false;
  v_launch_ok boolean := false;
begin
  select count(*) = 9 and bool_and(c.relrowsecurity)
  into v_rls_ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'league_organizations',
      'league_organization_memberships',
      'league_organization_seasons',
      'league_organization_pods',
      'league_organization_qualifiers',
      'league_organization_championships',
      'league_organization_championship_entrants',
      'league_organization_audit_events',
      'league_organization_administrator_invites'
    ]);
  if v_rls_ok is distinct from true then
    raise exception 'Expected all nine organization tables to have RLS enabled.';
  end if;

  select not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as roles(role_name)
    cross join unnest(array[
      'league_organizations',
      'league_organization_memberships',
      'league_organization_seasons',
      'league_organization_pods',
      'league_organization_qualifiers',
      'league_organization_championships',
      'league_organization_championship_entrants',
      'league_organization_audit_events',
      'league_organization_administrator_invites'
    ]) as tables(table_name)
    where has_table_privilege(role_name, 'public.' || table_name, 'select')
       or has_table_privilege(role_name, 'public.' || table_name, 'insert')
       or has_table_privilege(role_name, 'public.' || table_name, 'update')
       or has_table_privilege(role_name, 'public.' || table_name, 'delete')
  ) into v_direct_access_denied;
  if v_direct_access_denied is distinct from true then
    raise exception 'Browser roles unexpectedly have direct organization-table privileges.';
  end if;

  select not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as roles(role_name)
    where has_sequence_privilege(
      role_name,
      'public.league_organization_audit_events_id_seq',
      'USAGE'
    )
       or has_sequence_privilege(
         role_name,
         'public.league_organization_audit_events_id_seq',
         'SELECT'
       )
       or has_sequence_privilege(
         role_name,
         'public.league_organization_audit_events_id_seq',
         'UPDATE'
       )
  ) into v_sequence_access_denied;
  if v_sequence_access_denied is distinct from true then
    raise exception 'Browser roles unexpectedly have organization audit-sequence privileges.';
  end if;

  select not exists (
    select 1
    from unnest(array[
      'league_organizations',
      'league_organization_memberships',
      'league_organization_seasons',
      'league_organization_pods',
      'league_organization_qualifiers',
      'league_organization_championships',
      'league_organization_championship_entrants',
      'league_organization_audit_events',
      'league_organization_administrator_invites'
    ]) as tables(table_name)
    where not has_table_privilege('service_role', 'public.' || table_name, 'select')
       or not has_table_privilege('service_role', 'public.' || table_name, 'insert')
       or not has_table_privilege('service_role', 'public.' || table_name, 'update')
       or not has_table_privilege('service_role', 'public.' || table_name, 'delete')
  ) into v_service_access_ok;
  if v_service_access_ok is distinct from true then
    raise exception 'The service role is missing an organization-table privilege.';
  end if;

  select
    has_sequence_privilege(
      'service_role',
      'public.league_organization_audit_events_id_seq',
      'USAGE'
    )
    and has_sequence_privilege(
      'service_role',
      'public.league_organization_audit_events_id_seq',
      'SELECT'
    )
  into v_service_sequence_access_ok;
  if v_service_sequence_access_ok is distinct from true then
    raise exception 'The service role is missing organization audit-sequence privileges.';
  end if;

  select
    has_function_privilege(
      'authenticated',
      'public.create_league_organization(text,text,text)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.create_league_organization(text,text,text)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.attach_league_organization_pod(uuid,uuid,text,integer,integer,integer)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.attach_league_organization_pod(uuid,uuid,text,integer,integer,integer)',
      'execute'
    )
    and has_function_privilege(
      'anon',
      'public.can_view_league_organization(uuid)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.get_league_organization_workspace(uuid)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.create_league_organization_administrator_invite(uuid)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.create_league_organization_administrator_invite(uuid)',
      'execute'
    )
    and has_function_privilege(
      'anon',
      'public.preview_league_organization_administrator_invite(text)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.launch_league_organization_season(uuid,bigint)',
      'execute'
    )
  into v_rpc_grants_ok;
  if v_rpc_grants_ok is distinct from true then
    raise exception 'Organization RPC execution grants do not match the browser boundary.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values (v_other, 'Preview Commissioner')
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  if auth.uid() is distinct from v_owner then
    raise exception 'The owner preview identity was not established.';
  end if;

  select public.create_league(
    'Multi-pod Preview Pod A',
    'dc-multi-pod-a-' || left(replace(v_owner::text, '-', ''), 12),
    'Synthetic preview regression league',
    'Preview'
  ) into v_league_a;
  select public.create_league(
    'Multi-pod Preview Pod B',
    'dc-multi-pod-b-' || left(replace(v_owner::text, '-', ''), 12),
    'Synthetic preview regression league',
    'Preview'
  ) into v_league_b;

  update public.leagues
  set is_practice = true,
      practice_expires_at = now() + interval '1 day'
  where id in (v_league_a, v_league_b);
  update public.league_state_snapshots
  set state = jsonb_build_object('seasonNumber', 1, 'rev', 101),
      revision = case when league_id = v_league_a then 11 else 22 end
  where league_id in (v_league_a, v_league_b);
  select count(*) = 2 and bool_and(is_practice)
  into v_practice_ok
  from public.leagues
  where id in (v_league_a, v_league_b);

  select public.create_league_organization('Multi-pod Preview Organization')
  into v_private_payload;
  v_private_organization := (v_private_payload ->> 'id')::uuid;
  select public.create_league_organization(
    'Multi-pod Preview Public Organization',
    'Synthetic public visibility boundary',
    'public'
  ) into v_public_payload;
  v_public_organization := (v_public_payload ->> 'id')::uuid;
  select public.create_league_organization_administrator_invite(v_private_organization)
  into v_invite_payload;
  if coalesce(v_invite_payload ->> 'token', '') !~ '^[0-9a-f]{48}$'
     or exists (
       select 1
       from public.league_organization_administrator_invites invitation
       where invitation.organization_id = v_private_organization
         and invitation.token_hash = v_invite_payload ->> 'token'
     ) then
    raise exception 'Administrator invitation token storage is not one-time and hashed.';
  end if;

  select public.create_league_organization_season(
    v_private_organization,
    'Preview Season',
    jsonb_build_object(
      'draft_mode', 'snake',
      'roster_size', 12,
      'transactions', 'source-league'
    ),
    2,
    1,
    array['wins', 'differential', 'head-to-head', 'commissioner-draw']
  ) into v_primary_season;

  begin
    perform public.create_league_organization_season(
      v_private_organization,
      'Invalid Preview Season',
      '{}'::jsonb,
      17,
      0,
      array['wins']
    );
  exception when others then
    if sqlerrm = 'Season settings are invalid.' then
      v_invalid_settings_denied := true;
    else
      raise;
    end if;
  end;

  begin
    perform public.create_league_organization_season(
      v_private_organization,
      'Null Tiebreaker Season',
      '{}'::jsonb,
      2,
      0,
      array['wins', null]::text[]
    );
  exception when others then
    if sqlerrm = 'Season settings are invalid.' then
      v_null_tiebreaker_denied := true;
    else
      raise;
    end if;
  end;

  begin
    perform public.create_league_organization_season(
      v_private_organization,
      'Duplicate Tiebreaker Season',
      '{}'::jsonb,
      2,
      0,
      array['wins', 'wins']
    );
  exception when others then
    if sqlerrm = 'Season settings are invalid.' then
      v_duplicate_tiebreaker_denied := true;
    else
      raise;
    end if;
  end;

  begin
    perform public.create_league_organization_season(
      v_private_organization,
      'Multidimensional Tiebreaker Season',
      '{}'::jsonb,
      2,
      0,
      array[
        array['wins', 'differential'],
        array['head-to-head', 'commissioner-draw']
      ]
    );
  exception when others then
    if sqlerrm = 'Season settings are invalid.' then
      v_multidimensional_tiebreaker_denied := true;
    else
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  select
    not public.can_view_league_organization(v_private_organization)
    and public.get_league_organization_workspace(v_private_organization) is null
    and jsonb_array_length(public.list_my_league_organizations()) = 0
  into v_private_hidden;
  select
    public.can_view_league_organization(v_public_organization)
    and public.get_league_organization_workspace(v_public_organization) is not null
  into v_public_visible;

  insert into public.league_memberships(league_id, user_id, role)
  values (v_league_a, v_other, 'co_commissioner');
  begin
    perform public.attach_league_organization_pod(
      v_primary_season,
      v_league_a,
      'Unauthorized Pod',
      1,
      1,
      null
    );
  exception when others then
    if sqlerrm = 'Only organization administrators can add pods.' then
      v_non_admin_denied := true;
    else
      raise;
    end if;
  end;
  delete from public.league_memberships
  where league_id = v_league_a and user_id = v_other;

  select public.preview_league_organization_administrator_invite(v_invite_payload ->> 'token')
  into v_invite_preview;
  if public.accept_league_organization_administrator_invite(v_invite_payload ->> 'token') <> v_private_organization then
    raise exception 'Administrator invitation was accepted into the wrong organization.';
  end if;
  select exists (
      select 1
      from public.league_organization_memberships membership
      where membership.organization_id = v_private_organization
        and membership.user_id = v_other
        and membership.role = 'administrator'
    ) and v_invite_preview ->> 'organization_id' = v_private_organization::text
    and public.preview_league_organization_administrator_invite(v_invite_payload ->> 'token') is null
  into v_invite_accept_ok;
  begin
    perform public.create_league_organization_administrator_invite(v_private_organization);
  exception when others then
    if sqlerrm = 'Only the organization owner can invite administrators.' then
      v_non_owner_invite_denied := true;
    else
      raise;
    end if;
  end;
  begin
    perform public.attach_league_organization_pod(
      v_primary_season,
      v_league_a,
      'Unauthorized Pod',
      1,
      1,
      null
    );
  exception when others then
    if sqlerrm = 'You must also be a commissioner of the source league.' then
      v_non_commissioner_denied := true;
    else
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  select public.attach_league_organization_pod(
    v_primary_season,
    v_league_a,
    'Pod A',
    1,
    1,
    null
  ) into v_pod_a;
  select public.attach_league_organization_pod(
    v_primary_season,
    v_league_b,
    'Pod B',
    2,
    1,
    null
  ) into v_pod_b;
  select revision into v_season_revision
  from public.league_organization_seasons where id = v_primary_season;
  perform public.confirm_league_organization_pod_regulations(v_pod_a, v_season_revision);
  select revision into v_season_revision
  from public.league_organization_seasons where id = v_primary_season;
  perform public.confirm_league_organization_pod_regulations(v_pod_b, v_season_revision);
  select revision into v_season_revision
  from public.league_organization_seasons where id = v_primary_season;
  select public.launch_league_organization_season(v_primary_season, v_season_revision) ->> 'status' = 'active'
  into v_launch_ok;

  insert into public.league_organization_qualifiers(
    season_id,
    pod_id,
    source_league_id,
    source_team_key,
    source_team_id,
    display_name,
    manager_user_id,
    placement,
    qualification_kind,
    source_state_revision,
    source_state_rev,
    team_snapshot,
    roster_snapshot,
    roster_snapshot_hash
  ) values (
    v_primary_season,
    v_pod_a,
    v_league_a,
    0,
    'preview-team-a',
    'Preview Team A',
    v_owner,
    1,
    'pod-finish',
    11,
    101,
    jsonb_build_object('team_key', 0, 'name', 'Preview Team A'),
    v_roster,
    repeat('a', 64)
  ) returning id into v_qualifier_a;
  insert into public.league_organization_qualifiers(
    season_id,
    pod_id,
    source_league_id,
    source_team_key,
    source_team_id,
    display_name,
    manager_user_id,
    placement,
    qualification_kind,
    source_state_revision,
    source_state_rev,
    team_snapshot,
    roster_snapshot,
    roster_snapshot_hash
  ) values (
    v_primary_season,
    v_pod_b,
    v_league_b,
    0,
    'preview-team-b',
    'Preview Team B',
    v_owner,
    1,
    'pod-finish',
    22,
    101,
    jsonb_build_object('team_key', 0, 'name', 'Preview Team B'),
    v_roster,
    repeat('a', 64)
  ) returning id into v_qualifier_b;
  select count(*) = 2
    and count(distinct roster_snapshot) = 1
    and bool_and(jsonb_array_length(roster_snapshot) = 1)
  into v_duplicate_rosters_ok
  from public.league_organization_qualifiers
  where id in (v_qualifier_a, v_qualifier_b);

  select public.create_single_elimination_tournament(
    'Multi-pod Preview Championship A',
    '',
    'private',
    3,
    8,
    ''
  ) into v_tournament_payload;
  select id into v_tournament_a
  from public.tournaments
  where slug = v_tournament_payload ->> 'slug';
  select public.join_tournament(
    v_tournament_a,
    'Preview Team A',
    null,
    null
  ) into v_tournament_entrant_a;
  insert into public.league_organization_championships(
    season_id,
    tournament_id,
    format
  ) values (
    v_primary_season,
    v_tournament_a,
    'single-elimination'
  ) returning id into v_championship_a;
  insert into public.league_organization_championship_entrants(
    championship_id,
    season_id,
    tournament_id,
    qualifier_id,
    tournament_entrant_id,
    seed
  ) values (
    v_championship_a,
    v_primary_season,
    v_tournament_a,
    v_qualifier_a,
    v_tournament_entrant_a,
    1
  );

  select public.create_league_organization_season(
    v_private_organization,
    'Secondary Preview Season',
    '{}'::jsonb,
    2,
    0,
    array['wins', 'commissioner-draw']
  ) into v_secondary_season;
  select public.create_single_elimination_tournament(
    'Multi-pod Preview Championship B',
    '',
    'private',
    3,
    8,
    ''
  ) into v_tournament_payload;
  select id into v_tournament_b
  from public.tournaments
  where slug = v_tournament_payload ->> 'slug';
  select public.join_tournament(
    v_tournament_b,
    'Preview Team B',
    null,
    null
  ) into v_tournament_entrant_b;
  insert into public.league_organization_championships(
    season_id,
    tournament_id,
    format
  ) values (
    v_secondary_season,
    v_tournament_b,
    'single-elimination'
  ) returning id into v_championship_b;

  begin
    insert into public.league_organization_championship_entrants(
      championship_id,
      season_id,
      tournament_id,
      qualifier_id,
      tournament_entrant_id,
      seed
    ) values (
      v_championship_b,
      v_secondary_season,
      v_tournament_b,
      v_qualifier_a,
      v_tournament_entrant_b,
      1
    );
  exception when foreign_key_violation then
    v_cross_mapping_denied := true;
  end;

  select
    season.allow_cross_pod_species_duplicates
    and season.qualified_teams_keep_rosters
    and season.roster_policy = 'retain-regular-season-roster'
    and season.replacement_policy = 'inherit-source-league'
    and season.status = 'active'
    and season.qualification_rules ->> 'top_per_pod' = '2'
    and season.qualification_rules ->> 'wildcard_slots' = '1'
    and season.regulations ->> 'draft_mode' = 'snake'
    and (
      select count(*) = 2 and bool_and(pod.regulations_status = 'confirmed' and pod.status = 'active')
      from public.league_organization_pods pod
      where pod.season_id = season.id
    )
  into v_settings_ok
  from public.league_organization_seasons season
  where season.id = v_primary_season;

  select count(*) >= 5
    and bool_and(
      case
        when kind = 'administrator_invite_accepted' then actor_id = v_other
        else actor_id = v_owner
      end
    )
    and bool_and(kind = any(array[
      'organization_created',
      'season_created',
      'pod_attached',
      'administrator_invite_created',
      'administrator_invite_accepted',
      'pod_regulations_confirmed',
      'season_launched'
    ]))
  into v_audit_ok
  from public.league_organization_audit_events
  where organization_id = v_private_organization;

  select public.get_league_organization_workspace(v_private_organization)
  into v_workspace;
  if v_workspace is null
     or jsonb_array_length(v_workspace -> 'seasons') <> 2
     or jsonb_array_length(public.list_my_league_organizations()) <> 2 then
    raise exception 'The owner organization workspace or listing is incomplete.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  if jsonb_array_length(public.list_my_league_organizations()) <> 1
     or not public.is_league_organization_admin(v_private_organization) then
    raise exception 'Delegated organization administration was not bounded correctly.';
  end if;

  if v_invalid_settings_denied is distinct from true
     or v_null_tiebreaker_denied is distinct from true
     or v_duplicate_tiebreaker_denied is distinct from true
     or v_multidimensional_tiebreaker_denied is distinct from true
     or v_private_hidden is distinct from true
     or v_public_visible is distinct from true
     or v_non_admin_denied is distinct from true
     or v_non_commissioner_denied is distinct from true
     or v_settings_ok is distinct from true
     or v_duplicate_rosters_ok is distinct from true
     or v_cross_mapping_denied is distinct from true
     or v_audit_ok is distinct from true
     or v_practice_ok is distinct from true
     or v_invite_accept_ok is distinct from true
     or v_non_owner_invite_denied is distinct from true
     or v_launch_ok is distinct from true then
    raise exception 'One or more multi-pod behavior assertions failed.';
  end if;

  delete from public.league_organizations
  where id in (v_private_organization, v_public_organization);
  delete from public.tournaments
  where id in (v_tournament_a, v_tournament_b);
  delete from public.leagues
  where id in (v_league_a, v_league_b);
  delete from auth.users
  where id in (v_owner, v_other);

  select
    not exists (
      select 1 from public.league_organizations
      where id in (v_private_organization, v_public_organization)
    )
    and not exists (
      select 1 from public.tournaments
      where id in (v_tournament_a, v_tournament_b)
    )
    and not exists (
      select 1 from public.leagues
      where id in (v_league_a, v_league_b)
    )
    and not exists (
      select 1 from auth.users
      where id in (v_owner, v_other)
    )
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Preview fixtures were not completely removed.';
  end if;

  insert into dc_multi_pod_preview_results(result)
  values (jsonb_build_object(
    'tables_with_rls', 9,
    'browser_direct_table_access_denied', v_direct_access_denied,
    'browser_audit_sequence_access_denied', v_sequence_access_denied,
    'service_role_table_access', v_service_access_ok,
    'service_role_audit_sequence_access', v_service_sequence_access_ok,
    'rpc_grants', v_rpc_grants_ok,
    'private_organization_hidden', v_private_hidden,
    'public_organization_visible', v_public_visible,
    'non_admin_pod_attach_denied', v_non_admin_denied,
    'non_commissioner_pod_attach_denied', v_non_commissioner_denied,
    'bounded_settings_denied', v_invalid_settings_denied,
    'null_tiebreaker_denied', v_null_tiebreaker_denied,
    'duplicate_tiebreaker_denied', v_duplicate_tiebreaker_denied,
    'multidimensional_tiebreaker_denied', v_multidimensional_tiebreaker_denied,
    'shared_regulations_and_retained_rosters', v_settings_ok,
    'cross_pod_duplicate_rosters', v_duplicate_rosters_ok,
    'cross_season_championship_mapping_denied', v_cross_mapping_denied,
    'audit_history', v_audit_ok,
    'administrator_invite_hashed_and_consumed', v_invite_accept_ok,
    'non_owner_administrator_invite_denied', v_non_owner_invite_denied,
    'confirmed_pods_and_season_launch', v_launch_ok,
    'practice_only_fixtures', v_practice_ok,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result
from dc_multi_pod_preview_results;
