# DraftCenter SEO release and hardening handoff — August 6, 2026

## Outcome

The authorized release sequence is committed, merged through protected pull
requests, and deployed to production. Nuzlocke Lab, tournaments, Trainer Dex,
Daily Games, the technical SEO foundation, competitive resource and format
expansion, and the first four game-specific Nuzlocke guides are live.

- Production: https://www.draftcentral.gg
- Protected branch: `main`
- Verified production commit: `7e95ac96c7533167fc967a6cc23c4cff5356ae98`
- Latest production migration: 343
- Current application release pull request: 58

Vercel reports the exact commit Ready. The post-deployment signed-out smoke
sweep passes. No real league, draft, roster, tournament, Trainer Dex event, or
user record was created or changed for this release verification.

The application and database work is hardened for the released scope. SEO
measurement hardening is not yet complete because the current session did not
have authenticated Semrush or Google Search Console access. That account-bound
work is listed separately and must not be confused with an undeployed code
change.

## Deployed release map

| Pull request | Production commit | Scope |
| --- | --- | --- |
| 47 | `cd90679` | Nuzlocke Lab, tournaments, Trainer Dex, Daily Games foundations |
| 48 | `0c32022` | August 6 production release record |
| 49 | `815afdd` | SEO expansion and hardening plan |
| 50 | `6d30f73` | Raw H1s, Pokédex fragment state, shorter titles, form policy, related links |
| 51 | `4326b6e` | Playable and discoverable Daily Games |
| 52 | `745ed49` | Competitive Pokémon resource content |
| 53 | `2432db1` | Expanded format legal-pool facts |
| 54 | `bb74fa2` | Daily Games bracket champion ranking RPC migration |
| 55 | `6f08445` | Daily Games resource polish |
| 57 | `7f84b56` | Resource card artwork |
| 58 | `7e95ac9` | FireRed, Emerald, Platinum, and Scarlet Nuzlocke guides |

The sequence was deployed incrementally so each change had an isolated Preview,
repository checks, and an exact production commit. Pull request 58 is the
current production head and includes every release in the table.

## Product state

### Nuzlocke

Nuzlocke Lab supports all 37 reviewed main-series game catalogs from Red
through Violet. The original generator retains deterministic Team codes,
route-first and encounter-pool selection, equal and authentic weighting,
starter inclusion, family and legendary clauses, exclusions, method filters,
game-specific conditions, and game-limited final evolutions.

The first content cohort adds four server-rendered guides:

- `/nuzlocke/fire-red` — 2,108 encounter rows, 129 areas, 12 methods
- `/nuzlocke/emerald` — 1,743 encounter rows, 117 areas, 17 methods
- `/nuzlocke/platinum` — 4,227 encounter rows, 159 areas, 13 methods
- `/nuzlocke/scarlet` — 13,005 encounter rows, 80 areas, 13 methods

Every count, starter, condition option, representative area, and method is
derived from the pinned reviewed catalogs. Each guide has Article and breadcrumb
structured data, a self-canonical, contextual profile and guide links, a
sitemap entry, and a deterministic link into the generator. Only four pages
were published; the other 33 games remain intentionally unexpanded until the
cohort has real search and engagement evidence.

### Daily Games and Trainer Dex

The Daily Games resource now exposes the Daily Poll, Bracket, and Quiz as
playable public experiences with crawlable supporting content and navigation.
Trainer Dex remains private and records eligible Daily and draft discoveries
without becoming an indexable personal-data page.

Migration 343 restores bracket champion rankings. It was applied first to the
isolated Preview target and then to the exact production project. The final
audit verified:

- both bracket tables exist;
- the ranking function exists and is `SECURITY DEFINER`;
- its search path is fixed;
- anonymous and authenticated callers have only the intended execute access;
- `PUBLIC` execution is revoked; and
- anonymous current-day private results are excluded.

The direct anonymous production RPC returns HTTP 200. The verification changed
only the function, grants, and schema cache; it did not mutate game results or
user data.

### Tournaments and formats

Standalone single-elimination tournaments remain independent of league tables
and preserve their bounded RPC, RLS, registration, invitation, seeding, bracket,
result, dispute, correction, archive, and public-projection boundaries. No fake
public event was created for SEO. Format pages now expose more useful legal-pool
facts while the regulation catalog remains authoritative for actual drafts.

## SEO work completed

The first crawl backlog has been addressed at the application layer:

- `/` and `/pokemon` provide meaningful server-rendered H1 content;
- interactive Pokédex selection uses fragments instead of crawlable
  `?pokemon=` variants;
- the two overlong guide titles were shortened without flattening their visible
  editorial H1s;
- Pokémon form canonical behavior is documented and regression-covered;
- Pokémon profiles, formats, and guides expose useful contextual links;
- Nuzlocke, Daily Games, resources, and format pages have deeper crawlable
  content and cross-navigation; and
- the first four Nuzlocke game pages are present in the sitemap and `llms.txt`.

Sitemap splitting was not added because the available 100-page crawl could not
show a content-type indexing imbalance. Private Trainer Dex, account,
operations, and support routes retain their intended index restrictions.

## Validation evidence

### Repository and Preview

The release branches passed the applicable checks:

- `pnpm audit --prod --audit-level high` — no known vulnerabilities;
- `npm run test:all`;
- `npm run test:national-dex` — all 1,027 rows;
- `npm run build` — 144 generated routes/pages for the Nuzlocke release;
- `git diff --check`;
- required security tests, dependency audit, CodeQL, and full-history secret
  scan; and
- Ready Vercel Previews with no unresolved Preview feedback.

The Nuzlocke regression compares every published count, method, starter,
condition option, area key/name, and generator parameter with the raw pinned
catalog data. Preview review confirmed all four pages have one H1, the expected
title and canonical, two structured-data blocks, a working game-specific
generator link, and no horizontal overflow. A 390-by-844 mobile check also
passed and restored the Scarlet rules from its URL.

The security scanner initially treated public Pokémon area identifiers as
generic API keys. The final fix scopes the allowlist to the single generated
guide-data file. The rerun passed; no required check was bypassed.

### Production

- Exact `main` commit `7e95ac9` is Ready on Vercel.
- `npm run smoke:production` passes all public routes and expected signed-out
  protected API responses.
- All four live Nuzlocke guides return the expected title, self-canonical,
  single H1, two structured-data blocks, and generator parameters with no
  desktop overflow.
- The live Scarlet link restores game, Team code, six-slot size, route-first
  selection, equal weighting, starter inclusion, family clause, and legendary
  exclusion.
- Building that live run produced six encounters with Sprigatito first and no
  horizontal overflow.
- The Daily Games champion ranking RPC returns successfully after migration
  343 and preserves anonymous current-day privacy.

## Remaining work and ordered next steps

### 1. Establish the post-release measurement baseline

This is the only immediate hardening gate that could not be completed in the
current session. The owner needs to sign in to Semrush and Google Search
Console, then:

1. raise the Semrush Site Audit limit from 100 to at least 1,500, preferably
   2,000, and crawl production;
2. record Site Health plus errors, warnings, low-word-count, low text-to-HTML,
   H1, title, canonical, internal-link, blocked-page, and structured-data
   results from the same full crawl;
3. configure focused desktop/mobile Position Tracking groups for brand, draft
   leagues, Nuzlocke, Pokémon profiles, Daily Games, formats, and tournaments;
4. record Search Console clicks, impressions, CTR, position, sitemap processing,
   indexed/not-indexed counts, selected canonicals, top queries, and top pages;
   and
5. compare the new full crawl with the pre-release screenshot only as a
   directional baseline because the older crawl sampled 100 pages.

Do not repeatedly request indexing. Fix retrieval, robots, canonical, or
`noindex` defects immediately; otherwise allow normal recrawl time.

### 2. Review the four-page cohort

- Early review: August 20, 2026 (14 days)
- Decision review: September 3, 2026 (28 days)

For each guide, record indexing state, selected canonical, impressions, clicks,
CTR, average position, generator visits, and meaningful engagement. Expand to
more games only when the pages are accurate, indexable, and useful. A lack of
rankings in the first days is not a technical failure by itself.

### 3. Implement only evidence-backed follow-ups

1. Publish a separate original Nuzlocke rules guide covering core rules,
   optional clauses, gifts, duplicates, starters, and modern open-world games.
2. Decide whether a persistent route tracker is wanted as a real product. It
   requires a separate data model, RLS/grant review, focused regressions, and
   explicit production approval; it is not an SEO-only page.
3. Consider indexable tournament event pages only after real public events
   exist and stable public canonicals/privacy behavior are defined.
4. Add more format, tournament, Daily Three, or Pokémon-profile content only
   where Search Console and product usage show real demand.
5. Add route-specific Open Graph images as a sharing improvement, not as a
   direct ranking claim.

## Hardening status

### Complete

- application, database, RLS/grant, Preview, CI, responsive, and production
  release validation for the shipped scope;
- exact production commit and migration confirmation;
- no real-data mutations during SEO or release testing; and
- clean, collision-free migration numbering through 343.

### Pending account review

- full Semrush recrawl;
- Position Tracking baseline;
- Search Console indexing and query baseline;
- 14-day and 28-day cohort measurement; and
- Core Web Vitals review across the main templates if the connected measurement
  tools show a performance concern.

The released code may be called deployed and application-hardened. Do not call
the SEO program fully measurement-hardened until the authenticated crawl and
Search Console reviews are recorded.

## Safety reminders

- Continue from a fresh branch/worktree and preserve the dirty primary
  workspace.
- Never commit or document Supabase keys, project identifiers, session tokens,
  provider credentials, account details, private league identifiers, or user
  email addresses.
- Do not create fake tournaments, Daily results, Trainer Dex events, leagues,
  drafts, picks, or rosters for SEO evidence.
- Do not change provider settings, database projects, production data, or
  environment variables without exact scope and explicit owner approval.
- Keep private/account routes out of the sitemap and preserve their current
  robots boundaries.
