# Pokémon Blue encounter catalog audit — August 5, 2026

## Decision

Pokémon Blue is approved as the second `verified` Nuzlocke Lab catalog. It is
version-specific rather than a copy of Red, remains separate from competitive
regulation presets, and does not change league legality.

The forward-only release migrations are separate:

- `265-import-pokemon-blue-encounter-catalog.sql` imports the pinned snapshot
  as `pending`; and
- `266-verify-pokemon-blue-encounter-catalog.sql` verifies exact counts and
  Blue-specific encounter tables before publishing only that pending snapshot.

No production migration was applied while preparing this audit.

## Pinned sources

- Primary normalized data: [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f),
  commit `5064f1d72746b3a6a931616dae3fb6445c556d4f`, BSD-3-Clause.
- Licensed secondary catalog: [veekun/pokedex](https://github.com/veekun/pokedex/tree/cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b),
  commit `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`, MIT.
- ROM-accuracy comparison: [pret/pokered](https://github.com/pret/pokered/tree/cf621a76d4941c93c078eb38e0880fe8db48ef40),
  commit `cf621a76d4941c93c078eb38e0880fe8db48ef40`.
  No pret content is redistributed; the audit reads the version-conditional
  Blue wild tables directly.
- Artwork paths: [PokeAPI/sprites](https://github.com/PokeAPI/sprites/tree/5841d46f1a0d2b8918a29a7376b1424878b86b59),
  commit `5841d46f1a0d2b8918a29a7376b1424878b86b59`.

## Reviewed coverage

The generated snapshot contains:

- 151 Kanto Pokédex entries;
- 74 unique location-area keys;
- 891 encounter rows;
- 106 obtainable Pokémon profiles;
- a pinned final-evolution mapping for all 106 obtainable profiles, limited to
  the 151 species available in Pokémon Blue; and
- nine encounter methods: walking, surfing, all three rods, gifts, static
  encounters, Poké Flute encounters, and NPC trades.

The automated independent-source audit established:

- every one of the 854 licensed Veekun encounter tuples is represented;
- a reviewed 27-row modern delta limited to gifts, NPC trades, Poké Flute, and
  static encounters;
- all 64 Blue grass and surf areas match `pret/pokered`; and
- 564 distinct wild level/species pairs match the Blue disassembly tables.

Version-specific assertions include the common-slot Nidoran♀ table on Route
22 and wild Magmar in Pokémon Mansion B1F. The verification migration rejects
the corresponding Red common-slot Nidoran♂ row and wild Growlithe table, which
guards against accidentally publishing a renamed Red artifact as Blue.

## Reproduction

Run the game catalog builder for `--game blue` with both the catalog and
evolution outputs, then run `npm run catalog:audit:blue` using the exact commits
recorded above. Generate migration 265 with the reviewed migration builder.
The audit fails closed on count changes, duplicate or unresolved identifiers,
missing methods, licensed-source drift, unexpected special-encounter changes,
or a Blue wild-table mismatch.

## Release boundary

Review migrations 265-266 and the isolated Preview deployment before merge.
Apply them only through the authorized protected release flow after 261-264.
Do not run the production smoke test until the deployed application commit is
confirmed. No production game, league, draft, roster, queue, membership,
deadline, notification, provider, or catalog row was changed by this audit.
