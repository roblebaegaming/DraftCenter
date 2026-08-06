# Pokémon Sun encounter audit

Date: August 5, 2026

## Reviewed artifact

- 782 Pokédex rows, 67 catch locations, 886 encounter rows, 251 obtainable profiles, 11 methods, 13 conditions, and 5 condition groups.
- 181 SOS-tagged rows, 28 Island Scan rows with four encounters on each weekday, 64 Poké Pelago visitor rows, and 16 postgame-tagged rows.
- Solgaleo, Buzzwole, and Kartana are present; Moon's Lunala, Pheromosa, and Celesteela counterparts are absent. Five upstream New Mauville Voltorb/Electrode rows were rejected as cross-game contamination.
- The independent wild comparison contains 467 ordinary PKHeX tuples versus 366 catalog tuples with 352 shared, and 459 SOS tuples versus 97 catalog tuples with 96 shared. Static Ultra Beast encounters account for the expected representation differences.

## Reproducible sources

- [PokeAPI data snapshot](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv): `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokeAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX Sun/Moon encounter sources](https://github.com/kwsch/PKHeX/tree/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Legality/Encounters/Data/Gen7): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`
- [pk3DS Generation VII table structures](https://github.com/kwsch/pk3DS/tree/6daaca934ca2284a73ab743bf89c848c57cd9de1/pk3DS.Core/Structures/Gen7): `6daaca934ca2284a73ab743bf89c848c57cd9de1`

`npm run catalog:audit:sun` asserts all counts, paired-version differences, the 6,120-byte/151-area PKHeX container with 538 ordinary and 544 SOS slots, table-layout markers, Island Scan weekdays, special-mechanic defaults, version exclusives, and the contamination rejection. Migrations 312–313 are prepared but unapplied.
