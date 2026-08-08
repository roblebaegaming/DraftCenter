# DraftCenter current status

- Last updated: August 8, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production application commit: `a1bf843`
- Latest production migration: 354

## Deployed state

DraftCenter production includes the multi-pod organization foundation and
commissioner workspace, the owner-only Operations navigation, tournament
commissioner recovery, and the Pokémon species-traits release.

Tournament commissioner recovery shipped through pull request 83 at production
commit `55a5bec`. Migration 354 is applied to the exact core production
project. Commissioners can forfeit matches, drop or disqualify entrants, and
issue identity-safe replacement claims with revision checks, roster-retention
choices, private replacement storage, and audit history. The production RLS and
grant audit passed, and no test replacement rows or synthetic recovery
tournaments remain.

Pokédex shape and localized Egg Group facts, plus Nuzlocke shape and Egg Group
themes, shipped through pull request 87 at current production commit
`a1bf843`. The release uses a deterministic pinned catalog covering 1,025
species and all 1,351 PokeAPI battle profiles. Shape and Egg Group filters can
be combined with the existing type, color, and evolution-stage themes, apply to
every displayed team member, and persist in shared links and Run Card exports.

Production migrations are forward-only and collision-free through 354.
Migrations 350-353 provide the private multi-pod organization schema,
championship mapping correction, shared season-rule boundaries, and
commissioner workspace. Migration 354 adds tournament recovery.

## Release verification

- Full application tests passed.
- Production dependency audit reports no known vulnerabilities.
- National Dex paging passed across 1,027 rows.
- The production build passed with 180 generated pages.
- CodeQL, security checks, dependency checks, full-history secret scanning,
  Vercel, and preview feedback passed for both releases.
- Vercel reports the exact current `main` commit Ready in Production.
- The signed-out production smoke sweep passes, including protected 401
  boundaries.
- Live production checks confirm all 14 Pokédex shapes, all 15 Egg Groups, and
  Bulbasaur's Quadruped and Monster/Grass facts with no browser errors or
  desktop overflow.
- No merge protection was bypassed.

## Preserved boundaries

- No real league, draft, pick, roster, schedule, tournament, entrant, or result
  was changed for release testing.
- The retained `multi-pod-pr-82` Supabase Preview branch remains available and
  must not be deleted as part of routine cleanup.
- The original DraftCenter workspace still has 37 pre-existing changed paths;
  they were not staged, committed, discarded, hidden, or overwritten.
- No provider configuration, production environment variable, secret, or user
  record was changed by these releases.

## Remaining work

No deployment work remains for pull requests 83 or 87. Continue normal
production monitoring for tournament recovery, organization commissioner
workflows, Nuzlocke generation, and the new species filters.

Standalone double elimination is implemented on branch
`codex/standalone-double-elimination-2026-08-08` with forward migration 355.
The full application checks pass, and migration 355 plus its synthetic
transaction matrix pass in the isolated `double-elimination-pr-2026-08-08`
Supabase Preview branch. It is not merged, applied to production, or deployed.
The Preview branch remains billable until an explicit cleanup decision.

The August 8 external SEO measurement is complete. The 1,544-page Semrush
crawl, existing Position Tracking baseline, and Search Console performance,
indexing, sitemap, and canonical snapshots are recorded in
[`seo-measurement-2026-08-08.md`](seo-measurement-2026-08-08.md). Adding US
desktop/mobile Position Tracking remains blocked by the account's one-target
limit; the existing Australia history was preserved.

## Authoritative records

- Current continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-double-elimination-and-seo.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-double-elimination-and-seo.md)
- Previous production verification:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-final-production-verification.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-final-production-verification.md)
- Recovery and species-traits release detail:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-recovery-and-species-traits-production.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-recovery-and-species-traits-production.md)
- Multi-pod commissioner workspace:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-commissioner-workspace.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-commissioner-workspace.md)
- Detailed recovery implementation:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-07-tournament-commissioner-recovery.md`](handoffs/DraftCenter-agent-handoff-2026-08-07-tournament-commissioner-recovery.md)
- Species-trait provenance and behavior:
  [`docs/pokemon-catalog/pokemon-species-traits-2026-08-07.md`](pokemon-catalog/pokemon-species-traits-2026-08-07.md)
- Multi-pod organizer guide:
  [`docs/multi-pod-organizer-guide.md`](multi-pod-organizer-guide.md)
- Draft Tournament scope and status:
  [`docs/draft-tournament-concept.md`](draft-tournament-concept.md)
- External SEO measurement:
  [`docs/seo-measurement-2026-08-08.md`](seo-measurement-2026-08-08.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified production record
and the current repository state take precedence.
