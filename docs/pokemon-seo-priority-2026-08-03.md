# DraftCenter Pokémon SEO priority cohort — August 3, 2026

This cohort combines the first available Google Search Console demand signals
with DraftCenter's public community ADP and confirmed-match aggregates. It is
an initial editorial and monitoring list, not a permanent ranking.

Search Console data currently covers July 29–August 1 and is still sparse: 43
site-wide impressions and one click. Re-evaluate the cohort after 28 complete
days rather than assuming these early results represent stable demand.

## Priority 20

| Priority | Pokémon | Initial reason |
| ---: | --- | --- |
| 1 | Gengar | Eight Search Console impressions across stats and Pokédex queries; already indexed. |
| 2 | Archaludon | Search impression plus DraftCenter ADP 15.4 across six of at least seven eligible drafts. |
| 3 | Garchomp | DraftCenter ADP 17.3 across six of at least eight eligible drafts; prominent competitive species. |
| 4 | Dragonite | DraftCenter's largest displayed confirmed-match sample: 17–0 across 17 matches. |
| 5 | Venusaur | DraftCenter ADP 14.1 across six of at least seven eligible drafts. |
| 6 | Rhyperior | Search Console surfaced a direct Pokédex-number query. |
| 7 | Infernape | Search Console surfaced a direct stats query. |
| 8 | Drifblim | Search Console surfaced the profile from a likely misspelled name query. |
| 9 | Nymble | Individual profile received a Search Console impression. |
| 10 | Lairon | Individual profile received a Search Console impression. |
| 11 | Sawsbuck | Individual profile received a Search Console impression. |
| 12 | Anorith | Individual profile received a Search Console impression. |
| 13 | Armarouge | Individual profile received a Search Console impression. |
| 14 | Bombirdier | Individual profile received a Search Console impression. |
| 15 | Tapu Bulu | Individual profile received a Search Console impression. |
| 16 | Fraxure | Individual profile received a Search Console impression. |
| 17 | Florges | DraftCenter 12–0 confirmed-match sample. |
| 18 | Meowscarada | DraftCenter 12–0 confirmed-match sample. |
| 19 | Mudsdale | DraftCenter 12–0 confirmed-match sample. |
| 20 | Reuniclus | DraftCenter 12–0 confirmed-match sample. |

Win-rate entries are cohort signals, not claims that a Pokémon is inherently
best. The sample and league context must remain visible wherever these results
are discussed.

## Five-URL indexing inspection

Read-only Search Console URL Inspection was completed August 3 before the new
profile-index release. No indexing requests were submitted.

| URL | Search Console status | Discovery detail | Next action |
| --- | --- | --- | --- |
| `/pokemon/gengar` | Indexed; URL is on Google | Valid HTTPS and one valid breadcrumb item | Monitor impressions and CTR; do not request again. |
| `/pokemon/archaludon` | Discovered, currently not indexed | Sitemap detected; no referring page detected | Deploy internal indexes, then request indexing once. |
| `/pokemon/garchomp` | Unknown to Google | No sitemap or referring page detected in the processed report | Deploy internal indexes and refreshed sitemap, then request indexing once. |
| `/pokemon/dragonite` | Discovered, currently not indexed | Sitemap detected; no referring page detected | Deploy internal indexes, then request indexing once. |
| `/pokemon/venusaur` | Discovered, currently not indexed | Sitemap detected; no referring page detected | Deploy internal indexes, then request indexing once. |

## Next review

After deployment:

1. confirm that the A–Z, type, and generation indexes render and appear in the live sitemap;
2. request indexing for Archaludon, Garchomp, Dragonite, and Venusaur;
3. wait at least 14 days before treating an unchanged status as a problem;
4. record impressions, clicks, position, and indexing state after 28 complete days; and
5. choose the first five profiles for editorial enrichment from the updated evidence.
