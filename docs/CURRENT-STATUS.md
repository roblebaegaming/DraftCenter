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
onto the current mainline with separate audited Red and Blue catalogs and
unpublished migrations 261-266. Its isolated Preview database reports both
games verified, all six repository checks pass, the full local validation suite
passes, and live deterministic/shared/final-evolution browser checks pass. A
narrow mobile visual review remains before release. Stacked tournament pull
request [#39](https://github.com/roblebaegaming/DraftCenter/pull/39) must follow
the released Nuzlocke work, receive the first unused migration number, and be
revalidated in its isolated Preview.

Follow-on branch `codex/nuzlocke-gen2` has Pokemon Yellow plus independently
audited Gold, Silver, and Crystal locally prepared. It adds starter metadata,
shareable time/swarm/weekday filters, the Bug-Catching Contest, and unpublished
migrations 267-275. Focused tests and all four source audits pass. Preview
migration and visual validation remain paused until the isolated Preview
credential is rotated; none of this follow-on work is in production.

Stacked branch `codex/nuzlocke-gen3` has separate independently audited Ruby,
Sapphire, Emerald, FireRed, and LeafGreen catalogs locally prepared with
unpublished migrations 276-285. It covers Hoenn and Sevii encounters, Feebas
tiles, Rock Smash, starter-dependent roaming beasts, fossils, postgame state,
and all nine Altering Cave tables. All five source audits, the full application
suite, the 1,027-row National Dex check, dependency audit, and 108-page build
pass locally. The migrations have not been applied to Preview or production;
Preview database and visual validation remain required.

Stacked pull request [#45](https://github.com/roblebaegaming/DraftCenter/pull/45)
on branch `codex/nuzlocke-gen4` has separate independently audited Diamond,
Pearl, Platinum, HeartGold, and SoulSilver catalogs locally prepared with
unpublished migrations 286-295. It covers Sinnoh time windows, swarms,
Poke Radar, dual-slot cartridges, Trophy Garden, Great Marsh, and Honey Trees,
plus the remakes' weekday/radio, Bug-Catching Contest, headbutt-tree, Safari
block, and version-exclusive encounters. All five source audits, 40 focused
regressions, the full application suite, the 1,027-row National Dex check,
dependency audit, and 108-page build pass locally. The migrations have not been
applied to Preview or production; Preview database and visual validation remain
required.

The complete application suite, all 1,027 National Dex rows, production
dependency audit, and a 108-page production build pass locally on the stacked
Generation IV branch.

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
