-- Reconciles the privacy grant that existed in Production before migration 365
-- but was not represented in the historical forward SQL chain.
begin;

revoke all on table public.personal_teams from anon;
grant select, insert, update, delete on table public.personal_teams to authenticated;
grant all on table public.personal_teams to service_role;

do $$
begin
  if has_table_privilege('anon', 'public.personal_teams', 'SELECT')
     or has_table_privilege('anon', 'public.personal_teams', 'INSERT')
     or has_table_privilege('anon', 'public.personal_teams', 'UPDATE')
     or has_table_privilege('anon', 'public.personal_teams', 'DELETE') then
    raise exception 'Anonymous users must not receive direct personal_teams access.';
  end if;
  if not has_table_privilege('authenticated', 'public.personal_teams', 'SELECT')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'INSERT')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'DELETE') then
    raise exception 'Authenticated My Teams grants are incomplete.';
  end if;
end;
$$;

commit;
