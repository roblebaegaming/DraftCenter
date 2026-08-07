# Pokémon: Let's Go, Eevee! encounter audit

Date: August 5, 2026

## Reviewed artifact

- 153 Pokédex rows, 44 catch locations, 693 encounter rows, 125 obtainable profiles, 10 methods, 6 conditions, and 3 condition groups.
- 174 rare-overworld rows, 238 postgame rows, and 75 repeat roaming-bird rows are opt-in. Ordinary visible overworld encounters remain the default.
- The pinned PKHeX container has 35 areas and 688 nonempty wild slots. Its 275 unique species/level tuples compare with 272 catalog overworld tuples, all 272 of which are shared.
- Eevee is the fixed starter. Ekans, Vulpix, Meowth, Bellsprout, Koffing, Pinsir, and the Arcanine gift provide version-specific checks. GO Park transfers are excluded.

## Reproducible sources

- [PokeAPI data snapshot](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv): `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokeAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX Let's Go encounter source](https://github.com/kwsch/PKHeX/blob/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Legality/Encounters/Data/Gen7/Encounters7GG.cs): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`

`npm run catalog:audit:lets-go-eevee` asserts all counts, paired-version differences, the 3,040-byte/35-area PKHeX container, all 688 slots, exact tuple intersection, one-location scoping, special mechanics, and version exclusives. Migrations 322–323 are prepared but unapplied.
