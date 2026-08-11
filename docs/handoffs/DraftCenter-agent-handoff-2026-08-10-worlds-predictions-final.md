# DraftCenter handoff: 2026 Worlds Predictions final release

## Local live-scoring and Top Cut implementation update

The automated VGC Masters provisional-scoring option is implemented on the
isolated `codex/worlds-live-scoring-2026-08-10` branch. It adds forward-only
migration 371, bounded PokeData parsing, reviewed fail-closed aliases,
database-backed overlap and content-hash protection, immutable provisional and
final snapshots, last-known-good publication, privacy-safe alerts, owner
operations controls, a manual upload fallback, and public waiting,
**Live — provisional**, stale, and **Final** states.

The same branch now also adds forward-only migration 372 and a configurable VGC
Masters Top Cut challenge at `/worlds/2026/vgc/bracket`. It is seeded with no
field and can accept a reviewed Top 4/8/16/32/64 field through owner Operations
without another code release. Entries follow a complete validated elimination
tree, stay private before the owner-set lock, score automatically from reviewed
match winners, and can backfill only from an owner-finalized placement snapshot.
Provisional Swiss standings are never treated as bracket results. Full detail is
in [`../worlds-vgc-top-cut-bracket.md`](../worlds-vgc-top-cut-bracket.md).

The branch now also promotes Pokémon GO and Pokémon UNITE from disabled hub
cards to real fail-closed source-audit routes at `/worlds/2026/go` and
`/worlds/2026/unite`. Machine-validated source registries lock GO to individual
Trainers and UNITE to 5-on-5 teams. They record the reviewed 220-slot GO
Championship Point base and 15 published UNITE qualification awards without
claiming either count is a final registered field. No names, saved entries,
database events, or result polling were added. The activation boundary is in
[`../worlds-2026-go-and-unite.md`](../worlds-2026-go-and-unite.md).

The owner has now reduced the individual prediction format from 16 picks to 10
and renamed the featured double-scoring choice to **Your Champion**. A
signed-out read-only check of the live VGC page on August 10 showed zero saved
entries. Forward-only migration 373 therefore updates the VGC event to Pick 10,
records the 140-point maximum, and refreshes the save error language. It locks
the entries table and aborts if any VGC entry exists at release time, so a late
submission cannot be silently changed. TCG and GO now carry Pick 10 plus Your
Champion as their post-roster-audit default; UNITE remains team-bracket based.

This is not a production release. Migrations 371-373 have not been applied to any
database, the source is seeded without a feed URL and disabled, no PokeData
permission is assumed, no scheduler/provider setting was added, and no
production data or environment value changed. The implementation and remaining
Preview/release gates are documented in
[`../worlds-vgc-live-scoring.md`](../worlds-vgc-live-scoring.md).

Local branch validation passes the 37-test focused Worlds suite, the complete
application suite, the 1,027-row National Dex verification, the production
dependency audit with no known vulnerabilities, and an optimized 236-page
Preview-scoped build. Signed-out review at 1280px and 390px confirms the Pick
10 and Your Champion VGC interface, the matching TCG and GO defaults, and no
horizontal overflow. The VGC mobile anchor was given a 120px scroll margin so
the Pick 10 heading stays below the sticky site navigation. The final
production-build browser review logged no errors or warnings. This evidence
does not replace the required isolated Supabase Preview matrices for migrations
371-373 or a hosted Preview review before release. Neither the Supabase CLI nor
`psql` is available in this worktree, so no local database migration was run.

## Production state

The 2026 Worlds Predictions hub is live at
<https://www.draftcentral.gg/worlds/2026>. Pull request
[#125](https://github.com/roblebaegaming/DraftCenter/pull/125) merged through
the protected branch as production application commit
`1ef57ebd4cda6a49eb1a68dfcf94be47a1da0f31`. Vercel reports that exact
`main` commit deployed successfully. The post-deployment signed-out smoke sweep
passed all 19 public and protected routes. The latest production migration is
still 370; pull request #125 introduced no database or provider change.

The public route structure is:

- `/worlds/2026`: competition hub, event guide, discipline navigation, and
  discipline/overall leaderboard model;
- `/worlds/2026/vgc`: the live VGC Masters Pick 16 competition;
- `/worlds/2026/tcg`: a deliberately `noindex` Masters-only source-audit and
  build-status page with saving disabled;
- Pokémon GO and Pokémon UNITE: visible as planned, with no production routes,
  prediction controls, or invented roster model.

The unreleased branch adds `/worlds/2026/go` and `/worlds/2026/unite` as
deliberately `noindex` source audits. They do not change the production route
structure above.

The Worlds event card correctly says that the August 28-30 competition weekend
uses Moscone Center and that all finals move to Chase Center on Championship
Sunday. The hub and VGC page use canonical URLs, social metadata, current
sitemap dates, and accurate event, item-list, and breadcrumb structured data.
The indexable hub and VGC routes are in the sitemap; the unfinished TCG route is
not. The local GO and UNITE source-audit routes also stay out of the sitemap.
`llms.txt` describes the public feature and its roster-source boundary.

## VGC competition contract

The August 10 invite-earned snapshot contains 438 VGC Masters competitors.
It cites Victory Road's 2026 invite tracker, which combines Championship Point
standings and qualifying event results. It is not a confirmed registration or
attendance list.

Production currently lets each signed-in DraftCenter member save 16 unique
picks and one **Ace Pick** whose placement points count twice. Other users'
selections remain private
until the entry lock at `2026-08-28T07:00:00Z` (midnight Pacific). The scoring
curve is 30 / 20 / 12 / 7 / 4 / 2 / 1 from World Champion through Top 64.
VGC keeps its raw leaderboard. When at least two disciplines have official
scores, the overall leaderboard normalizes each launched competition to a
maximum of 100 points; a missing entry earns zero.

Only official Masters divisions belong in prediction pools. Junior and Senior
competitors remain excluded. Masters is not an adult-only guarantee, so never
collect or infer private birth dates. The Top Cut route and schema are locally
implemented, but the database seed remains closed until Pokémon publishes real
elimination pairings and the owner reviews the exact field and deadline.

Migrations 369 and 370 remain the authoritative production database
implementation. They
enforce RLS, authenticated RPC writes, the exact Pick 16 and Ace constraints,
pre-lock privacy, the 30-point cap, and the seeded 438-player VGC roster.
The pending branch pairs migration 373 with Pick 10 and Your Champion UI copy;
its maximum raw score is 140. The legacy `ace_slug`, `p_ace_slug`, and
`ace_multiplier` names remain internal compatibility fields and are not shown
as the player-facing label.

## Release sequence

- [#116](https://github.com/roblebaegaming/DraftCenter/pull/116) released the
  database-backed VGC Masters Pick 16 competition.
- [#118](https://github.com/roblebaegaming/DraftCenter/pull/118) added the
  roster-provenance panel and invite-earned boundary.
- [#121](https://github.com/roblebaegaming/DraftCenter/pull/121) moved Worlds
  Predictions into the top navigation and account-gated all selection controls.
- [#123](https://github.com/roblebaegaming/DraftCenter/pull/123) clarified the
  competitor-search examples with full player names.
- [#125](https://github.com/roblebaegaming/DraftCenter/pull/125) added the
  multi-competition hub, separate VGC and TCG routes, discipline and overall
  leaderboard design, the two-venue correction, and the Worlds SEO pass.

## Verified evidence

- The production dependency audit reported no known vulnerabilities.
- The complete application suite, focused Worlds and SEO tests, 1,027-row
  National Dex verification, and optimized 230-page build passed.
- Pull request #125 passed protected CodeQL, JavaScript security analysis,
  dependency/security, full-history secret scan, Supabase Preview, and Vercel
  checks before merge.
- The exact hosted Preview passed signed-out desktop and 390px mobile review for
  the hub and VGC routes with no browser warnings or horizontal overflow. It
  showed all 438 invitees. The TCG build page remained non-interactive and
  Masters-only.
- The post-merge checks on `1ef57eb` all passed, including the Supabase Preview
  integration and Vercel production deployment.
- Live postflight confirmed HTTP 200 responses and expected titles/canonicals
  for the hub, VGC, and TCG routes; SportsEvent and breadcrumb data on the two
  indexable pages; `noindex, follow` on TCG; hub and VGC sitemap inclusion with
  TCG exclusion; and Worlds coverage in `llms.txt`.
- The post-deployment production smoke sweep passed every public 200 route and
  protected 401 boundary. No merge protection was bypassed.

## Preserved boundaries

No production league, draft, roster, tournament, account, prediction entry,
provider setting, environment variable, or secret was changed for this release.
Pull request #125 made no production database write. The existing 438-player
seed and applied migrations 369-370 remain unchanged. The original dirty DraftCenter
workspace and the retained `multi-pod-pr-82` Preview branch remain untouched.

## Next work

1. Refresh the VGC invite-earned snapshot only after reviewing source changes.
   Publish every production roster correction as a new forward-only migration
   after 373, and never relabel invite earners as confirmed attendees.
2. Finish the TCG Masters roster audit across Championship Point standings,
   direct invites, deduplication, and the separately managed Japan, South Korea,
   Mainland China, and Asia-Pacific programs. Keep the page fail-closed until
   that complete Masters-only roster passes review.
3. Reconcile the final GO individual roster and UNITE team roster only after
   preserving official sources. Keep GO at the owner-approved Pick 10 and Your
   Champion contract; wait for official UNITE groups and pairings before
   creating its team bracket. Publish any schema or roster as a new
   forward-only migration after 373.
4. Validate migration 373 and its Pick 10 matrix only in an isolated Preview.
   Recheck the public production entry count immediately before applying it;
   the migration must abort if that count has become nonzero.
5. Validate migration 372 and its Top Cut matrix only in an isolated Preview.
   Keep the seeded challenge empty until official pairings exist; publishing a
   real field remains a separate explicitly authorized production action.
6. Validate migration 371 and the live-scoring matrix only in an isolated
   Preview. Obtain source permission and approve the exact event feed before
   enabling polling; otherwise use the reviewed manual fallback. Choose and
   authorize the scheduler separately because no provider schedule is included
   in the implementation branch.
7. Submit the two live canonical Worlds URLs for priority indexing once; then
   measure rather than repeatedly resubmitting them.

Stable product and operating detail remains in
[`docs/worlds-2026-pick-sixteen.md`](../worlds-2026-pick-sixteen.md). Canonical
cross-product status remains in [`docs/CURRENT-STATUS.md`](../CURRENT-STATUS.md).
