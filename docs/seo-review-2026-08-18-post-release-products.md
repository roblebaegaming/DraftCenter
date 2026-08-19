# Post-release product SEO review — August 18, 2026

## Outcome

The technical indexing foundation remained healthy after the August 18 product
releases. The necessary work was a focused content-alignment update: the public
Team Lab, tournament organizer, Worlds VGC, guide library, social previews, and
AI discovery copy no longer described the product as it existed before the
Battle Room and organizer-showcase releases.

No private workspace was made indexable. Tournament detail routes, personal
Team Lab workspaces, saved battle reports, account data, and organization
administration remain outside the sitemap and retain their existing indexing
boundaries.

## Public changes

- Team Lab metadata and `WebApplication` features now describe the four-slot
  doubles field, open- and closed-team-sheet play, type-ahead entry, pivot
  switches, timed effects, optional Auto-next, reload recovery, and battle
  exports.
- The tournament organizer landing now describes private synthetic rehearsal,
  4–32 manager auctions, winning-bid records, Swiss standings, Top Cut, and
  authorized team previews without publishing the retained demo URL or data.
- English, Italian, and Spanish Worlds VGC metadata now describes the same Pick
  10 competition, transparent non-betting champion odds, and community
  leaderboard profiles. Canonicals and reciprocal language alternates remain
  unchanged.
- New authored guides cover auction-to-Swiss-to-Top-Cut event operation and
  fast VGC battle tracking with open or closed team sheets.
- The guide index, homepage commissioner links, About page, `llms.txt`, social
  preview images, and truthful sitemap modification dates now connect the new
  public material.

## Search and privacy boundaries

- `/team-lab` and `/tournaments` are public product landings.
- `/team-lab/teams`, `/tournaments/[slug]`, and `/organizations/[slug]` remain
  intentionally non-indexed.
- Public copy may describe synthetic organizer practice only in general terms.
  It must not include the retained practice event's slug, bot identities,
  registration code, roster contents, results, or account-specific state.
- Champion odds are described as DraftCenter's non-betting predictions, not
  bookmaker lines or official Pokémon probabilities.
- No Pokémon profile title or canonical policy changed in this release.

## Standards used

The review follows Google Search Central guidance that titles should be concise
and descriptive, descriptions should be useful and page-specific, sitemap
`lastmod` values should change only for significant content or structured-data
updates, and private pages should use `noindex` rather than being promoted for
search discovery:

- [Title links](https://developers.google.com/search/docs/appearance/title-link)
- [Snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Block search indexing with `noindex`](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Google Images SEO guidance](https://developers.google.com/search/docs/appearance/google-images)

## Release validation

Before release, validate the focused metadata and product contracts, the full
application suite, National Dex data, production dependency audit, and build.
On the Vercel preview, inspect the two new guides, Team Lab, tournaments, and
all three Worlds language routes at desktop and mobile widths. After merge,
confirm the exact Production commit, run the signed-out production smoke sweep,
and verify that the private retained tournament remains `noindex,nofollow` and
absent from the sitemap.
