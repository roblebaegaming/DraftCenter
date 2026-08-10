# SEO and AI answer resources - August 10, 2026

This record documents the evidence-led editorial release shipped through pull
request [#114](https://github.com/roblebaegaming/DraftCenter/pull/114) and the
Search Console actions completed after exact production commit
`08668350d29a28b07bb8e0a83d301426e5a61121` became Ready.

## Measurement basis

The August 10 weekly report showed 2,483 Google impressions and seven clicks in
the latest seven-day window, up from 43 impressions and one click in the August
3 baseline. The new visibility was concentrated in public guides, formats, the
homepage, Pokemon profiles, and type or generation indexes. It also showed that
the original six guides already covered the first six prompt-tracking topics,
while five useful high-intent questions still lacked a focused public answer.

The lower average position and CTR were treated as expected consequences of
Google testing hundreds of newly discovered pages, not as evidence for a mass
title rewrite. The high-impression Pokemon pages therefore retain their current
titles and canonical policy until another measurement window is available.

## Published resources

| Search or AI question | Canonical resource |
| --- | --- |
| How should I use ADP in a Pokemon draft? | `/guides/how-to-use-pokemon-draft-adp` |
| How do transactions and free agency work? | `/guides/pokemon-draft-league-transactions-free-agency` |
| How do standings, tiebreakers, and playoffs work? | `/guides/pokemon-draft-standings-tiebreakers-playoffs` |
| Where can I compare forms, stats, and draft data? | `/guides/compare-pokemon-forms-stats-draft-data` |
| Why use a league manager instead of spreadsheets? | `/guides/pokemon-draft-manager-vs-spreadsheets` |

Each guide has:

- a concise canonical title and description;
- a direct answer near the top of the page;
- product-accurate explanatory sections and human decision guidance;
- a practical checklist and at least four internal next steps;
- an Article graph with truthful per-guide publication and modification dates;
  and
- visible editorial ownership, methodology, and correction links.

DraftCenter's ADP explanation matches the production calculation: an eligible
Pokemon contributes its actual pick when selected and one position after that
draft's final pick when undrafted. Auction price, draft rate, teammates, and
confirmed-match results remain separate signals with their own samples.

## Discovery connections

- The guide directory now exposes CollectionPage and ItemList structured data.
- The directory metadata covers ADP, transactions, standings, playoffs, rules,
  and league management as well as introductory draft topics.
- Pokemon profiles link to the form/stat comparison and ADP guides.
- Existing guides link into the new resources at the relevant season step.
- The sitemap gives each guide its real modification date.
- `llms.txt` names and links all five resources and records an August 10 review.

The live sitemap contains 1,542 canonical URLs at verification time. The count
can change with eligible public leagues; the five new guide entries each carry
an August 10 `lastmod`.

## Search Console actions

After production verification:

- the existing `https://www.draftcentral.gg/sitemap.xml` submission was
  resubmitted successfully on August 10;
- Search Console immediately associated every new guide with that sitemap;
- all five new guide URLs were accepted into the priority crawl queue; and
- the five already-indexed priority Pokemon profiles were not submitted again.

At submission time, the new URLs were reported as `Discovered - currently not
indexed`, with no prior crawl. An indexing request is a crawl hint, not a promise
of indexing or ranking. Do not submit the same URLs repeatedly.

## Validation

- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: all 1,027 rows verified.
- `npm run build`: 227 generated pages.
- Pull request #114: protected secret scan, dependency/security, CodeQL, Vercel,
  and preview-comment checks passed without bypass.
- Exact Preview: all five pages had one H1, the expected production canonical,
  search-length descriptions, direct answers, no horizontal overflow, and no
  browser errors.
- Vercel Production: exact commit `0866835` Ready.
- Live production: all five URLs returned 200 with one H1, their canonical, and
  the direct-answer block; directory, sitemap, and `llms.txt` coverage were 5/5.
- Post-deployment smoke: all public routes returned 200 and all protected API
  boundaries returned 401.

## Preserved boundaries

- No database migration, production record, real league, account, provider
  setting, environment variable, or secret changed.
- No private route was added to the sitemap or made indexable.
- No broad Pokemon title, canonical, or form-policy change was made.
- No indexing request was repeated for the five already-indexed profiles.
- Semrush Prompt Tracking remains unavailable under the current account access;
  no purchase, session override, or plan upgrade was attempted.

## Measurement plan

- Let Google crawl the new pages and the expanded catalog normally.
- Use roughly August 23 for an early directional Search Console read.
- Use roughly September 6 for the normal 28-day editorial decision.
- Compare queries and pages individually; do not use sitewide average position
  alone while Google is testing hundreds of new URLs.
- Revisit a high-impression snippet only when the same page/query gap persists
  and the proposed edit makes the page more useful to a person.
- When Semrush prompt tracking becomes available without a plan change, add the
  retained 15-prompt United States/English watchlist and review it weekly.
