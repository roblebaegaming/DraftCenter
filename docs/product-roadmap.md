# DraftCenter product roadmap

This roadmap preserves the current feature freeze. Reliability, privacy,
permissions, recovery, data portability, mobile usability, and the complete
league lifecycle come before new product areas.

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
