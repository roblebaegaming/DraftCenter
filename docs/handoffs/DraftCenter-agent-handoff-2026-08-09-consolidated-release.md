# DraftCenter handoff - consolidated Pokédex, pricing, and pod-access release

- Date: August 9, 2026 (America/Denver)
- Branch: `codex/consolidated-release-2026-08-09`
- Base: `origin/main` at `52ec81c`
- Production application: `cdce0f19c62110cff384d204f890be01042735b6`
- Latest production migration: 368
- Release state: deployed through protected pull request 103 and verified

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
- protected pull request security, dependency, full-history secret scan,
  CodeQL, and Vercel checks: passed;
- exact application Preview and production Pokédex review: passed at desktop
  and 390px mobile without browser errors or horizontal overflow;
- Vercel production source: exact merged `main` commit `cdce0f1`, Ready on the
  public production domains;
- production database postflight: RPCs, observer policies, authenticated and
  anonymous grants, metadata portability, and first-prediction persistence all
  verified read-only; and
- signed-out production smoke: passed every public 200 and protected 401
  boundary.

No production data or provider configuration was changed. No real league,
draft, pick, roster, queue, transaction, manager, spectator, or message was
used for validation. The original dirty workspace remains untouched.

## Production completion

Pull request [#103](https://github.com/roblebaegaming/DraftCenter/pull/103)
merged after all protected checks and exact Preview review. Forward migrations
366, 367, and 368 were then applied in order to the exact core production
project and verified with read-only object, policy, grant, and function-body
checks. Vercel serves the exact merged commit from `main`, and the signed-out
production smoke and focused live Pokédex checks pass. No release step remains.
