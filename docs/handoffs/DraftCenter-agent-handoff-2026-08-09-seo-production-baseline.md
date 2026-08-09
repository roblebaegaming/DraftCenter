# DraftCenter handoff — SEO from the August 9 production baseline

- Date: August 9, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified application commit: `b40717e213d7e71e0ae32cd3226409f082ce780c`
- Latest production migration: 365
- Next mission: repair exact current crawl defects, then measure the released
  discovery changes without making private product surfaces crawlable

## Start here

Read [`../../AGENTS.md`](../../AGENTS.md),
[`../CURRENT-STATUS.md`](../CURRENT-STATUS.md),
[`../seo-measurement-2026-08-08.md`](../seo-measurement-2026-08-08.md), and
[`../pokemon-profile-canonical-policy.md`](../pokemon-profile-canonical-policy.md),
and [`../public-indexing-policy.md`](../public-indexing-policy.md)
before changing public metadata, canonicals, structured data, sitemap behavior,
or indexability.

This handoff supersedes
[`DraftCenter-agent-handoff-2026-08-06-seo-expansion.md`](DraftCenter-agent-handoff-2026-08-06-seo-expansion.md)
as the continuation record. That older file remains valuable historical
context, but several of its proposed tasks have already shipped.

## Authoritative production baseline

| Release | Pull request | Production commit | Database |
| --- | --- | --- | --- |
| Multi-pod qualification and connected championships | [#91](https://github.com/roblebaegaming/DraftCenter/pull/91), [#92](https://github.com/roblebaegaming/DraftCenter/pull/92), recorded by [#94](https://github.com/roblebaegaming/DraftCenter/pull/94) | `1c1afac` | migrations 356-360 |
| Standalone tournament scale | [#95](https://github.com/roblebaegaming/DraftCenter/pull/95) | `79812b4` | migration 361 |
| Draft Tournament lifecycle | [#96](https://github.com/roblebaegaming/DraftCenter/pull/96) | `a74632e` | migrations 362-363 |
| Daily Games and Pokémon Connections | [#97](https://github.com/roblebaegaming/DraftCenter/pull/97) | `9bf383e` | migration 364 |
| Private Nuzlocke Run Cards | [#98](https://github.com/roblebaegaming/DraftCenter/pull/98) | `e8fc947` | migration 365 |
| Persistent Draft Home navigation | [#99](https://github.com/roblebaegaming/DraftCenter/pull/99) | `9d0c8b6` | none |
| SEO product alignment | [#101](https://github.com/roblebaegaming/DraftCenter/pull/101) | `b40717e` | none |

All application releases above are deployed. Vercel reported the exact final
commit Ready, the signed-out production smoke sweep passed, and focused live
browser checks passed. Do not describe a Preview, local build, or pull request
head as the current production baseline.

### SEO alignment release verification

Pull request #101 updated the tournament landing metadata, social metadata,
WebPage and Breadcrumb JSON-LD, visible H1, server-readable event-format
guidance, and internal planning links. It also aligned the Daily Games FAQ and
structured data with completion-gated discussions, refreshed truthful sitemap
modification dates, updated the public `llms.txt` index, repaired its malformed
Pokémon label, and added the stable public indexing policy.

All repository checks passed. The exact Vercel Preview passed desktop and 390px
mobile review for `/tournaments` and `/resources/daily-games`, and Vercel then
reported exact commit `b40717e` Ready, Production, and Current. The signed-out
production smoke sweep and focused live metadata, JSON-LD, sitemap, `llms.txt`,
link, layout, and `noindex` checks passed. No production row, league, draft,
roster, event, account, provider setting, environment variable, or secret was
changed.

### Product changes that affect discovery work

- Standalone tournaments support up to 512 entrants in single elimination and
  256 in double elimination, with bounded round loading and pagination.
- Draft Tournaments are a distinct 16-player event type. They add registration,
  check-in, a hidden snake draft, roster publication and locking, deterministic
  Swiss rounds, correction rollback, and an optional top cut. They use the
  existing Tournament bracket for the top cut but are not multi-pod
  championships.
- Multi-pod organizations can automate qualification and promote retained
  rosters into connected single- or double-elimination championships.
- Daily Games now means four games. Pokémon Connections is the current product
  name, and signed-in discussions remain gated until a player completes the
  relevant daily game.
- Nuzlocke encounters link to Pokémon profiles. Signed-in users can save a run
  privately in My Teams and download a branded PNG Run Card. Saved runs and My
  Teams are not public SEO content.
- Draft Home is a persistent 44px global action inside the sticky header on
  every route. Preserve its keyboard, mobile, and safe-area behavior when
  changing navigation or internal links.

## Current SEO foundation

The repository already contains a substantial public-discovery foundation:

- `src/app/layout.js` defines the production metadata base, site title template,
  Open Graph/Twitter defaults, and WebSite/Organization JSON-LD.
- `src/app/robots.js` allows the public site, blocks API routes and My Teams,
  and points to the production sitemap.
- `src/app/sitemap.js` includes public static pages, public leagues, Pokémon
  profiles and indexes, formats, authored guides, and all Nuzlocke game guides.
- `src/app/llms.txt/route.js` exposes a human-curated public reference index.
  Treat it as a discovery aid, not a guaranteed ranking signal.
- The home and Pokédex client experiences provide useful server-rendered
  fallback headings and introductions.
- Interactive Pokédex selection uses URL fragments rather than creating new
  internal `?pokemon=` links. Legacy parameter links are restored for visitors
  and replaced in the browser.
- Pokémon profile canonicals follow the conservative documented form policy.
  Materially distinct battle forms remain self-canonical; cosmetic appearances
  stay grouped with their owning profile.
- Pokémon, format, and guide templates include crawlable related links.
- The guide title fixes proposed in the older handoff are already live.
- Thirty-seven server-rendered Nuzlocke game guides are live, not just the
  original four-page cohort. They use reviewed game data, route lists, encounter
  methods, profile links, Article/Breadcrumb JSON-LD, and self-canonicals.
- Daily Games has current four-game metadata, Open Graph/Twitter metadata, and
  JSON-LD at `/resources/daily-games`.
- The tournament landing now describes every released event family with current
  metadata, JSON-LD, crawlable guidance, and useful internal links.
- Private My Teams, Trainer Dex, Operations, support, tournament workspace, and
  organization routes carry explicit `noindex` metadata under the documented
  policy.

The main regression file is `test/seo-metadata.test.js`. Extend it when changing
metadata, canonicals, sitemap membership, structured data, internal links, or
indexability.

## Route and indexability map

### Intended public, indexable surfaces

- `/`, `/explore`, `/leagues`, and eligible public `/league/[slug]` pages
- `/pokemon`, `/pokemon/a-z`, `/pokemon/types`, `/pokemon/type/[type]`,
  `/pokemon/generations`, `/pokemon/generation/[generation]`, and
  `/pokemon/[name]`
- `/guides` and `/guides/[slug]`
- `/formats` and `/formats/[slug]`
- `/resources` and `/resources/daily-games`
- `/nuzlocke`, `/nuzlocke/guides`, and all 37 `/nuzlocke/[game]` pages
- `/tournaments`
- `/about`, `/manuals`, `/manuals/commissioner`, `/manuals/manager`, and the
  public legal/information pages already present in the sitemap

### Private or intentionally non-indexed surfaces

- `/my-teams` and saved Nuzlocke Run Cards
- `/trainer-dex`
- `/operations`, `/operations/daily-three`, and `/operations/league/[id]`
- `/support`
- `/tournaments/[slug]` under the current policy, regardless of bracket type
- `/organizations` under the current policy
- authenticated league, draft-room, commissioner, membership, queue, and
  account state not represented by an explicitly public route

Do not expose these routes, their data, or their identifiers merely to improve
a crawler score. A page-level `noindex` is not a defect when the content is
private, account-specific, or intentionally withheld.

### Explicit indexability decisions

1. `/organizations` and `/organizations/[slug]` remain `noindex, nofollow` and
   outside the sitemap until the owner approves a narrower visibility-aware
   policy.
2. `/tournaments/[slug]` remains `noindex, nofollow` for standalone events,
   connected championships, and Draft Tournaments, regardless of application
   visibility. Public share access is not automatic search-indexing approval.
3. The public `/tournaments` landing is the indexable product-controlled source
   for the released event families. It does not place private names, codes,
   rosters, entrants, or commissioner controls in metadata or structured data.
4. Any future detail-page indexing requires authoritative visibility checks,
   stable canonicals, useful server-rendered public content, safe dynamic
   metadata, and sitemap queries limited to eligible public records.

## Measured external baseline

The August 8 measurement is the comparison point. Use the same scope and time
windows before declaring improvement or regression.

### Semrush Site Audit

- 1,544 pages crawled from a 5,000-page desktop limit with JavaScript rendering
  disabled
- 83% Site Health and 90% AI Search Health
- 85 errors, 1,506 warnings, and 519 notices
- 71 invalid structured-data items
- one broken internal link and one 4xx page
- four duplicate-title issues, four duplicate-description issues, and two
  duplicate-content pages
- 1,426 low text-to-HTML warnings, 376 pages more than three clicks deep, and 44
  pages with only one incoming internal link
- two large HTML pages, 35 URLs with more than two query parameters, and one
  orphaned sitemap page

Do not optimize the low text-to-HTML ratio as a score by adding filler. Repair
specific structured-data, link, canonical, page-depth, and content-quality
problems with template-level changes.

### Google Search Console

The seven-day view through August 6 recorded four clicks, 1,592 impressions,
0.3% CTR, and average position 40.6. The sitemap was successful and reported
1,496 discovered pages. The submitted-sitemap view reported 414 indexed and
1,012 not indexed, of which 1,001 were “discovered — currently not indexed.”

The homepage, guides, formats, Nuzlocke landing page, and a sampled Pokémon
profile were fetchable, indexable, and used their inspected URLs as Google's
selected canonical. Large “discovered — currently not indexed” counts are an
index-selection signal, not proof of a robots or sitemap failure.

### Position Tracking limitation

The current Semrush plan has one Australia desktop target and no spare target.
Replacing it would delete history. US desktop/mobile tracking needs a plan
upgrade or an explicit owner decision to sacrifice the existing campaign.
Changing that external monitoring configuration is not authorized by this
handoff.

## Recommended next sequence

### Phase 1 — repair confirmed crawl defects

1. Export or inspect the exact current URLs behind the 71 invalid
   structured-data items, one broken link, one 4xx, duplicates, and orphan.
2. Reproduce each defect against the final production commit. Several releases
   landed after the August 8 crawl, so do not fix stale findings blindly.
3. Validate WebSite, Organization, Article, Breadcrumb, WebApplication, and any
   page-specific JSON-LD with representative route tests and a schema
   validator. Preserve user-data escaping.
4. Fix the smallest shared templates first, then run a new crawl at the same
   5,000-page scope.

### Phase 2 — completed product alignment

1. `/tournaments` now represents single elimination, double elimination,
   connected championships, and Draft Tournaments accurately.
2. The organization and tournament indexing boundaries are documented in the
   stable public indexing policy and enforced by focused regression tests.
3. `llms.txt` has a current review date, verified links and product names, and
   no private workspace links.
4. The sitemap retains only approved indexable routes and uses truthful August
   9 modification dates for the changed product landings.
5. The persistent header and feature shortcuts remain intact; private tools did
   not become sitemap destinations or indexable pages.

### Phase 3 — improve catalog selection and depth

1. Use Search Console impressions and the current crawl to select Pokémon
   profile, type, generation, format, and Nuzlocke templates with real demand
   or weak internal support.
2. Add unique, data-backed profile sections and contextual links. Preserve
   sample sizes for DraftCenter aggregates and keep the existing conservative
   form-canonical policy.
3. Reduce click depth through useful indexes and relationships, not sitewide
   keyword lists.
4. Audit the 37 Nuzlocke guides for page weight, duplicate patterns, and factual
   differentiation. The complete library is already live; do not recreate the
   old four-page launch plan.
5. Expand format pages only with authoritative rules, legal-pool facts, and
   clearly qualified community evidence.

### Phase 4 — sharing, performance, and measurement

1. Add route-specific social images where they materially improve sharing for
   tournaments, Daily Games, Nuzlocke guides, formats, and authored guides.
2. Measure Core Web Vitals or equivalent lab evidence on the home page,
   Pokédex, one Pokémon profile, one format, Daily Games, tournament landing,
   Nuzlocke generator, and one large Nuzlocke guide.
3. Keep server payloads bounded. In particular, inspect large route-by-route
   Nuzlocke HTML and high-cardinality tournament views before adding content.
4. After a release, compare the same Semrush crawl and Search Console windows.
   Record an early read after about 14 days and a normal content decision after
   about 28 days unless a technical defect appears sooner.

## Release and validation contract

### Narrow checks while developing

- `npm run test:seo`
- focused route tests for tournaments, organizations, Daily Games, Nuzlocke,
  or Pokémon catalogs when those surfaces change
- `git diff --check`

### Preview review

For every changed public template, verify desktop and approximately 390px
mobile layouts plus:

- one useful visible H1 and meaningful raw server content where applicable;
- unique title, description, and canonical behavior;
- intended `index` or `noindex` behavior;
- valid JSON-LD with no user-controlled script injection;
- useful internal links that do not generate query duplicates;
- correct social metadata;
- no browser errors, layout shift, hidden focus, or sticky-header obstruction;
  and
- no private or signed-in data in raw HTML, metadata, sitemap output, or public
  API responses.

### Required release checks

Before proposing an application release, run:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

Require the protected pull-request checks and review the deployed Preview.
After an authorized merge, confirm the exact `main` commit is Ready in
Production, run `npm run smoke:production`, and verify the changed live routes.

No SEO test may mutate a real league, draft, roster, tournament, Daily Games
discussion, saved team, account, provider setting, or production row.

## Definition of done for the next SEO release

The next release is complete when:

1. its scope is tied to exact current crawl or Search Console evidence;
2. affected public/private indexability decisions are documented;
3. metadata, canonical, structured-data, sitemap, and internal-link regressions
   have focused tests;
4. public content is truthful, useful, differentiated, and server-readable;
5. private workspaces remain private and non-indexable;
6. full checks and Preview desktop/mobile review pass;
7. the protected pull request merges and the exact commit reaches Production;
8. the production smoke and focused live SEO checks pass; and
9. the same-scope follow-up measurement is scheduled and recorded.

## Owner decisions still required

- Whether public organization detail pages should become indexable, and what
  visibility state makes one eligible.
- Whether any public tournament, connected championship, or Draft Tournament
  detail page should become indexable.
- Whether to upgrade Semrush or replace the existing Australia Position
  Tracking campaign and lose its history.
- Whether a persistent Nuzlocke route tracker is wanted as a real product; it
  is not an SEO-only page.
- Whether the isolated release-wave Supabase Preview branch should be deleted
  by exact verified identifier. The retained multi-pod Preview branch is out of
  scope for deletion.

## Boundaries to preserve

- Do not modify Mushroom Cup or the intentionally paused historical Mushroom
  Hut drafts.
- Do not use real leagues or events for SEO screenshots, structured-data tests,
  or indexability experiments.
- Keep Operations reporting aggregate-only and keep Discord editorial,
  commissioner, and direct-message scopes separate.
- Do not put project identifiers, account details, email addresses, channel
  identifiers, keys, tokens, or other credentials into commits, metadata, or
  handoffs.
- Never rewrite a migration that may have run. Production is forward-only
  through migration 365.
