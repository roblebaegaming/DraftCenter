-- DraftCenter least-privilege function execution.
-- Run once AFTER migrations 033 and 034.
-- Discovers installed signatures so obsolete historical overloads are safe.

begin;

drop policy if exists "Public can view profile photos" on storage.objects;

do $$
declare fn record;
begin
  for fn in
    select n.nspname schema_name, p.proname function_name,
           pg_get_function_identity_arguments(p.oid) identity_arguments
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon',
      fn.schema_name, fn.function_name, fn.identity_arguments);
  end loop;
end
$$;

do $$
declare fn record;
begin
  for fn in
    select n.nspname schema_name, p.proname function_name,
           pg_get_function_identity_arguments(p.oid) identity_arguments
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_public_explore', 'get_public_league',
        'get_public_league_cards', 'get_pokemon_poll_placements')
  loop
    execute format('grant execute on function %I.%I(%s) to anon, authenticated',
      fn.schema_name, fn.function_name, fn.identity_arguments);
  end loop;
end
$$;

do $$
declare fn record;
begin
  for fn in
    select n.nspname schema_name, p.proname function_name,
           pg_get_function_identity_arguments(p.oid) identity_arguments
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'reconcile_overnight_draft_pauses',
        'auction_actor_can_control_team')
  loop
    execute format('revoke execute on function %I.%I(%s) from authenticated',
      fn.schema_name, fn.function_name, fn.identity_arguments);
    if fn.function_name = 'reconcile_overnight_draft_pauses' then
      execute format('grant execute on function %I.%I(%s) to service_role',
        fn.schema_name, fn.function_name, fn.identity_arguments);
    end if;
  end loop;
end
$$;

commit;

-- Existing authenticated grants remain intact. Default privileges are deferred
-- until the exact production function-creating role has been confirmed.
