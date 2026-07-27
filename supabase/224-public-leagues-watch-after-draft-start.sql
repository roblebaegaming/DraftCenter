-- Once a public league begins drafting, move it from Open to Join to
-- Open to Watch everywhere. This also closes the public join RPC.

begin;

create or replace function public.move_started_public_league_to_watch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.state ->> 'locked')::boolean, false) then
    update public.leagues
    set league_visibility = 'watch',
        is_public = true,
        updated_at = now()
    where id = new.league_id
      and league_visibility = 'open';
  end if;
  return new;
end;
$$;

revoke all on function public.move_started_public_league_to_watch()
  from public, anon, authenticated;

drop trigger if exists league_moves_to_watch_after_draft_start
  on public.league_state_snapshots;
create trigger league_moves_to_watch_after_draft_start
after insert or update of state on public.league_state_snapshots
for each row
execute function public.move_started_public_league_to_watch();

-- Correct any public drafts that were already underway before this trigger.
update public.leagues league
set league_visibility = 'watch',
    is_public = true,
    updated_at = now()
from public.league_state_snapshots snapshot
where snapshot.league_id = league.id
  and league.league_visibility = 'open'
  and coalesce((snapshot.state ->> 'locked')::boolean, false);

create or replace function public.update_league_access(
  p_league_id uuid,
  p_visibility text,
  p_is_practice boolean default false,
  p_practice_expires_at timestamptz default null
)
returns public.leagues
language plpgsql security definer set search_path = public
as $$
declare v_league public.leagues; v_visibility text;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can update league access.'; end if;
  v_visibility := lower(trim(p_visibility));
  if v_visibility not in ('private', 'watch', 'open') then raise exception 'Choose private, watch, or open.'; end if;
  if v_visibility = 'open' and exists (
    select 1
    from public.league_state_snapshots
    where league_id = p_league_id
      and coalesce((state ->> 'locked')::boolean, false)
  ) then
    v_visibility := 'watch';
  end if;
  update public.leagues set league_visibility = v_visibility, is_public = v_visibility <> 'private',
    is_practice = coalesce(p_is_practice, false), practice_expires_at = case
      when coalesce(p_is_practice, false) then coalesce(p_practice_expires_at, now() + interval '30 days') else null end,
    updated_at = now()
  where id = p_league_id returning * into v_league;
  return v_league;
end;
$$;

create or replace function public.join_open_league(p_slug text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to join a league.'; end if;
  select league.id into v_league_id
  from public.leagues league
  left join public.league_state_snapshots snapshot on snapshot.league_id = league.id
  where league.slug = p_slug
    and league.league_visibility = 'open'
    and not coalesce((snapshot.state ->> 'locked')::boolean, false);
  if v_league_id is null then raise exception 'This league is now open to watch because its draft has started.'; end if;
  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'coach') on conflict (league_id, user_id) do nothing;
  return v_league_id;
end;
$$;

commit;

notify pgrst, 'reload schema';
