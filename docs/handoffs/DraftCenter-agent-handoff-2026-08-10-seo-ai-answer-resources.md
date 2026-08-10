# DraftCenter handoff - SEO and AI answer resources

- Date: August 10, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production application commit: `08668350d29a28b07bb8e0a83d301426e5a61121`
- Latest production migration: 368
- Security-maintenance release:
  [#113](https://github.com/roblebaegaming/DraftCenter/pull/113)
- SEO and AI answer-resource release:
  [#114](https://github.com/roblebaegaming/DraftCenter/pull/114)

## Read this first

Pull requests 113 and 114 are merged and deployed. Pull request 113 repaired the
scheduled full-history secret scan without changing application behavior. Pull
request 114 published the five focused resources recommended by the August 10
SEO report and connected them to DraftCenter's existing discovery surfaces.

The original dirty DraftCenter checkout remains untouched. Continue from a
clean worktree based on current `origin/main`, use a short-lived `codex/` branch
and pull request, and preserve the release boundaries in `AGENTS.md`.

## Current production state

Vercel reports exact `main` commit `0866835` Ready in Production. The five new
guide URLs return 200 with one H1, a production canonical, a direct answer, and
their August 10 publication data. The guide directory, sitemap, and `llms.txt`
all link the complete set. The production sitemap contained 1,542 URLs at the
verification moment; eligible public leagues can change that inventory.

The complete application suite, 1,027-row National Dex check, production
dependency audit, 227-page build, protected pull-request checks, exact Preview
review, and post-deployment 19-route smoke sweep passed. Desktop and 375px
mobile review found no horizontal overflow or browser error.

## Google Search Console

The production sitemap was resubmitted successfully on August 10. Search
Console associated each new guide with that sitemap and accepted all five into
the priority crawl queue:

- `/guides/how-to-use-pokemon-draft-adp`
- `/guides/pokemon-draft-league-transactions-free-agency`
- `/guides/pokemon-draft-standings-tiebreakers-playoffs`
- `/guides/compare-pokemon-forms-stats-draft-data`
- `/guides/pokemon-draft-manager-vs-spreadsheets`

They were initially `Discovered - currently not indexed`, with no prior crawl.
Do not request them repeatedly. The already-indexed Gengar, Archaludon,
Garchomp, Dragonite, and Venusaur profiles were intentionally not resubmitted.

## Editorial and indexing decisions

The release completes the useful gaps identified in the original 15-prompt
watchlist. Existing guides cover prompts 1-6; the format library covers format
selection; the About page answers what DraftCenter is; and the new resources
cover ADP, roster movement, standings/playoffs, form comparison, and the
manager-versus-spreadsheet decision.

Do not mass-change Pokemon titles or form canonicals from the first week of
expanded impressions. Google is testing hundreds of newly discovered pages,
which can raise impressions while lowering sitewide CTR and average position.
Wait for a persistent page/query gap and make only a human-useful change.

Semrush Prompt Tracking remains unavailable under the current account access.
Do not buy an upgrade or override the multiple-session guard merely to remove
that reporting gap. The retained 15-prompt United States/English set should be
added when the included account capability becomes available.

## Preserved boundaries

- No real league, draft, roster, result, transaction, support request, or
  production account was changed.
- No database migration, provider setting, environment variable, or secret was
  changed.
- No private route was made indexable or added to the sitemap.
- No production title or canonical mass rewrite was performed.
- The original dirty workspace remains untouched.
- The security repair remains limited to reviewed public identifiers and four
  exact historical Gitleaks fingerprints.

## Ordered continuation

1. Let Google crawl the submitted sitemap and new guide URLs; do not repeat the
   indexing requests.
2. Review Search Console around August 23 for an early directional read and
   September 6 for the normal 28-day editorial decision.
3. Compare exact queries and pages, especially the five new guides and the
   current high-impression type/profile pages; do not judge from sitewide
   average position alone.
4. Run the comparable Semrush desktop crawl after production cache replacement
   with JavaScript disabled and a 5,000-page ceiling. Compare issue URL exports.
5. Add the 15-prompt watchlist only when Semrush Prompt Tracking is available
   without a purchase or session override.
6. Keep AdSense integration deferred until the owner deliberately resumes it.

## Authoritative references

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- [`../seo-ai-answer-resources-2026-08-10.md`](../seo-ai-answer-resources-2026-08-10.md)
- [`../seo-remediation-2026-08-09.md`](../seo-remediation-2026-08-09.md)
- [`DraftCenter-agent-handoff-2026-08-10-league-pulse-and-security-maintenance.md`](DraftCenter-agent-handoff-2026-08-10-league-pulse-and-security-maintenance.md)
- [`../../AGENTS.md`](../../AGENTS.md)

When this document conflicts with an older broad handoff, this verified
production state, `CURRENT-STATUS.md`, and the current repository state take
precedence.
