# DraftCenter current status

- Last updated: August 10, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production application commit: `3eb4e94ca78bd1074454c59bdaaba43f665eed61`
- Latest production migration: 370

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
it, shows the August 10 snapshot date, explains that the tracker combines
Championship Point standings and qualifying event results, and repeats that an
invite-earned list is not confirmed attendance or registration.

The Worlds navigation and account-gate refinement shipped through pull request
[#121](https://github.com/roblebaegaming/DraftCenter/pull/121). The global
feature link is now named **Worlds Predictions** and lives in the sticky top
header instead of the bottom tools bar. Signed-out visitors may browse the
Masters roster, scoring, sources, and leaderboard, but the Pick 16 builder and
all competitor-selection controls remain locked behind a DraftCenter account.

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
- Vercel reports exact `main` application commit `3eb4e94` Ready and Current on
  the public production domains.
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
- No merge protection was bypassed.

## Preserved boundaries

- No real league, draft, roster, tournament, Daily Games discussion, saved
  team, provider setting, or production account was changed to test the
  releases.
- Disposable Preview fixtures were removed by exact recorded identifiers.
- The Worlds production seed created the intended event and 438 public
  invite-earned competitors; it created no user entry or synthetic account.
- The release-wave Preview branch remains available for owner-approved
  cleanup. The retained `multi-pod-pr-82` Preview branch must not be deleted.
- The original DraftCenter workspace's pre-existing changes remain unstaged
  and untouched.
- No production provider configuration, environment variable, or secret was
  changed.

## Remaining work

Continue normal monitoring of the tournament, Daily Games, Nuzlocke,
navigation, pricing, pod-observer, League Pulse, metadata, indexing, and
commissioner-save paths. Treat historical Operations events by timestamp and
current authoritative state before declaring a recurrence.

Refresh the VGC Masters invite-earned snapshot only after reviewing current
source changes, and publish every post-370 database change as a new forward-only
migration. Do not describe invite-earned competitors as confirmed attendees.
Keep the Worlds bracket challenge closed until official pairings exist.

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
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-10-worlds-pick-sixteen-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-10-worlds-pick-sixteen-release.md)
- Worlds Pick 16 operating record:
  [`docs/worlds-2026-pick-sixteen.md`](worlds-2026-pick-sixteen.md)
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
