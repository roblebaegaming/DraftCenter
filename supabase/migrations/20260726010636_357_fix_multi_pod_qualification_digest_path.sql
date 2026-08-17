-- Migration 357: expose pgcrypto only to the qualification functions that hash
-- rosters. Migration 356 has already run in the retained Preview branch, so
-- this correction is forward-only rather than rewriting that migration.

begin;

alter function public.lock_league_organization_pod_standings(uuid, bigint)
  set search_path = public, extensions;
alter function public.sync_league_organization_qualifier_manager(uuid)
  set search_path = public, extensions;

notify pgrst, 'reload schema';

commit;
