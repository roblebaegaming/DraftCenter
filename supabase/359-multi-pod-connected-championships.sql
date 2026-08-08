-- Migration 359: promote finalized multi-pod qualifiers into a connected,
-- immediately locked Tournament bracket without copying or redrafting rosters.
begin;

alter table public.league_organization_championships
  add column seeding_policy text not null default 'pod-finish-avoid-rematches'
  check (seeding_policy in ('overall-record', 'pod-finish-bands', 'pod-finish-avoid-rematches'));

create or replace function public.guard_connected_championship_entrant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and exists (
       select 1 from public.league_organization_championships championship
       where championship.tournament_id = new.tournament_id
     )
     and coalesce(current_setting('draftcenter.connected_championship_promotion', true), '')
       <> new.tournament_id::text then
    raise exception 'Connected championship entrants come only from finalized qualifiers.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_connected_championship_entrant_insert
  on public.tournament_entrants;
create trigger guard_connected_championship_entrant_insert
before insert on public.tournament_entrants
for each row execute function public.guard_connected_championship_entrant_insert();

create or replace function public.sync_league_organization_championship_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_championship public.league_organization_championships%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_status text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into v_championship
  from public.league_organization_championships
  where tournament_id = new.id
  for update;
  if not found then return new; end if;

  v_status := case new.status
    when 'registration' then 'registration'
    when 'active' then 'active'
    when 'complete' then 'complete'
    when 'archived' then 'archived'
    else v_championship.status
  end;
  update public.league_organization_championships
  set status = v_status, revision = revision + 1, updated_at = now()
  where id = v_championship.id;
  select * into v_season
  from public.league_organization_seasons
  where id = v_championship.season_id
  for update;
  update public.league_organization_seasons
  set status = case
        when new.status = 'active' then 'championship'
        when new.status in ('complete', 'archived') then 'complete'
        else status
      end,
      revision = revision + 1,
      updated_at = now()
  where id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    v_season.organization_id, v_season.id, auth.uid(),
    'championship_status_synchronized',
    jsonb_build_object('championship_id', v_championship.id, 'tournament_status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists sync_league_organization_championship_status
  on public.tournaments;
create trigger sync_league_organization_championship_status
after update of status on public.tournaments
for each row execute function public.sync_league_organization_championship_status();

create or replace function public.create_league_organization_championship(
  p_season_id uuid,
  p_expected_season_revision bigint,
  p_format text default 'single-elimination',
  p_seeding_policy text default 'pod-finish-avoid-rematches',
  p_best_of integer default 3,
  p_visibility text default 'public'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_season public.league_organization_seasons%rowtype;
  v_organization public.league_organizations%rowtype;
  v_run public.league_organization_qualification_runs%rowtype;
  v_championship_id uuid := gen_random_uuid();
  v_tournament_id uuid := gen_random_uuid();
  v_entrant_id uuid;
  v_name text;
  v_slug_base text;
  v_slug text;
  v_description text;
  v_rules text;
  v_count integer;
  v_seed integer := 0;
  v_size integer := 2;
  v_seed_order integer[];
  v_index integer;
  v_seed_a integer;
  v_seed_b integer;
  v_swap_seed integer;
  v_entrant_b uuid;
  v_swap_entrant uuid;
  v_pod_a uuid;
  v_pod_b uuid;
  v_same_pod_matches integer := 0;
  v_qualifier record;
begin
  if auth.uid() is null then raise exception 'Only the organization owner can create its championship.'; end if;
  if p_format not in ('single-elimination', 'double-elimination')
     or p_seeding_policy not in ('overall-record', 'pod-finish-bands', 'pod-finish-avoid-rematches')
     or p_best_of not in (1, 3)
     or p_visibility not in ('public', 'private') then
    raise exception 'Championship settings are invalid.';
  end if;

  select * into v_season
  from public.league_organization_seasons
  where id = p_season_id
  for update;
  if not found then raise exception 'Organization season not found.'; end if;
  select * into v_organization
  from public.league_organizations
  where id = v_season.organization_id
  for update;
  if not public.is_league_organization_owner(v_organization.id) then
    raise exception 'Only the organization owner can create its championship.';
  end if;
  if v_season.status <> 'qualification'
     or p_expected_season_revision is null
     or v_season.revision <> p_expected_season_revision then
    raise exception 'The finalized season changed. Refresh before creating its championship.';
  end if;
  select * into v_run
  from public.league_organization_qualification_runs
  where season_id = v_season.id and status = 'finalized'
  for update;
  if not found then raise exception 'Finalize qualification before creating the championship.'; end if;
  if exists (
    select 1 from public.league_organization_championships
    where season_id = v_season.id
  ) then raise exception 'This season already has a connected championship.'; end if;

  select count(*) into v_count
  from public.league_organization_qualifiers
  where season_id = v_season.id and status = 'qualified';
  if v_count < 2 or v_count > 64
     or (p_format = 'double-elimination' and v_count < 4) then
    raise exception 'The selected bracket format does not support this qualifier count.';
  end if;
  if exists (
    select 1 from public.league_organization_qualifiers
    where season_id = v_season.id and status = 'qualified' and manager_user_id is null
  ) then raise exception 'Every qualifier needs a claimed manager before championship creation.'; end if;
  if exists (
    select manager_user_id
    from public.league_organization_qualifiers
    where season_id = v_season.id and status = 'qualified'
    group by manager_user_id having count(*) > 1
  ) then raise exception 'One manager cannot control multiple championship entrants.'; end if;

  v_name := left(v_season.name || ' Championship', 120);
  v_description := left(
    v_organization.name || ' connected championship. Qualified teams retain their finalized regular-season rosters.',
    2000
  );
  v_rules := left(coalesce(v_season.regulations ->> 'notes', ''), 10000);
  v_slug_base := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60);
  if v_slug_base = '' then v_slug_base := 'championship'; end if;
  v_slug := v_slug_base || '-' || left(replace(v_tournament_id::text, '-', ''), 8);

  insert into public.tournaments(
    id, slug, owner_id, name, description, visibility, format,
    status, rules, best_of, entrant_limit
  ) values (
    v_tournament_id, v_slug, auth.uid(), v_name, v_description, p_visibility,
    p_format, 'registration', v_rules, p_best_of, v_count
  );
  insert into public.league_organization_championships(
    id, season_id, tournament_id, format, status, seeding_policy
  ) values (
    v_championship_id, v_season.id, v_tournament_id, p_format,
    'registration', p_seeding_policy
  );
  perform set_config('draftcenter.connected_championship_promotion', v_tournament_id::text, true);

  for v_qualifier in
    select qualifier.*, pod.sort_order
    from public.league_organization_qualifiers qualifier
    join public.league_organization_pods pod on pod.id = qualifier.pod_id
    where qualifier.season_id = v_season.id and qualifier.status = 'qualified'
    order by
      case when p_seeding_policy <> 'overall-record' then qualifier.placement end asc nulls last,
      case when p_seeding_policy = 'overall-record' then coalesce((qualifier.qualification_basis ->> 'wins')::integer, 0) end desc,
      case when p_seeding_policy = 'overall-record' then coalesce((qualifier.qualification_basis ->> 'differential')::integer, 0) end desc,
      case when p_seeding_policy = 'overall-record' then
        coalesce((qualifier.qualification_basis ->> 'game_wins')::numeric, 0)
        / greatest(
            coalesce((qualifier.qualification_basis ->> 'game_wins')::numeric, 0)
            + coalesce((qualifier.qualification_basis ->> 'game_losses')::numeric, 0),
            1
          )
      end desc,
      case when qualifier.qualification_kind = 'wildcard' then 1 else 0 end,
      coalesce((qualifier.qualification_basis ->> 'wins')::integer, 0) desc,
      coalesce((qualifier.qualification_basis ->> 'differential')::integer, 0) desc,
      pod.sort_order,
      qualifier.source_team_key,
      qualifier.id
  loop
    v_seed := v_seed + 1;
    v_entrant_id := gen_random_uuid();
    insert into public.tournament_entrants(
      id, tournament_id, user_id, display_name, seed, status
    ) values (
      v_entrant_id, v_tournament_id, v_qualifier.manager_user_id,
      v_qualifier.display_name, v_seed, 'registered'
    );
    insert into public.league_organization_championship_entrants(
      championship_id, season_id, tournament_id, qualifier_id,
      tournament_entrant_id, seed
    ) values (
      v_championship_id, v_season.id, v_tournament_id, v_qualifier.id,
      v_entrant_id, v_seed
    );
  end loop;
  perform set_config('draftcenter.connected_championship_promotion', '', true);

  while v_size < v_count loop v_size := v_size * 2; end loop;
  v_seed_order := public.single_elimination_seed_order(v_size);
  if p_seeding_policy = 'pod-finish-avoid-rematches' then
    v_index := 1;
    while v_index < array_length(v_seed_order, 1) loop
      v_seed_a := v_seed_order[v_index];
      v_seed_b := v_seed_order[v_index + 1];
      select qualifier.pod_id into v_pod_a
      from public.league_organization_championship_entrants mapping
      join public.league_organization_qualifiers qualifier on qualifier.id = mapping.qualifier_id
      where mapping.championship_id = v_championship_id and mapping.seed = v_seed_a;
      select qualifier.pod_id, mapping.tournament_entrant_id into v_pod_b, v_entrant_b
      from public.league_organization_championship_entrants mapping
      join public.league_organization_qualifiers qualifier on qualifier.id = mapping.qualifier_id
      where mapping.championship_id = v_championship_id and mapping.seed = v_seed_b;
      if v_pod_a is not null and v_pod_a = v_pod_b then
        select mapping.seed, mapping.tournament_entrant_id
        into v_swap_seed, v_swap_entrant
        from unnest(v_seed_order) with ordinality slot(seed_value, position)
        join public.league_organization_championship_entrants mapping
          on mapping.championship_id = v_championship_id and mapping.seed = slot.seed_value
        join public.league_organization_qualifiers qualifier on qualifier.id = mapping.qualifier_id
        left join public.league_organization_championship_entrants paired_mapping
          on paired_mapping.championship_id = v_championship_id
         and paired_mapping.seed = v_seed_order[
           (case when slot.position % 2 = 1 then slot.position + 1 else slot.position - 1 end)::integer
         ]
        left join public.league_organization_qualifiers paired_qualifier
          on paired_qualifier.id = paired_mapping.qualifier_id
        where slot.position > v_index + 1
          and qualifier.pod_id <> v_pod_a
          and (paired_qualifier.pod_id is null or paired_qualifier.pod_id <> v_pod_b)
        order by slot.position
        limit 1;
        if v_swap_seed is not null then
          update public.league_organization_championship_entrants set seed = null
          where championship_id = v_championship_id and tournament_entrant_id = v_entrant_b;
          update public.tournament_entrants set seed = null where id = v_entrant_b;
          update public.league_organization_championship_entrants set seed = v_seed_b
          where championship_id = v_championship_id and tournament_entrant_id = v_swap_entrant;
          update public.tournament_entrants set seed = v_seed_b where id = v_swap_entrant;
          update public.league_organization_championship_entrants set seed = v_swap_seed
          where championship_id = v_championship_id and tournament_entrant_id = v_entrant_b;
          update public.tournament_entrants set seed = v_swap_seed where id = v_entrant_b;
        end if;
      end if;
      v_pod_a := null; v_pod_b := null; v_swap_seed := null;
      v_entrant_b := null; v_swap_entrant := null;
      v_index := v_index + 2;
    end loop;
  end if;

  v_index := 1;
  while v_index < array_length(v_seed_order, 1) loop
    select qualifier.pod_id into v_pod_a
    from public.league_organization_championship_entrants mapping
    join public.league_organization_qualifiers qualifier on qualifier.id = mapping.qualifier_id
    where mapping.championship_id = v_championship_id and mapping.seed = v_seed_order[v_index];
    select qualifier.pod_id into v_pod_b
    from public.league_organization_championship_entrants mapping
    join public.league_organization_qualifiers qualifier on qualifier.id = mapping.qualifier_id
    where mapping.championship_id = v_championship_id and mapping.seed = v_seed_order[v_index + 1];
    if v_pod_a is not null and v_pod_a = v_pod_b then
      v_same_pod_matches := v_same_pod_matches + 1;
    end if;
    v_pod_a := null; v_pod_b := null;
    v_index := v_index + 2;
  end loop;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_tournament_id, auth.uid(), 'connected_championship_created',
    jsonb_build_object(
      'championship_id', v_championship_id, 'format', p_format,
      'seeding_policy', p_seeding_policy, 'entrants', v_count,
      'same_pod_first_round_matches', v_same_pod_matches
    )
  );
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    v_organization.id, v_season.id, auth.uid(), 'championship_created',
    jsonb_build_object(
      'championship_id', v_championship_id, 'tournament_id', v_tournament_id,
      'format', p_format, 'seeding_policy', p_seeding_policy,
      'entrant_count', v_count, 'same_pod_first_round_matches', v_same_pod_matches
    )
  );

  if p_format = 'double-elimination' then
    perform public.lock_double_elimination_tournament(v_tournament_id);
  else
    perform public.lock_single_elimination_tournament(v_tournament_id);
  end if;

  return jsonb_build_object(
    'championship_id', v_championship_id,
    'tournament_id', v_tournament_id,
    'slug', v_slug,
    'format', p_format,
    'seeding_policy', p_seeding_policy,
    'entrant_count', v_count,
    'same_pod_first_round_matches', v_same_pod_matches
  );
exception when unique_violation then
  raise exception 'Championship entrant identities or seeds conflict. Refresh qualification before trying again.';
end;
$$;

create or replace function public.sync_league_organization_championship_manager(
  p_qualifier_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sync jsonb;
  v_qualifier public.league_organization_qualifiers%rowtype;
  v_mapping public.league_organization_championship_entrants%rowtype;
  v_tournament public.tournaments%rowtype;
  v_season public.league_organization_seasons%rowtype;
begin
  select public.sync_league_organization_qualifier_manager(p_qualifier_id) into v_sync;
  select * into v_qualifier
  from public.league_organization_qualifiers
  where id = p_qualifier_id
  for update;
  if v_qualifier.manager_user_id is null then
    raise exception 'Assign the replacement manager in the source league before synchronization.';
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
  update public.tournament_entrants
  set user_id = v_qualifier.manager_user_id
  where id = v_mapping.tournament_entrant_id and tournament_id = v_tournament.id;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = v_tournament.id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_tournament.id, auth.uid(), 'connected_championship_manager_synchronized',
    jsonb_build_object('entrant_id', v_mapping.tournament_entrant_id)
  );
  select * into v_season
  from public.league_organization_seasons where id = v_mapping.season_id;
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

create or replace function public.get_league_organization_championship_workspace(
  p_organization_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.can_view_league_organization(p_organization_id) then
    jsonb_build_object('championships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', championship.id,
        'season_id', championship.season_id,
        'format', championship.format,
        'seeding_policy', championship.seeding_policy,
        'status', tournament.status,
        'tournament_id', tournament.id,
        'tournament_slug', tournament.slug,
        'tournament_name', tournament.name,
        'visibility', tournament.visibility,
        'best_of', tournament.best_of,
        'entrant_count', (
          select count(*) from public.league_organization_championship_entrants mapping
          where mapping.championship_id = championship.id
        )
      ) order by championship.created_at desc)
      from public.league_organization_championships championship
      join public.league_organization_seasons season on season.id = championship.season_id
      join public.tournaments tournament on tournament.id = championship.tournament_id
      where season.organization_id = p_organization_id
        and public.can_view_tournament(tournament.id)
    ), '[]'::jsonb))
  else null end;
$$;

create or replace function public.get_connected_championship_tournament(
  p_tournament_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.can_view_tournament(p_tournament_id) then (
    select jsonb_build_object(
      'championship_id', championship.id,
      'organization_name', organization.name,
      'organization_slug', organization.slug,
      'season_name', season.name,
      'seeding_policy', championship.seeding_policy,
      'entrants', coalesce((
        select jsonb_agg(jsonb_build_object(
          'tournament_entrant_id', mapping.tournament_entrant_id,
          'pod_label', pod.label,
          'qualification_kind', qualifier.qualification_kind,
          'placement', qualifier.placement,
          'roster_size', jsonb_array_length(qualifier.roster_snapshot)
        ) order by mapping.seed)
        from public.league_organization_championship_entrants mapping
        join public.league_organization_qualifiers qualifier on qualifier.id = mapping.qualifier_id
        join public.league_organization_pods pod on pod.id = qualifier.pod_id
        where mapping.championship_id = championship.id
      ), '[]'::jsonb)
    )
    from public.league_organization_championships championship
    join public.league_organization_seasons season on season.id = championship.season_id
    join public.league_organizations organization on organization.id = season.organization_id
    where championship.tournament_id = p_tournament_id
  ) else null end;
$$;

revoke all on function public.guard_connected_championship_entrant_insert()
  from public, anon, authenticated;
revoke all on function public.sync_league_organization_championship_status()
  from public, anon, authenticated;
revoke all on function public.create_league_organization_championship(uuid,bigint,text,text,integer,text)
  from public, anon, authenticated;
revoke all on function public.sync_league_organization_championship_manager(uuid)
  from public, anon, authenticated;
revoke all on function public.get_league_organization_championship_workspace(uuid)
  from public, anon, authenticated;
revoke all on function public.get_connected_championship_tournament(uuid)
  from public, anon, authenticated;

grant execute on function public.create_league_organization_championship(uuid,bigint,text,text,integer,text)
  to authenticated;
grant execute on function public.sync_league_organization_championship_manager(uuid)
  to authenticated;
grant execute on function public.get_league_organization_championship_workspace(uuid)
  to anon, authenticated;
grant execute on function public.get_connected_championship_tournament(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
