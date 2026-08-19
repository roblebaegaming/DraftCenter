begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournaments' and column_name = 'regulation_id'
  ) then raise exception 'tournaments do not publish a regulation'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournaments' and column_name = 'registration_closes_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournaments' and column_name = 'check_in_opens_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournaments' and column_name = 'starts_at'
  ) then raise exception 'tournament schedule milestones are incomplete'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.update_tournament_operation_details(uuid,bigint,text,timestamptz,timestamptz,timestamptz)',
    'execute'
  ) then raise exception 'operators cannot update the published event plan'; end if;
  if not has_function_privilege(
    'anon',
    'public.get_tournament_operation_details(uuid,text)',
    'execute'
  ) then raise exception 'viewers cannot read the bounded event plan'; end if;
  if has_function_privilege(
    'authenticated',
    'public.set_tournament_seed(uuid,uuid,integer)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.randomize_tournament_seeds(uuid,text)',
    'execute'
  ) then raise exception 'pre-event manual seeding remains browser callable'; end if;
  if not has_function_privilege(
    'authenticated',
    'public.start_tournament_with_random_draw(uuid)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.lock_draft_tournament_field_with_draw(uuid,bigint)',
    'execute'
  ) then raise exception 'result-neutral opening draw functions are unavailable'; end if;
  if has_function_privilege(
    'authenticated',
    'public.sync_draft_tournament_regulation()',
    'execute'
  ) then raise exception 'draft-room regulation sync helper is browser callable'; end if;
  if position(
    'initial_seed' in pg_get_functiondef(
      'public.rebuild_draft_tournament_standings(uuid,integer)'::regprocedure
    )
  ) > 0 then
    raise exception 'opening draft positions still affect Swiss standings';
  end if;
end;
$$;

rollback;

select 'tournament_operator_workflow_schema_and_privileges' as result;
