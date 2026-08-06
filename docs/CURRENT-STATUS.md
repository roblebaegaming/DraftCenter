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
request [#38](https://github.com/roblebaegaming/DraftCenter/pull/38) and stacked
tournament pull request [#39](https://github.com/roblebaegaming/DraftCenter/pull/39)
must be rebased, renumber their unpublished migrations after production
migration 260, revalidated in isolated Previews, and released in that order.

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

Stacked branch `codex/nuzlocke-gen4` has separate independently audited
Diamond, Pearl, Platinum, HeartGold, and SoulSilver catalogs locally prepared
with unpublished migrations 286-295. It covers Sinnoh time windows, swarms,
Poke Radar, dual-slot cartridges, Trophy Garden, Great Marsh, and Honey Trees,
plus the remakes' weekday/radio, Bug-Catching Contest, headbutt-tree, Safari
block, and version-exclusive encounters. All five source audits, 40 focused
regressions, the full application suite, the 1,027-row National Dex check,
dependency audit, and 108-page build pass locally. The migrations have not been
applied to Preview or production; Preview database and visual validation remain
required.

Stacked branch `codex/nuzlocke-gen5` has separate independently audited Black,
White, Black 2, and White 2 catalogs locally prepared with unpublished
migrations 296-303. It covers seasons, phenomenon encounters, exact PKHeX
swarm tables, weekday-only static encounters, Regi keys, and 70 explicit
Hidden Grotto rows in each sequel. All four source audits, 42 focused
regressions, the full application suite, the 1,027-row National Dex check,
dependency audit, and 108-page build pass locally. The migrations have not
been applied to Preview or production; Preview database, CI, and visual
validation remain.

Stacked branch `codex/nuzlocke-gen6` has separate independently audited X, Y,
Omega Ruby, and Alpha Sapphire catalogs locally prepared with unpublished
migrations 304-311. It covers hordes, a one-location opt-in Friend Safari,
starter-matched legendary birds, exact ORAS wild tables, National Pokédex
DexNav species, rotating Mirage Spots, soaring, schedules, and
version-exclusive forms. No schema change was required. All four source
audits, 44 focused regressions, the full application suite, all 1,027 National
Dex rows, the production dependency audit, and a 108-page production build
pass locally. Preview database, CI, and visual validation remain; nothing from
this stack is in production.

Stacked branch `codex/nuzlocke-gen7` has separate independently audited Sun,
Moon, Ultra Sun, Ultra Moon, Let's Go Pikachu, and Let's Go Eevee catalogs
locally prepared with unpublished migrations 312-323. It covers SOS allies,
weekday Island Scan, Poké Pelago, one-location Ultra Warp Ride, pair-required
legends, QR gifts, visible overworld encounters, rare/catch-combo pools,
postgame flying encounters, and repeated roaming birds. No schema change was
required. All six source audits, 46 focused regressions, the full application
suite, all 1,027 National Dex rows, the production dependency audit, and a
108-page production build pass locally. Preview database, CI, and visual
validation remain; nothing from this stack is in production.

Stacked branch `codex/nuzlocke-gen8` has separate independently audited Sword,
Shield, Brilliant Diamond, Shining Pearl, and Legends: Arceus catalogs locally
prepared with unpublished migrations 324-333. It covers weather and visible
encounters, both Sword/Shield expansions, stock raids and Dynamax Adventures,
Grand Underground hideaways, Alpha Pokemon, landmarks, distortions, outbreaks,
and mass outbreaks. All five source audits and 48 focused regressions pass.
The full application suite, all 1,027 National Dex rows, production dependency
audit, and 108-page production build also pass locally. CI, Preview database,
and visual validation remain; nothing from this stack is in production.

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
