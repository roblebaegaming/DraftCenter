# DraftCenter current status

- Last updated: August 8, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified functional production release: `b44277a`
- Latest production migration: 353

## Status

Production includes the multi-pod organization foundation from pull request
82, the restored owner Operations navigation from pull request 84, and the
commissioner workspace from pull request 85. Current `main` commit `b44277a`
and migration 353 are deployed and verified. The organization schema remains
private by default, the retained `multi-pod-pr-82` Preview branch is still
available, and no real league has been attached to an organization for release
testing.

The production release passed the refreshed application suite, dependency
audit, National Dex verification, production build, CodeQL, security and
dependency checks, full-history secret scan, exact Vercel deployment check,
database RLS/grant audit, and signed-out production smoke sweep. Preview
fixtures were removed and verified absent before release. No merge protection
was bypassed.

Commissioner tournament recovery remains the active release candidate in pull
request 83. It adds explicit match forfeits, entrant drops and
disqualifications, and identity-safe replacement invitations with an explicit
roster policy. Its forward-only migration is now 354 because production
migration 353 belongs to the multi-pod commissioner workspace. Migration 354
and its synthetic transaction matrix passed on a separate isolated Preview;
RLS, grants, revision denials, replacement claims, projection privacy, and
fixture cleanup all verified. The temporary Preview was deleted after the
proof, while `multi-pod-pr-82` remains untouched. Recovery is not yet deployed
and requires separate production approval.

The August 7 tournament hardening release is live at production commit
`20f55ac`, the squash merge of pull request 80. Native browser confirmations
were replaced with labeled in-page dialogs, result advancement and rejection
now require explicit confirmation, tournament fields and live feedback have
screen-reader names, and six-round brackets expose selectable round controls.
Small screens display one selected round at a time, and focused regression
coverage verifies a complete 64-entrant bracket. The exact Vercel production
deployment is Ready, protected checks passed, the signed-out production smoke
sweep passed, and no migration or production tournament data changed.

The August 7 Roster Connections release is live at production commit
`1750f9a`, the squash merge of pull request 56. The public Daily Games page now
includes a deterministic four-by-four Pokémon grouping puzzle with four
mistakes, one-away hints, solved-group reveals, browser-local progress, and
shareable results. Vercel reports the exact merged commit Ready in Production,
the signed-out production smoke sweep passed, and a live 390-by-844 check
solved and restored a group without page overflow or browser warnings. No
migration was required.

The August 7 global mobile-navigation release is live at production commit
`66014646`, the squash merge of pull request 74. The shared header now keeps
primary discovery links separate from account actions, the fixed mobile tool
bar uses five equal-width destinations without horizontal scrolling, and the
site footer groups reference links under Explore, DraftCenter, and Policies.
Vercel reports the exact merged commit Ready in Production, the signed-out
production smoke sweep passed, and eight representative live routes had no
document, header, or tool-bar overflow at a 390-pixel viewport. No migration,
provider setting, production data, or real league changed.

The August 7 Nuzlocke team-size follow-up is live at production commit
`2d583251`, the squash merge of pull request 72. The compact draft option is
now labeled **Select Team Size**, exposes its slider only while selected, and
supports teams from 1 through 20. The one-Pokémon-per-route option now uses
the shorter **Build the full run** description. Share URLs, saved and
downloaded Run Cards, validation, and SEO copy all accept the expanded limit.
Vercel reports the exact merged commit Ready and current, the signed-out
production smoke sweep passed, and a live 390-by-844 production check generated
all 20 requested Pokémon without horizontal overflow. No migration was
required.

The August 7 tournament stabilization release is live at production commit
`d5b1344`, the squash merge of pull request 68. Vercel reports that exact
`main` deployment Ready and current, all protected checks passed, the signed-out
production smoke sweep passed, and the live `/tournaments` page has the
expected signed-out state with no browser warnings or errors. Tournament score,
replay, and MVP correction fields now refresh from the authoritative completed
match whenever that match changes. No database migration was required.

The repository organization guide was merged immediately before the functional
release through pull request 69 as `dcb0f5b`. Both pull requests were refreshed
onto the concurrent Nuzlocke Draft release record before merge, preventing
overlap with the other active work.

The August 7 Nuzlocke Draft mobile and guide release remains live from
production commit `a9a3894`, the squash merge of pull request 67. The generator
exposes a clear one-Pokémon-per-route option without the compact 12-Pokémon
limit. All 37 game-specific guides use one disclosure per route or area, with
flat method/Pokémon/level rows, and the indexable `/nuzlocke/guides` directory
groups every guide across Generations I–IX.

The August 7 versioned Pokédex move-pool release is live at production commit
`fe0ca21`, the squash merge of pull request 65. All protected and local release
checks passed, Vercel reported the exact `main` deployment Ready, migration 349
was applied to the exact core production project, and the signed-out production
smoke sweep passed. The Pokédex now exposes 28 distinct move-bearing pools
across Generations I–IX from 638,321 pinned PokeAPI learnset rows plus separate
base and Mega Dimension Legends: Z-A snapshots. Live checks confirmed
Champions, Red/Blue Stadium-gift Surf, BDSP, both Z-A pools, and
Scarlet/Violet + DLC.

DraftCenter production is approved for monitored public use and real drafts.
The deployed release sequence now includes Nuzlocke Draft, standalone
tournaments, Trainer Dex, the Daily Three and public Roster Connections,
the technical SEO foundation, expanded competitive resources and format data,
37 reviewed game-specific Nuzlocke guides, complete versioned move pools, and
source-attributed competitive ladder and tournament evidence on Pokémon
profiles.

Vercel reports current `main` release `b44277a` Ready. Pull request 84 restored
the owner-only Operations navigation in production commit `1b29b8c`; pull
request 85 then released the multi-pod commissioner workspace in `b44277a`.
The signed-out production smoke sweep passes, protected Operations and recovery
APIs still return 401 without a session, and `/organizations` presents the
expected sign-in boundary. Live mobile review previously confirmed Roster
Connections is public, usable without an account, persists progress in the
current browser, and has no horizontal overflow. The reorganized header,
five-slot tool bar, and grouped footer remain live. Earlier tournament review
confirmed the public organizer page, signed-out empty state, sign-in boundary,
and clean browser console. Pokémon profiles also expose bounded,
source-attributed ladder and anonymous tournament aggregates without making the
underlying tables public.

Production migrations are collision-free through 353. Migration 343 restores
the Daily Games bracket champion ranking function with a fixed search path,
least-privilege grants, and anonymous current-day privacy. Migrations 344–347
add reviewed competitive datasets behind RLS and bounded aggregate RPCs. The
production audit verifies 4 formats, 4 datasets, 2,938 ladder snapshots, 10
tournaments, 737 anonymous teams, and 4,422 roster members, with direct table
access denied and only the intended RPC execution grants available. Migration
348 refreshes the production PostgREST schema cache so both RPCs are visible to
the deployed application. Migration 349 catalogues all 32 upstream move
version groups, publishes 28 move-bearing pools, retires four empty DLC aliases,
preserves RLS, allows public read-only catalog access, and denies browser
mutations.

Migrations 350-352 provide the private-by-default multi-pod organization
foundation, the forward-only championship-mapping cleanup correction, and
hardened season-rule and audit-sequence boundaries.

Migration 353 adds the commissioner workspace, one-time hashed administrator
invitations, shared-regulation confirmation, revision-aware season launch, and
public organization pages. It was validated first on the retained isolated
Preview branch and then applied once to the exact core production project after
the protected merge. The production audit confirms all nine organization
tables use RLS, browser roles have no direct table or audit-sequence access,
service-role access remains intact, RPC grants match the intended public and
authenticated boundaries, and the new branding constraints, invitation index,
and security-definer search paths are present. No real league was attached or
changed during release validation, and the retained Preview branch was not
deleted.

The application-side SEO backlog from the first crawl is substantially
implemented: meaningful raw-HTML H1 content, fragment-based Pokédex selection,
shorter guide titles, a documented form-canonical policy, useful related links,
expanded resource and format content, and the complete Nuzlocke guide library
are live. External measurement is the remaining hardening gate: a new full
Semrush crawl, Position Tracking baseline, and Search Console snapshot require
an authenticated account session and have not been represented as completed.

## Active watch items

- Semrush full crawl and Search Console indexing/canonical results
- Nuzlocke guide-library impressions, clicks, CTR, and engagement at 14 and
  28 days
- Daily Games ranking RPC errors and anonymous privacy behavior
- Roster Connections daily rotation, artwork availability, and browser-local
  persistence
- Competitive dataset refresh cadence, source availability, and bounded RPC
  performance
- Supabase memory and Disk IO during normal live-draft days
- Autonomous-claim reconciliation workload and duplicate live-draft polling
- Historical versus new Operations events
- Tournament confirmation and round-navigation feedback, correction-state
  refresh behavior, and isolated lifecycle-fixture readiness
- The inactive generic Supabase fallback and its schema drift; do not change
  provider configuration or either project without exact-ID owner approval

## Authoritative records

- Current recovery production-checkpoint handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-tournament-recovery-production-checkpoint.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-tournament-recovery-production-checkpoint.md)
- Multi-pod commissioner workspace handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-commissioner-workspace.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-commissioner-workspace.md)
- Tournament hardening release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-tournament-hardening-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-tournament-hardening-release.md)
- Production reconciliation and cross-agent merge handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-production-reconciliation.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-production-reconciliation.md)
- Current detailed handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-roster-connections.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-roster-connections.md)
- Mobile-navigation release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-mobile-navigation.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-mobile-navigation.md)
- Tournament stabilization release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-tournament-stabilization.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-tournament-stabilization.md)
- Nuzlocke product release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-nuzlocke-product-pass.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-nuzlocke-product-pass.md)
- Versioned move-pool release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-versioned-move-pools.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-versioned-move-pools.md)
- SEO release-hardening record:
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
