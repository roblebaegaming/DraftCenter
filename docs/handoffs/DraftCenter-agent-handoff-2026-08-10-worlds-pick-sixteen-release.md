# DraftCenter handoff: 2026 VGC Worlds Pick 16 release

## Live state

The VGC Masters Pick 16 competition is live at
<https://www.draftcentral.gg/worlds/2026>. Pull request
[#116](https://github.com/roblebaegaming/DraftCenter/pull/116) merged as
the original feature release. Pull request
[#118](https://github.com/roblebaegaming/DraftCenter/pull/118) added the
prominent roster-provenance panel and merged as production commit
`a36a514ca93aa7c089d9f53822d9a961d385ffd4`.
Migrations 369 and 370 are applied to the exact core production project.

The August 10 invite-earned snapshot contains 438 Masters competitors. Each
signed-in member may save 16 unique picks and designate one **Ace Pick** whose
placement score counts twice. The scoring curve is 30 / 20 / 12 / 7 / 4 / 2 /
1 from champion through Top 64. Entries lock at `2026-08-28T07:00:00Z`.
Selections other than the current user's remain private before the lock. The
later bracket predictor remains closed until official pairings exist.

## Verified evidence

- The production dependency audit, complete application suite, 1,027-row
  National Dex check, focused Worlds tests, release-integration tests, and
  optimized build passed.
- Protected CodeQL, JavaScript security analysis, dependency/security,
  full-history secret scan, Supabase Preview, and Vercel checks passed.
- The isolated Preview matrix passed all roster, RLS, grants, pre-lock privacy,
  duplicate-entry, validation, lock, Ace-scoring, public-after-lock, and fixture
  cleanup assertions.
- The connected hosted Preview and production page passed desktop and 390px
  mobile review with one H1, all 438 competitors, working selection and Ace
  controls, no horizontal overflow, and no browser warnings or errors.
- Production postflight found one open Masters event, 438 competitors, zero
  entries, RLS on all three tables, denied direct browser table reads, correct
  RPC grants, a 30-point champion, an Ace multiplier of two, and no lingering
  migration session.
- The post-deployment signed-out production smoke sweep passed all public 200
  routes and protected 401 boundaries.
- The source clarification's exact hosted Preview and live page show the
  Victory Road tracker link, August 10 snapshot date, and invite-earned versus
  confirmed-attendance boundary. Desktop and 390px review found no horizontal
  overflow, and pull request #118 passed every protected check.

## Cleanup and preserved boundaries

The disposable `worlds-pick-sixteen-pr-116` Supabase Preview branch was removed
automatically after merge. The retained `multi-pod-pr-82` branch remains
present and untouched. The four temporary Vercel variables scoped only to the
feature branch were removed, and the merged remote feature branch was deleted.

No real league, draft, roster, tournament, user entry, production account, or
production provider setting was changed for testing. Synthetic Preview fixtures
were removed by the committed matrix. The production migration created only
the intended public event and roster seed.

## Next work

1. Refresh the static roster with
   `scripts/build-worlds-2026-roster.mjs` when the invite tracker changes.
   Review every count change and publish any production roster correction as a
   new forward-only migration after 370.
2. Do not call invite-earned competitors confirmed attendees, and continue to
   exclude Junior and Senior divisions. Masters is not an adult-only guarantee;
   do not collect or infer private birth dates.
3. Keep the bracket challenge closed until official pairings are published.
   Use the real bracket rather than inventing seeds, byes, or matchups.
4. Record final results and score production entries only from an official
   published source and with explicit production authorization.
5. The next comparable predictor can target Pokémon TCG Masters, followed by
   Pokémon GO and Pokémon UNITE after their roster units and age-safety
   boundaries are defined.

The stable product and operating detail remains in
[`docs/worlds-2026-pick-sixteen.md`](../worlds-2026-pick-sixteen.md). The
canonical release summary is [`docs/CURRENT-STATUS.md`](../CURRENT-STATUS.md).
