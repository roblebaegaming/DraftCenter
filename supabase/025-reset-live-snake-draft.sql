-- DraftCenter milestone 25: commissioner-only reset for a live shared draft.
-- Run after 009-live-snake-draft-provisioning.sql.

create or replace function public.reset_live_snake_draft(p_league_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can reset a live draft.';
  end if;

  -- Clear dependent data first. Teams, manager ownership, league settings,
  -- and the league Pokemon catalogue intentionally remain in place.
  delete from public.roster_entries r
  using public.teams t
  where r.team_id = t.id and t.league_id = p_league_id and r.released_at is null;

  delete from public.draft_picks p
  using public.draft_sessions d
  where p.draft_session_id = d.id and d.league_id = p_league_id;

  update public.league_pokemon
  set is_drafted = false
  where league_id = p_league_id;

  -- Provisioning creates a fresh official session on the next start.
  delete from public.draft_sessions where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (p_league_id, 'draft_reset', auth.uid(), jsonb_build_object('reason', 'commissioner restart'));
end;
$$;

grant execute on function public.reset_live_snake_draft(uuid) to authenticated;
