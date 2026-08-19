begin;

do $$
declare
  v_rls boolean;
begin
  select relrowsecurity into v_rls
  from pg_class where oid = 'public.league_participation_events'::regclass;
  if not v_rls then raise exception 'league participation history must enforce RLS'; end if;

  select relrowsecurity into v_rls
  from pg_class where oid = 'public.tournament_participation_events'::regclass;
  if not v_rls then raise exception 'tournament participation history must enforce RLS'; end if;

  if has_table_privilege('authenticated', 'public.league_participation_events', 'select')
     or has_table_privilege('authenticated', 'public.tournament_participation_events', 'select') then
    raise exception 'private participation reasons are directly readable';
  end if;

  if has_function_privilege(
    'anon',
    'public.set_league_team_retirement(uuid,integer,bigint,integer,text,text)',
    'execute'
  ) then raise exception 'anonymous users can retire league teams'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.set_tournament_participation_status(uuid,uuid,bigint,text,integer,text,text)',
    'execute'
  ) then raise exception 'organizer participation RPC is not available to signed-in owners'; end if;

  if has_function_privilege(
    'authenticated',
    'public.apply_league_qualification_eligibility(uuid)',
    'execute'
  ) then raise exception 'qualification eligibility helper is public'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'league_organization_qualification_candidates'
      and column_name = 'eligible'
  ) then raise exception 'qualification candidates do not record retirement eligibility'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tournament_matches'
      and column_name = 'administrative_resolution'
  ) then raise exception 'tournament matches cannot distinguish administrative resolutions'; end if;
end;
$$;

rollback;

select 'participant_retirement_schema_and_privileges' as result;
