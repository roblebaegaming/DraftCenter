-- Read-only, privacy-conscious rehearsal health report.
with params as (
  select 'concurrency-rehearsal-jul-27-9nnn5'::text as league_slug
),
target as (
  select league.id, league.name
  from public.leagues league
  join params on params.league_slug = league.slug
),
membership_health as (
  select
    count(*) filter (where membership.role = 'commissioner') as commissioners,
    count(*) filter (
      where membership.role in ('coach', 'commissioner', 'co_commissioner')
    ) as managers
  from public.league_memberships membership
  join target on target.id = membership.league_id
  where membership.archived_at is null
),
team_health as (
  select
    count(*) as teams,
    count(*) filter (where team.owner_membership_id is not null) as claimed_teams,
    count(distinct team.owner_membership_id)
      filter (where team.owner_membership_id is not null) as distinct_owners
  from public.teams team
  join target on target.id = team.league_id
),
notification_health as (
  select
    count(*) filter (
      where event.sent_at is null and event.failed_at is null
    ) as pending_notifications,
    count(*) filter (
      where event.sent_at >= now() - interval '24 hours'
    ) as completed_last_24h,
    count(*) filter (
      where event.failed_at >= now() - interval '24 hours'
    ) as failed_last_24h
  from public.notification_events event
  join target on target.id = event.league_id
)
select
  target.name as league_name,
  membership_health.commissioners,
  membership_health.managers,
  team_health.teams,
  team_health.claimed_teams,
  team_health.distinct_owners,
  notification_health.pending_notifications,
  notification_health.completed_last_24h,
  notification_health.failed_last_24h,
  now() as checked_at
from target
cross join membership_health
cross join team_health
cross join notification_health;
