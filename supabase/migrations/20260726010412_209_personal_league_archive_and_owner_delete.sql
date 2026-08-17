-- Let every member organize their own dashboard without changing the league
-- for anyone else. Permanent deletion remains an explicit owner-only action.

begin;

alter table public.league_memberships
  add column if not exists archived_at timestamptz;

create index if not exists league_memberships_user_archived_idx
  on public.league_memberships (user_id, archived_at, joined_at desc);

create table if not exists public.deleted_league_audit (
  league_id uuid primary key,
  league_name text not null,
  deleted_by uuid not null,
  deleted_at timestamptz not null default clock_timestamp(),
  member_count integer not null default 0,
  season_count integer not null default 0
);

alter table public.deleted_league_audit enable row level security;
revoke all on table public.deleted_league_audit
  from public, anon, authenticated;
grant all on table public.deleted_league_audit to service_role;

create or replace function public.set_my_league_archived(
  p_league_id uuid,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  v_archived_at := case
    when coalesce(p_archived, false) then clock_timestamp()
    else null
  end;

  update public.league_memberships
  set archived_at = v_archived_at
  where league_id = p_league_id
    and user_id = auth.uid();

  if not found then
    raise exception 'You are not a member of that league.';
  end if;

  return jsonb_build_object(
    'league_id', p_league_id,
    'archived', v_archived_at is not null,
    'archived_at', v_archived_at
  );
end;
$$;

create or replace function public.delete_my_league(
  p_league_id uuid,
  p_confirmation text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_league_name text;
  v_created_by uuid;
  v_role public.membership_role;
  v_member_count integer;
  v_season_count integer;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select league.name, league.created_by, membership.role
  into v_league_name, v_created_by, v_role
  from public.leagues league
  left join public.league_memberships membership
    on membership.league_id = league.id
   and membership.user_id = v_user_id
  where league.id = p_league_id
  for update of league;

  if v_league_name is null then
    raise exception 'That league no longer exists.';
  end if;
  if v_created_by is distinct from v_user_id
     or v_role is distinct from 'commissioner'::public.membership_role then
    raise exception 'Only the original league commissioner can permanently delete this league.';
  end if;
  if btrim(coalesce(p_confirmation, '')) <> v_league_name then
    raise exception 'Type the exact league name to confirm permanent deletion.';
  end if;

  select count(*)
  into v_member_count
  from public.league_memberships
  where league_id = p_league_id;

  select coalesce(
    jsonb_array_length(coalesce(snapshot.state -> 'seasonHistory', '[]'::jsonb)),
    0
  ) + 1
  into v_season_count
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id;
  v_season_count := greatest(1, coalesce(v_season_count, 1));

  insert into public.deleted_league_audit (
    league_id,
    league_name,
    deleted_by,
    member_count,
    season_count
  )
  values (
    p_league_id,
    v_league_name,
    v_user_id,
    v_member_count,
    v_season_count
  )
  on conflict (league_id) do update
  set league_name = excluded.league_name,
      deleted_by = excluded.deleted_by,
      deleted_at = clock_timestamp(),
      member_count = excluded.member_count,
      season_count = excluded.season_count;

  delete from public.leagues
  where id = p_league_id;

  if not found then
    raise exception 'The league could not be deleted.';
  end if;

  return p_league_id;
end;
$$;

revoke all on function public.set_my_league_archived(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_my_league_archived(uuid, boolean)
  to authenticated;

revoke all on function public.delete_my_league(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_my_league(uuid, text)
  to authenticated;

commit;

notify pgrst, 'reload schema';
