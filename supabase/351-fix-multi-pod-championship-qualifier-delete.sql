-- Allow organization cleanup to remove championship entrant mappings before
-- their retained qualifier snapshots. Cross-season identity remains enforced
-- by the same composite foreign key.
begin;

alter table public.league_organization_championship_entrants
  drop constraint league_organization_championship_en_qualifier_id_season_id_fkey;

alter table public.league_organization_championship_entrants
  add constraint league_org_championship_qualifier_fk
  foreign key (qualifier_id, season_id)
  references public.league_organization_qualifiers(id, season_id)
  on delete cascade;

notify pgrst, 'reload schema';

commit;
