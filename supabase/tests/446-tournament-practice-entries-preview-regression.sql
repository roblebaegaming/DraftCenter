-- Preview-only regression for flexible private tournament practice fields.
-- Run only in an isolated Supabase Preview branch. Every synthetic identity,
-- tournament, entrant, and audit event is rolled back.

begin;

create temp table dc_tournament_practice_results (
  result jsonb not null
) on commit preserve rows;

create function pg_temp.dc_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_payload jsonb;
  v_tournament_id uuid;
  v_public_id uuid;
  v_entrant_id uuid;
  v_revision bigint;
  v_rejected boolean := false;
begin
  if not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'tournaments'
         and column_name = 'is_practice'
     )
     or not has_function_privilege(
       'authenticated',
       'public.add_tournament_practice_entrants(uuid,bigint,integer,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.remove_tournament_practice_entrant(uuid,uuid,bigint)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.add_tournament_practice_entrants(uuid,bigint,integer,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.guard_tournament_synthetic_entrant()',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.guard_practice_draft_team_identity()',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.materialize_auction_draft_tournament_rosters(uuid)',
       'execute'
     ) then
    raise exception 'Practice field grants do not match the RPC-only browser boundary.';
  end if;
  insert into dc_tournament_practice_results values
    (jsonb_build_object('check', 'grants', 'ok', true));

  if (select count(*) = 3 and bool_and(relrowsecurity)
      from pg_class
      where oid in (
        'public.tournaments'::regclass,
        'public.tournament_entrants'::regclass,
        'public.tournament_audit_events'::regclass
      )) is distinct from true then
    raise exception 'Practice field tables must keep RLS enabled.';
  end if;
  if position(
       'is_practice' in pg_get_functiondef(
         'public.lock_draft_tournament_field(uuid,bigint)'::regprocedure
       )
     ) = 0
     or position(
       'is_practice' in pg_get_functiondef(
       'public.lock_auction_draft_tournament_field(uuid,bigint)'::regprocedure
       )
     ) = 0
     or position(
       'owner_membership_id is null' in pg_get_functiondef(
         'public.lock_draft_tournament_rosters(uuid,bigint)'::regprocedure
       )
     ) = 0 then
    raise exception 'Draft field locks do not recognize flexible practice bots.';
  end if;
  insert into dc_tournament_practice_results values
    (jsonb_build_object('check', 'rls_and_draft_boundary', 'ok', true));

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values
    (v_owner, 'Practice Operator'),
    (v_other, 'Other Operator')
  on conflict (id) do update set display_name = excluded.display_name;

  perform pg_temp.dc_auth(v_owner);
  v_payload := public.create_tournament(
    'Flexible Private Practice', '', 'private', 3, 8, '', 'single-elimination'
  );
  select tournament.id, tournament.revision
  into v_tournament_id, v_revision
  from public.tournaments tournament
  where tournament.slug = v_payload ->> 'slug';
  perform public.join_tournament(v_tournament_id, 'Practice Operator', null, null);
  select revision into v_revision from public.tournaments where id = v_tournament_id;
  v_payload := public.add_tournament_practice_entrants(
    v_tournament_id, v_revision, 3, 'Swiss Test Player'
  );

  if (v_payload ->> 'added_count')::integer <> 3
     or not exists (
       select 1 from public.tournaments tournament
       where tournament.id = v_tournament_id
         and tournament.visibility = 'private'
         and tournament.is_practice
         and tournament.entrant_limit = 8
     )
     or (select count(*) from public.tournament_entrants entrant
         where entrant.tournament_id = v_tournament_id
           and entrant.is_demo_bot
           and entrant.user_id is null
           and entrant.display_name like '% · Practice') <> 3 then
    raise exception 'The operator could not build a bounded private practice field.';
  end if;
  v_payload := public.get_tournament_operation_details(v_tournament_id, null);
  if not coalesce((v_payload ->> 'is_practice')::boolean, false)
     or jsonb_array_length(v_payload -> 'synthetic_entrant_ids') <> 3 then
    raise exception 'Authorized viewers cannot identify every synthetic practice entrant.';
  end if;
  insert into dc_tournament_practice_results values
    (jsonb_build_object('check', 'private_field', 'ok', true, 'real', 1, 'practice', 3, 'capacity', 8));

  perform pg_temp.dc_auth(v_other);
  begin
    perform public.add_tournament_practice_entrants(
      v_tournament_id,
      (select revision from public.tournaments where id = v_tournament_id),
      1,
      'Unauthorized'
    );
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'A non-owner added practice entrants.';
  end if;

  perform pg_temp.dc_auth(v_owner);
  v_rejected := false;
  begin
    perform public.add_tournament_practice_entrants(
      v_tournament_id,
      (select revision from public.tournaments where id = v_tournament_id),
      8,
      'Over Capacity'
    );
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Practice entrants exceeded the configured maximum capacity.';
  end if;

  v_payload := public.create_tournament(
    'Public Boundary Check', '', 'public', 3, 8, '', 'single-elimination'
  );
  select tournament.id into v_public_id
  from public.tournaments tournament
  where tournament.slug = v_payload ->> 'slug';
  v_rejected := false;
  begin
    perform public.add_tournament_practice_entrants(
      v_public_id,
      (select revision from public.tournaments where id = v_public_id),
      1,
      'Public Bot'
    );
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'A public tournament accepted a synthetic practice entrant.';
  end if;
  insert into dc_tournament_practice_results values
    (jsonb_build_object('check', 'authorization_and_capacity', 'ok', true));

  for v_entrant_id in
    select entrant.id from public.tournament_entrants entrant
    where entrant.tournament_id = v_tournament_id
      and entrant.is_demo_bot
    order by entrant.registered_at, entrant.id
  loop
    perform public.remove_tournament_practice_entrant(
      v_tournament_id,
      v_entrant_id,
      (select revision from public.tournaments where id = v_tournament_id)
    );
  end loop;
  if exists (
       select 1 from public.tournament_entrants entrant
       where entrant.tournament_id = v_tournament_id and entrant.is_demo_bot
     )
     or exists (
       select 1 from public.tournaments tournament
       where tournament.id = v_tournament_id and tournament.is_practice
     ) then
    raise exception 'Removing the final synthetic entrant did not clear practice mode.';
  end if;
  insert into dc_tournament_practice_results values
    (jsonb_build_object('check', 'removal', 'ok', true));
end;
$validation$;

select result from dc_tournament_practice_results order by result ->> 'check';

rollback;
