# DraftCenter handoff: Pokédex Tracker and focused Draft Lab release

Date: August 13, 2026

## Production record

The account Pokédex Tracker and focused Draft Lab shipped through pull request
[#211](https://github.com/roblebaegaming/DraftCenter/pull/211). GitHub
squash-merged the protected release as application commit
`c4e19ec421220a6e0388531b7ac8dcfb2dbdcae8`. The complete Pokémon HOME
National Dex correction shipped through pull request
[#212](https://github.com/roblebaegaming/DraftCenter/pull/212), producing final
`main` commit `9ffff2d45e2bca6737f71d0872ba69656439e593`. Vercel reports both exact
commits Ready in Production.

Forward-only migrations 391 and 392 are applied once to the exact core
production project `eukexfqpiuidwygllaye`. Migration 391 is immutable history.
Migration 392 completes the HOME catalog and must also remain immutable.

## Pokédex Tracker

The public and signed-in route is <https://www.draftcentral.gg/pokedex-tracker>.

- A signed-in member can create multiple trackers for every verified game and
  Pokémon HOME, including separate playthroughs of the same game.
- Standard and shiny completion are independent. Enabling shiny progress later
  cannot erase either checklist.
- Progress saves immediately to the current DraftCenter account. Search,
  completion filters, HOME-box filters, and pagination are presentation-only.
- Trackers can be renamed and deleted. Account export includes tracker
  definitions and caught flags, and account deletion cascades to tracker data.
- HOME uses National Dex order with page, box, row, and slot labels. It now
  reports exactly 1,025 species. Diancie, Hoopa, and Volcanion are explicitly
  supplemented because the three Kalos mythicals have no rows in any verified
  regional game catalog.

Migration 391 creates `pokedex_trackers` and `pokedex_tracker_entries` with RLS
enabled, no client policies, and no direct `anon` or `authenticated` table
access. The browser can use only authenticated, `auth.uid()`-scoped RPCs for
list, detail, create, rename, caught-state changes, deletion, and export.
Migration 392 replaces only the private catalog helper and tracker-summary RPC;
it does not alter regional catalogs or saved tracker rows.

Production postflight confirmed:

- 1,025 distinct HOME species and a reported total of 1,025;
- Diancie, Hoopa, and Volcanion at National Dex IDs 719-721;
- RLS enabled on both tracker tables with no client policies;
- direct authenticated reads denied;
- the catalog helper unavailable to `anon` and `authenticated`; and
- the tracker list RPC available only to the authenticated and service roles.

No production tracker, synthetic production user, real league, draft, roster,
queue, tournament, or prediction was created or changed for verification. The
live signed-in review was read-only.

## Search and mobile behavior

The public landing is indexable and contains only product-controlled copy. It
has the intended canonical, description, large-image social metadata,
`WebApplication`, FAQ and breadcrumb structured data, sitemap entry, `llms.txt`
entry, and internal links. Tracker IDs, names, progress, catches, and account
identity do not enter metadata, structured data, or server-rendered SEO copy.

Live 390px and 320px reviews showed no page-level horizontal overflow. Visible
tracker controls retained 44px targets, the creation panel remained readable,
the sticky mobile tools navigation stayed usable, and the signed-in catalog
reported Pokémon HOME at 1,025 species. The earlier exact Preview review also
covered populated galleries, HOME pagination, shiny artwork, and long tracker
lists.

## Draft Lab

The public route remains <https://www.draftcentral.gg/tools/team-builder>.

- The supported sizes are a six-Pokémon battle team and a focused
  10-Pokémon draft roster. The former 24-Pokémon option is removed.
- Existing type, STAB, speed, stat, base-regulation, and share-link analysis is
  preserved.
- The live analysis now offers directional prompts for balance or bulky
  offense, hyper offense, hazard-stack or pivot offense, weather or terrain,
  Trick Room or other speed control, and stall or control.
- The prompts state their limits: typing and base stats can suggest questions,
  but moves, abilities, items, Tera rules, and league clauses still require a
  manual check.

Live verification switched between the six- and 10-Pokémon modes, confirmed
the 24-Pokémon option is absent, and rendered all six archetype prompts with a
public Garchomp-only URL state. No team was saved to production.

## Validation

The release passed:

- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run test:all`;
- `npm run test:national-dex`: all 1,027 application catalog rows;
- the optimized 255-page production build;
- focused Pokédex Tracker and release-integration suites;
- protected CodeQL, JavaScript security, dependency/security, secret-scan, and
  Vercel checks for both pull requests;
- an isolated 1,022-species Preview baseline followed by exact migrations 391
  and 392;
- an isolated two-account matrix proving cross-account list, detail, rename,
  progress-change, and deletion denial, with all fixtures rolled back;
- exact production migration postflight and live signed-in read-only review;
- live 320px and 390px responsive checks and SEO metadata review; and
- the 20-check signed-out production smoke sweep.

The manual Supabase Preview branch is
`pokedex-home-completion-2026-08-13`, exact project ref
`bifkxlkoipwswglcffvl`. It is isolated and still exists. Do not delete it based
on its name or without explicit owner approval for that exact project ref.

## Continuation

There is no undeployed application or database step from this release. Start
future work from fresh `origin/main`, treat migrations 391 and 392 as immutable,
and use migration 393 or later for any database change.

The stable contracts are
[`../pokedex-trackers.md`](../pokedex-trackers.md) and
[`../draft-lab.md`](../draft-lab.md). The preceding broad SEO record remains at
[`DraftCenter-agent-handoff-2026-08-13-final-seo-and-release-consolidation.md`](DraftCenter-agent-handoff-2026-08-13-final-seo-and-release-consolidation.md).
