-- Give tournament operators a guarded permanent-delete path alongside the
-- existing history-preserving archive action. Deletion removes a private
-- Draft Tournament room atomically and refuses active or organization-linked
-- competition.

begin;

create or replace function public.delete_tournament(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_draft_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete a tournament.';
  end if;

  select * into v_tournament
  from public.tournaments tournament
  where tournament.id = p_tournament_id
  for update;
  if not found or v_tournament.owner_id <> auth.uid() then
    raise exception 'Only the tournament owner can delete it.';
  end if;
  if v_tournament.revision <> p_expected_revision then
    raise exception 'The tournament changed. Refresh before deleting it.';
  end if;
  if v_tournament.status = 'active' then
    raise exception 'Live tournaments cannot be deleted. Finish the event first.';
  end if;
  if exists (
    select 1
    from public.league_organization_championships championship
    where championship.tournament_id = p_tournament_id
  ) then
    raise exception 'Connected championships must be managed from the organization workspace.';
  end if;

  select * into v_event
  from public.draft_tournament_events event
  where event.tournament_id = p_tournament_id
  for update;
  if found then
    v_draft_league_id := v_event.draft_league_id;
    update public.draft_tournament_events
    set draft_session_id = null,
        draft_league_id = null,
        updated_at = now()
    where id = v_event.id;

    if v_draft_league_id is not null then
      delete from public.leagues league
      where league.id = v_draft_league_id
        and league.workspace_kind = 'draft-tournament';
    end if;
  end if;

  delete from public.tournaments tournament
  where tournament.id = p_tournament_id;
  if not found then
    raise exception 'The tournament changed. Refresh before deleting it.';
  end if;
end;
$$;

comment on function public.delete_tournament(uuid, bigint) is
  'Permanently deletes an owner-controlled non-live tournament and its dependent records. Draft-first deletion also removes the internal draft room; organization championships are excluded.';

revoke all on function public.delete_tournament(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.delete_tournament(uuid, bigint)
to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
