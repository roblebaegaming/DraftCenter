# DraftCenter current status

- Last updated: August 6, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production release: `7e95ac9`
- Latest production migration: 343

## Status

DraftCenter production is approved for monitored public use and real drafts.
The deployed release sequence now includes Nuzlocke Lab, standalone
tournaments, Trainer Dex, playable Daily Games, the technical SEO foundation,
expanded competitive resources and format data, and four reviewed
game-specific Nuzlocke guides.

Vercel reports exact `main` commit `7e95ac9` Ready. The signed-out production
smoke sweep passes, and live review confirms the FireRed, Emerald, Platinum,
and Scarlet Nuzlocke guides have the expected title, canonical, single H1,
structured data, responsive layout, and preconfigured generator links. The
Scarlet link restores its six-slot clauses and generates six encounters.

Production migrations are collision-free through 343. Migration 343 restores
the Daily Games bracket champion ranking function with a fixed search path,
least-privilege grants, and anonymous current-day privacy. Direct production
RPC verification returns successfully without exposing private current-day
results.

The application-side SEO backlog from the first crawl is substantially
implemented: meaningful raw-HTML H1 content, fragment-based Pokédex selection,
shorter guide titles, a documented form-canonical policy, useful related links,
expanded resource and format content, and the four-page Nuzlocke search cohort
are live. External measurement is the remaining hardening gate: a new full
Semrush crawl, Position Tracking baseline, and Search Console snapshot require
an authenticated account session and have not been represented as completed.

## Active watch items

- Semrush full crawl and Search Console indexing/canonical results
- Four-page Nuzlocke cohort impressions, clicks, CTR, and engagement at 14 and
  28 days
- Daily Games ranking RPC errors and anonymous privacy behavior
- Supabase memory and Disk IO during normal live-draft days
- Autonomous-claim reconciliation workload and duplicate live-draft polling
- Historical versus new Operations events
- The inactive generic Supabase fallback and its schema drift; do not change
  provider configuration or either project without exact-ID owner approval

## Authoritative records

- Current detailed handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-06-seo-release-hardening.md`](handoffs/DraftCenter-agent-handoff-2026-08-06-seo-release-hardening.md)
- August 6 feature release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-06-release-integration.md`](handoffs/DraftCenter-agent-handoff-2026-08-06-release-integration.md)
- SEO expansion plan and pre-implementation baseline:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-06-seo-expansion.md`](handoffs/DraftCenter-agent-handoff-2026-08-06-seo-expansion.md)
- Pallet Town release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md`](handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md)
- Security remediation:
  [`docs/DraftCenter-security-remediation-2026-08-02.md`](DraftCenter-security-remediation-2026-08-02.md)
- Retention and recovery:
  [`docs/data-retention-and-recovery.md`](data-retention-and-recovery.md)

When this file conflicts with an older handoff, the newest verified production
record and repository state take precedence.
