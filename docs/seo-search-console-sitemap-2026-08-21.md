# Search Console sitemap refresh — August 21, 2026

The multilingual Pokédex and Worlds release materially expanded DraftCenter's
public indexable URL cohort after the previous August 10 sitemap submission.
This record captures the bounded post-release sitemap verification and Search
Console action. It contains no account identity, private URL, or credential.

## Production verification

- `https://www.draftcentral.gg/sitemap.xml` returned HTTP 200 and contained
  9,716 URLs.
- The live sitemap included the English and localized Pokédex indexes and
  profiles, all seven Worlds language routes, the Mega Bracket, and the public
  Pokédex Tracker landing page.
- `https://www.draftcentral.gg/robots.txt` returned HTTP 200 and referenced the
  production sitemap.
- The sitemap remained below Google's 50,000-URL single-file limit.

## Search Console action

Before the refresh, the domain property's submitted-sitemap row reported:

- Submitted: August 10, 2026
- Last read: August 20, 2026
- Status: Success
- Discovered pages: 9,716
- Discovered videos: 0

The existing production sitemap was resubmitted once on August 21, 2026.
Search Console confirmed “Sitemap submitted successfully,” and the row then
reported Submitted August 21, Last read August 20, Status Success, and 9,716
discovered pages. No sitemap was removed or replaced, and no repeated
individual URL-indexing requests were made.

## Ongoing rule

Google periodically rereads a successful sitemap. Resubmit only after a
production release materially adds, removes, renames, or localizes a cohort of
indexable URLs, or changes sitemap, canonical, or language-alternative
structure. Ordinary UI and copy changes do not trigger a submission. After a
qualified submission, monitor the Last read, Status, and discovered-page count
instead of repeatedly submitting the same URLs.

This rule follows
[Google's Search Console sitemap guidance](https://support.google.com/webmasters/answer/7451001?hl=en):
successful sitemaps are periodically recrawled, while materially changed
sitemaps may be submitted again for a fresh crawl request.
