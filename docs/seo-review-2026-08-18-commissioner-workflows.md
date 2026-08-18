# SEO review: commissioner workflows — August 18, 2026

This record covers the read-only Production audit and focused follow-up prepared
after the commissioner activation, league import, weekly next-action, and
Showdown replay-result release. It contains no private league data, account
identity, provider configuration, or Production write.

## Audited Production baseline

- Production application commit: `435cc6fb3c209c64e31c0b2b7af29aa9c26416e6`
- Final release-documentation commit: `68fa146e6100b5e189f3f5259419491444116536`
- Production migration: 438 (`20260818090807`)
- Ten important public routes returned HTTP 200 with a canonical URL, one clear
  H1, and no `noindex`: home, Team Lab, tournaments, Pokédex Tracker, Pokémon,
  guides, About, Daily Games, Worlds 2026, and public leagues.
- The live sitemap contained 1,597 unique URLs and no duplicates.
- The pre-change SEO metadata regression passed 19 of 19 tests.

The technical indexing foundation did not need a broad rewrite. The material
gap was that the visible home promise had changed while the title branding,
global descriptions, social preview, `llms.txt`, About page, and commissioner
guides still described the earlier broad community-platform position.

## Focused follow-up

The prepared branch aligns the public search and sharing story around one
promise: run a complete Pokémon draft league in one connected commissioner and
manager workspace.

It:

- gives the home page an explicit branded title plus matching Open Graph and
  Twitter metadata;
- updates the root WebSite and Organization descriptions without adding a
  speculative application-schema claim;
- replaces the broad social-card copy with the connected-season promise;
- adds compact, crawlable commissioner links below the five-step home journey;
- refreshes the commissioner walkthrough, spreadsheet comparison, standings
  guide, public manuals, About page, and `llms.txt` against the released
  workflows;
- publishes one authored guide for reporting scheduled draft-league results
  from public Pokémon Showdown replays;
- adds truthful August 18 sitemap modification dates to the materially changed
  public discovery routes; and
- preserves all existing private-workspace and dynamic-record indexing gates.

## Content boundaries

The public import explanation states that manager text is a planning label, not
an account claim or invitation. It does not promise arbitrary spreadsheet
compatibility or historical reconstruction.

The public replay explanation requires a scheduled eligible matchup, one to
five exact public replay URLs, deliberate player-to-team mapping, review in the
normal result editor, and an intentional Save. It does not claim automatic
result writes, raw-log retention, inferred knockout attribution, or knowledge
of unrevealed Pokémon.

`/organizations`, tournament workspaces, APIs, private teams, Pokédex account
state, and other protected routes remain outside the sitemap under
[`docs/public-indexing-policy.md`](public-indexing-policy.md).

## Evidence gate after release

Do not treat local or Preview validation as a Production deployment. After an
authorized protected release, confirm the deployed commit, run the complete
signed-out Production smoke sweep, and verify the live title, descriptions,
social metadata, new guide, `llms.txt`, and sitemap dates.

Do not make another broad Pokémon-profile title or canonical change from this
release. Recheck the five August 17 priority profiles after at least 14 days
and normally 28 days, as required by
[`docs/seo-review-2026-08-17.md`](seo-review-2026-08-17.md).
