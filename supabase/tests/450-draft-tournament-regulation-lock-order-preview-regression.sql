begin;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.sync_draft_tournament_regulation()'::regprocedure
  ) into v_definition;

  if position('set search_path to ''''' in lower(v_definition)) = 0 then
    raise exception 'The regulation sync function does not pin an empty search path.';
  end if;
  if position('update public.league_state_snapshots' in lower(v_definition)) = 0 then
    raise exception 'The regulation sync function no longer updates the canonical draft-room snapshot.';
  end if;
  if position('update public.leagues' in lower(v_definition)) > 0 then
    raise exception 'The regulation sync function still mutates guarded relational league settings.';
  end if;
  if not has_function_privilege(
       'service_role',
       'public.sync_draft_tournament_regulation()',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.sync_draft_tournament_regulation()',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.sync_draft_tournament_regulation()',
       'execute'
     ) then
    raise exception 'The regulation sync function grants changed unexpectedly.';
  end if;
end;
$$;

rollback;
