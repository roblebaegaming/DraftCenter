-- Preview-only two-account privacy and recovery matrix for migration 393.
-- Run only in an isolated Supabase Preview project. The transaction rolls back
-- every synthetic account, team, matchup, roster, and note.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_team uuid;
  v_other_team uuid;
  v_matchup jsonb;
  v_matchup_id uuid;
  v_export jsonb;
  v_restored integer;
  v_cross_update_denied boolean := false;
  v_cross_delete_denied boolean := false;
  v_cross_parent_denied boolean := false;
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.personal_teams'::regclass
      and tgname = 'personal_teams_enforce_free_limit'
      and not tgisinternal
  ) then
    raise exception 'The retired My Teams count trigger still exists.';
  end if;

  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'Team Lab matchups must keep forced RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'insert')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'delete') then
    raise exception 'Team Lab matchup storage must remain RPC-only.';
  end if;

  if not has_function_privilege('authenticated', 'public.list_my_team_lab_matchups(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_my_team_lab_matchup(uuid,uuid,text,text,text,text,jsonb,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.delete_my_team_lab_matchup(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.export_my_team_lab_matchups()', 'execute')
     or not has_function_privilege('authenticated', 'public.restore_my_team_lab_matchups(jsonb)', 'execute') then
    raise exception 'Authenticated Team Lab RPC grants are incomplete.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');

  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_owner, 'Preview Team Lab roster', '["Garchomp","Rotom-Wash"]'::jsonb)
  returning id into v_team;
  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_other, 'Other Preview roster', '["Corviknight"]'::jsonb)
  returning id into v_other_team;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.save_my_team_lab_matchup(
    null,
    v_team,
    'Preview Opponent',
    'Synthetic Preview Team',
    'roster',
    'reg-mb',
    '["Miraidon","Iron Hands"]'::jsonb,
    'Synthetic private notes that must never cross accounts.'
  ) into v_matchup;
  v_matchup_id := (v_matchup ->> 'id')::uuid;

  if jsonb_array_length(public.list_my_team_lab_matchups(v_team)) <> 1
     or public.list_my_team_lab_matchups(v_team) -> 0 ->> 'notes'
       <> 'Synthetic private notes that must never cross accounts.' then
    raise exception 'The owner could not round-trip a Team Lab matchup.';
  end if;

  select public.export_my_team_lab_matchups() into v_export;
  if jsonb_array_length(v_export) <> 1 then
    raise exception 'Team Lab account export is incomplete.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );

  if jsonb_array_length(public.list_my_team_lab_matchups(null)) <> 0 then
    raise exception 'A second account can list another account matchup.';
  end if;

  begin
    perform public.save_my_team_lab_matchup(
      v_matchup_id, v_other_team, 'Changed', '', 'team', 'reg-mb', '[]'::jsonb, ''
    );
  exception when others then
    v_cross_update_denied := sqlerrm = 'That matchup plan is unavailable.';
  end;

  begin
    perform public.delete_my_team_lab_matchup(v_matchup_id);
  exception when others then
    v_cross_delete_denied := sqlerrm = 'That matchup plan is unavailable.';
  end;

  begin
    perform public.save_my_team_lab_matchup(
      null, v_team, 'Unauthorized parent', '', 'team', 'reg-mb', '[]'::jsonb, ''
    );
  exception when others then
    v_cross_parent_denied := sqlerrm = 'Choose one of your own saved teams.';
  end;

  if not v_cross_update_denied or not v_cross_delete_denied or not v_cross_parent_denied then
    raise exception 'The two-account Team Lab denial matrix failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  perform public.delete_my_team_lab_matchup(v_matchup_id);
  if jsonb_array_length(public.list_my_team_lab_matchups(null)) <> 0 then
    raise exception 'The owner delete did not remove the exact matchup.';
  end if;
  select public.restore_my_team_lab_matchups(v_export) into v_restored;
  if v_restored <> 1
     or jsonb_array_length(public.list_my_team_lab_matchups(v_team)) <> 1 then
    raise exception 'Team Lab recovery did not restore the private matchup.';
  end if;
end;
$validation$;

rollback;
