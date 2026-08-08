# External SEO measurement — August 8, 2026

This record captures authenticated Semrush and Google Search Console evidence
for `www.draftcentral.gg`. It is a measurement checkpoint, not proof that every
reported item is a product defect. The Semrush crawl limit was increased from
100 to 5,000 pages so the generated catalog could be measured. No Search
Console setting, sitemap, URL-indexing request, or production application data
was changed.

## Semrush Site Audit

The fresh desktop crawl completed on August 8 with JavaScript rendering
disabled:

- 1,544 of the 5,000-page limit crawled;
- 83% Site Health, compared with 95% in the previous 100-page sample;
- 90% AI Search Health;
- 85 errors, 1,506 warnings, and 519 notices;
- 64 healthy pages, 1,471 pages with issues, one broken page, six redirects,
  and two blocked pages;
- 100% HTTPS and Core Web Vitals thematic scores, 95% performance, 97% markup,
  and 87% crawlability and internal linking.

The score change is not a like-for-like regression. The crawler settings
changed from a 100-page sample to a 1,544-page catalog crawl, which exposed the
generated Pokemon profile surface.

### Error breakdown

- 71 invalid structured-data items;
- four duplicate title-tag issues;
- four duplicate meta-description pages;
- two duplicate-content pages;
- two pages with large HTML documents;
- one 4xx page;
- one broken internal link.

### Warnings and notices

- 1,426 pages have a low text-to-HTML ratio;
- 37 pages have a low word count;
- 35 crawled URLs contain more than two query parameters;
- eight title tags are too long;
- 376 pages are more than three clicks deep;
- 94 URLs are permanent redirects;
- 44 pages have only one incoming internal link;
- two pages are blocked from crawling;
- two pages are flagged for excessive content;
- one sitemap page is orphaned.

The first repair pass should identify the 71 structured-data failures and the
single broken internal link/4xx path, then separate intentional generated-page
patterns from actionable title, canonical, and internal-linking issues.

## Semrush Position Tracking

The existing campaign is an Australia, Google, English, desktop target. From
August 4 through August 8 it tracked two terms:

- `gengar stats`: outside the top 100;
- `lairon pokemon`: outside the top 100.

Campaign visibility and estimated traffic were both zero, with average
position reported as 100. The account currently permits one target and that
slot is already used. Adding US desktop and mobile targets requires a plan
upgrade. Replacing the Australia target would delete its ranking history, so
that destructive change was cancelled and the existing campaign was
preserved.

## Google Search Console

The seven-day view had data through August 6:

- four clicks;
- 1,592 impressions;
- 0.3% click-through rate;
- average position 40.6.

The leading pages in that window were:

| Page | Clicks | Impressions |
| --- | ---: | ---: |
| `/guides` | 2 | 68 |
| `/formats` | 1 | 60 |
| `/` | 1 | 9 |
| `/pokemon/type/water` | 0 | 78 |
| `/pokemon/rayquaza-mega` | 0 | 35 |
| `/pokemon/type/fairy` | 0 | 22 |
| `/pokemon/zygarde-complete` | 0 | 20 |
| `/formats/national-dex` | 0 | 19 |
| `/pokemon/mawile-mega` | 0 | 19 |
| `/pokemon/goodra-hisui` | 0 | 18 |

The submitted sitemap was successful, last read on August 8, and reported
1,496 discovered pages. The submitted-sitemap indexing view showed 414 indexed
and 1,012 not indexed. Of the not-indexed pages, 1,001 were “discovered —
currently not indexed” and 11 were “crawled — currently not indexed.”

URL Inspection showed that the homepage, `/guides`, `/formats`, `/nuzlocke`,
and `/pokemon/gengar` were on Google. All five used the inspected URL as the
Google-selected canonical, were fetchable, and allowed indexing. Their latest
recorded crawl dates ranged from July 30 through August 8.

## Interpretation and follow-up

The sitemap and sampled canonicals are working. The main discovery is scale:
Google knows about most catalog URLs but has not yet chosen to index most of
them. That is not the same as an indexing error. The next SEO implementation
should prioritize valid structured data, stronger differentiated profile
content, shallower catalog navigation, and additional internal links to useful
Pokemon and format pages. A later measurement should compare the same
5,000-page Semrush scope and the same Search Console windows.

US desktop/mobile Position Tracking remains blocked by the one-target Semrush
plan limit. It should be added only after an upgrade or an explicit decision to
replace and lose the existing Australia history.
