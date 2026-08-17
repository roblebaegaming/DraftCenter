-- Migration 229 replaced the rollover function after migration 098 had
-- repaired its lifecycle label. Restore the canonical enum value without
-- changing any league data.

begin;

do $$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from pg_type type_row
    join pg_namespace namespace_row
      on namespace_row.oid = type_row.typnamespace
    join pg_enum enum_row
      on enum_row.enumtypid = type_row.oid
    where namespace_row.nspname = 'public'
      and type_row.typname = 'league_status'
      and enum_row.enumlabel = 'setup'
  ) then
    raise exception 'The canonical league_status setup value is missing.';
  end if;

  select pg_get_functiondef(
    to_regprocedure('public.transition_league_to_new_season(uuid,jsonb)')
  )
  into v_definition;
  if v_definition is null then
    raise exception 'transition_league_to_new_season is missing; run migration 229 first.';
  end if;
  if position('status = ''preseason''' in v_definition) > 0 then
    execute replace(
      v_definition,
      'status = ''preseason''',
      'status = ''setup'''
    );
  elsif position('status = ''setup''' in v_definition) > 0 then
    -- The corrected migration 229 may already have installed this version.
    -- Treat that state as success so this repair is safe to rerun.
    null;
  else
    raise exception 'transition_league_to_new_season contains an unknown status assignment.';
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
