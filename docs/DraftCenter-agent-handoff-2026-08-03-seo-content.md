# DraftCenter SEO and content agent handoff — August 3, 2026

- Production: https://www.draftcentral.gg
- GitHub: `roblebaegaming/DraftCenter`; protected branch `main`
- Production baseline for this handoff: `441d3fe`
- Pull requests covered: #21, #22, #24, and #25
- Broader operations and launch handoff: `docs/DraftCenter-agent-handoff-2026-08-03.md`
- SEO roadmap: `docs/seo-content-roadmap-2026-08-to-12.md`
- Initial Pokémon cohort: `docs/pokemon-seo-priority-2026-08-03.md`
- Outside-reference queue: `docs/seo-outside-reference-backlog-2026-08.md`

## Purpose and current state

This document covers the public Pokémon catalog, technical SEO, educational
guides, content planning, and ethical outside-reference work completed on
August 3. It is designed to be combined with another agent's operational
handoff without changing the existing launch, database, draft-room, or
regulation safety instructions.

The work in this handoff is released to production. The public catalog and six
practical guide resources are live, the production sitemap contains 1,416 URLs,
Google Search Console has read the expanded catalog sitemap, and the protected
production smoke suite passes.

This is now primarily a measurement and editorial-quality program. DraftCenter
does not need hundreds of rushed pages or repeated indexing requests. New
pages should solve real coach or commissioner tasks, and profile improvements
should be selected from search demand, useful first-party data, and clear user
need.

## Work completed

### Public Pokémon discovery and profile expansion — `ff5a7c9`, pull request #21

The public Pokémon catalog now has crawlable discovery paths for:

- A–Z browsing;
- all 18 types;
- Generations I–IX;
- species and battle/stat profiles; and
- public forms with stable profile URLs.

Production and catalog validation confirmed:

- 1,025 species;
- 1,351 battle/stat profiles;
- 1,579 forms;
- 18 types; and
- 1,027 National Dex rows in the existing draft data audit.

Pokémon profiles now display:

- individual base stats and base-stat total;
- height and weight;
- types and abilities;
- explicit source and refresh information;
- format links and eligibility-aware community data;
- draft rate, ADP, auction samples, teammate patterns, and confirmed-match
  results when data exists; and
- visible sample sizes and cautions against overinterpreting small samples.

Core Pokédex facts are retrieved from PokéAPI and refreshed daily. DraftCenter
community statistics are anonymous aggregates from eligible DraftCenter
leagues. The website is the public catalog; a manually maintained master
spreadsheet is not currently the source of truth and should not be introduced
unless a defined editorial workflow requires one. A spreadsheet export can be
useful later for analysis, but duplicating the live sources by hand would
create stale-data and form-mapping risk.

`scripts/verify-public-pokemon-catalog.mjs` audits the PokéAPI catalog and the
public route model. `scripts/verify-national-dex-paging.mjs` continues to audit
the National Dex data used by draft functionality. Keep these responsibilities
separate: improving public discovery must not change regulation legality or
draft-board behavior.

### Search evidence and indexing work

The first 20 Pokémon were an initial monitoring and editorial cohort, not the
only Pokémon cataloged and not a permanent priority list. All validated species
and forms are represented through the public catalog routes.

The initial cohort combined the first available Search Console signals with
DraftCenter aggregate demand. Gengar, Archaludon, Garchomp, Dragonite, and
Venusaur received the first URL inspection.

After the expanded indexes were deployed:

- Gengar remained indexed and was not resubmitted;
- one indexing request was accepted for Archaludon;
- one indexing request was accepted for Garchomp;
- one indexing request was accepted for Dragonite; and
- one indexing request was accepted for Venusaur.

Do not repeatedly request indexing. Reinspect these four pages no earlier than
August 17. A newly discovered or not-yet-crawled page is not automatically a
technical defect; allow 14–28 days unless retrieval, canonical, `noindex`, or
robots evidence shows a concrete problem.

The initial Search Console window, July 29–August 1, contained only 43
impressions and one click. Do not change every Pokémon title from that sample.
Consider title or description changes only after a page has at least 100
impressions and materially weak click-through rate for its position.

### August content foundation — `e9b7aa2`, pull request #22

The initial guide cluster, internal guide links, resource-hub references, SEO
roadmap, priority cohort, and outside-reference backlog were added. Search
Console read the expanded 1,414-URL sitemap generated at that stage.

The roadmap covers August 3 through December 31 and includes weekly measurement,
monthly comparisons, publishing targets, decision thresholds, responsible
community outreach, first-party data studies, and a year-end review.

### Human, product-specific guide rewrite — `2170ddc`, pull request #24

The original four public guides were rewritten to sound like an experienced,
helpful league participant rather than generic generated copy. They now explain
what a reader is deciding, common mistakes, and how the relevant DraftCenter
feature is actually used.

The released guides are:

- `/guides/what-is-pokemon-draft-league`
- `/guides/snake-vs-auction-draft`
- `/guides/pokemon-draft-league-formats`
- `/guides/how-to-tier-pokemon-for-draft-league`

Each guide uses contextual **How this works in DraftCenter** callouts and links
readers to the next relevant tool or resource. Future guide edits should keep
this pattern: practical explanation first, product instructions where they
help, and no claims that community aggregates prove causation.

### First-league guide and rules template — `441d3fe`, pull request #25

Two additional resources are released:

- `/guides/how-to-join-first-pokemon-draft-league`
- `/guides/pokemon-draft-league-rules-template`

The newcomer guide walks a coach through choosing a suitable league, reading
the format, claiming one team, preparing a flexible draft plan, completing
draft night, preparing a first matchup, using official transaction and message
paths, and asking for help. It includes a seven-item readiness checklist.

The commissioner resource includes a one-click copy control and a complete
rules template covering:

- league basics, game, format, and legal mechanics;
- rosters, draft type, order, budget, timers, and missed picks;
- match-week deadlines, extensions, results, disconnects, and forfeits;
- standings and playoffs;
- trades and free agency;
- inactivity and replacement coaches;
- conduct, rulings, conflicts of interest, and appeals; and
- coach agreement before the draft.

It also includes a ten-item commissioner rules and launch checklist. The copy
control uses the browser clipboard with a safe selection fallback and an
accessible status message.

## Production verification and protected boundaries

The four SEO/content releases passed the protected pull-request workflow and
Vercel deployment checks. The final resource release passed:

- 40 automated tests in the full suite;
- 1,027-row National Dex validation;
- public catalog validation for 1,025 species, 1,351 profiles, and 1,579 forms;
- a production build generating 95 application routes;
- live verification of both new guides, their guide-directory links, and their
  sitemap entries;
- a 1,416-URL production sitemap count; and
- the production smoke suite, including expected 401 responses from protected
  owner, operations, support, recovery, and account-deletion endpoints.

The SEO/content work did not modify:

- `src/components/PokemonDraftLeague.jsx`;
- `src/lib/regulation-catalog.js`;
- `src/lib/showdown-regional-pokedexes.js`;
- Supabase migrations or production league records;
- active or paused draft sessions;
- roster, pick, queue, membership, or deadline data; or
- authentication and Turnstile enforcement.

Preserve that boundary. Public profiles may explain regulation eligibility,
but regulation catalogs and draft-board pools remain authoritative for actual
league operations.

## Work still required

### Immediate, with Turnstile kept last

1. Record the first complete seven-day Search Console snapshot when available:
   clicks, impressions, CTR, position, top pages and queries, and initial
   indexed/not-indexed reasons.
2. Confirm Google-selected canonicals for the home page, one guide, one format,
   one Pokémon profile, and one public league after the reports finish
   processing.
3. Reinspect Archaludon, Garchomp, Dragonite, and Venusaur on or after August
   17. Do not submit another indexing request unless there is a specific
   technical reason.
4. Ask two known commissioners to review the copyable rules template. Record
   omissions and make only evidence-based revisions.
5. Share the beginner guide and rules template once in an appropriate
   DraftCenter community channel after the owner selects the destination and
   confirms posting rules.
6. Complete the separate human Turnstile test last, in a normal signed-out
   private browser. Keep strict enforcement off until that passes, following
   the sequence and rollback instructions in the broader August 3 handoff.

### August 17–31

- Review the initial guide cluster after at least 14 days of data.
- Select profile enrichments from updated Search Console and DraftCenter data;
  do not assume the original priority 20 remain the best opportunities.
- Add or refine contextual internal links where actual query journeys reveal a
  gap.
- Incorporate commissioner feedback into the rules template with permission;
  credit contributors only if they want attribution.
- Offer the resource to one existing DraftCenter league as neutral onboarding
  material. A link is optional and should never be required.

### September–December

Follow `docs/seo-content-roadmap-2026-08-to-12.md` rather than improvising a
high-volume publishing schedule. The current planned sequence is:

- September: snake-draft strategy, auction-draft strategy, and a stronger
  comparison hub with a useful checklist or worksheet;
- October: a transparent DraftCenter draft-trends study, data methodology page,
  and ADP guide;
- November: role-compression and speed-control hubs plus 10 evidence-selected
  Pokémon profile improvements; and
- December: a 2026 year-in-review report and 2027 commissioner planning pack.

Each month should include two substantial assets, one proven-page refresh,
five to ten useful internal-link improvements, no more than five personalized
outreach conversations, and a recorded Search Console/referral review.

### Advertising and eventual monetization

Advertising is not the next implementation step. First build reliable organic
traffic, recurring community use, analytics history, and enough high-quality
public reading inventory to estimate revenue without degrading the product.

When traffic is meaningful, begin with a small experiment on long-form public
guides and selected public Pokémon profiles. Measure revenue per thousand page
views, layout shift, page speed, engagement, and user complaints before adding
more placements.

Do not place ads in:

- live draft rooms;
- sign-in, registration, or password-reset flows;
- commissioner tools;
- private team workspaces;
- Operations and support areas;
- dense interactive controls where accidental clicks are plausible; or
- unmoderated user-generated content.

Keep sponsorships clearly labeled and separate from rankings, tiering, search
results, eligibility, or editorial recommendations. Do not sell links or make
outside references conditional on reciprocal promotion.

## Measurement and decision rules

- Record a seven-day Search Console snapshot every Monday.
- Compare the previous 28 days with the prior 28 days on the first Monday of
  each month.
- Annotate deployments, content releases, community shares, and unusual events.
- Wait 14 days before judging a new or materially revised page and normally 28
  days before changing direction.
- Investigate immediately when an important URL is blocked, unexpectedly
  canonicalized elsewhere, marked `noindex`, missing from the sitemap, or
  unavailable to crawlers.
- If large numbers of Pokémon profiles are crawled but not indexed after 6–8
  weeks, improve only profiles with demand or useful data and reassess whether
  every low-value form belongs in the sitemap.
- Prefer relevant editorial references and qualified referral visits over raw
  backlink counts.
- Never scrape community members, bulk-message, buy links, trade links, or send
  repeated unanswered outreach.

## Primary implementation files

- `src/app/pokemon/[name]/page.js`
- `src/app/pokemon/a-z/page.js`
- `src/app/pokemon/types/page.js`
- `src/app/pokemon/type/[type]/page.js`
- `src/app/pokemon/generations/page.js`
- `src/app/pokemon/generation/[generation]/page.js`
- `src/app/guides/[slug]/page.js`
- `src/app/sitemap.js`
- `src/components/GuideCopyBlock.jsx`
- `src/lib/publicPokemonIndex.js`
- `src/lib/seoContent.js`
- `src/lib/guideTemplates.js`
- `scripts/verify-public-pokemon-catalog.mjs`
- `scripts/verify-national-dex-paging.mjs`
- `test/seo-metadata.test.js`

## Validation commands for future related changes

Run these from the DraftCenter repository:

```text
pnpm run test:all
pnpm run test:national-dex
pnpm run test:pokemon-catalog
pnpm run build
pnpm run smoke:production
```

The production smoke command should run only after deployment. A future agent
must also perform a focused diff review of draft, regulation, Supabase, and
authentication paths before releasing public catalog or guide changes.

## Merge guidance for the receiving agent

Use this as an additive SEO/content section beside the broader August 3
operations handoff. If another agent has newer production work, update the
baseline commit and validation totals rather than discarding the completed
release history above. Preserve the broader handoff's live-league protections,
performance monitoring thresholds, rollback instructions, privacy rules, and
Turnstile sequence as authoritative.
