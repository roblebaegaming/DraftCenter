# DraftCenter current status

- Last updated: August 5, 2026
- Production: https://www.draftcentral.gg
- Repository: `roblebaegaming/DraftCenter`
- Production branch: `main`
- Verified application release: `3d67d98`

## Status

DraftCenter is approved for monitored public use and real drafts. There are no
known launch blockers.

Pull request [#41](https://github.com/roblebaegaming/DraftCenter/pull/41) is
released. Draft reminders now expire against authoritative draft state, stale
turn alerts are discarded, the footer has one clean resource/support link set,
and the owner-only Daily Three Operations page includes a future editorial
calendar with a separate human-first Question of the Day. Migration 260 is on
the core production database with RLS and grants verified. The deployed source
was confirmed at `3d67d98`; the owner calendar loaded successfully and the
signed-out production smoke sweep passed.

The Pallet Town feedback release in pull request
[#34](https://github.com/roblebaegaming/DraftCenter/pull/34) remains live.
Migrations 252-255 are present on the core production database.

Nuzlocke Lab and standalone tournaments are not in production. Nuzlocke pull
request [#38](https://github.com/roblebaegaming/DraftCenter/pull/38) is rebased
onto the current mainline with its unpublished migrations renumbered 261-264
and is undergoing final Preview validation. Stacked tournament pull request
[#39](https://github.com/roblebaegaming/DraftCenter/pull/39) must follow the
released Nuzlocke mainline, rename its unpublished migration after 264, and be
revalidated in its isolated Preview before the two features are released in
that order.

## Active watch items

- Supabase memory and Disk IO during normal live-draft days
- Autonomous-claim reconciliation workload and duplicate live-draft polling
- Search Console indexing and canonical reports
- Historical versus new Operations events
- The inactive generic Supabase fallback and its schema drift; do not change
  provider configuration or either project without exact-ID owner approval

## Non-blocking work

- Apple Mail, Samsung Email, or Thunderbird coverage
- Continued performance monitoring
- August-December SEO roadmap
- Further polling optimization after regression coverage

## Authoritative records

- Detailed current handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-05-nuzlocke-tournaments-finalization.md`](handoffs/DraftCenter-agent-handoff-2026-08-05-nuzlocke-tournaments-finalization.md)
- Pallet Town release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md`](handoffs/DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md)
- Last broad production handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-04-final.md`](handoffs/DraftCenter-agent-handoff-2026-08-04-final.md)
- Security remediation:
  [`docs/DraftCenter-security-remediation-2026-08-02.md`](DraftCenter-security-remediation-2026-08-02.md)
- Retention and recovery:
  [`docs/data-retention-and-recovery.md`](data-retention-and-recovery.md)

When this file conflicts with an older handoff, the newest verified production
record and repository state take precedence.
