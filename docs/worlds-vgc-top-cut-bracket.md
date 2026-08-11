# 2026 VGC Masters Top Cut bracket challenge

DraftCenter has a configurable Top Cut prediction challenge at
`/worlds/2026/vgc/bracket`. The infrastructure is deliberately seeded with no
field, size, seeds, deadline, or pairings. The official 2026 competitor page
still says more competitor information is coming, so none of those details are
safe to infer from prior Worlds events, Swiss standings, the invite-earned
roster, or promotional copy.

The challenge is deployed through pull request
[#128](https://github.com/roblebaegaming/DraftCenter/pull/128) and production
feature commit `e5dca23b9da09d3a557e485443e7dc5a207b4e20`. The safe setup
draft download and event-day operating package shipped through pull request
[#130](https://github.com/roblebaegaming/DraftCenter/pull/130) and current
production application commit `eb951de33bd4ace0463cb9ea57fab9a0e460b188`.
Forward-only migration 372 is applied to the exact core production project.
Production remains in `waiting_for_official_bracket` state with no slots or
entries. No provider, scheduler, fictional field, or environment value was
added.

## Public lifecycle

The challenge has six visible states:

1. **Ready for the official field**: the route explains that the infrastructure
   is ready, but exposes no fictional names or pairings.
2. **Official bracket published**: the reviewed field exists, but the configured
   entry window has not opened.
3. **Bracket entries are open**: signed-in members predict every match in a
   complete single-elimination tree. Changing an early winner clears choices
   that no longer follow that player.
4. **Bracket entries are locked**: other members' brackets become visible and
   no entry can be created or edited.
5. **Top Cut scoring is live**: each reviewed match winner automatically scores
   every saved entry.
6. **Top Cut results are final**: the field, results, scores, and audit trail are
   preserved.

Before lock, the public RPC returns aggregate entry count, display names, ranks,
and scores, but another user's `picks` value is `null`. A signed-in member may
always retrieve their own bracket. Direct browser access to all five bracket
tables is revoked.

## Official-field activation

The owner-only League Operations page is the activation boundary. Once the
official VGC Masters Top Cut is announced:

1. Choose the published power-of-two field size: Top 4, 8, 16, 32, or 64.
2. Set the opening time and a lock before the first Top Cut match.
3. Add the public official bracket URL and the time it was checked.
4. Set one whole-number point value for every round. The form initially offers
   progressive `1 / 2 / 4 / ...` weights, but the owner must review the displayed
   contract before publication.
5. Fill the first-round slots from the existing 438-player VGC Masters roster,
   including official seeds when the source provides them. Every roster slug,
   bracket slot, competitor, and supplied seed must be unique.
6. Type `PUBLISH OFFICIAL TOP CUT` and publish once.

The same form can load a reviewable JSON setup file to reduce announcement-day
data entry. The supported shape is:

```json
{
  "bracket_size": 8,
  "opens_at": "ISO-8601 timestamp",
  "locks_at": "ISO-8601 timestamp",
  "source_url": "official HTTPS bracket URL",
  "source_checked_at": "ISO-8601 timestamp",
  "round_points": { "1": 1, "2": 2, "3": 4 },
  "participants": [
    { "slot": 1, "competitor_slug": "reviewed-roster-slug", "source_seed": 1 }
  ]
}
```

The example describes the schema only; it is not a usable field. A valid file
must include every slot and unique competitor for the chosen size. Loading a
file changes only the local form. The owner still reviews it and performs the
explicit publication action.

After choosing the official field size in Operations, **Download setup JSON**
creates a reviewable blank or partially completed draft with every required
slot and the default progressive round weights. Empty source, time, competitor,
and seed fields make no event claims and cannot be published. The owner can
complete the file offline, load it back, verify every resolved roster name, and
then use the existing typed publication confirmation. The announcement-day
procedure is in
[`worlds-vgc-top-cut-announcement-checklist.md`](worlds-vgc-top-cut-announcement-checklist.md).

Once any member saves an entry, the published field cannot be replaced. That
prevents a source correction from silently changing the meaning of an existing
prediction. A real post-publication field correction needs a separately
reviewed forward migration and entry-remediation policy.

## Results and automation

After the prediction deadline, the owner can record a reviewed official winner
for each match. The database derives that match's eligible competitors from the
published slots or its two feeder winners, rejects impossible advancement, and
recalculates every leaderboard score through the public read RPC. A correction
is allowed only before a downstream result depends on the old winner.

The live standings importer does **not** infer provisional bracket winners from
placement order. During Swiss and an unfinished Top Cut, ranking order can look
decisive before a match is played. Using it would leak or publish false results.

Automation is safe at the final boundary: when the owner finalizes the immutable
official VGC placement snapshot, the results route calls
`sync_worlds_bracket_from_final_results`. The database walks the published
pairings round by round, compares the two finalists' final placements for each
match, fills every winner, and finalizes the bracket. It fails closed on a
missing, `9999`, or tied placement. The Operations page also exposes the same
backfill as an owner action if a prior finalization needs to be reconciled.

If live match-level data becomes available later, add a narrowly validated
provider adapter that emits exact `(round, match, winner)` records into the
existing result RPC. Do not reuse Swiss placement order as that adapter.

## Database and release evidence

Migration 372 adds five private RLS tables:

- `worlds_bracket_events`
- `worlds_bracket_slots`
- `worlds_bracket_entries`
- `worlds_bracket_results`
- `worlds_bracket_audit_log`

The isolated Preview matrix is
`supabase/tests/372-worlds-vgc-top-cut-bracket-preview-regression.sql`. It must
pass after migrations 369-372 and verifies RLS, browser table denial, RPC
grants, the empty seed, entry validation, pre-lock privacy, field immutability,
pre-lock result denial, provisional-placement automation denial, advancement,
automatic scoring, owner finalization, post-final write denial, and exact
fixture cleanup.

Before the production release:

- apply migrations 371-373 only to an isolated Preview branch;
- run both Preview regression matrices and confirm migration-ledger alignment;
- review the public route signed out and signed in at desktop and narrow mobile
  widths, including a field large enough to exercise horizontal bracket scroll;
- confirm the Operations form with a synthetic reviewed setup in Preview only;
- run the repository's dependency audit, full tests, National Dex verification,
  and optimized build;
- release through a protected pull request, confirm the deployed commit, then
  run the signed-out production smoke sweep.

Those gates passed on a disposable isolated Preview branch and protected pull
request #128. The branch and its fixtures were permanently deleted after
production verification. Applying migration 372 prepared only the empty
infrastructure; it did not authorize publishing a real field, changing
production data, or treating an unofficial source as official. Every future
database change must use a new forward-only migration after 373.
