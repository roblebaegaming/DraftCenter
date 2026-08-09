# DraftCenter handoff - indexing and crawl improvements

- Date: August 9, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Branch: `codex/seo-indexing-improvements-2026-08-09`
- Base: `origin/main` at `ec9b0b35a8c6a38221a8cb621092dc373e87a409`
- Production application before this work: `cdce0f19c62110cff384d204f890be01042735b6`
- Latest production migration: 368
- Database or provider change: none
- Release state: validation and protected release in progress

## Why this work exists

The owner reported a failed GitHub security email and two Google Search
Console indexing emails. The security failure was historical: the initial
pull-request run treated public Pokémon catalog provenance hashes as possible
secrets. Commit `43c6108` narrowed the existing Gitleaks allowlist, and every
later pull-request and `main` full-history secret scan passed.

The Search Console redirect, alternate-canonical, and `noindex` examples were
also intentional:

- the bare Deoxys route redirects to its resolved default form;
- HTTP and the bare host redirect to the canonical HTTPS `www` host;
- legacy `?pokemon=` directory states canonicalize to `/pokemon`; and
- `/support` remains intentionally `noindex` and outside the sitemap.

Search Console's August 6 coverage snapshot reported 466 indexed and 1,033
not indexed: 967 discovered but not yet indexed, 61 crawled but not indexed,
two redirects, two alternate canonicals, and one intentional `noindex`. The
first 500 discovered examples contained 474 Pokémon profiles. The 61 crawled
examples were primarily newly released format and Nuzlocke pages. This is an
index-selection and crawl-allocation problem at the current catalog scale, not
evidence of a site-wide robots failure.

## Reproduced technical defects

The August 8 Semrush snapshot was checked at URL level against the current
production application before editing:

- `/pokemon/tauros-paldea` returned 404 and was linked from
  `/pokemon/charizard-mega-x`;
- tournament teammate links generated 94 avoidable redirects to unresolved
  species-default routes such as `/pokemon/basculegion`, `/pokemon/maushold`,
  `/pokemon/aegislash`, `/pokemon/meowstic`, and `/pokemon/urshifu`;
- Nuzlocke `WebApplication` and nested `VideoGame` markup produced 71 invalid
  structured-data findings because software rich-result markup requires
  offers plus a rating or review;
- the male and female Mega Meowstic pages shared the same title, description,
  and visible display name, while the two 10% Zygarde records shared title and
  description text despite different abilities;
- eight titles exceeded the audit threshold, including seven long Pokémon
  form names and the Daily Games title; and
- the public Pallet Town league was in the sitemap but its link was available
  only after the client-side directory RPC and tab selection.

## Implemented improvements

- Paldean Tauros aliases now resolve directly to the three live `-breed`
  routes. Tournament teammate links use the same canonical profile resolver
  as other public Pokémon links.
- The exact Gitleaks configuration fixture now includes the two public
  species-trait provenance paths added by the earlier hotfix, restoring the
  regression contract behind the passing full-history scan.
- Separate battle records with ambiguous API labels receive truthful public
  qualifiers: male/female for Mega Meowstic and Aura Break/Power Construct for
  10% Zygarde.
- Pokémon profile titles use the shorter `<name> Pokédex & Stats` pattern,
  and Daily Games uses `Pokémon Daily Games, Polls & Quizzes`.
- The Nuzlocke landing uses `WebPage` plus breadcrumb data. Game guides retain
  `Article` and breadcrumb data while representing the game name as text,
  avoiding software-offer and rating requirements. Preconfigured generator
  query links remain useful to visitors but are marked `nofollow` so crawlers
  focus on the canonical landing and guides.
- `/leagues` now server-renders the existing public league-card RPC and emits
  a direct link to every eligible returned league independent of the active
  join/watch filter. No league visibility, data, or membership was changed.

## Validation evidence

Completed before the protected release:

- focused SEO, Nuzlocke-guide, and Daily Games tests;
- the complete application test suite;
- National Dex paging across 1,027 rows;
- the public catalog check across 1,025 species and 1,351 profiles;
- a production dependency audit with no known vulnerabilities;
- a production build covering 221 generated application routes; and
- rendered local checks for the Tauros redirect and referring link, all four
  formerly duplicate profile titles and canonicals, Nuzlocke JSON-LD types,
  the guide `nofollow` state link, and the shorter Daily Games title.

Protected checks, exact Preview review, production deployment, and
post-deployment smoke evidence must be appended before this release is called
complete.

## Safety boundaries

- No production league, draft, roster, membership, tournament, prediction,
  provider setting, environment variable, or secret was changed.
- No database migration is required; production remains at migration 368.
- The original dirty workspace remains untouched. All work is in the isolated
  branch and worktree named above.
- No rating, review, offer, or other rich-result claim was fabricated to make
  a validator pass.

## Measurement after release

Run a comparable 5,000-page Semrush crawl after production cache replacement.
Use roughly August 23 for the early 14-day Search Console read and September 6
for the normal 28-day content/indexing decision. Do not request indexing for
all 1,351 profiles or interpret every `discovered - currently not indexed`
URL as a technical failure. Prioritize URL groups with search demand and add
useful differentiated content only where the fixed-window evidence supports
it.

## Authoritative references

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- [`DraftCenter-agent-handoff-2026-08-09-post-release-continuation.md`](DraftCenter-agent-handoff-2026-08-09-post-release-continuation.md)
- [`../seo-measurement-2026-08-08.md`](../seo-measurement-2026-08-08.md)
- [`../pokemon-profile-canonical-policy.md`](../pokemon-profile-canonical-policy.md)
- [`../public-indexing-policy.md`](../public-indexing-policy.md)
- [`../../AGENTS.md`](../../AGENTS.md)
