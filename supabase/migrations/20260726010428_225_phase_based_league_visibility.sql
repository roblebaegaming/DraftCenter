-- Let commissioners choose how league visibility changes when the draft starts.
-- Existing leagues retain the current behavior: Open to Join becomes Open to
-- Watch, while Private and Open to Watch remain unchanged.

begin;

alter table public.leagues
  add column if not exists draft_start_visibility text;

alter table public.leagues
  drop constraint if exists leagues_draft_start_visibility_check;
alter table public.leagues
  add constraint leagues_draft_start_visibility_check
  check (draft_start_visibility is null or draft_start_visibility in ('private', 'watch'));

create or replace function public.update_league_visibility_plan(
  p_league_id uuid,
  p_current_visibility text,
  p_draft_start_visibility text default null
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league public.leagues;
  v_current text := lower(trim(p_current_visibility));
  v_after_start text := nullif(lower(trim(coalesce(p_draft_start_visibility, ''))), '');
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can update league visibility.';
  end if;
  if v_current not in ('private', 'watch', 'open') then
    raise exception 'Choose private, watch, or open.';
  end if;
  if v_after_start is not null and v_after_start not in ('private', 'watch') then
    raise exception 'After the draft starts, choose private or public to watch.';
  end if;

  update public.leagues
  set league_visibility = v_current,
      is_public = v_current <> 'private',
      draft_start_visibility = v_after_start,
      updated_at = now()
  where id = p_league_id
  returning * into v_league;

  return v_league;
end;
$$;

revoke all on function public.update_league_visibility_plan(uuid, text, text)
  from public, anon;
grant execute on function public.update_league_visibility_plan(uuid, text, text)
  to authenticated;

create or replace function public.move_started_public_league_to_watch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visibility text;
begin
  if coalesce((new.state ->> 'locked')::boolean, false)
     and (tg_op = 'INSERT' or not coalesce((old.state ->> 'locked')::boolean, false)) then
    select coalesce(
      draft_start_visibility,
      case when league_visibility = 'open' then 'watch' else league_visibility end
    )
    into v_visibility
    from public.leagues
    where id = new.league_id;

    update public.leagues
    set league_visibility = v_visibility,
        is_public = v_visibility <> 'private',
        updated_at = now()
    where id = new.league_id;
  end if;
  return new;
end;
$$;

revoke all on function public.move_started_public_league_to_watch()
  from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
