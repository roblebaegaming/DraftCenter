# DraftCenter current status

- Last updated: August 11, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production application commit: `4a664943f88d6e74a5ba534d5d5bf2e4defcdee4`
- Latest production migration: 375

## Deployed state

The August 9 release wave is complete. Pull requests
[#95](https://github.com/roblebaegaming/DraftCenter/pull/95) through
[#99](https://github.com/roblebaegaming/DraftCenter/pull/99) shipped, in order:

- standalone tournaments scaled to 512 single-elimination or 256
  double-elimination entrants;
- 16-player Draft Tournaments with registration, check-in, a hidden event
  draft, roster snapshots and locks, Swiss rounds, corrections, and an optional
  2/4/8-player top cut;
- Pokémon Connections and the four-game Daily Games experience, including
  completion-gated discussions and updated badges;
- private Nuzlocke Run Card saves in My Teams, profile-linked encounter
  artwork, and branded PNG exports; and
- a persistent, accessible Draft Home action in the global sticky header.

The evidence-led product-alignment SEO release also shipped through pull
request [#101](https://github.com/roblebaegaming/DraftCenter/pull/101). The
public tournament landing now covers single elimination, double elimination,
Draft Tournaments, and connected championships with current metadata,
structured data, server-readable guidance, and internal links. Daily Games FAQ
content and structured data now cover completion-gated discussions, and the
sitemap and `llms.txt` reflect the current public products. Tournament and
organization detail workspaces, My Teams, and saved Nuzlocke Run Cards remain
non-indexed and outside the sitemap.

The consolidated discovery, pricing, and pod-access release shipped through
pull request [#103](https://github.com/roblebaegaming/DraftCenter/pull/103).
The public Pokédex now has combinable color, Egg Group, and shape filters plus
42 canonical category routes. Draft commissioners can opt into sourced,
versioned pricing boards with explicit BST estimates and provenance, while
existing leagues retain their stored pricing. Managers may visit sibling pods
to follow activity, use the League Board, and predict without receiving team,
transaction, claim, trade, draft, or direct-message authority; spectators
remain limited to standings, predictions, the official draft board, and
playoffs.

The crawl-integrity follow-up shipped through pull request
[#106](https://github.com/roblebaegaming/DraftCenter/pull/106). It repairs the
live Paldean Tauros 404 and redirecting tournament links, gives ambiguous
Meowstic and Zygarde forms unique public metadata, replaces invalid Nuzlocke
software rich-result markup with accurate page/article data, shortens the
flagged titles, and server-renders direct links to eligible public leagues.
The GitHub security-email finding was also confirmed as an already-remediated
false positive involving public catalog provenance hashes; the regression
fixture now covers the exact allowlist paths.

The league-save reconciliation release shipped through pull request
[#108](https://github.com/roblebaegaming/DraftCenter/pull/108). Manual
commissioner checkpoints now advance the snapshot revision instead of falsely
resubmitting an already-saved revision. Stale conflicts refresh and safely
reapply the functional edit with bounded retries, genuine failures receive a
four-second neutral verification grace period, and background polling can no
longer overwrite unsaved work or relabel a real failure as success. The
database stale-session guard remains unchanged.

The conversation release confirmation shipped through pull request
[#110](https://github.com/roblebaegaming/DraftCenter/pull/110). The Semrush
crawl-remediation release then shipped through pull request
[#111](https://github.com/roblebaegaming/DraftCenter/pull/111). It repairs the
reproduced broken and redirecting internal targets, reduces Nuzlocke guide HTML
by loading full area encounters on demand, removes internal `nofollow` query
links, and strengthens thin or weakly linked public templates without adding
filler for the low text-to-HTML heuristic.

The privacy-safe League Pulse shipped through pull request
[#112](https://github.com/roblebaegaming/DraftCenter/pull/112). Owner
Operations now shows aggregate results, completed transactions, meaningful
activity age, season state, open support requests, and recent unexpected
system failures for post-draft leagues. It does not expose teams, Pokemon,
matchups, scores, managers, messages, request text, error text, or transaction
contents.

The scheduled full-history scan repair shipped through pull request
[#113](https://github.com/roblebaegaming/DraftCenter/pull/113). It narrowly
covers reviewed public catalog identifiers under seven obsolete migration paths
and four exact historical prose fingerprints. It does not change application
behavior, production data, provider settings, or secrets.

The SEO and AI answer-resource release shipped through pull request
[#114](https://github.com/roblebaegaming/DraftCenter/pull/114). Five focused
guides now cover ADP, transactions and free agency, standings/tiebreakers and
playoffs, Pokemon form/stat/data comparison, and dedicated league management
versus spreadsheets. They include direct answers, truthful guide dates,
internal links, guide-collection structured data, sitemap freshness, and
`llms.txt` coverage. Search Console accepted the refreshed sitemap and all five
new URLs into its priority crawl queue.

Migrations 361-368 are applied to the exact core production project. The
previous multi-pod organization, qualification, and connected championship
release remains live through migrations 350-360 and production record pull
request [#94](https://github.com/roblebaegaming/DraftCenter/pull/94).

The 2026 VGC Worlds Pick 16 release shipped through pull request
[#116](https://github.com/roblebaegaming/DraftCenter/pull/116). The public
competition contains only the VGC Masters invite-earned list: 438 competitors
in the August 10 snapshot. A signed-in member chooses 16 competitors and one
Ace Pick whose placement score counts twice. The winner is worth 30 points,
entries lock at midnight Pacific on August 28, and other users' selections stay
private until the lock. The sitewide leaderboard is live with zero initial
entries. The bracket challenge remains closed until official pairings exist.
Migrations 369-370 are applied to the exact core production project.

The VGC roster-provenance clarification shipped through pull request
[#118](https://github.com/roblebaegaming/DraftCenter/pull/118). The qualified-
player section now names Victory Road's 2026 invite tracker, links directly to
it, explains that the tracker combines Championship Point standings and
qualifying event results, and repeats that an invite-earned list is not
confirmed attendance or registration. The source-check date is not presented
as player-facing roster copy.

The Worlds navigation and account-gate refinement shipped through pull request
[#121](https://github.com/roblebaegaming/DraftCenter/pull/121). The global
feature link is now named **Worlds Predictions** and lives in the sticky top
header instead of the bottom tools bar. Signed-out visitors may browse the
Masters roster, scoring, sources, and leaderboard, but the prediction builder and
all competitor-selection controls remain locked behind a DraftCenter account.

The competitor-search clarification shipped through pull request
[#123](https://github.com/roblebaegaming/DraftCenter/pull/123). Its placeholder
now uses the complete names of the two latest VGC Masters World Champions,
Giovanni Cischke and Luca Ceribelli, followed by Wolfe Glick. It no longer
mixes a partial player name, country code, and qualification path.

The final Worlds Predictions hub shipped through pull request
[#125](https://github.com/roblebaegaming/DraftCenter/pull/125) as production
application commit `1ef57ebd4cda6a49eb1a68dfcf94be47a1da0f31`. The public
hub now separates VGC, TCG, Pokémon GO, and Pokémon UNITE, with discipline
leaderboards and a normalized overall leaderboard that opens after two games
score. VGC lives at `/worlds/2026/vgc`. The TCG Masters source audit lives at
`/worlds/2026/tcg` but stays `noindex` and fail-closed until its roster passes
review. The release also names the
Moscone Center and Chase Center venue split and adds full Worlds search
metadata, structured data, sitemap freshness, and `llms.txt` coverage.

The Worlds live-scoring and prediction-infrastructure release shipped through
pull request [#128](https://github.com/roblebaegaming/DraftCenter/pull/128) as
production application commit
`e5dca23b9da09d3a557e485443e7dc5a207b4e20`. VGC now uses **Pick 10** with
**Your Champion** worth double placement points and a maximum raw score of 140.
Migration 371 adds the fail-closed provisional-results importer, migration 372
adds the configurable Top Cut challenge, and migration 373 performs the guarded
Pick 10 change. Production had zero VGC entries immediately before and after
the change. The importer is disabled with no feed URL or scheduler, and the Top
Cut challenge is empty and waiting for an official reviewed field. The public
GO and UNITE source-audit routes are live with no names, saving, or polling;
TCG and GO use Pick 10 plus Your Champion as their post-roster-audit contract,
while UNITE remains team-bracket based.

The Worlds event-day operations follow-up shipped through pull request
[#130](https://github.com/roblebaegaming/DraftCenter/pull/130) as production
application commit `eb951de33bd4ace0463cb9ea57fab9a0e460b188`. After an
official field size is known, owner Operations can download a blank or partially
completed Top Cut setup JSON, review it offline, and load it back without
publishing. The stable guides now reflect the deployed state and include the
announcement checklist plus a ready-to-send results-feed permission request.
The request has not been sent, the importer remains disabled, and no database,
provider, field, entry, or scheduler changed in the follow-up.

The TCG, GO, and UNITE staged-infrastructure release ships through pull request
[#132](https://github.com/roblebaegaming/DraftCenter/pull/132). It adds
owner-only local setup-file preparation for all three games and reusable Pick
10/Your Champion screens for reviewed TCG and GO rosters. Migration 374 is
applied to the exact core production project: TCG Masters and GO are `draft`,
Pick 10, individual events with zero competitors and zero entries; their result
sources are disabled with no feed URL or external event identifier; VGC still
has zero entries; browser table reads remain denied; and the privacy-safe
overall leaderboard is closed. UNITE remains an offline team/group/bracket
preparation contract with no database event. The isolated migration rehearsal
and 371-374 database matrices passed, and both exact disposable Preview branches
were permanently deleted.

The reusable VGC, TCG, and GO Pick 10 screen now includes an optional social
card flow once a lineup and Your Champion are complete. It creates a 1080 by
1350 PNG for download, supports native file sharing to installed apps such as
Instagram or X when the device exposes them, and provides a prepared X post
plus downloaded image fallback. Sharing never saves or changes an entry and
clearly warns that it publicly reveals the card before lock.

Forward-only migration 375 is applied in production. It makes final Pick 10
ties use the lower average finish of the six best-finishing picks, then the
lower average finish of all 10. Provisional ranks remain points-only; exact
final ties share a rank. Finalization fails closed if any saved selection lacks
a reviewed placement, and no-valid-placing results count as one position after
the published field for the two averages. The matching interface and server
release shipped through protected pull request
[#136](https://github.com/roblebaegaming/DraftCenter/pull/136).

The isolated migration-375 rehearsal applied the same minimal Worlds baseline
used by the prior release, then passed the new final-ranking matrix and the
current live-scoring, Top Cut, Pick 10, and future-event compatibility matrices.
Its read-only postflight confirmed all three individual events carry the new
rules, zero fixture entries remained, placement-table RLS stayed enabled, and
the public/service function grants were unchanged. The exact disposable
Preview branch was permanently deleted after verification.

The production migration-375 postflight confirmed the same three Pick 10
events and tiebreaker keys, zero entries, disabled and unconfigured result
sources, public hub access, and service-only finalization. No entry, score,
roster, bracket, result snapshot, or provider setting changed during release.

## Release verification

- The complete application tests, National Dex verification across 1,027
  rows, production dependency audit, and production builds passed for the
  applicable releases.
- The destructive tournament, Draft Tournament, Daily Games, and Nuzlocke
  database matrices passed only in the isolated Supabase Preview environment.
- Protected pull-request security, dependency, secret-scan, CodeQL, and Vercel
  checks passed for the release pull requests.
- Signed-in Preview walkthroughs covered the new database-backed workflows.
- The SEO release passed all protected security, dependency, secret-scan,
  CodeQL, and Vercel checks. Its exact Preview passed desktop and 390px mobile
  review without browser errors or horizontal overflow.
- Pull request #103 passed protected security, dependency, full-history secret
  scan, CodeQL, and Vercel checks. Its exact Preview and production deployment
  passed desktop and 390px mobile Pokédex review without browser errors or
  horizontal overflow. The retained Supabase Preview observer-access matrix
  passed every RLS, grant, allow, denial, full-staff, and cleanup assertion.
- Vercel reports exact `main` commit `e5dca23` Ready in Production on the public
  production domains.
- The signed-out production smoke sweep passes, including protected 401
  boundaries. Focused live checks also pass for tournament metadata and JSON-LD,
  Daily Games FAQ structured data, sitemap modification dates, `llms.txt`, and
  private-route `noindex` behavior. The new color, Egg Group, and shape category
  routes also return their expected canonical metadata and structured data,
  combine correctly in the directory, and appear in the production sitemap.
- Pull request #106 passed all protected checks. Its exact Preview and live
  production pages passed focused canonical, title, JSON-LD, redirect,
  `nofollow`, and direct-link checks. The signed-out production smoke sweep
  passed after deployment, including every protected 401 boundary.
- Pull request #108 passed all protected checks, its exact Vercel Preview was
  Ready, and the post-deployment signed-out smoke sweep passed every public
  route and protected 401 boundary. Focused tests cover manual checkpoints,
  two bounded conflict recoveries, non-replay of timeouts, delayed failure,
  polling ownership, and retained Retry Save behavior.
- Pull request #111 passed all protected checks, its production build, and a
  signed-out built-output crawl covering 1,537 sitemap URLs with zero broken
  pages or targets, redirects, oversized documents, H1 defects, internal
  `nofollow` links, sub-200-word pages, orphans, one-link pages, or URLs over
  three clicks deep.
- Pull request #112 passed all protected checks, the complete application
  suite, the 1,027-row National Dex verification, the production build, and
  the post-deployment smoke sweep across all 19 public and protected routes.
- Pull request #113 passed its authoritative full-history scan and every
  protected check. Pinned Gitleaks 8.30.1 scanned 852 commits and approximately
  691.80 MB with no leaks.
- Pull request #114 passed the complete application suite, 1,027-row National
  Dex verification, dependency audit, 227-page build, protected checks, exact
  Preview review, and the post-deployment 19-route smoke sweep. All five live
  guides return 200 with one H1, the expected canonical, and their direct answer;
  the guide directory, sitemap, and `llms.txt` contain the complete set.
- Pull request #116 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, production build, protected security and
  deployment checks, and post-deployment 19-route smoke sweep. Its isolated
  Preview matrix passed roster, RLS, grants, privacy, duplicate-entry, lock,
  validation, Ace-scoring, and fixture-cleanup assertions. The connected hosted
  Preview and production route passed desktop and 390px mobile review with all
  438 competitors, no browser warnings or errors, and no horizontal overflow.
- Pull request #118 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, production build, and every protected
  check. Its exact Preview and production source panel passed desktop and
  390px review with the intended Victory Road link and no horizontal overflow;
  the post-deployment signed-out smoke sweep passed all 19 routes.
- Pull request #121 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized production build, and all six
  protected checks. Its exact Preview and production route passed signed-out
  desktop and 390px review with Worlds Predictions in the top header, five
  balanced bottom-tool slots, zero enabled pick buttons, all 438 roster cards,
  no browser errors, and no horizontal overflow. The post-deployment signed-out
  smoke sweep passed all 19 routes.
- Pull request #123 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized build, all six protected
  checks, and exact hosted desktop and 390px review. Production shows the three
  complete player names without horizontal overflow, and the post-deployment
  signed-out smoke sweep passed all 19 routes.
- Pull request #125 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized 230-page build, every protected
  check, and exact hosted desktop and 390px review without browser errors or
  horizontal overflow. Vercel reports exact `main` commit `1ef57eb` deployed.
  Live postflight confirmed the hub, VGC, and TCG routes; intended canonical,
  structured-data, sitemap, `llms.txt`, and TCG `noindex` behavior; and a clean
  signed-out 19-route production smoke sweep.
- Pull request #128 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, focused 37-test Worlds suite, optimized
  236-page build, protected security/CodeQL/secret-scan checks, and Vercel
  Preview. Because automatic Supabase PR branches are disabled, the exact
  migrations and all three matrices were validated on a manually created
  disposable Preview branch. Every live-scoring, Top Cut, Pick 10, RLS, grant,
  privacy, locking, scoring, cleanup, and fail-closed assertion passed. The
  branch was deleted by its exact identifier after release. Desktop and 390px
  hosted review and the live signed-out route sweep passed with no browser
  errors; the post-deployment 19-route production smoke sweep also passed.
- Pull request #130 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, focused 38-test Worlds suite, optimized
  236-page build, all six protected checks, and Vercel Preview. The hosted
  signed-out Operations gate remained closed and logged no browser errors. The
  exact `main` commit `eb951de` reached Ready in Production, and the
  post-deployment 19-route production smoke sweep passed.
- No merge protection was bypassed.

## Preserved boundaries

- No real league, draft, roster, tournament, Daily Games discussion, saved
  team, provider setting, or production account was changed to test the
  releases.
- Disposable Preview fixtures were removed by exact recorded identifiers.
- The Worlds production seed created the intended event and 438 public
  invite-earned competitors; it created no user entry or synthetic account.
- The guarded Pick 10 migration changed only the zero-entry VGC event contract.
  The result importer remains disabled without a feed URL, permission approval,
  or scheduler, and the Top Cut seed remains empty and unpublished.
- The disposable `worlds-live-scoring-pr-128` Preview branch and its fixtures
  were permanently deleted after production verification, stopping its compute
  billing.
- The release-wave Preview branch remains available for owner-approved
  cleanup. The retained `multi-pod-pr-82` Preview branch must not be deleted.
- The original DraftCenter workspace's pre-existing changes remain unstaged
  and untouched.
- No production provider configuration, environment variable, or secret was
  changed.
- The PokeData permission request is a repository draft only. It has not been
  sent and does not authorize polling or manual feed use.

## Remaining work

Continue normal monitoring of the tournament, Daily Games, Nuzlocke,
navigation, pricing, pod-observer, League Pulse, metadata, indexing, and
commissioner-save paths. Treat historical Operations events by timestamp and
current authoritative state before declaring a recurrence.

Refresh the VGC Masters invite-earned snapshot only after reviewing current
source changes, and publish every post-373 database change as a new forward-only
migration. Do not describe invite-earned competitors as confirmed attendees.
Keep the Worlds bracket challenge closed until official pairings exist.

Do not enable the live importer until the exact structured Masters results feed,
permission, attribution, and event identifier are reviewed. Scheduler creation
is a separate production-provider action; keep polling off until that action is
explicitly authorized. Preserve the last-known-good snapshot and require the
owner-reviewed official source before final scoring.

Repeat the comparable Semrush crawl after production cache replacement with a
5,000-page ceiling. It may stop below that ceiling when it exhausts the
discoverable canonical inventory; compare issue URL exports rather than only
aggregate counts. Use roughly August 23 for the early Search Console read and
September 6 for the normal 28-day content/indexing decision. Redirect,
alternate-canonical, and intentional `noindex` examples should not be treated
as defects merely because Search Console excludes them.

The five new guide URLs are already in Google's priority crawl queue. Do not
submit them repeatedly. Semrush Prompt Tracking remains unavailable under the
current account access; do not buy an upgrade or override the multiple-session
guard merely to remove that measurement gap.

## Authoritative records

- Current continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-10-worlds-predictions-final.md`](handoffs/DraftCenter-agent-handoff-2026-08-10-worlds-predictions-final.md)
- Historical Worlds Pick 16 operating record:
  [`docs/worlds-2026-pick-sixteen.md`](worlds-2026-pick-sixteen.md)
- Worlds live-scoring operating record:
  [`docs/worlds-vgc-live-scoring.md`](worlds-vgc-live-scoring.md)
- Worlds Top Cut operating record:
  [`docs/worlds-vgc-top-cut-bracket.md`](worlds-vgc-top-cut-bracket.md)
- Worlds Top Cut announcement checklist:
  [`docs/worlds-vgc-top-cut-announcement-checklist.md`](worlds-vgc-top-cut-announcement-checklist.md)
- Worlds results-feed permission request:
  [`docs/worlds-vgc-results-feed-permission-request.md`](worlds-vgc-results-feed-permission-request.md)
- GO and UNITE activation record:
  [`docs/worlds-2026-go-and-unite.md`](worlds-2026-go-and-unite.md)
- SEO and AI answer-resource release:
  [`docs/seo-ai-answer-resources-2026-08-10.md`](seo-ai-answer-resources-2026-08-10.md)
- League-save implementation detail:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-09-league-save-reconciliation.md`](handoffs/DraftCenter-agent-handoff-2026-08-09-league-save-reconciliation.md)
- Consolidated application release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-09-consolidated-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-09-consolidated-release.md)
- External SEO measurement:
  [`docs/seo-measurement-2026-08-08.md`](seo-measurement-2026-08-08.md)
- Draft Tournament architecture and status:
  [`docs/draft-tournament-concept.md`](draft-tournament-concept.md)
- Multi-pod production detail:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md)
- Pokémon profile canonical policy:
  [`docs/pokemon-profile-canonical-policy.md`](pokemon-profile-canonical-policy.md)
- Public indexing policy:
  [`docs/public-indexing-policy.md`](public-indexing-policy.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified production record
and the current repository state take precedence.
