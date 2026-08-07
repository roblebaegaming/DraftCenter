# Pokemon Gold encounter audit

- Date: August 5, 2026
- Status: locally verified; Preview migration pending credential rotation
- Game key: `gold`
- PokeAPI snapshot: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- Sprite snapshot: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun snapshot: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- pret/pokegold snapshot: `add1dbe018170d7f25f7b7360e8046cec6354906`

## Reviewed catalog

- 251 Pokedex rows
- 125 locations
- 2,830 encounter rows
- 156 obtainable profiles
- 17 encounter methods
- 156 complete, game-limited evolution mappings

The independently generated Veekun baseline contains 2,382 exact encounter tuples. The reviewed catalog has no missing Veekun tuples and exactly 342 additional approved tuples from PokeAPI and the pinned disassembly-backed special-encounter sources. Additional rows are bounded to the reviewed contest, gift, headbutt, trade, Poke Flute, roaming, SquirtBottle, and static methods.

The pret/pokegold review confirms Gold-specific daytime Caterpie in Ilex Forest and late-game Ursaring on Mt. Silver. The Bug-Catching Contest table exactly matches the ten pinned disassembly rows and preserves its Tuesday, Thursday, and Saturday schedule.

## Release gate

Migration 270 imports this exact snapshot as pending. Migration 271 requires every source, count, location, method, profile, contest, and version-specific assertion to pass before it marks only the pinned Gold row verified. Apply both only to the isolated Preview after credential rotation, then test time, swarm, weekday, starter, method, shared-link, and final-evolution behavior.
