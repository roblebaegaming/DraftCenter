-- My Teams saved report links and explicit public attachment permissions.
-- Planning-entry links remain inside the existing owner-only JSON payload.

begin;

alter table public.personal_teams
  add column if not exists team_report_url text,
  add column if not exists share_pokepaste boolean not null default false,
  add column if not exists share_replica_code boolean not null default false,
  add column if not exists share_team_report boolean not null default false;

create or replace function public.get_public_team_repository(
  p_regulation_id text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with shared as (
    select
      team.id,
      team.team_name,
      team.league_name,
      team.format_name,
      team.regulation_id,
      team.public_summary,
      team.pokemon,
      case when team.share_pokepaste then team.pokepaste_url else null end as pokepaste_url,
      case when team.share_replica_code then nullif(team.replica_code, '') else null end as replica_code,
      case when team.share_team_report then team.team_report_url else null end as team_report_url,
      team.workspace_type,
      team.updated_at,
      profile.username,
      profile.display_name,
      profile.avatar_url
    from public.personal_teams team
    join public.profiles profile on profile.id = team.owner_id
    where team.is_public
      and not team.archived
      and jsonb_array_length(team.pokemon) > 0
      and (
        nullif(btrim(coalesce(p_regulation_id, '')), '') is null
        or team.regulation_id = p_regulation_id
      )
    order by team.updated_at desc, team.team_name
    limit least(100, greatest(1, coalesce(p_limit, 100)))
  ), regulations as (
    select regulation_id, count(*)::integer as team_count
    from public.personal_teams
    where is_public and not archived and regulation_id is not null
      and jsonb_array_length(pokemon) > 0
    group by regulation_id
    order by regulation_id
  )
  select jsonb_build_object(
    'teams', coalesce((select jsonb_agg(to_jsonb(shared)) from shared), '[]'::jsonb),
    'regulations', coalesce((select jsonb_agg(to_jsonb(regulations)) from regulations), '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_team_repository(text, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_team_repository(text, integer)
  to anon, authenticated;

commit;

notify pgrst, 'reload schema';
