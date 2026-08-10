# DraftCenter handoff - League Pulse and security maintenance

- Date: August 10, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production commit: `32aeb5ba5fa2467587740d318b2bdf2825a6a693`
- Latest production migration: 368
- Pending maintenance pull request:
  [#113](https://github.com/roblebaegaming/DraftCenter/pull/113)

## Read this first

This is the current continuation handoff after the August 10 Semrush cleanup,
privacy-safe League Pulse release, and scheduled full-history secret-scan
investigation. Pull requests 110-112 are merged and deployed. Pull request 113
is a security-maintenance change and is not yet merged into `main` at the time
of this handoff.

Do not push the original dirty DraftCenter checkout. Its user-owned changes
remain preserved. Continue from a clean worktree based on current protected
`main`, and use a short-lived `codex/` branch and pull request.

## Production releases since the August 9 handoff

| Pull request | Production commit | Scope | State |
| --- | --- | --- | --- |
| [#110](https://github.com/roblebaegaming/DraftCenter/pull/110) | `3e018a2` | Conversation release confirmation | Deployed |
| [#111](https://github.com/roblebaegaming/DraftCenter/pull/111) | `28e41c1` | Semrush crawl remediation | Deployed |
| [#112](https://github.com/roblebaegaming/DraftCenter/pull/112) | `32aeb5b` | Privacy-safe League Pulse | Deployed |

Vercel reported exact commit `32aeb5b` successfully deployed. The required
post-deployment signed-out smoke sweep passed all 19 public and protected-route
checks. Production migrations remain current through 368; none of these three
pull requests required a database migration.

## Semrush crawl remediation

The Semrush crawl shown during the conversation reported 1,588 discovered
pages under a 5,000-page campaign limit, 91% site health, 32 errors, and 1,648
warnings. That crawl was started before pull request 111 reached production, so
its unchanged counts are a baseline rather than post-release evidence.

Pull request 111:

- repaired the reproduced broken Pokemon destinations and redirecting links;
- server-rendered eligible public-league content and stronger internal links;
- removed internal `nofollow` query links;
- added missing primary headings and useful supporting copy to thin public
  directory templates;
- reduced the Nuzlocke guide HTML payload by loading complete area encounters
  on demand; and
- retained low text-to-HTML ratio as a measurement heuristic instead of adding
  filler or crawler-specific markup.

Its built-output crawl covered 1,537 sitemap URLs with zero broken pages or
targets, redirects, oversized documents, missing H1s, internal `nofollow`
links, sub-200-word pages, orphans, one-link pages, or URLs more than three
clicks deep.

The next Semrush run should begin after the production cache has refreshed and
use the same desktop, JavaScript-disabled, 5,000-page ceiling. It may stop below
5,000 when it exhausts the discoverable canonical inventory. Compare issue URL
exports, not only aggregate counts, before deciding whether anything remains a
real defect.

## Privacy-safe League Pulse

Pull request 112 added an owner-only League Pulse to Operations. It exposes
only these aggregate signals for real post-draft leagues:

- results recorded;
- completed transactions;
- days since meaningful activity;
- season status;
- open support requests; and
- unexpected system failures from the last 30 days.

It does not return team names, Pokemon, matchups, scores, managers, messages,
request text, error text, or transaction contents. Result counts include the
current regular season and playoffs. Transaction counts include only accepted,
non-reversed trades and non-reversed free-agent moves. Expected authorization
and stale-state rejections do not count as system failures.

The League Pulse implementation passed its strict response-key privacy
contract, Operations regression tests, the complete application suite, the
1,027-row National Dex verification, the production build, and the production
smoke sweep. No real league was opened, mutated, or inspected to validate it;
in particular, the organically created Goonsquad league was not queried for
private details.

The preview and production route correctly enforce the owner sign-in boundary.
The owner should make the final signed-in desktop/mobile visual check in
Operations.

## AdSense state

The owner created an AdSense account and supplied only the website. No ad code,
payment, tax, consent, or additional account setup is part of the repository or
this release. Integration remains intentionally deferred while content,
traffic, policy readiness, and user experience mature.

## Scheduled full-history scan investigation

GitHub scheduled security run
[#309](https://github.com/roblebaegaming/DraftCenter/actions/runs/31407726380)
ran against production commit `32aeb5b` after the successful pull-request and
push scans. Its dependency, regulation, and application-security job passed.
The Gitleaks job failed on 6,688 `generic-api-key` matches and then attempted to
write a roughly 3.6 MB job summary, exceeding GitHub's 1 MB summary limit.

The findings were fully classified without exposing their matched values:

- 6,684 were reviewed public Pokemon area/location identifiers under seven
  obsolete historical migration filenames; and
- four were natural-language warnings in superseded handoffs telling agents
  not to commit Supabase or Discord credentials. Those lines contain no
  credential value.

This was scanner configuration drift, not a production secret incident and
not a League Pulse regression.

Pull request 113 applies the narrow correction:

- the five obsolete import paths and two obsolete verification paths are added
  only to the existing exact public area/location identifier rules;
- the four prose false positives are ignored by their exact Gitleaks
  fingerprints rather than by broadly excluding documentation; and
- the catalog-security regression fixture locks both files to their reviewed
  contents.

Pinned Gitleaks 8.30.1 scanned all 850 commits and approximately 691.79 MB with
no leaks after the correction. Focused validation also passed 30 catalog
security tests, 14 security tests, six regulations/pricing tests, and the
production dependency audit with no known vulnerabilities. The complete
application suite, 1,027-row National Dex verification, and production build
across 222 generated pages also passed. The isolated worktree contains no
local environment file, so the successful build used only the existing public
Supabase URL and publishable-key variables from the preserved local setup; no
server-only credential was loaded or exposed.

Before pull request 113 is merged, its final head must pass the authoritative
manual full-history GitHub workflow, the protected pull-request checks, and
owner review. The change does not alter application behavior, production data,
database migrations, provider settings, or secrets.

## Preserved boundaries

- No real league, draft, pick, roster, queue, membership, result, transaction,
  support request, or production account was changed for this work.
- No production database, provider configuration, environment variable, or
  secret was changed.
- No timed-out or ambiguous mutation was replayed.
- Owner Operations remains aggregate-only and server-authorized.
- The original dirty workspace remains untouched and must not be released.

## Ordered continuation

1. Confirm pull request 113's final full-history workflow and protected checks,
   review the diff, and merge only with owner approval.
2. Run the comparable post-deployment Semrush crawl with a 5,000-page ceiling;
   export the remaining issue URLs for evidence-led triage.
3. Perform the owner-signed-in desktop and mobile League Pulse visual check.
4. Review Search Console around August 23 for an early read and September 6
   for the normal 28-day content/indexing decision.
5. Keep AdSense integration deferred until the owner deliberately resumes it.

## Authoritative references

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- [`../seo-remediation-2026-08-09.md`](../seo-remediation-2026-08-09.md)
- [`../owner-league-operations.md`](../owner-league-operations.md)
- [`DraftCenter-agent-handoff-2026-08-09-conversation-release-confirmation.md`](DraftCenter-agent-handoff-2026-08-09-conversation-release-confirmation.md)
- [`../../gitleaks.toml`](../../gitleaks.toml)
- [`../../.gitleaksignore`](../../.gitleaksignore)
- [`../../AGENTS.md`](../../AGENTS.md)

When this document conflicts with an older broad handoff, this verified
production state, `CURRENT-STATUS.md`, and the current repository state take
precedence.
