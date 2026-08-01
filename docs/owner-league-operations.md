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

Spreadsheet and recovery JSON downloads now record only the league, staff user,
backup type, and timestamp. DraftCenter does not upload or inspect the file.

## Daily Three participation

Allowlisted owners can open `/operations/daily-three` from the global Daily
Three shortcut. It shows each profile's last Daily Three activity, last full
completion, today's Poll/Bracket/Quiz status, and completion-day counts. It does
not return poll choices, bracket selections, quiz answers, or correctness.

## Configuration support access

League Operations never turns platform ownership into silent private-league
access. Migration `233-temporary-support-access.sql` creates support grants and
their audit log. Commissioners manage them in Commissioner Tools without adding
the owner as a league member or co-commissioner.

Support sessions are read-only, last 24 hours, 3 days, or 7 days, expire
automatically, and can be revoked immediately. Operations shows the expiration
and opens a dedicated read-only configuration view. Approval, each view, and
revocation are recorded. The support response excludes private notebooks,
direct messages, notification preferences, Discord data, and personal notes.

A later phase may add explicitly scoped editing, but no support grant currently
permits a league change.

## Verification

Create a practice league first and confirm it appears without sending email.
Then create a temporary non-practice league and confirm exactly one email per
configured owner recipient. Download both backup types and refresh Operations;
the newest timestamp should appear. Delete temporary leagues through the normal
commissioner workflow when testing is complete.
