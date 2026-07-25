-- Structured weekly or tournament planning for private external teams.
-- Existing teams remain weekly by default and keep their legacy notes.
begin;

alter table public.personal_teams
  add column if not exists workspace_type text not null default 'weekly',
  add column if not exists planning_entries jsonb not null default '[]'::jsonb;

alter table public.personal_teams
  drop constraint if exists personal_teams_workspace_type_check,
  add constraint personal_teams_workspace_type_check
    check (workspace_type in ('weekly', 'tournament'));

alter table public.personal_teams
  drop constraint if exists personal_teams_planning_entries_check,
  add constraint personal_teams_planning_entries_check
    check (
      jsonb_typeof(planning_entries) = 'array'
      and jsonb_array_length(planning_entries) <= 100
      and octet_length(planning_entries::text) <= 100000
    );

commit;
notify pgrst, 'reload schema';
