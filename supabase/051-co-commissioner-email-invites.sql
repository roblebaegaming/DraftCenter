-- Let commissioners invite a co-commissioner by email while preserving the
-- existing username promotion option. Run once after migration 050.

begin;

create or replace function public.create_co_commissioner_invite(
  p_league_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_email text;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can invite co-commissioners.';
  end if;

  v_email := nullif(lower(trim(p_email)), '');
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  insert into public.league_invites (
    league_id,
    email,
    role,
    created_by,
    expires_at
  )
  values (
    p_league_id,
    v_email,
    'co_commissioner',
    auth.uid(),
    now() + interval '14 days'
  )
  returning token into v_token;

  return jsonb_build_object(
    'token', v_token,
    'role', 'co_commissioner',
    'expires_at', now() + interval '14 days'
  );
end;
$$;

create or replace function public.accept_league_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.league_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  select *
  into v_invite
  from public.league_invites
  where token = p_token
  for update;

  if v_invite.id is null or v_invite.accepted_at is not null then
    raise exception 'This invite is no longer available.';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_invite.email is not null and v_invite.email <> v_email then
    raise exception 'This invite was sent to a different email address.';
  end if;

  insert into public.profiles (id, display_name)
  values (
    auth.uid(),
    coalesce(nullif(split_part(v_email, '@', 1), ''), 'Coach')
  )
  on conflict (id) do nothing;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_invite.league_id, auth.uid(), v_invite.role)
  on conflict (league_id, user_id) do update
  set role = case
    when public.league_memberships.role = 'commissioner'
      then public.league_memberships.role
    when excluded.role = 'co_commissioner'
      then 'co_commissioner'::public.membership_role
    when public.league_memberships.role = 'viewer'
      then excluded.role
    else public.league_memberships.role
  end;

  update public.league_invites
  set accepted_at = coalesce(accepted_at, now())
  where id = v_invite.id;

  return v_invite.league_id;
end;
$$;

revoke execute on function public.create_co_commissioner_invite(uuid, text) from public;
revoke execute on function public.accept_league_invite(uuid) from public;
grant execute on function public.create_co_commissioner_invite(uuid, text) to authenticated;
grant execute on function public.accept_league_invite(uuid) to authenticated;

commit;
