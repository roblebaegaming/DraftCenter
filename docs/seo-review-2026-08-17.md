# SEO review follow-up — August 17, 2026

This record reconciles the August 9–15 Search Console review with the current
Production site and the implementation branch
`codex/seo-profile-priorities-2026-08-17`. It contains no Production writes,
private league data, account identity, or provider configuration changes.

## What the weekly evidence says

- Search Console reported 59 clicks and 8,032 impressions for August 9–15.
  The broader query set lowered average position while clicks and impressions
  increased, so the current evidence does not show a sitewide ranking collapse.
- Search Console reported 1,346 indexed and 246 not-indexed URLs as of August
  13, a material improvement over the preceding review.
- The latest visible Semrush crawl is dated August 12. Treat its 108 low-word-
  count and 41 one-internal-link warnings as an older snapshot until the site
  is recrawled after the current Production releases.
- The Worlds hub supplies most current clicks. Evergreen profiles, guides, and
  type/generation discovery pages remain the diversification opportunity.

## Sitemap reconciliation

The live sitemap contained 1,591 URLs during this review, 165 more than the
1,426 post-release expectation. The increase is fully accounted for:

| Route group | Increase |
| --- | ---: |
| `/guides/` pages | 43 |
| format pages | 29 |
| Pokémon trait hubs and details | 42 |
| Worlds pages | 6 |
| Pokémon profiles | 3 |
| other released public products and game-guide routes | 42 |
| **Total** | **165** |

The live sitemap had no duplicate-count anomaly. Search Console's one-URL
reporting difference from the live sitemap is normal processing lag.

## Current live crawl check

A bounded read-only check covered all 234 non-profile URLs in the live sitemap
on August 17. It deliberately did not recrawl all 1,357 generated Pokémon
profiles.

- 234 of 234 returned HTTP 200.
- Zero rendered pages contained fewer than 200 words after scripts, styles, and
  markup were removed.
- Zero pages exposed one or fewer outgoing internal links.
- Eight pages contained 200–249 rendered words; none was an error or empty
  template.

The five Search Console profile priorities already rendered substantial pages
before this branch's additions:

| Profile | Rendered words | Distinct internal links |
| --- | ---: | ---: |
| Garchomp | 817 | 55 |
| Tauros | 738 | 52 |
| Galarian Weezing | 583 | 34 |
| Mega Garchomp | 579 | 37 |
| Lugia | 510 | 43 |

This evidence supports improving specificity and decision value rather than
adding generic word-count filler.

## Protected crawler scopes

The three current `robots.txt` exclusions are intentional:

- `/api/` contains application and protected account endpoints, not public
  landing pages.
- `/my-teams` is the legacy alias for a private signed-in workspace.
- `/team-lab/teams` stores private teams, sets, and matchup planning.

All three remain outside the sitemap. Do not open them to crawlers to improve a
site-audit score.

## Focused implementation

This branch adds reviewed, authored draft context to Garchomp, Tauros,
Galarian Weezing, Mega Garchomp, and Lugia. Each profile receives:

- a concise targeted description without a broad title rewrite;
- draft-role and roster-planning context;
- explicit form and legality distinctions;
- links to at least three practical comparison profiles;
- an editorial review date and bounded sitemap `lastModified`; and
- clearer PokéAPI, Smogon, Limitless, and DraftCenter methodology explanations.

Water and Psychic type indexes now link to contrasting example profiles and
research guides. Generation IV distinguishes debut generation from the
Pokémon Platinum regional Pokédex and links to the Platinum format, Nuzlocke
guide, shiny-hunting guide, and numbered Pokédex Tracker.

## Next evidence gate

After a protected release, run a new Semrush crawl and compare its page-level
issue list with the August 12 snapshot. Do not claim that the 108 and 41
warnings are closed from this local branch alone. Recheck the five profile
pages in Search Console after at least 14 days, and normally 28 days, before
making further title or canonical changes.
