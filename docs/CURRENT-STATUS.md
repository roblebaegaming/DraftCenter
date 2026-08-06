# DraftCenter current status

- Last updated: August 6, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production release: `3d67d98`
- Latest production migration: 260

## Status

DraftCenter production remains approved for monitored public use and real
drafts. The Nuzlocke, tournaments, Daily Games, and Trainer Dex integration is
Preview-only and has not changed production.

Branch `codex/nuzlocke-tournaments-daily-integration` combines all 37 audited
main-series Nuzlocke game catalogs from Red through Violet, standalone
single-elimination tournaments, Daily Games resources, and the signed-in
Trainer Dex. The integrated application head is `1fc6399`; the dated release
handoff follows on the same branch. Its forward-only production migration map
is collision-free: Nuzlocke 261-339, tournaments 340, Trainer Dex 341, and the
Trainer Dex draft-name correction 342.

The isolated Preview database reports 37 verified catalogs and no pending
catalogs. Catalog/RLS audits, signed-out UI checks, signed-in Daily discovery
and shiny checks, and an isolated practice-league draft pick/undo check pass.
The draft check also verified that Trainer Dex records the Pokémon name rather
than a numeric pool identifier and removes that discovery after undo. The
disposable account and practice league were deleted after testing.

The dependency audit, full application test suite, all 1,027 National Dex
rows, and the 111-page production build pass. Preview is available at
https://draftcenter-git-codex-nuzlocke-tournaments-dai-5c9468-rob-lebae.vercel.app.

## Remaining release gates

- Deploy and verify the final integration branch head on the stable Preview.
- Open the integration pull request and require its repository checks/review.
- Complete the narrow mobile visual pass and, if Vercel protection remains,
  one deployment-origin signed-in confirmation.
- Rehearse the exact 261-342 production migration sequence against current
  production schema state.
- Obtain explicit owner approval before any production migration, merge, or
  deployment. Production must not receive the legacy Preview fixture repairs.

## Active watch items

- Supabase memory and Disk IO during normal live-draft days
- Autonomous-claim reconciliation workload and duplicate live-draft polling
- Search Console indexing and canonical reports
- Historical versus new Operations events
- The inactive generic Supabase fallback and its schema drift; do not change
  provider configuration or either project without exact-ID owner approval

## Authoritative records

- Current detailed handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-06-release-integration.md`](handoffs/DraftCenter-agent-handoff-2026-08-06-release-integration.md)
- Pallet Town release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md`](handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md)
- Security remediation:
  [`docs/DraftCenter-security-remediation-2026-08-02.md`](DraftCenter-security-remediation-2026-08-02.md)
- Retention and recovery:
  [`docs/data-retention-and-recovery.md`](data-retention-and-recovery.md)

When this file conflicts with an older handoff, the newest verified production
record and repository state take precedence.
