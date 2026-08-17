-- Migration 390: expose aggregate-only Full Dex Mega Bracket completion totals
-- to the owner Operations server. No member identities, champions, Top 64
-- results, bracket choices, active attempts, or abandoned attempts are returned.

begin;

create or replace function public.get_operations_mega_bracket_completions()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'completed_members', count(distinct user_id)::integer,
    'completed_brackets', count(*)::integer
  )
  from public.mega_bracket_attempts
  where status = 'completed';
$$;

comment on function public.get_operations_mega_bracket_completions() is
  'Returns aggregate Full Dex Mega Bracket completion totals for the allowlisted owner Operations server.';

revoke all on function public.get_operations_mega_bracket_completions() from public, anon, authenticated;
grant execute on function public.get_operations_mega_bracket_completions() to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.get_operations_mega_bracket_completions()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_operations_mega_bracket_completions()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_operations_mega_bracket_completions()', 'EXECUTE') then
    raise exception 'Operations Mega Bracket completion grants are incorrect';
  end if;
  if has_table_privilege('anon', 'public.mega_bracket_attempts', 'SELECT')
     or has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'SELECT') then
    raise exception 'Mega Bracket attempt rows must remain private';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.mega_bracket_attempts'::regclass) then
    raise exception 'Mega Bracket attempt RLS must remain enabled';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
