# Standalone tournaments

DraftCenter's first standalone tournament release is a single-elimination
organizer. It is separate from league playoffs, Daily Three brackets, and the
Nuzlocke catalog.

## Release status

The first release is live in production. Pull request 47 deployed application
commit `cd90679` and forward-only migration
`340-standalone-single-elimination-tournaments.sql` on August 6, 2026. The
production schema, RLS policies, grants, empty public directory, signed-out
route, and post-deployment smoke sweep were verified without creating a
production tournament.

The tournament schema remains independent of the Nuzlocke catalog and league
tables. Any future database change requires a new forward-only migration;
never rewrite migration 340.

## First-release lifecycle

1. A signed-in commissioner creates a public or private best-of-one or
   best-of-three event with 2–64 entrant slots.
2. Entrants register with a display name and may attach one of their private
   saved teams. Commissioners may also enter their own event.
3. Commissioners assign manual seeds, swap occupied seeds, or use the
   deterministic shuffle action.
4. Locking registration creates stable relational rounds, matches, bye
   advancement, and explicit winner destinations.
5. A participant reports a completed score with optional HTTPS replays and an
   MVP. The opponent or commissioner confirms or rejects it.
6. Confirmation locks the submission, current match, and next match; checks the
   expected revision; records the result; and advances exactly one winner in a
   single transaction. An authorized retry is idempotent.
7. A commissioner may correct a confirmed result only before its downstream
   match is reported or completed. The correction replaces the exact bracket
   slot, advances both match revisions, and records an audit event.
8. Completed tournaments, or tournaments still in registration, may be
   archived without deleting bracket history.

## Privacy and authorization

- Browser clients receive no direct table-write grants. Mutations use bounded
  security-definer functions, while every tournament table has RLS enabled.
- Public spectators use explicit JSON projections that omit account IDs,
  private-team IDs, registration hashes, and audit records.
- Private registration codes use 128 bits of cryptographic randomness, are
  generated once, stored only as SHA-256 hashes,
  and can be rotated by the owner while registration is open.
- Invite links carry the code in a URL fragment. Fragments are not sent in HTTP
  requests, keeping the bearer code out of normal server request logs and
  referrer data.
- After registration locks, an invite code no longer grants private spectator
  access. Owners and registered entrants continue through their signed-in
  account.

## Required isolated validation

The transactional isolated-database matrix covers private best-of-one, public
best-of-three, byes, idempotent confirmation, correction, blocked downstream
correction, archived read-only enforcement, and the public projection.

Verify private isolation, public projections, manual and shuffled seeds, byes,
stale and simultaneous submissions, opponent confirmation, idempotent retry,
safe correction, archive behavior, refresh/interruption recovery, keyboard and
screen-reader behavior, and mobile brackets at both small and large field
sizes. Record the exact disposable fixture and verify its cleanup afterward.

Before opening test registration, run `npm run test:tournament-fixture` with
`TOURNAMENT_TEST_SUPABASE_URL`,
`TOURNAMENT_TEST_SUPABASE_PUBLISHABLE_KEY`, and the exact
`TOURNAMENT_TEST_EXPECTED_PROJECT_HOST` for the disposable project. Set
`TOURNAMENT_TEST_CONFIRM_ISOLATED=yes` only after independently confirming
that exact project. The readiness check calls only the bounded directory and a
missing-slug workspace projection; it performs no mutation and does not print
credentials or returned tournament data.

On August 7, the dedicated PR-39 isolated Preview repeated the lifecycle with
four disposable identities. It verified private invite isolation, three-person
bye advancement, manual seed swapping, randomized seeding, invite expiry after
lock, unauthorized and malformed result rejection, reject/resubmit, stale
revision rejection, opponent confirmation, idempotent retry, safe correction,
blocked correction after a downstream report, completed-final correction,
archive enforcement, public best-of-three projection, and bounded replay
evidence. Signed-out desktop and 390-by-844 browser reviews showed the public
archived bracket, kept the private event out of the directory, and produced no
console warnings or page-level horizontal overflow.

The same Preview was then refreshed from current `main` and exercised through
normal signed-in application sessions with three new disposable identities.
The owner created a private best-of-three event, all three users registered,
the bracket rendered its bye, an incomplete 1-0 report was rejected, a valid
2-0 report waited for the opponent, and the bracket advanced only after the
opponent confirmed. An authorized server-side correction followed by the
page's Refresh control changed the still-open correction fields from 2-0 to
0-2 without a full reload. The signed-in 390-by-844 view had no page-level
horizontal overflow and the browser console remained clear.

The automated browser opened the shuffle confirmation but its JavaScript
dialog adapter could not accept that prompt reliably. Randomized seeding and
bracket locking were therefore completed through the same authenticated RPCs
and verified in the rendered owner workspace. Keep commissioner confirmation
dialogs, keyboard flow, and screen-reader announcements in the manual browser
release review.

Cleanup verification returned zero tournament, entrant, registration-code,
match, submission, audit-event, and disposable-profile rows for the exact
fixtures, zero disposable authentication users, and the empty signed-out
directory. No production record was created or changed.

The combined release Preview is not a valid tournament fixture because its
connected database does not expose the tournament RPCs. Use the dedicated
isolated tournament Preview instead. The Turnstile widget can still show an
automation-only warning in the in-app browser, but normal Preview sign-in
completed without changing Cloudflare configuration or authentication policy.

Do not use a real league or production tournament for lifecycle testing. The
production smoke sweep is only valid after an authorized deployment.

## Deliberately deferred formats

Round robin, double elimination, and Swiss remain deferred until this release
has production evidence. League-standings seeding and active-bracket entrant
substitution, drop, disqualification, and explicit forfeit workflows are also
outside this first release; do not simulate them with direct database edits.

## Strengthening sequence

Tournament development proceeds in small releases from the current production
baseline:

1. Finish single-elimination hardening: accessible in-page confirmations,
   keyboard and screen-reader structure, selectable rounds, 64-entrant mobile
   behavior, and the isolated-fixture readiness guard.
2. Add commissioner recovery before another bracket type. Explicit forfeits,
   disqualifications, drops, and safe entrant replacement require bounded
   owner-only RPCs, optimistic revision checks, audit events, and a new
   forward-only migration. Do not overload result correction or edit bracket
   tables directly to simulate these actions.
3. Add double elimination as the next standalone format, in its own release,
   only after recovery behavior is proven. Do not combine it with round robin
   or Swiss.
4. Build the planned **Draft Tournament** as a tournament-facing workflow that
   reuses the existing league draft engine. Its phases are registration,
   drafting, roster lock, Swiss play, optional single-elimination top cut, and
   completion. Swiss remains deferred until this phase rather than being added
   prematurely as an unrelated standalone format.
5. Freeze broad feature development after the agreed tournament work and shift
   to monitoring, bug fixes, live-draft performance, organizer feedback, and
   external Search Console and Semrush measurement.

The Draft Tournament must not duplicate league drafting tables or ask users to
pretend a short event is a full league. The primary entry point belongs under
Tournaments, while an existing league may later expose **Create tournament
from this league** to carry its members and rosters into the same competition
workflow.
