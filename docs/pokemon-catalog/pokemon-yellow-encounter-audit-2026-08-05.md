# Pokémon Yellow encounter audit

- Date: August 5, 2026
- Status: locally verified; Preview migration pending credential rotation
- Game key: `yellow`
- PokéAPI snapshot: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- Sprite snapshot: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun snapshot: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- pret/pokeyellow snapshot: `0a0851546ff65f65c4bb2af2b95e279e709a8653`

## Reviewed catalog

- 151 Pokédex rows
- 74 locations
- 877 encounter rows
- 106 obtainable profiles
- 9 methods: gift, good rod, NPC trade, old rod, Poké Flute, static, Super Rod, surf, and walk
- 106 complete, game-limited evolution mappings

The Veekun baseline contains 830 encounter tuples. The reviewed artifact has no missing Veekun tuples and an explicit 25-tuple delta for static, gift, Poké Flute, and NPC-trade encounters. The Yellow disassembly audit matched all 67 wild areas and 584 level/species pairs.

Version-specific verification includes early Route 1 Pidgey, Route 12 Farfetch’d, and late Pokémon Mansion Ditto assertions. Yellow is never inferred from either Red or Blue.

## Starter policy

Yellow uses Pikachu as its only starter. Red and Blue seed-select Bulbasaur, Charmander, or Squirtle. A starter occupies one requested team slot and reserves its evolutionary family when the family clause is active. New runs default to including a starter; existing seeded links remain encounter-only unless `starter=include` is present.

## Release gate

Migrations 267 and 268 import the exact snapshot as pending and publish it only after source, count, location, and version-specific assertions pass. Apply them only to the isolated Preview database after its exposed credential is rotated. Then verify both selection styles, exclusions, method filters, starter links, and final-evolution links on desktop and mobile before release.
