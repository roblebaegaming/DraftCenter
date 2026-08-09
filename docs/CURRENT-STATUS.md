# DraftCenter current status

- Last updated: August 9, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production application commit: `cdce0f19c62110cff384d204f890be01042735b6`
- Latest production migration: 368

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

Migrations 361-368 are applied to the exact core production project. The
previous multi-pod organization, qualification, and connected championship
release remains live through migrations 350-360 and production record pull
request [#94](https://github.com/roblebaegaming/DraftCenter/pull/94).

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
- Vercel reports exact `main` commit `cdce0f1` Ready on the public production
  domains.
- The signed-out production smoke sweep passes, including protected 401
  boundaries. Focused live checks also pass for tournament metadata and JSON-LD,
  Daily Games FAQ structured data, sitemap modification dates, `llms.txt`, and
  private-route `noindex` behavior. The new color, Egg Group, and shape category
  routes also return their expected canonical metadata and structured data,
  combine correctly in the directory, and appear in the production sitemap.
- No merge protection was bypassed.

## Preserved boundaries

- No real league, draft, roster, tournament, Daily Games discussion, saved
  team, provider setting, or production account was changed to test the
  releases.
- Disposable Preview fixtures were removed by exact recorded identifiers.
- The release-wave Preview branch remains available for owner-approved
  cleanup. The retained `multi-pod-pr-82` Preview branch must not be deleted.
- The original DraftCenter workspace's pre-existing changes remain unstaged
  and untouched.
- No production provider configuration, environment variable, or secret was
  changed.

## Remaining work

No application release from the August 9 wave, the first product-alignment SEO
pass, or the consolidated discovery/pricing/pod-access release remains to be
pushed. Continue normal monitoring of the tournament, Daily Games, Nuzlocke,
navigation, pricing, pod-observer, metadata, and indexing paths.

The next SEO work begins with the exact URLs behind the August 8 crawl defects:
invalid structured data, one broken internal link and 4xx, duplicates, and the
orphaned sitemap page. Reproduce each finding against `cdce0f1` before changing
templates because the measurement predates several releases. Repeat the same
5,000-page crawl scope after technical repairs, with an early search read after
about 14 days and a normal content decision after about 28 days.

## Authoritative records

- Current continuation handoff:
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
