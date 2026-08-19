begin;

-- The event link is installed only after the private draft room and its state
-- snapshot already exist. Sync the regulation into that canonical snapshot,
-- but do not touch leagues.settings after the link is visible: the existing
-- draft-room guard correctly treats that relational settings row as locked.
create or replace function public.sync_draft_tournament_regulation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regulation_id text;
begin
  if new.draft_league_id is null
     or new.draft_league_id is not distinct from old.draft_league_id then
    return new;
  end if;

  select tournament.regulation_id into v_regulation_id
  from public.tournaments tournament
  where tournament.id = new.tournament_id;

  update public.league_state_snapshots
  set state = jsonb_set(state, '{settings,regulationId}', to_jsonb(v_regulation_id), true),
      revision = revision + 1,
      updated_at = now()
  where league_id = new.draft_league_id;

  return new;
end;
$$;

revoke all on function public.sync_draft_tournament_regulation()
from public, anon, authenticated, service_role;
grant execute on function public.sync_draft_tournament_regulation()
to service_role;

comment on function public.sync_draft_tournament_regulation()
is 'Copies a Draft Tournament regulation into the newly linked private room snapshot without mutating guarded room settings.';

commit;

notify pgrst, 'reload schema';
