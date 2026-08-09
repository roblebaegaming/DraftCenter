-- Preview-only maximum-capacity matrix for migration 361.
-- Run only on a confirmed disposable Supabase branch with migrations 340-361.
-- Every synthetic row is deleted before commit; a failed assertion aborts.
begin;

create temp table dc_tournament_scale_identities (
  kind text not null,
  seed integer not null,
  user_id uuid not null primary key
) on commit preserve rows;

create temp table dc_tournament_scale_tournaments (
  tournament_id uuid not null primary key
) on commit preserve rows;

create temp table dc_tournament_scale_results (
  result jsonb not null
) on commit preserve rows;

insert into dc_tournament_scale_identities(kind, seed, user_id)
values ('owner', 0, gen_random_uuid());

insert into dc_tournament_scale_identities(kind, seed, user_id)
select 'entrant', seed_number, gen_random_uuid()
from generate_series(1, 512) seed_number;

insert into auth.users(id, aud, role)
select user_id, 'authenticated', 'authenticated'
from dc_tournament_scale_identities;

do $validation$
declare
  v_owner uuid;
  v_single uuid;
  v_double uuid;
  v_single_byes uuid;
  v_double_byes uuid;
  v_single_slug text;
  v_double_slug text;
  v_payload jsonb;
  v_page jsonb;
  v_started timestamptz;
  v_single_ms numeric;
  v_double_ms numeric;
  v_ok boolean;
  v_single_rejected boolean := false;
  v_double_rejected boolean := false;
begin
  select user_id into v_owner
  from dc_tournament_scale_identities
  where kind = 'owner';

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select
    has_function_privilege(
      'authenticated',
      'public.get_tournament_workspace_page(text,text,text,integer,integer,integer)',
      'execute'
    )
    and has_function_privilege(
      'anon',
      'public.get_tournament_workspace_page(text,text,text,integer,integer,integer)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.lock_single_elimination_tournament(uuid)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.lock_double_elimination_tournament(uuid)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.lock_double_elimination_tournament(uuid)',
      'execute'
    )
  into v_ok;
  if v_ok is distinct from true then
    raise exception 'Tournament scale grants do not match the browser boundary.';
  end if;
  insert into dc_tournament_scale_results(result)
  values (jsonb_build_object('grants', true));

  begin
    perform public.create_tournament(
      'Rejected Single 513', '', 'public', 1, 513, '', 'single-elimination'
    );
  exception when raise_exception then
    if sqlerrm = 'Tournament settings are invalid.' then
      v_single_rejected := true;
    else
      raise;
    end if;
  end;
  begin
    perform public.create_tournament(
      'Rejected Double 257', '', 'public', 1, 257, '', 'double-elimination'
    );
  exception when raise_exception then
    if sqlerrm = 'Tournament settings are invalid.' then
      v_double_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_single_rejected or not v_double_rejected then
    raise exception 'One or more format-specific capacity limits accepted an oversized field.';
  end if;
  insert into dc_tournament_scale_results(result)
  values (jsonb_build_object('format_caps', true));

  select public.create_tournament(
    'Scale Preview Single Byes', '', 'public', 1, 5,
    'Synthetic set-based bye regression', 'single-elimination'
  ) into v_payload;
  select id into v_single_byes
  from public.tournaments where slug = v_payload ->> 'slug';
  insert into dc_tournament_scale_tournaments values (v_single_byes);
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  select
    v_single_byes,
    identity.user_id,
    format('Scale Single Bye Seed %s', identity.seed),
    identity.seed
  from dc_tournament_scale_identities identity
  where identity.kind = 'entrant' and identity.seed between 1 and 5;
  perform public.lock_single_elimination_tournament(v_single_byes);
  select
    count(*) = 7
    and count(*) filter (where bracket_round = 1 and status = 'bye') = 3
    and count(*) filter (where status = 'ready') = 2
  into v_ok
  from public.tournament_matches
  where tournament_id = v_single_byes;
  if v_ok is distinct from true then
    raise exception 'Set-based single-elimination bye routing is incomplete.';
  end if;

  select public.create_tournament(
    'Scale Preview Double Byes', '', 'public', 1, 5,
    'Synthetic set-based bye regression', 'double-elimination'
  ) into v_payload;
  select id into v_double_byes
  from public.tournaments where slug = v_payload ->> 'slug';
  insert into dc_tournament_scale_tournaments values (v_double_byes);
  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  select
    v_double_byes,
    identity.user_id,
    format('Scale Double Bye Seed %s', identity.seed),
    identity.seed
  from dc_tournament_scale_identities identity
  where identity.kind = 'entrant' and identity.seed between 1 and 5;
  perform public.lock_double_elimination_tournament(v_double_byes);
  select
    count(*) = 15
    and count(*) filter (where status = 'ready') = 2
    and count(*) filter (where status = 'bye') = 4
    and count(*) filter (
      where status = 'pending'
        and ((entrant_a_id is null) <> (entrant_b_id is null))
    ) = 1
  into v_ok
  from public.tournament_matches
  where tournament_id = v_double_byes;
  if v_ok is distinct from true then
    raise exception 'Set-based double-elimination bye routing is incomplete.';
  end if;
  insert into dc_tournament_scale_results(result)
  values (jsonb_build_object('bye_routing', true));

  select public.create_tournament(
    'Scale Preview Single 512', '', 'private', 1, 512,
    'Synthetic maximum-capacity matrix', 'single-elimination'
  ) into v_payload;
  v_single_slug := v_payload ->> 'slug';
  select id into v_single from public.tournaments where slug = v_single_slug;
  insert into dc_tournament_scale_tournaments values (v_single);

  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  select
    v_single,
    identity.user_id,
    format('Scale Single Seed %s', identity.seed),
    identity.seed
  from dc_tournament_scale_identities identity
  where identity.kind = 'entrant';

  perform public.set_tournament_seed(
    v_single,
    (select user_entrant.id
     from public.tournament_entrants user_entrant
     where user_entrant.tournament_id = v_single and user_entrant.seed = 512),
    1
  );
  perform public.randomize_tournament_seeds(v_single, 'scale-preview-single-512');
  select
    count(*) = 512
    and count(distinct seed) = 512
    and min(seed) = 1
    and max(seed) = 512
  into v_ok
  from public.tournament_entrants
  where tournament_id = v_single;
  if v_ok is distinct from true then
    raise exception 'Set-based maximum-field seeding is incomplete.';
  end if;

  v_started := clock_timestamp();
  perform public.lock_single_elimination_tournament(v_single);
  v_single_ms := extract(epoch from (clock_timestamp() - v_started)) * 1000;

  select
    count(*) = 511
    and count(*) filter (where bracket_stage = 'single' and bracket_round = 1) = 256
    and count(*) filter (where status = 'ready') = 256
    and count(*) filter (where winner_to_match_id is not null) = 510
    and max(bracket_round) = 9
    and max(match_number) = 256
  into v_ok
  from public.tournament_matches
  where tournament_id = v_single;
  if v_ok is distinct from true then
    raise exception 'The 512-entrant single-elimination graph is incomplete.';
  end if;
  insert into dc_tournament_scale_results(result)
  values (jsonb_build_object('single_512', true, 'generation_ms', round(v_single_ms, 2)));

  select public.get_tournament_workspace_page(
    v_single_slug, null, 'single', 1, 1, 64
  ) into v_page;
  if jsonb_array_length(v_page -> 'entrants') <> 512
     or jsonb_array_length(v_page -> 'rounds') <> 9
     or jsonb_array_length(v_page -> 'matches') <> 64
     or (v_page #>> '{match_page,total_matches}')::integer <> 256
     or (v_page #>> '{match_page,total_pages}')::integer <> 4
     or ((v_page -> 'matches') -> 0) ? 'winner_to_match_id'
     or ((v_page -> 'matches') -> 0) ? 'loser_to_match_id' then
    raise exception 'The bounded single-elimination workspace page is invalid.';
  end if;

  select public.get_tournament_workspace_page(
    v_single_slug, null, 'single', 1, 4, 64
  ) into v_page;
  if jsonb_array_length(v_page -> 'matches') <> 64
     or (v_page #>> '{match_page,page}')::integer <> 4 then
    raise exception 'The final single-elimination match page is invalid.';
  end if;
  insert into dc_tournament_scale_results(result)
  values (jsonb_build_object('workspace_paging', true));

  select public.create_tournament(
    'Scale Preview Double 256', '', 'public', 1, 256,
    'Synthetic maximum-capacity matrix', 'double-elimination'
  ) into v_payload;
  v_double_slug := v_payload ->> 'slug';
  select id into v_double from public.tournaments where slug = v_double_slug;
  insert into dc_tournament_scale_tournaments values (v_double);

  insert into public.tournament_entrants(tournament_id, user_id, display_name, seed)
  select
    v_double,
    identity.user_id,
    format('Scale Double Seed %s', identity.seed),
    identity.seed
  from dc_tournament_scale_identities identity
  where identity.kind = 'entrant' and identity.seed between 1 and 256;

  v_started := clock_timestamp();
  perform public.lock_double_elimination_tournament(v_double);
  v_double_ms := extract(epoch from (clock_timestamp() - v_started)) * 1000;

  select
    count(*) = 511
    and count(*) filter (where bracket_stage = 'winners') = 255
    and count(*) filter (where bracket_stage = 'losers') = 254
    and count(*) filter (where bracket_stage = 'grand-final') = 2
    and count(*) filter (where bracket_stage = 'winners' and bracket_round = 1 and status = 'ready') = 128
    and max(bracket_round) filter (where bracket_stage = 'winners') = 8
    and max(bracket_round) filter (where bracket_stage = 'losers') = 14
    and max(round_number) = 24
  into v_ok
  from public.tournament_matches
  where tournament_id = v_double;
  if v_ok is distinct from true then
    raise exception 'The 256-entrant double-elimination graph is incomplete.';
  end if;

  select public.get_tournament_workspace_page(
    v_double_slug, null, 'winners', 1, 2, 64
  ) into v_page;
  if jsonb_array_length(v_page -> 'rounds') <> 24
     or jsonb_array_length(v_page -> 'matches') <> 64
     or (v_page #>> '{match_page,total_matches}')::integer <> 128
     or (v_page #>> '{match_page,total_pages}')::integer <> 2 then
    raise exception 'The bounded double-elimination workspace page is invalid.';
  end if;
  insert into dc_tournament_scale_results(result)
  values (jsonb_build_object('double_256', true, 'generation_ms', round(v_double_ms, 2)));
end;
$validation$;

delete from public.tournaments tournament
where tournament.id in (
  select tournament_id from dc_tournament_scale_tournaments
);

delete from auth.users identity
where identity.id in (
  select user_id from dc_tournament_scale_identities
);

do $cleanup$
declare
  v_clean boolean;
begin
  select
    not exists (
      select 1 from public.tournaments tournament
      where tournament.id in (select tournament_id from dc_tournament_scale_tournaments)
    )
    and not exists (
      select 1 from public.tournament_entrants entrant
      where entrant.tournament_id in (select tournament_id from dc_tournament_scale_tournaments)
    )
    and not exists (
      select 1 from public.tournament_matches bracket_match
      where bracket_match.tournament_id in (select tournament_id from dc_tournament_scale_tournaments)
    )
    and not exists (
      select 1 from auth.users identity
      where identity.id in (select user_id from dc_tournament_scale_identities)
    )
  into v_clean;
  if v_clean is distinct from true then
    raise exception 'Synthetic tournament scale fixtures were not fully removed.';
  end if;
  insert into dc_tournament_scale_results(result)
  values (jsonb_build_object('cleanup', true));
end;
$cleanup$;

commit;

select result from dc_tournament_scale_results;
