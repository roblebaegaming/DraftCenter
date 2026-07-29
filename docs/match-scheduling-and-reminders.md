# Match scheduling and configurable reminders

## Release boundary

The feature is disabled unless
`NEXT_PUBLIC_MATCH_SCHEDULING_ENABLED=true`. Enable it only in the isolated
Preview environment until the two-user rehearsal and teardown gates pass.
Production must leave the variable unset or set it to `false`.

The feature adds dedicated schedule and preference records. It does not rewrite
the league snapshot schedule, results, tournament tables, or existing Discord
notification configuration.

## Scheduling contract

- Either scheduled manager may propose a match time within the configured match
  week. Times are stored as UTC instants and displayed in each viewer's local
  time zone.
- The opposing manager must accept a proposal. A manager cannot accept their
  own proposal.
- Either manager may replace a pending proposal. Replacing or cancelling a
  proposal increments its revision and removes only unsent reminder events for
  that match.
- Either manager may cancel a confirmed time. The match returns to an auditable
  cancelled state and must be proposed and accepted again.
- League staff may confirm, reschedule, or cancel a match as a judge override.
  Overrides record the acting user and a required reason.
- Availability remains private. Raw windows are visible only to their owner;
  opponents see intersections. A proposal does not disclose either manager's
  raw availability.
- Completed match results remain authoritative. Scheduling never edits or
  deletes results.

## Reminder contract

- Preferences belong to the user, not the match.
- Defaults are enabled with reminders 24 hours and 1 hour before a confirmed
  match.
- Supported offsets are 48 hours, 24 hours, 2 hours, and 1 hour. A user may
  select up to four unique offsets.
- Delivery state belongs to a specific schedule revision. Confirming or
  rescheduling creates new dedupe keys; obsolete unsent events are removed.
- Reminders already sent remain as operational evidence and are never reused.
- Personal Discord delivery still requires the user's existing opt-in Discord
  connection and obeys quiet hours.

## Rehearsal and rollback gates

Before Production consideration, verify two-user proposal and acceptance,
self-accept rejection, staff override, time-zone display, cancellation,
rescheduling, duplicate prevention, quiet hours, and recovery export.

Rollback in the isolated project must leave zero synthetic schedules and
reminder jobs after teardown while leaving league results, availability, user
identities, and existing notification configuration intact.

League staff can export privacy-bounded schedule, preference, and delivery-state
records before teardown. The recovery export excludes secret configuration,
Discord tokens, authorization data, raw availability, and notification error
text. The isolated rehearsal teardown RPC removes scheduling records and their
match-reminder events; participant preferences are removed only when its
explicit boolean argument is `true`.
