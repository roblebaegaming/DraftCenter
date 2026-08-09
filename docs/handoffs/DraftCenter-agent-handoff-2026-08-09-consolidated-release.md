# DraftCenter handoff - consolidated Pokédex, pricing, and pod-access release

- Date: August 9, 2026 (America/Denver)
- Branch: `codex/consolidated-release-2026-08-09`
- Base: `origin/main` at `52ec81c`
- Production baseline: application `b40717e`, migration 365
- Release state: isolated Preview database verification and all local release
  gates pass; protected pull request and application Preview review remain

## Included work

### Public Pokédex discovery

- combinable color, Egg Group, and shape filters;
- three category hubs and 39 category pages with canonical metadata, Open
  Graph data, breadcrumbs, structured data, sitemap entries, and profile
  cross-links; and
- pinned public catalog coverage of 10 colors, 14 shapes, 15 Egg Groups,
  1,025 species, and 1,351 battle/stat profiles.

The integration preserves the newer production canonical, move-catalog,
Nuzlocke-guide, indexing, and product-discovery behavior already on `main`.

### Versioned draft pricing

- sourced, versioned default boards for Regulations M-B, F, G, and H;
- explicit BST estimates for every otherwise unlisted legal Pokémon;
- optional singles-oriented Generation 3-7 boards;
- BST/import behavior for regional Pokédex and Custom formats; and
- commissioner-facing source, version, date, coverage, and estimate labels.

Existing leagues retain their stored pricing until a commissioner opts into a
new preset. The durable source and product contract are in
[`../draft-pricing-presets.md`](../draft-pricing-presets.md).

### Multi-pod observer access

- sibling-pod managers may navigate, view completed activity, use the League
  Board, and predict without gaining team, draft, transaction, claim, trade,
  or direct-message authority; and
- invited spectators remain limited to standings, predictions, the official
  draft board, and playoffs.

The database boundary is forward migrations 366-368. Migration 367 makes the
access payload portable across the retained Preview schema's optional league
metadata. Migration 368 ensures a league's first prediction creates its
missing matchup object. The detailed role contract and release matrix are in
[`DraftCenter-agent-handoff-2026-08-09-multi-pod-access-clarification.md`](DraftCenter-agent-handoff-2026-08-09-multi-pod-access-clarification.md).

## Evidence

- production dependency audit: no known vulnerabilities;
- complete application test suite: passed;
- National Dex paging: 1,027 rows;
- public Pokémon catalog: 1,025 species, 1,351 profiles, 1,579 forms, and 18
  type indexes;
- every legal Pokémon across all 54 draft formats: finite positive price;
- optimized production build: 222 generated pages/routes completed; and
- retained isolated Preview migrations 366-368 and access transaction matrix:
  passed with every boundary `true` and exact synthetic-fixture cleanup.

No production data or provider configuration was changed. No real league,
draft, pick, roster, queue, transaction, manager, spectator, or message was
used for validation. The original dirty workspace remains untouched.

## Remaining release sequence

1. Push the consolidated branch and open a protected pull request.
2. Require repository checks and review the exact Vercel Preview at desktop
   and 390px mobile. Exercise the public Pokédex and available signed-in pod
   role surfaces without changing a real league.
3. Merge only after Preview approval.
4. Apply migrations 366, 367, and 368, in order, to the exact core production
   project as the authorized release database step.
5. Confirm Vercel serves the merged commit as Current production, run the
   signed-out production smoke sweep, and record the final deployed state in a
   follow-up documentation pull request.
