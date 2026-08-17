# DraftCenter product roadmap

This roadmap preserves the current feature freeze. Reliability, privacy,
permissions, recovery, data portability, mobile usability, and the complete
league lifecycle come before new product areas.

## Current release sequence

Tournament strengthening, Draft Tournament Swiss, ordinary-league Swiss, and
4–32-manager Auction Draft Tournaments are complete through migration 428:

1. Stabilize ordinary-league Swiss and tournament auction workflows through
   real commissioner feedback and isolated lifecycle testing.
2. Complete the already reviewed prediction-publisher, Legends: Z-A, Team
   Sheet, and organization-communication backlog as separate protected
   releases.
3. Return to monitoring, bug fixes,
   live-draft performance, tournament feedback, and external SEO measurement.

## Next flagship expansion: multi-pod league organizations

After the stabilization period, the preferred major league expansion is an
organization season containing multiple independent league pods and one shared
championship. Each pod uses the existing draft, roster, schedule, standings,
transaction, and replacement systems. Qualifying teams retain their exact
regular-season rosters, and duplicate Pokemon across pods remain legal when
those teams meet in the championship.

Build this in staged releases: organization and season infrastructure,
commissioner workspace and shared regulations, qualification review, connected
championships, then public organization history and community features. The
detailed product and data contract is in
[`multi-pod-league-organizations.md`](multi-pod-league-organizations.md). The
organizer-facing flow and configurable choices are summarized in
[`multi-pod-organizer-guide.md`](multi-pod-organizer-guide.md).

Multi-pod seasons continue to use their existing round-robin and connected-championship workflow. The first ordinary-league Swiss release deliberately remains one 4–16 team table rather than combining two new scheduling models at once.

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
