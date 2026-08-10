# Semrush technical SEO remediation — August 9, 2026

This record documents the repair prepared after the comparable 5,000-page
Semrush Site Audit crawl. It is pre-release evidence and must not be cited as
proof that production has changed until the pull request is merged, the exact
commit is Ready in Production, and a new production crawl finishes.

## Reported production crawl

The August 9 desktop crawl used JavaScript rendering disabled and completed
1,588 URLs against a 5,000-page ceiling. Semrush reported 83% Site Health and
the following actionable issue groups:

- 23 broken internal-link findings and two 4xx pages;
- seven pages with oversized HTML documents;
- 30 outgoing internal links carrying `nofollow`;
- one page without an H1;
- 114 pages with low word count; and
- 1,503 pages with a low text-to-HTML ratio.

The crawl ceiling is not an expected page count. DraftCenter currently exposes
roughly 1,500 canonical sitemap URLs, so completing below 5,000 is normal.

## Reproduction and root causes

A controlled signed-out production crawl found two unique invalid destinations
behind the repeated broken-link findings:

- `/pokemon/nidoran`, produced when the female and male symbols in Nidoran
  names were discarded; and
- `/pokemon/flab-b`, produced when the accented characters in Flabébé were
  converted to separators.

The page without an H1 was the public league at
`/league/pallet-town-m0ks1`. Its server route already loaded the public league,
but the client component discarded that initial result and rendered a loading
shell until JavaScript fetched the record again.

The seven oversized documents were the Scarlet, Violet, Sword, Shield,
Legends: Arceus, HeartGold, and SoulSilver Nuzlocke guides. Their static HTML
contained every encounter row for every area. The 30 Semrush `nofollow`
findings were a subset of 37 game-guide links that encoded a preconfigured
generator state in a crawlable query URL.

## Repair

- Pokémon profile slug normalization now preserves gender as `-f` or `-m`,
  removes combining marks, and produces the live `flabebe` profile slug.
- Public league pages pass their server-fetched public payload into the client
  view, so the league H1 and public content exist in the initial HTML.
- Each Nuzlocke guide now server-renders compact area summaries with encounter
  counts, methods, and representative Pokémon. The complete pinned encounter
  pool is returned by a validated, public-cacheable read-only endpoint only
  when a visitor opens an area.
- The preconfigured Nuzlocke launch action is now a GET form. It retains
  no-JavaScript behavior without publishing dozens of crawlable query URLs or
  applying `nofollow` to internal navigation.
- Thin public hubs and category templates now include useful guidance about
  research workflow, league rules, generation and type interpretation,
  community-data boundaries, and public-league participation.
- The popular Urshifu link points directly to its canonical Single-Strike
  profile instead of relying on a permanent redirect.
- Five pages that had only one incoming internal link gained a second relevant
  editorial link: the first-league guide, Legends: Arceus Nuzlocke guide,
  National Dex format, VGC 2020 format, and custom format.

No database migration, production data mutation, authentication change,
provider setting, secret, or private indexing-policy change is part of this
repair.

## Built-output validation

An optimized local production build completed successfully. A signed-out
crawl of all 1,537 sitemap URLs in the isolated validation environment found:

- zero 4xx or failed sitemap pages;
- zero broken linked targets;
- zero redirecting internal-link targets after the direct-link repair;
- zero documents larger than 1 MB;
- zero missing or multiple H1 headings;
- zero internal `nofollow` links;
- zero pages below 200 rendered words;
- zero sitemap orphans; and
- every sitemap URL reachable from the homepage within three clicks.

The seven formerly oversized guides now range from about 121 KB to 209 KB.
The local environment intentionally uses the isolated preview database, so it
does not contain the production Pallet Town league record. The public-league
H1 change is covered by the server-rendering contract and must also be checked
on the pull-request preview using an eligible preview record, then on the
production URL after release.

## Semrush interpretation and follow-up

Low text-to-HTML ratio is a framework/template measurement, not evidence that
1,503 pages are broken. DraftCenter must not add filler, hide content, expose
private pages, or serve crawler-specific markup to manipulate this score.
Meaningful copy and the multi-megabyte guide reduction address the actionable
content and payload cases; any residual ratio warning should be recorded as a
measurement limitation.

The two intentionally blocked route families remain outside the public
indexing surface. They must not be made indexable merely to remove a Semrush
notice.

After release and production cache replacement, rerun the same desktop,
JavaScript-disabled Site Audit with the 5,000-page ceiling. Compare exact URL
lists rather than aggregate deltas, because the number of discoverable public
league pages can change independently of this code release.
