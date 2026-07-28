-- Read-only ownership consistency check.
-- Change only the slug in params when intentionally checking another league.
with params as (
  select 'concurrency-rehearsal-jul-27-9nnn5'::text as league_slug
),
target as (
  select league.id
  from public.leagues league
  join params on params.league_slug = league.slug
),
snapshot_teams as (
  select
    entry.ordinality - 1 as team_index,
    entry.team ->> 'name' as team_name,
    nullif(entry.team ->> 'claimedByUserId', '')::uuid as snapshot_user_id
  from public.league_state_snapshots snapshot
  join target on target.id = snapshot.league_id
  cross join lateral jsonb_array_elements(snapshot.state -> 'teams')
    with ordinality as entry(team, ordinality)
),
relational_teams as (
  select
    team.source_key::integer as team_index,
    membership.user_id as relational_user_id
  from public.teams team
  join target on target.id = team.league_id
  left join public.league_memberships membership
    on membership.id = team.owner_membership_id
  where team.source_key ~ '^[0-9]+$'
)
select
  snapshot.team_index,
  snapshot.team_name,
  snapshot.snapshot_user_id,
  relational.relational_user_id,
  case
    when snapshot.snapshot_user_id is null
      and relational.relational_user_id is null then 'open'
    when snapshot.snapshot_user_id = relational.relational_user_id then 'consistent'
    else 'mismatch'
  end as ownership_status
from snapshot_teams snapshot
left join relational_teams relational using (team_index)
order by snapshot.team_index;
