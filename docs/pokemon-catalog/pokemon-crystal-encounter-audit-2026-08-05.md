# Pokemon Crystal encounter audit

- Date: August 5, 2026
- Status: locally verified; Preview migration pending credential rotation
- Game key: `crystal`
- PokeAPI snapshot: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- Sprite snapshot: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun snapshot: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- pret/pokecrystal snapshot: `5593381195342e481b69a2fd4ab25e202ddcf708`

## Reviewed catalog

- 251 Pokedex rows
- 127 locations
- 3,193 encounter rows
- 172 obtainable profiles
- 17 encounter methods
- 172 complete, game-limited evolution mappings

The independently generated Veekun baseline contains 2,736 exact encounter tuples. The reviewed catalog has no missing Veekun tuples and exactly 327 additional approved tuples from PokeAPI and the pinned disassembly-backed special-encounter sources. Additional rows are bounded to the reviewed contest, gift, headbutt, trade, Poke Flute, roaming, SquirtBottle, and static methods.

The pret/pokecrystal review confirms morning Teddiursa at the Violet City entrance to Dark Cave. The reviewed catalog also asserts the Crystal-only static Suicune encounter on Bell Tower 1F. The Bug-Catching Contest table exactly matches the ten pinned disassembly rows and preserves its Tuesday, Thursday, and Saturday schedule.

## Release gate

Migration 274 imports this exact snapshot as pending. Migration 275 requires every source, count, location, method, profile, contest, and Crystal-specific assertion to pass before it marks only the pinned Crystal row verified. Apply both only to the isolated Preview after credential rotation, then test time, swarm, weekday, starter, method, shared-link, and final-evolution behavior.
