-- DraftCenter public discovery milestone
-- Run after 003-league-hub-and-state-bridge.sql.

create or replace function public.join_public_league(p_slug text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to join a league.'; end if;
  select id into v_league_id from public.leagues where slug = p_slug and is_public = true;
  if v_league_id is null then raise exception 'That public league was not found.'; end if;
  insert into public.league_memberships(league_id, user_id, role)
    values (v_league_id, auth.uid(), 'viewer')
  on conflict (league_id, user_id) do nothing;
  return v_league_id;
end; $$;

grant execute on function public.join_public_league(text) to authenticated;
