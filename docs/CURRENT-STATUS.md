# DraftCenter current status

- Last updated: August 7, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified functional production release: `34c3286`
- Latest production migration: 348

## Status

The August 7 Nuzlocke product and guide release is live at production commit
`34c3286`, the squash merge of pull request 63. All protected checks passed,
Vercel reported the exact `main` deployment Ready, and the signed-out
production smoke sweep passed. Nuzlocke now supports named and saved local
runs, exact saved teams, downloadable Run Cards, themed and one-per-area runs,
and complete route-by-route encounter guides for all 37 reviewed games. Live
checks confirmed 37 guide choices, all 129 FireRed areas, all 80 Violet areas,
method-specific encounter disclosures, and no player-facing “encounter rows”
terminology. No migration or production-data change was required.

DraftCenter production is approved for monitored public use and real drafts.
The deployed release sequence now includes Nuzlocke Lab, standalone
tournaments, Trainer Dex, playable Daily Games, the technical SEO foundation,
expanded competitive resources and format data, four reviewed game-specific
Nuzlocke guides, and source-attributed competitive ladder and tournament
evidence on Pokémon profiles.

Vercel reports exact functional release `43a030c` Ready; it contains the
competitive application commit `a5dbb30`. The signed-out production smoke
sweep passes. Live review confirms the FireRed, Emerald, Platinum, and Scarlet
Nuzlocke guides have the expected title, canonical,
single H1, structured data, responsive layout, and preconfigured generator
links. The Scarlet link restores its six-slot clauses and generates six
encounters. Pokémon profiles also expose bounded, source-attributed ladder and
anonymous tournament aggregates without making the underlying tables public.

Production migrations are collision-free through 348. Migration 343 restores
the Daily Games bracket champion ranking function with a fixed search path,
least-privilege grants, and anonymous current-day privacy. Migrations 344–347
add reviewed competitive datasets behind RLS and bounded aggregate RPCs. The
production audit verifies 4 formats, 4 datasets, 2,938 ladder snapshots, 10
tournaments, 737 anonymous teams, and 4,422 roster members, with direct table
access denied and only the intended RPC execution grants available. Migration
348 refreshes the production PostgREST schema cache so both RPCs are visible to
the deployed application.

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
- Competitive dataset refresh cadence, source availability, and bounded RPC
  performance
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
