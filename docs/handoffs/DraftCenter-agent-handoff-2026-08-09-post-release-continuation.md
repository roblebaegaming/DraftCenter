# DraftCenter handoff - post-release continuation

- Date: August 9, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Branch: `codex/post-release-handoff-2026-08-09`
- Base: `origin/main` at `da550721a8f5eba3344fa8b6d2a127917ec6e73f`
- Production deployment before this documentation-only continuation:
  `da550721a8f5eba3344fa8b6d2a127917ec6e73f`
- Verified production application: `cdce0f19c62110cff384d204f890be01042735b6`
- Latest production migration: 368
- Open pull requests at handoff creation: 0
- Release state: complete; no application or database deployment is pending

## Start here

The August 9 release wave is complete. Pull requests 95-104 are merged into
`main`, migrations 361-368 are applied to the exact core production project,
and Vercel reports the current `main` deployment Ready on the public domains.
At handoff preparation, the deployment source was documentation-only commit
`da55072`; it contains verified application release `cdce0f1` as its direct
ancestor. A later deployment of this handoff may advance the documentation
commit without changing the verified application or database baseline.

Do not create another application deployment merely to reproduce an older
release message. There is no omitted work from pull requests 95-104. The live
site loads successfully, the most recent signed-out production smoke sweep
passed, and the production homepage was rechecked without browser console
errors while this handoff was prepared.

The original DraftCenter workspace remains intentionally dirty with preserved
user work and stale or superseded release candidates. Do not stage, commit, or
push that checkout. Begin future work from a clean worktree based on the latest
`origin/main`.

## Deployed release chain

- Pull requests 95-99: tournament scaling, Draft Tournaments, Daily Games and
  Pokemon Connections, private Nuzlocke Run Cards, and persistent Draft Home
  navigation.
- Pull requests 100-102: production and SEO records plus evidence-led product
  alignment for tournament, Daily Games, sitemap, metadata, structured data,
  `llms.txt`, and private-route indexing boundaries.
- Pull request 103: public Pokemon color, Egg Group, and shape discovery;
  sourced versioned draft-pricing presets; and manager-versus-spectator
  sibling-pod access enforced in both application behavior and database
  policy.
- Pull request 104: the canonical consolidated production record. It changes
  documentation only and is the current production deployment source.

The deployed application and database details remain in
[`DraftCenter-agent-handoff-2026-08-09-consolidated-release.md`](DraftCenter-agent-handoff-2026-08-09-consolidated-release.md).

## Verified boundaries

- No real league, draft, pick, roster, queue, tournament, saved team,
  transaction, claim, trade, membership, manager, spectator, or direct message
  was changed for release testing.
- No production provider setting, environment variable, authentication
  configuration, or secret was changed.
- Existing leagues retain their stored pricing until a commissioner explicitly
  opts into a new preset.
- Sibling-pod managers do not gain team, transaction, claim, trade, draft, or
  direct-message authority. Invited spectators remain limited to standings,
  predictions, the official draft board, and playoffs.
- Private tournament and organization workspaces, My Teams, and saved Nuzlocke
  Run Cards remain non-indexed and outside the sitemap.
- The retained `multi-pod-pr-82` Preview branch must not be deleted. Any
  disposable Preview cleanup requires the exact verified branch or project
  identifier and explicit owner approval.

## What is next

### 1. Stabilize and observe

Treat the current release as the baseline. Monitor Vercel errors, Supabase
memory and Disk IO, tournament and Draft Tournament lifecycle behavior, Daily
Games discussions, Nuzlocke saves and exports, draft pricing selection, and
manager/spectator pod access. Begin investigations read-only and distinguish
historical Operations events from current incidents by timestamp and
authoritative state.

Do not mutate a real league or tournament to manufacture monitoring evidence.
Fix confirmed regressions before beginning another broad feature release.

### 2. Reproduce the August 8 SEO findings against the current application

The next implementation should start from the exact URLs behind the 5,000-page
Semrush crawl, not the aggregate issue counts alone. Reproduce each candidate
against `cdce0f1` or its current descendant before editing templates because
the crawl predates several August 9 releases.

Prioritize in this order:

1. the 71 invalid structured-data items;
2. the one broken internal link and related 4xx page;
3. the orphaned sitemap page;
4. duplicate titles, descriptions, and content;
5. large HTML documents, excessive depth, and weak internal-link coverage; and
6. differentiated, useful Pokemon profile content where indexing evidence
   supports it.

Keep generated query/filter states canonicalized. Do not make private routes
indexable to improve crawl counts. Preserve the current public indexing policy
and verify schema changes with rendered-page structured data, canonicals,
sitemap membership, and signed-out access checks.

### 3. Measure on fixed windows

After any technical repair release, repeat the same 5,000-page crawl scope so
the result is comparable. Use roughly August 23, 2026 for an early 14-day
Search Console read and roughly September 6, 2026 for the normal 28-day content
decision. Do not treat `discovered - currently not indexed` as an application
error without URL-level evidence.

The existing Semrush Position Tracking target is Australia desktop. Replacing
it would delete history. Add United States desktop/mobile only after a plan
upgrade or an explicit owner decision to replace that history.

### 4. Perform only explicitly approved cleanup

The release-wave disposable Preview may be removed later only after resolving
its exact identifier and receiving owner approval. Preserve the retained
multi-pod Preview. Local worktree and branch cleanup is optional and must not
discard the original workspace's user changes.

## Next release gates

Use a short-lived branch and protected pull request. Review the exact Preview
before merge. Database work requires a new forward-only migration after 368,
focused regression coverage, and independent RLS and grant verification.

Before proposing an application release, run the applicable checks:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

Run `npm run smoke:production` only after an authorized deployment. Confirm the
exact deployed source commit rather than inferring production success from a
local build or Preview. Keep server credentials out of `NEXT_PUBLIC_*`
variables and never expose production keys or session material in records.

## Completion criteria for the next SEO task

The next SEO repair is done when every changed URL has a recorded pre-fix
reproduction, focused regression coverage, valid canonical and structured-data
output, correct sitemap and indexing behavior, a clean desktop/mobile Preview,
passing protected checks, an exact production deployment, and a signed-out
production smoke sweep. Record the comparable recrawl separately from the
release so crawl timing is not confused with deployment verification.

## Authoritative references

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- [`DraftCenter-agent-handoff-2026-08-09-consolidated-release.md`](DraftCenter-agent-handoff-2026-08-09-consolidated-release.md)
- [`DraftCenter-agent-handoff-2026-08-09-seo-production-baseline.md`](DraftCenter-agent-handoff-2026-08-09-seo-production-baseline.md)
- [`../seo-measurement-2026-08-08.md`](../seo-measurement-2026-08-08.md)
- [`../public-indexing-policy.md`](../public-indexing-policy.md)
- [`../../AGENTS.md`](../../AGENTS.md)
