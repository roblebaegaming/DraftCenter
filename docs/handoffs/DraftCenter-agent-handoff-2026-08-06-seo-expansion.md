# DraftCenter SEO expansion handoff — August 6, 2026

## Purpose

This is the current continuation handoff after the August 6 production release.
It separates the SEO foundation that is already live from the opportunities
identified in the first post-release crawl. It is an implementation, testing,
and hardening plan; it does not claim that the new SEO backlog has been built.

Read this document with:

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md) for the short production state;
- [`DraftCenter-agent-handoff-2026-08-06-release-integration.md`](DraftCenter-agent-handoff-2026-08-06-release-integration.md)
  for the completed application and database release;
- [`../seo-content-roadmap-2026-08-to-12.md`](../seo-content-roadmap-2026-08-to-12.md)
  for the longer editorial program; and
- [`../../AGENTS.md`](../../AGENTS.md) for permanent repository and production
  safety rules.

## Production baseline

- Production: https://www.draftcentral.gg
- Protected branch: `main`
- Current production `main`: `0c32022`
- Feature application release: `cd90679`, pull request 47
- Production database: migrations 1-342, with the August feature sequence at
  261-342
- Post-release documentation: pull request 48

The feature release is complete. Nuzlocke Lab, tournaments, Daily Games,
Trainer Dex, and the Nuzlocke search-discovery pass are live. Production
migrations 261-342 were applied in order and verified. The final signed-out
production smoke sweep passes, and the live Nuzlocke, Daily Games, Trainer Dex,
and tournament routes return HTTP 200.

The primary workspace contains unrelated pre-existing local changes. Preserve
them. Continue SEO work in a fresh worktree and short-lived `codex/` branch from
the latest `origin/main`; do not build a release from the dirty primary
workspace.

## SEO work already live

The production site already includes:

- canonical metadata and useful descriptions for the main public routes;
- a 1,429-URL sitemap containing 1,354 Pokémon profiles, 18 type indexes, nine
  generation indexes, 26 format pages, six guides, one public league, and the
  current public hubs;
- crawlable A-Z, type, and generation Pokémon discovery pages;
- individual Pokémon profiles with server-rendered headings, stats, abilities,
  measurements, source information, community aggregates, canonicals,
  breadcrumbs, and social metadata;
- six original draft-league guides with Article and breadcrumb structured data,
  editorial dates, practical checklists, and contextual product links;
- format landing pages with unique canonicals and breadcrumb structured data;
- Nuzlocke metadata, WebApplication and breadcrumb structured data, crawlable
  explanations, profile links, reciprocal resource links, and a weekly 0.9
  sitemap priority;
- an indexable Daily Games resource page with roughly 300 words of raw
  server-rendered text;
- an indexable tournament organizer landing page; and
- intentional `noindex` treatment for private Trainer Dex, My Teams, and
  support-oriented pages where search discovery is not the product goal.

The latest crawl reports zero 4xx errors, zero broken internal links, zero
duplicate titles or descriptions, zero missing descriptions, zero sitemap or
robots format errors, and zero structured-data errors across the items it
checked.

## Latest crawl and search evidence

The connected Semrush Site Audit completed its first post-release crawl on
August 6 at approximately 10:48 PM Mountain time. It crawled 100 pages, reached
a Site Health score of 95, and reported zero errors, 121 warnings, and 46
notices.

Compared with the counts visible before that crawl:

| Check | Before | Latest | Interpretation |
| --- | ---: | ---: | --- |
| Low word count | 37 | 34 | Improved by three pages |
| Low text-to-HTML ratio | 82 | 82 | Unchanged; concentrated in app and generated templates |
| Missing H1 | 6 | 3 | Improved, but the remaining three are genuine raw-HTML issues |
| Long title element | 2 | 2 | Two guide titles still need shortening |
| Only one internal link | 30 | 44 | Not comparable as a whole-site regression under the 100-page crawl cap |

The audit currently samples only 100 of 1,429 sitemap URLs. Raise the crawl cap
to at least 1,500, preferably 2,000, before using page-count changes as
whole-site evidence.

### Confirmed technical findings

The three missing raw-HTML H1 pages are:

- `/`
- `/pokemon`
- `/pokemon?pokemon=Miraidon`

The hydrated browser UI shows an H1 on the home page and Pokédex, but their
initial server responses contain no H1 because the client components render a
loading/authentication shell first. Search engines can render JavaScript, but
the stable fix is a meaningful server-rendered heading and introduction.

The two long titles are:

- `How to Run a Pokémon Draft League: A Commissioner’s Walkthrough | DraftCenter`
- `Pokémon Draft League Rules Template and Commissioner Checklist | DraftCenter`

Recommended search titles are:

- `How to Run a Pokémon Draft League | DraftCenter`
- `Pokémon Draft League Rules Template | DraftCenter`

The visible H1s may retain their longer editorial wording.

The 44 sampled pages with only one internal link consist of:

- 23 format pages;
- 18 Pokémon profiles;
- two guides; and
- one parameterized Pokédex URL.

The low text-to-HTML warning should not be optimized as a score by itself.
Prioritize meaningful raw server content, useful internal links, and measured
performance. The warning is concentrated in Pokémon profiles, format pages,
and client-rendered hubs, so template-level improvements are more appropriate
than one-off padding.

The two blocked pages are expected private or intentionally non-indexed routes,
not release defects. Do not make private workspaces crawlable to improve an
audit score.

### Organic discovery evidence

Semrush currently finds 63 US organic keywords. Estimated traffic remains
minimal and most positions are outside page one, which is normal for a new
catalog. Early discovery includes Mega Delphox, Dusk Mane Necrozma, Eternamax
Eternatus, G-Max Toxtricity, Water-type pages, and several individual Pokémon
stat/type queries.

Position Tracking is enabled on the Semrush project but does not currently
return an active target campaign. Configure a focused campaign rather than
trying to monitor all 1,429 URLs.

Current US keyword estimates support these opportunities:

| Topic | Monthly volume | Difficulty |
| --- | ---: | ---: |
| `nuzlocke rules` | 8,100 | 33 |
| `nuzlocke tracker` | 5,400 | 38 |
| `pokemon nuzlocke` | 3,600 | 48 |
| `pokemon nuzlocke rules` | 2,900 | 21 |
| `what is nuzlocke` | 1,900 | 32 |
| `pokemon fire red nuzlocke` | 320 | 6 |
| `pokemon emerald nuzlocke` | 320 | 15 |
| `pokemon platinum nuzlocke` | 320 | 25 |
| `pokemon scarlet nuzlocke` | 170 | 18 |
| `pokemon draft league` | 590 | 22 |
| `draft league pokemon` | 320 | 9 |
| `pokemon draft` | 260 | 6 |
| `pokemon daily game` | 210 | 18 |

Treat these as directional estimates, not traffic promises. Confirm decisions
against Search Console impressions and real user behavior after enough data
accumulates.

## Work not yet implemented

The following items are recommendations from the post-release audit and remain
unimplemented:

1. Raise the Semrush crawl limit and run a complete crawl.
2. Configure a focused desktop/mobile Position Tracking campaign.
3. Add meaningful server-rendered H1/introduction shells to `/` and `/pokemon`.
4. Stop creating crawlable `/pokemon?pokemon=...` variants from every profile.
5. Classify Pokémon forms so cosmetic or statistically identical variants can
   canonicalize to a primary page or leave the sitemap while distinct battle
   forms remain indexable.
6. Shorten the two guide title elements.
7. Add template-level related links to Pokémon profiles, format pages, and
   guides.
8. Split the sitemap by content type for Search Console monitoring if indexing
   or crawl allocation remains uneven.
9. Create original game-specific Nuzlocke landing pages, beginning with FireRed,
   Emerald, Platinum, and Scarlet.
10. Publish a maintained Nuzlocke rules guide connected to the live generator.
11. Decide whether a genuine game/route Nuzlocke tracker belongs in the product.
12. Enrich format pages with unique data instead of repeated overview copy.
13. Expand the tournament landing page beyond its current roughly 100 raw words.
14. Consider a dedicated Daily Three landing/archive after Search Console
    confirms demand beyond the existing Daily Games resource page.
15. Add page-specific social preview images for the major tools and editorial
    clusters.

## Recommended implementation sequence

### Phase 0 — correct the measurement baseline

1. Increase the Site Audit crawl limit to 1,500-2,000 and recrawl production.
2. Configure Position Tracking groups for brand, draft leagues, Nuzlocke,
   Pokémon profiles, Daily Games, and tournaments. Track the primary audience
   location on desktop and mobile.
3. Record a current Search Console snapshot: clicks, impressions, CTR, position,
   indexed/not-indexed counts, sitemap processing, top queries, and top pages.
4. Do not repeatedly request indexing. Investigate retrieval, robots, canonical,
   and `noindex` defects immediately; otherwise allow 14-28 days.

This phase changes monitoring configuration, not the application. Any account
or campaign-setting change requires the owner’s authorization for that exact
external action.

### Phase 1 — technical crawl and index quality

Implement one focused pull request for:

1. server-rendered home and Pokédex headings/introduction text;
2. shorter guide title elements;
3. fragment-based interactive Pokédex state such as `/pokemon#miraidon`, so
   profile links no longer generate unique query URLs;
4. a documented form-classification and canonical policy with regression tests;
5. related-link components for Pokémon and format templates; and
6. sitemap segmentation only if the full crawl or Search Console shows a
   content-type indexing imbalance.

The preferred Pokédex behavior is progressive enhancement: `/pokemon` remains
the canonical interactive directory, `/pokemon/<name>` remains the canonical
search profile, and a URL fragment may select a Pokémon without creating a new
server URL for crawlers.

Do not mass-redirect or canonicalize forms until the code can distinguish
cosmetic duplicates from battle/stat forms. Preserve profiles whose typing,
stats, abilities, or competitive identity are materially distinct.

### Phase 2 — Nuzlocke search cluster

Start with four server-rendered game pages:

- `/nuzlocke/fire-red`
- `/nuzlocke/emerald`
- `/nuzlocke/platinum`
- `/nuzlocke/scarlet`

Each page should use the reviewed catalog to provide unique, factual value:

- supported starters;
- verified encounter, location, and method totals;
- game-specific conditions or mechanics;
- representative encounter areas;
- supported clause behavior;
- a preconfigured link into the generator; and
- contextual links to relevant Pokémon profiles and Nuzlocke guidance.

Do not publish 37 near-identical pages in the first release. Validate indexing,
engagement, and accuracy on the four-page cohort, then expand only when the
template proves useful. All catalog claims must derive from the reviewed game
metadata rather than invented editorial prose.

Publish a separate original Nuzlocke rules guide that explains the core rules,
common optional clauses, gifts, duplicates, starters, and modern open-world
adaptations. Keep the guide distinct from the generator’s product instructions.

A route tracker is a larger product decision, not an SEO-only page. Build it
only if it provides real run-state tracking by game and does not create or
modify league, draft, roster, or Trainer Dex data without an explicit design.

### Phase 3 — deepen proven templates

1. Improve Pokémon profiles selected from Search Console opportunity, current
   rankings, and useful DraftCenter aggregates. Candidate sections include
   evolution relationships, weaknesses/resistances, game availability, related
   forms, draft role, same-type alternatives, and related profiles.
2. Add unique format facts: supported game/era, legal-pool counts, major rules,
   regulation date range where authoritative, related formats, and sufficiently
   sampled DraftCenter usage.
3. Strengthen guide clusters with contextual next-step links. Avoid generic
   keyword blocks or hundreds of interchangeable paragraphs.

### Phase 4 — Daily Games, tournaments, and sharing

1. Improve the tournament landing page with an original explanation of entry,
   seeding, bracket locking, result confirmation, corrections, privacy, and
   public viewing. Do not create fake public tournament records for SEO.
2. Once real public tournaments exist, consider indexable public event pages
   with stable canonicals and accurate event data. Private events stay private.
3. Evaluate a dedicated Daily Three landing page and dated archive only after
   the current Daily Games page has enough query data. Avoid thin daily pages or
   spoiler-heavy archives.
4. Add branded, route-specific Open Graph images for Nuzlocke, Daily Games,
   tournaments, formats, and guides. Social previews improve sharing but should
   not be described as a direct ranking improvement.

## Implementation files likely to change

- `src/app/page.js`
- `src/components/AuthGate.jsx`
- `src/app/pokemon/page.js`
- `src/components/PokemonDirectory.jsx`
- `src/app/pokemon/[name]/page.js`
- `src/lib/publicPokemonIndex.js`
- `src/app/formats/[slug]/page.js`
- `src/lib/seoContent.js`
- `src/app/guides/[slug]/page.js`
- `src/app/nuzlocke/page.js`
- new `src/app/nuzlocke/[game]/page.js` only after the data contract is defined
- `src/components/TournamentDirectory.jsx`
- `src/app/sitemap.js` or a Next.js sitemap-index structure
- `test/seo-metadata.test.js`
- `test/nuzlocke-generator.test.js`
- `scripts/verify-public-pokemon-catalog.mjs`

Keep public discovery changes separate from regulation legality, draft pools,
and league mutations. Public copy may describe a format, but the existing
regulation catalog remains authoritative for actual drafts.

## Validation plan

### Narrow checks while developing

- `npm run test:seo`
- `npm run test:nuzlocke` for game-page or generator changes
- `npm run test:pokemon-catalog` for profile, form, or sitemap changes
- focused tests for fragment restoration, canonical selection, related links,
  and every new game-page data contract
- `git diff --check`

### Preview checks before merge

For every changed public template, inspect desktop and approximately 390px
mobile layouts and verify:

- exactly one useful visible H1 after hydration;
- an H1 and meaningful introduction in the raw server HTML where applicable;
- a unique title and description;
- the expected self-canonical or documented primary canonical;
- intended `index`/`noindex` behavior;
- no unexpected query URLs in internal links;
- useful links to at least two relevant next destinations;
- valid JSON-LD with no user-controlled script injection;
- working social image metadata;
- no browser console warnings or errors; and
- no layout shift or blocked interaction caused by the SEO content.

For Pokémon form changes, audit a representative matrix:

- one ordinary species;
- one regional form;
- one Mega or Gigantamax battle form;
- one form with different typing or stats;
- one cosmetic or mode-only duplicate candidate;
- one punctuation-sensitive name; and
- one legacy `/pokemon?pokemon=...` link.

For Nuzlocke game pages, verify exact catalog counts and links for all four
initial games, deterministic generator restoration, starter behavior, method
filters, final-evolution behavior, excluded species, and a source mismatch that
fails closed.

### Required release checks

Before proposing an application release, run:

```text
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run test:pokemon-catalog
npm run build
```

Require protected pull-request checks and review the deployed Preview. After an
authorized merge, confirm the exact deployed `main` commit and run:

```text
npm run smoke:production
```

Then confirm HTTP 200, canonical, title, description, H1, and robots behavior
for every changed public route. A local or Preview build is not production
evidence.

### Measurement after release

1. Run the full Semrush crawl after deployment and compare the same snapshot,
   not two different 100-page samples.
2. Record sitemap counts by content type.
3. Inspect Search Console for the changed templates and initial Nuzlocke pages.
4. Wait at least 14 days for an early read and normally 28 days for a content
   decision unless a technical defect is visible.
5. Record impressions, clicks, CTR, position, selected canonical, indexing
   state, and meaningful product engagement.

## Hardening gates

The SEO expansion is ready to call hardened only when all applicable gates
below pass.

### Crawl and index safety

- Every indexable page is public, stable, self-canonical unless intentionally
  consolidated, represented in the correct sitemap, and reachable through
  useful internal links.
- Private, account-specific, support, owner, and operations routes remain out of
  the sitemap and retain their intended robots restrictions.
- Parameterized and cosmetic duplicate URLs do not consume unnecessary crawl
  budget.
- Redirects are permanent only when the canonical replacement is certain.

### Content and data integrity

- Game-specific and format-specific statements come from reviewed sources or
  documented application data.
- First-party aggregates show sample sizes and never expose private league,
  user, Discord, or account information.
- Small samples are qualified rather than promoted as definitive rankings.
- Authored pages include an owner, review date, source/methodology path, and a
  correction route where appropriate.

### Security and privacy

- JSON-LD and metadata do not interpolate unsanitized user-controlled values.
- No new public query exposes private data or broadens an RLS boundary.
- A future persistent Nuzlocke tracker requires a separate data model, RLS/grant
  review, focused regression tests, and explicit production approval.
- No secret, provider credential, private project identifier, account detail,
  or private league data enters documentation or generated metadata.

### Performance and accessibility

- Measure Core Web Vitals or equivalent lab metrics on the home page, Pokédex,
  one Pokémon profile, one format, one guide, and one Nuzlocke game page.
- Avoid fetching all 1,354 profiles or every encounter row during a single page
  request. Use bounded reviewed metadata and cached server data.
- Heading order, link text, keyboard navigation, focus states, image alt text,
  color contrast, and mobile layouts pass review.
- Social images have correct dimensions and descriptive alternatives.

### Operational release safety

- No SEO test mutates a real league, draft, roster, queue, tournament, Trainer
  Dex event, provider setting, or production database row.
- Production starts from the authoritative migration state through 342; an SEO
  content release should not add a migration unless a separately approved
  product feature genuinely requires one.
- The release branch is clean, checks pass, Preview is reviewed, `main` is
  merged through a pull request, the deployed commit is confirmed, and the
  post-deployment smoke sweep passes.

## Definition of done for the next agent

The next technical SEO release is complete when:

1. the full-crawl baseline is recorded;
2. the raw home and Pokédex responses contain one meaningful H1;
3. the two guide titles no longer trigger the long-title warning;
4. profile links no longer create crawlable `?pokemon=` variants;
5. form canonical behavior is documented and covered by tests;
6. Pokémon, format, and guide templates expose useful related links;
7. required tests and the Preview review pass;
8. the protected pull request merges and the exact production commit is Ready;
9. the production smoke sweep and focused live SEO checks pass; and
10. the deployment is annotated for the 14-day and 28-day measurement reviews.

After that technical release is stable, begin the four-page Nuzlocke cohort as
a separate pull request. Do not combine form canonicalization, sitemap
restructuring, 37 game pages, a tracker product, and unrelated application work
into one release.

## Owner decisions still required

- Whether to authorize changing the Semrush crawl limit and Position Tracking
  campaign settings.
- Whether the first Nuzlocke content cohort should use the recommended four
  games or a different evidence-backed set.
- Whether a persistent Nuzlocke route tracker is wanted as a real product.
- Whether public tournament detail pages should become indexable once real
  public events exist.
- Which community channels, commissioners, or resource maintainers may receive
  the existing guides; no outreach should occur without the owner choosing the
  destination and confirming its posting rules.
