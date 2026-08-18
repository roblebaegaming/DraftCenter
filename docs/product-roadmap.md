# DraftCenter product roadmap

DraftCenter's current advantage is its connected organizer-to-player
lifecycle, not raw feature count. Reliability, privacy, recovery, portability,
mobile usability, activation, and completed real seasons come before another
broad product area. The detailed competitive rationale and 30-day sequence are
in the
[`competitive lead and growth handoff`](handoffs/DraftCenter-agent-handoff-2026-08-18-competitive-lead-and-growth.md).

## Current release and growth sequence

Tournament strengthening, Swiss, 4–32-manager Auction Draft Tournaments,
multi-pod organizations, prediction publishing, Legends: Z-A, Team Sheets, and
organization communication are released. The current sequence is:

1. Make the commissioner path understandable in under one minute: one promise,
   plain-language presets, a safe practice path, and a setup checklist ending
   at a scheduled or started draft.
2. Publish one reviewed import template and a safe preview-before-write path
   for commissioners moving an existing league from spreadsheets.
3. Add confirmed Showdown replay-to-result automation with participant,
   duplicate, conflict, authorization, and audit safeguards.
4. Recruit an owner-approved lighthouse group and measure leagues reaching a
   scheduled draft, completed draft, first result, week-two activity, and
   completed season.
5. Continue reliability, export, restore, permissions, mobile, and live-draft
   hardening before choosing another expansion.

## Released flagship: multi-pod league organizations

Multi-pod league organizations and connected championships are live. Treat
them as a stabilization and adoption surface, not a future build. Qualifying
teams retain their exact regular-season rosters, and duplicate Pokémon across
pods remain legal when those teams meet in the championship.

The durable product and data contract remains in
[`multi-pod-league-organizations.md`](multi-pod-league-organizations.md), with
the organizer-facing flow in
[`multi-pod-organizer-guide.md`](multi-pod-organizer-guide.md). Multi-pod
seasons keep their existing round-robin and connected-championship workflow;
ordinary-league Swiss remains one 4–16-team table rather than combining two
scheduling models.

## Current hardening priorities

1. Test and document database backup and recovery, including who can restore,
   how often backups are created, retention, and a practiced recovery drill.
2. Verify league spreadsheet and recovery-file exports against completed
   snake, budgeted snake, auction, playoff, archived, and second-season data.
3. Add private account data export so a user can download their profile,
   preferences, personal teams, planning entries, notebooks, league
   memberships, and intentionally user-owned activity without exposing other
   members' private data.
4. Add My Teams export in a readable format and a restorable private format.
5. Make backup ownership and status clear in the interface: manual download,
   last successful export, what is included, and what requires the site owner
   to restore.
6. Continue multi-account permission, draft, result, archive, reconnect, and
   mobile testing from the launch stabilization checklist.

## Post-freeze utility: personal calendar

After the core product and recovery process are proven, add a private,
account-wide calendar alongside My Teams.

Initial scope:

- Agreed league match times, tied to the relevant league matchup.
- Personal reminders and notes.
- Local events, regional events, and other competitive events.
- Time-zone-aware start and end times.
- Clear private, league-visible, and public visibility choices.
- Calendar-file export so users can add events to their existing calendar.
- Mobile-first agenda and month views.

Later possibilities:

- Match-time proposals and opponent confirmation.
- Commissioner deadlines and league-wide events.
- Curated event discovery with source and last-verified timestamps.
- Optional reminders and external-calendar synchronization.

The first calendar release should not attempt two-way synchronization or a
large public event directory until privacy, conflict handling, event sourcing,
and update ownership are defined.
