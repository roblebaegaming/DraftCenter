-- Allow owner-scoped browser writes to satisfy the Team Lab check constraints.
-- The outer validators run with the migration owner's privileges while their
-- implementation helpers remain unavailable to browser roles.

begin;

alter function public.is_valid_team_lab_team_sets(jsonb, jsonb)
  security definer;
alter function public.is_valid_team_lab_team_sets(jsonb, jsonb)
  set search_path = '';

alter function public.is_valid_team_lab_battle_report(jsonb)
  security definer;
alter function public.is_valid_team_lab_battle_report(jsonb)
  set search_path = '';

revoke all on function public.is_valid_team_lab_team_sets(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.is_valid_team_lab_team_sets(jsonb, jsonb)
  to authenticated;

revoke all on function public.is_valid_team_lab_battle_report(jsonb)
  from public, anon, authenticated;
grant execute on function public.is_valid_team_lab_battle_report(jsonb)
  to authenticated;

do $hardening$
begin
  if has_function_privilege('anon', 'public.is_valid_team_lab_team_sets(jsonb,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.is_valid_team_lab_team_sets(jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute') then
    raise exception 'Team Lab constraint validator grants are incorrect.';
  end if;
  if has_function_privilege('anon', 'public.is_valid_team_lab_series(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_series(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_side_state(jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_side_state(jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_state(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_state(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_report_v1(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_report_v1(jsonb)', 'execute') then
    raise exception 'Internal Team Lab validator helpers are exposed to browser roles.';
  end if;
end;
$hardening$;

commit;
notify pgrst, 'reload schema';
