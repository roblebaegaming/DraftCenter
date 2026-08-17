-- Migration 358: allow season and organization cleanup to remove locked
-- qualification candidates before their source pod disappears. Migration 356
-- is already present on the retained Preview branch, so this is forward-only.

begin;

alter table public.league_organization_qualification_candidates
  drop constraint league_organization_qualifica_pod_id_season_id_source_leag_fkey;

alter table public.league_organization_qualification_candidates
  add constraint league_organization_qualifica_pod_id_season_id_source_leag_fkey
  foreign key (pod_id, season_id, source_league_id)
  references public.league_organization_pods(id, season_id, league_id)
  on delete cascade;

notify pgrst, 'reload schema';

commit;
