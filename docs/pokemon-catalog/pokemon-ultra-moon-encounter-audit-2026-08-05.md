# Pokémon Ultra Moon encounter audit

Date: August 5, 2026

## Reviewed artifact

- 1,003 Pokédex rows, 74 catch locations, 1,216 encounter rows, 377 obtainable profiles, 11 methods, 19 conditions, and 8 condition groups.
- 268 SOS-tagged rows, 28 weekday-specific Island Scan rows, 63 Poké Pelago rows, and 96 postgame-tagged rows.
- All 86 Ultra Warp Ride entries share one catch location. Five pair-required legends and the QR-code gift remain explicit opt-ins.
- Lunala, Pheromosa, Celesteela, and Stakataka are present; their Ultra Sun counterparts are absent.
- The independent wild comparison contains 567 ordinary PKHeX tuples versus 452 catalog tuples with 451 shared, and 637 SOS tuples versus 167 catalog tuples with 166 shared.

## Reproducible sources

- [PokeAPI data snapshot](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv): `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokeAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX USUM encounter sources](https://github.com/kwsch/PKHeX/blob/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Legality/Encounters/Data/Gen7/Encounters7USUM.cs): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`
- [pk3DS Generation VII table structures](https://github.com/kwsch/pk3DS/tree/6daaca934ca2284a73ab743bf89c848c57cd9de1/pk3DS.Core/Structures/Gen7): `6daaca934ca2284a73ab743bf89c848c57cd9de1`

`npm run catalog:audit:ultra-moon` asserts all counts, the 7,696-byte/172-area PKHeX container with 650 ordinary and 752 SOS slots, exact source intersections, the one-location Ultra Space policy, special mechanics, and version exclusives. Migrations 318–319 are prepared but unapplied.
