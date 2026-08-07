# Pokémon Omega Ruby encounter audit

Date: August 5, 2026

## Reviewed artifact

- 211 Pokédex rows, 89 catch locations, 2,822 encounter rows, 251 obtainable profiles, 14 methods, and 26 source conditions.
- All 2,747 nonempty wild slots match the pinned PKHeX 273-table container exactly: 996 ordinary grass, 120 tall-grass, 150 National Pokédex DexNav, 295 Surf, 55 Rock Smash, 531 rod, and 600 horde rows.
- Seven normal soaring species and all scheduled/special encounters remain explicit. Daily Mirage Spots contribute 420 tagged rows and are off by default.
- Groudon, Latios, Tornadus, and West Sea Shellos are asserted as version-specific records. Final evolutions stop at species 721.

## Reproducible sources

- PokeAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokeAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX Omega Ruby wild container and static encounter source](https://github.com/kwsch/PKHeX/tree/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Resources/legality/wild/Gen6): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`
- [pk3DS ORAS encounter layout](https://github.com/kwsch/pk3DS/blob/6daaca934ca2284a73ab743bf89c848c57cd9de1/pk3DS.WinForms/Subforms/Gen6/RSWE.cs): `6daaca934ca2284a73ab743bf89c848c57cd9de1`
- Veekun: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`; all 23 available tuples match.

`npm run catalog:audit:omega-ruby` asserts the exact binary reconstruction, independent tuple comparison, version differences, forms, controls, and counts. Migrations 308–309 are prepared but unapplied.
