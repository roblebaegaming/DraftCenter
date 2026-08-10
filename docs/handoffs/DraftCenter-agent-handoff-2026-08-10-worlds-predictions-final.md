# DraftCenter handoff: 2026 Worlds Predictions final release

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
- Pokémon GO and Pokémon UNITE: visible as planned, with no prediction controls
  or invented roster model.

The Worlds event card correctly says that the August 28-30 competition weekend
uses Moscone Center and that all finals move to Chase Center on Championship
Sunday. The hub and VGC page use canonical URLs, social metadata, current
sitemap dates, and accurate event, item-list, and breadcrumb structured data.
The indexable hub and VGC routes are in the sitemap; the unfinished TCG route is
not. `llms.txt` describes the public feature and its roster-source boundary.

## VGC competition contract

The August 10 invite-earned snapshot contains 438 VGC Masters competitors.
It cites Victory Road's 2026 invite tracker, which combines Championship Point
standings and qualifying event results. It is not a confirmed registration or
attendance list.

Each signed-in DraftCenter member may save 16 unique picks and one **Ace Pick**
whose placement points count twice. Other users' selections remain private
until the entry lock at `2026-08-28T07:00:00Z` (midnight Pacific). The scoring
curve is 30 / 20 / 12 / 7 / 4 / 2 / 1 from World Champion through Top 64.
VGC keeps its raw leaderboard. When at least two disciplines have official
scores, the overall leaderboard normalizes each launched competition to a
maximum of 100 points; a missing entry earns zero.

Only official Masters divisions belong in prediction pools. Junior and Senior
competitors remain excluded. Masters is not an adult-only guarantee, so never
collect or infer private birth dates. The later bracket predictor remains
closed until Pokémon publishes real elimination pairings.

Migrations 369 and 370 remain the authoritative database implementation. They
enforce RLS, authenticated RPC writes, the exact Pick 16 and Ace constraints,
pre-lock privacy, the 30-point cap, and the seeded 438-player VGC roster.

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
seed and migrations 369-370 remain unchanged. The original dirty DraftCenter
workspace and the retained `multi-pod-pr-82` Preview branch remain untouched.

## Next work

1. Refresh the VGC invite-earned snapshot only after reviewing source changes.
   Publish every production roster correction as a new forward-only migration
   after 370, and never relabel invite earners as confirmed attendees.
2. Finish the TCG Masters roster audit across Championship Point standings,
   direct invites, deduplication, and the separately managed Japan, South Korea,
   Mainland China, and Asia-Pacific programs. Keep the page fail-closed until
   that complete Masters-only roster passes review.
3. Design Pokémon GO around a safe official competitor unit and Pokémon UNITE
   around teams rather than forcing individuals into Pick 16.
4. Keep the bracket challenge closed until official pairings exist. Record and
   score results only from an official published source and with explicit
   production authorization.
5. Decide whether live scoring will use a reviewed data partnership or a
   documented manual fallback. Do not depend on an undocumented third-party
   feed during Worlds weekend.
6. Submit the two live canonical Worlds URLs for priority indexing once; then
   measure rather than repeatedly resubmitting them.

Stable product and operating detail remains in
[`docs/worlds-2026-pick-sixteen.md`](../worlds-2026-pick-sixteen.md). Canonical
cross-product status remains in [`docs/CURRENT-STATUS.md`](../CURRENT-STATUS.md).
