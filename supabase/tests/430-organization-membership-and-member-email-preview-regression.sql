-- Preview-only security and behavior matrix for migration 430. Run only in an
-- isolated Supabase Preview branch. All identities and records are synthetic
-- and removed by exact identifier before commit. This script sends no email.

begin;

create temp table dc_member_email_preview_results (result jsonb not null)
on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_opted_out uuid := gen_random_uuid();
  v_unconfirmed uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_organization_payload jsonb;
  v_organization_id uuid;
  v_league_id uuid;
  v_directory jsonb;
  v_workspace jsonb;
  v_planning jsonb;
  v_audience_count integer;
  v_joined_role text;
  v_member_left boolean;
  v_closed_join_denied boolean := false;
  v_staff_leave_denied boolean := false;
  v_privacy_ok boolean;
  v_grants_ok boolean;
  v_org_audience_ok boolean;
  v_league_audience_ok boolean;
  v_cleanup_ok boolean;
begin
  select
    has_function_privilege('anon', 'public.get_league_organization_directory()', 'execute')
    and has_function_privilege('authenticated', 'public.get_league_organization_directory()', 'execute')
    and has_function_privilege('authenticated', 'public.join_open_league_organization(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.leave_league_organization(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.update_league_organization_membership_policy(uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.join_open_league_organization(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.update_league_organization_membership_policy(uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.resolve_member_email_audience(uuid,text,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.resolve_member_email_audience(uuid,text,uuid)', 'execute')
    and has_function_privilege('service_role', 'public.resolve_member_email_audience(uuid,text,uuid)', 'execute')
    and not has_table_privilege('anon', 'public.member_email_broadcasts', 'select')
    and not has_table_privilege('authenticated', 'public.member_email_broadcasts', 'select')
    and not has_table_privilege('authenticated', 'public.member_email_broadcasts', 'insert')
    and has_table_privilege('service_role', 'public.member_email_broadcasts', 'select')
    and has_table_privilege('service_role', 'public.member_email_broadcasts', 'insert')
    and (select relrowsecurity from pg_class where oid = 'public.member_email_broadcasts'::regclass)
  into v_grants_ok;
  if v_grants_ok is distinct from true then raise exception 'Migration 430 grants or RLS do not match the private boundary.'; end if;

  insert into auth.users(id, aud, role, email, email_confirmed_at)
  values
    (v_owner, 'authenticated', 'authenticated', 'owner-430@example.test', now()),
    (v_admin, 'authenticated', 'authenticated', 'admin-430@example.test', now()),
    (v_member, 'authenticated', 'authenticated', 'member-430@example.test', now()),
    (v_opted_out, 'authenticated', 'authenticated', 'opted-out-430@example.test', now()),
    (v_unconfirmed, 'authenticated', 'authenticated', 'unconfirmed-430@example.test', null),
    (v_outsider, 'authenticated', 'authenticated', 'outsider-430@example.test', now());
  insert into public.profiles(id, display_name, username)
  values
    (v_owner, 'Preview Organization Owner', 'dc_preview_owner_430'),
    (v_admin, 'Preview Organization Administrator', 'dc_preview_admin_430'),
    (v_member, 'Preview Organization Member', 'dc_preview_member_430'),
    (v_opted_out, 'Preview Opted Out Member', 'dc_preview_opted_out_430'),
    (v_unconfirmed, 'Preview Unconfirmed Member', 'dc_preview_unconfirmed_430'),
    (v_outsider, 'Preview Outsider', 'dc_preview_outsider_430')
  on conflict (id) do update set display_name = excluded.display_name, username = excluded.username;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select public.create_league_organization('Preview Open Organization 430', 'Synthetic membership and email regression.', 'public') into v_organization_payload;
  v_organization_id := (v_organization_payload ->> 'id')::uuid;
  perform public.update_league_organization_membership_policy(v_organization_id, 'open');
  select public.create_league(
    'Preview Member Email League 430',
    'dc-member-email-430-' || left(replace(v_owner::text, '-', ''), 12),
    'Synthetic member-email regression league',
    'Preview'
  ) into v_league_id;
  update public.leagues set is_practice = true, practice_expires_at = now() + interval '1 day' where id = v_league_id;

  insert into public.league_organization_memberships(organization_id, user_id, role)
  values
    (v_organization_id, v_admin, 'administrator'),
    (v_organization_id, v_opted_out, 'member'),
    (v_organization_id, v_unconfirmed, 'member');
  insert into public.league_memberships(league_id, user_id, role)
  values
    (v_league_id, v_member, 'coach'),
    (v_league_id, v_opted_out, 'coach'),
    (v_league_id, v_unconfirmed, 'coach');
  insert into public.notification_preferences(user_id, email_member_announcements)
  values
    (v_opted_out, false),
    (v_member, true)
  on conflict (user_id) do update set email_member_announcements = excluded.email_member_announcements;

  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  select public.get_league_organization_directory() into v_directory;
  v_privacy_ok := exists (
    select 1 from jsonb_array_elements(v_directory) item
    where (item ->> 'id')::uuid = v_organization_id
      and item ->> 'membership_policy' = 'open'
      and item ->> 'my_role' is null
  ) and position('@example.test' in v_directory::text) = 0
    and position(v_owner::text in v_directory::text) = 0
    and position(v_admin::text in v_directory::text) = 0;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_member::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  select public.join_open_league_organization(v_organization_id) into v_joined_role;
  select public.get_league_organization_directory() into v_directory;
  select public.get_league_organization_workspace(v_organization_id) into v_workspace;
  select public.get_league_organization_planning_workspace(v_organization_id) into v_planning;
  v_privacy_ok := v_privacy_ok
    and v_joined_role = 'member'
    and exists (
      select 1 from jsonb_array_elements(v_directory) item
      where (item ->> 'id')::uuid = v_organization_id and item ->> 'my_role' = 'member'
    )
    and public.list_my_league_organizations() = '[]'::jsonb
    and v_planning is null
    and v_workspace -> 'administrators' = '[]'::jsonb
    and position('availability_note' in coalesce(v_workspace::text, '')) = 0;
  select public.leave_league_organization(v_organization_id) into v_member_left;
  if v_member_left is distinct from true then raise exception 'A general member could not independently leave.'; end if;
  select public.join_open_league_organization(v_organization_id) into v_joined_role;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.update_league_organization_membership_policy(v_organization_id, 'closed');
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  begin
    perform public.join_open_league_organization(v_organization_id);
  exception when others then
    if sqlerrm = 'This organization is invite only.' then v_closed_join_denied := true; else raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.leave_league_organization(v_organization_id);
  exception when others then
    if sqlerrm = 'Organization staff must transfer or remove their staff role before leaving.' then v_staff_leave_denied := true; else raise; end if;
  end;

  select count(*) into v_audience_count
  from public.resolve_member_email_audience(v_owner, 'organization', v_organization_id);
  v_org_audience_ok := v_audience_count = 3
    and not exists (
      select 1 from public.resolve_member_email_audience(v_owner, 'organization', v_organization_id)
      where user_id in (v_opted_out, v_unconfirmed)
    );

  select count(*) into v_audience_count
  from public.resolve_member_email_audience(v_owner, 'league', v_league_id);
  v_league_audience_ok := v_audience_count = 2
    and not exists (
      select 1 from public.resolve_member_email_audience(v_owner, 'league', v_league_id)
      where user_id in (v_opted_out, v_unconfirmed)
    );

  if v_privacy_ok is distinct from true
     or v_closed_join_denied is distinct from true
     or v_staff_leave_denied is distinct from true
     or v_org_audience_ok is distinct from true
     or v_league_audience_ok is distinct from true then
    raise exception 'One or more migration 430 privacy or behavior assertions failed.';
  end if;

  insert into public.member_email_broadcasts(
    id, sender_user_id, scope_type, scope_id, scope_name, subject, recipient_count
  ) values (
    gen_random_uuid(), v_owner, 'organization', v_organization_id,
    'Preview Open Organization 430', 'Synthetic ledger entry', 3
  );

  delete from public.member_email_broadcasts where sender_user_id = v_owner and scope_id = v_organization_id;
  delete from public.league_organizations where id = v_organization_id;
  delete from public.leagues where id = v_league_id;
  delete from auth.users where id in (v_owner, v_admin, v_member, v_opted_out, v_unconfirmed, v_outsider);

  select
    not exists (select 1 from public.league_organizations where id = v_organization_id)
    and not exists (select 1 from public.leagues where id = v_league_id)
    and not exists (select 1 from auth.users where id in (v_owner, v_admin, v_member, v_opted_out, v_unconfirmed, v_outsider))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then raise exception 'Migration 430 Preview fixtures were not completely removed.'; end if;

  insert into dc_member_email_preview_results(result) values (jsonb_build_object(
    'rpc_and_table_grants', v_grants_ok,
    'directory_identity_privacy', v_privacy_ok,
    'member_join_and_leave', v_member_left,
    'closed_join_denied', v_closed_join_denied,
    'staff_leave_denied', v_staff_leave_denied,
    'private_planning_hidden', v_planning is null,
    'organization_email_preference_and_confirmation_filter', v_org_audience_ok,
    'league_email_preference_and_confirmation_filter', v_league_audience_ok,
    'real_email_sent', false,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_member_email_preview_results;
