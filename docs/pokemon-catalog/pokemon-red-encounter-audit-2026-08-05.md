# Pokémon Red encounter catalog audit — August 5, 2026

## Decision

Pokémon Red is approved as the first `verified` Nuzlocke Lab catalog. The
catalog remains separate from competitive regulation presets and does not
change league legality.

The import and verification are separate forward-only migrations:

- `261-versioned-pokemon-encounter-catalog.sql` creates the fail-closed schema;
- `262-import-pokemon-red-encounter-catalog.sql` imports the pinned snapshot as
  `pending`; and
- `263-verify-pokemon-red-encounter-catalog.sql` verifies exact counts and
  publishes only that pinned pending snapshot.

No migration was applied while preparing this audit.

## Pinned sources

- Primary normalized data: [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f),
  commit `5064f1d72746b3a6a931616dae3fb6445c556d4f`, BSD-3-Clause.
- Licensed secondary catalog: [veekun/pokedex](https://github.com/veekun/pokedex/tree/cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b),
  commit `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`, MIT.
- Additional ROM-accuracy comparison: [pret/pokered](https://github.com/pret/pokered/tree/cf621a76d4941c93c078eb38e0880fe8db48ef40),
  commit `cf621a76d4941c93c078eb38e0880fe8db48ef40`. No
  pret content is redistributed; the repository is read only by the audit.
- Artwork paths: [PokeAPI/sprites](https://github.com/PokeAPI/sprites/tree/5841d46f1a0d2b8918a29a7376b1424878b86b59),
  commit `5841d46f1a0d2b8918a29a7376b1424878b86b59`.

## Reviewed coverage

The generated snapshot contains:

- 151 Kanto Pokédex entries;
- 74 unique location-area keys;
- 891 encounter rows;
- 106 obtainable Pokémon profiles;
- a pinned final-evolution mapping for all 106 obtainable profiles, limited to
  the 151 species available in Pokémon Red;
- nine encounter methods: walking, surfing, all three rods, gifts, static
  encounters, Poké Flute encounters, and NPC trades; and
- pinned source commits on every imported row.

The automated secondary-source audit established:

- every Veekun tuple represented in the modern PokeAPI Red catalog;
- a documented 27-row modern delta limited to gifts, NPC trades, Poké Flute,
  and static encounters;
- all 64 grass and surf areas matching `pret/pokered`; and
- 564 distinct wild level/species pairs matching the disassembly.

The review covers early, middle, and late routes; caves and floor-specific
areas; water and all fishing rods; Red-specific version tables; gifts, trades,
static and Poké Flute encounters; legendary flags; encounter levels and
conditions; Kanto Pokédex membership; and evolutionary-family normalization.
Pokémon Red has no time, weather, roaming, DLC, or alternate-form encounter
systems, so those categories are correctly empty rather than omitted.

## Reproduction

Run the builder with `--evolutions-output`, then run the preview importer and
source audit with the exact commits recorded above. The final-evolution mapping
is derived from the pinned species relationships and the game-specific
Pokédex, so later-generation evolutions such as Crobat and Steelix are not
treated as available in Red. The source audit fails closed on changed counts,
unresolved or duplicate area keys, missing methods, ordinary encounter drift,
an unexpected special-encounter delta, or a wild-table mismatch.

The database audit additionally reports per-game Pokédex, species, form,
location, encounter, method, and condition totals after migrations are applied.

## Release boundary

Review migrations 261–264 and the Preview deployment before merge. Apply them
only through the authorized release flow. Do not run the production smoke test
until the deployed commit is confirmed. No production league, draft, roster,
queue, membership, deadline, notification, provider, or catalog row was changed
by this audit.
