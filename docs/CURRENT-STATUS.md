# DraftCenter current status

- Last updated: August 6, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production release: `cd90679`
- Latest production migration: 342

## Status

DraftCenter production is approved for monitored public use and real drafts.
The August 6 release is live and includes Nuzlocke Lab, standalone tournaments,
Daily Games resources, Trainer Dex, and the completed Nuzlocke search-discovery
pass.

Production commit `cd90679` is the squash merge of pull request 47. Its
repository checks passed, Vercel reports the `main` deployment Ready, and the
post-deployment signed-out production smoke sweep passes.

The production database now contains the forward-only migration sequence
261-342: Nuzlocke 261-339, tournaments 340, Trainer Dex 341, and the Trainer Dex
draft-name correction 342. The sequence remains collision-free. Production
verification reports all 37 audited main-series Nuzlocke catalogs from Red
through Violet verified, all affected tables protected by RLS and least-privilege
grants, no initial tournament records, and the intended private Trainer Dex
execution boundary.

The live signed-out review passes for `/nuzlocke`, `/resources/daily-games`,
`/trainer-dex`, and `/tournaments`. Nuzlocke publishes its expanded metadata,
structured data, crawlable game/rule guidance, canonical Pokédex links, and
weekly priority-0.9 sitemap entry. Trainer Dex presents its sign-in invitation,
and the tournament directory presents its empty public state without creating
test data.

The release validation includes a clean production dependency audit, the full
application suite, all 1,027 National Dex rows, the 111-page production build,
the full-history secret scan, database catalog/RLS/grant verification, and the
post-deployment production smoke sweep.

The first post-release SEO crawl reports Site Health 95 with zero errors. The
next recommended work is measurement correction and technical crawl cleanup,
followed by a small game-specific Nuzlocke content cohort. These opportunities
are planned, not yet implemented; use the current detailed handoff for the
ordered backlog, tests, and hardening gates.

## Active watch items

- Supabase memory and Disk IO during normal live-draft days
- Autonomous-claim reconciliation workload and duplicate live-draft polling
- Search Console indexing and canonical reports
- Historical versus new Operations events
- The inactive generic Supabase fallback and its schema drift; do not change
  provider configuration or either project without exact-ID owner approval

## Authoritative records

- Current detailed handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-06-seo-expansion.md`](handoffs/DraftCenter-agent-handoff-2026-08-06-seo-expansion.md)
- August 6 production release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-06-release-integration.md`](handoffs/DraftCenter-agent-handoff-2026-08-06-release-integration.md)
- Pallet Town release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md`](handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md)
- Security remediation:
  [`docs/DraftCenter-security-remediation-2026-08-02.md`](DraftCenter-security-remediation-2026-08-02.md)
- Retention and recovery:
  [`docs/data-retention-and-recovery.md`](data-retention-and-recovery.md)

When this file conflicts with an older handoff, the newest verified production
record and repository state take precedence.
