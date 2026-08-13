# DraftCenter owner league operations

## Purpose

`/operations` is a private, owner-only view of new leagues and operational
signals. It does not grant ordinary users access to other leagues. The API
verifies the signed-in email against a server-only allowlist before using the
Supabase service role.

## Production setup

1. Apply `supabase/232-owner-league-operations.sql` once.
2. Set `DRAFTCENTER_OWNER_EMAILS` in Vercel to one or more comma-separated
   DraftCenter account email addresses.
3. Confirm `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`, and the
   Supabase service-role key remain configured server-side.
4. Deploy and sign in with an allowlisted account.
5. Bookmark `https://www.draftcentral.gg/operations`.

Do not expose `DRAFTCENTER_OWNER_EMAILS` through a `NEXT_PUBLIC_*` variable.

## Alerts

- Creating a non-practice league calls the owner alert route immediately.
- A unique delivery key prevents duplicate alerts for the same league and
  recipient.
- Practice leagues appear in League Operations but skip instant email.
- The operations digest runs daily at 14:30 UTC and sends only when a real
  league has at least one attention signal.

## Current attention signals

- unclaimed teams;
- a draft within 48 hours without a ready scheduled-start job;
- failed scheduled-draft automation;
- failed notification deliveries;
- no saved activity for ten days in a live season phase;
- no recorded commissioner backup, or none in the last 30 days.

League Operations also shows privacy-safe operational errors for the last 30
days and highlights the last 24 hours. The daily owner digest includes new
errors alongside league-health warnings.

Spreadsheet and recovery JSON downloads now record only the league, staff user,
backup type, and timestamp. DraftCenter does not upload or inspect the file.

## League Pulse

The owner-only Operations page summarizes real post-draft leagues without
opening them or bypassing membership. Each League Pulse contains only:

- the number of current-season regular-season and playoff results;
- completed free-agent moves and accepted trades, excluding reversed, pending,
  rejected, and cancelled transactions;
- days since the latest meaningful saved activity;
- a season state of awaiting activity, underway, inactive, or complete;
- the number of open support requests; and
- the number of unexpected system failures recorded in the last 30 days.

A completed draft with no result or transaction remains **awaiting season
activity** for 14 days, then becomes **inactive**. Once a result or transaction
exists, recent activity is **season underway** and the same 14-day inactivity
threshold applies. These labels are product-health signals, not commissioner
deadlines or enforcement actions.

League Pulse never returns team names, Pokemon, matchups, scores, managers,
messages, support-request text, error text, or transaction contents. It does
not grant the owner league access and does not notify or alter the league.

## Daily Games participation

Allowlisted owners can open `/operations/daily-three` from the global Daily
Games shortcut. It shows each profile's last Daily Games activity, last full
completion, today's Poll/Bracket/Quiz status, and completion-day counts. The
main `/operations` page separately shows aggregate Pokémon Connections usage:
all-time players and completions, today, trailing 7- and 30-day totals, account
adoption, and a 30-day completion trend. It does not expose Pokémon Connections
completion rows, player names, puzzle groups, guesses, answers, failed boards,
or signed-out play.

The same owner-only page includes the upcoming community editorial calendar.
It previews Daily Games polls and quizzes alongside the separate Question of
the Day schedule. The owner can add or replace content on future dates; live
and historical activities are intentionally locked. Daily Games polls and
quizzes remain Pokemon-only. Question of the Day is human/community-first with
occasional Pokemon prompts, and is delivered only to the dedicated community
channel.

## Current site activity

Operations shows an **Active now estimate** from the existing Vercel Web
Analytics integration. It counts anonymized visitors who loaded or navigated a
public DraftCenter page during the previous five minutes. It is not a precise
connected-user census: someone who leaves can remain in the window briefly,
and someone who keeps one page open for more than five minutes without
navigating can fall out of it. Known bots, `/operations`, and private workspace
paths are excluded. The count uses Vercel's daily-reset visitor hashes and does
not add cookies, heartbeats, account linkage, or page-level identity to
Operations. The live estimate is cached for one minute; historical traffic
retains its five-minute cache.

## Configuration support access

League Operations never turns platform ownership into silent private-league
access. Migration `233-temporary-support-access.sql` creates support grants and
their audit log. Commissioners manage them in Commissioner Tools without adding
the owner as a league member or co-commissioner.

Support sessions last 24 hours, 3 days, or 7 days, expire automatically, and
can be revoked immediately. Commissioners can approve review-only access.
Only the primary commissioner can approve the stronger **Review and edit
tiers/pricing** scope.

The pricing scope is consumed only by a guarded server importer. It can update
`settings.costOverrides` and `settings.priceTierMax`; it cannot manage members,
drafts, rosters, messages, results, or other settings. The update requires the
exact league name, rejects a stale snapshot revision, creates a private
`pre_support_edit` recovery point, applies the changes, and records every
changed Pokémon in the support audit log in one database transaction.

Operations shows the grant scope and expiration and opens the appropriate
support view. Approval, each view, pricing changes, and revocation are recorded.
Support responses continue to exclude private notebooks, direct messages,
notification preferences, Discord data, and personal notes.

## Verification

Create a practice league first and confirm it appears without sending email.
Then create a temporary non-practice league and confirm exactly one email per
configured owner recipient. Download both backup types and refresh Operations;
the newest timestamp should appear. Delete temporary leagues through the normal
commissioner workflow when testing is complete.

## Automatic recovery history

Migration `235-automatic-league-recovery-history.sql` seeds an initial private
recovery point for every league. When league state changes, DraftCentral keeps
at most one automatic point per six-hour window and removes points older than
30 days. Commissioners review and restore these in League Tools. A restore
first preserves the current state and uses a revision check so a stale recovery
screen cannot overwrite newer activity.
