# Pokémon Moon encounter audit

Date: August 5, 2026

## Reviewed artifact

- 782 Pokédex rows, 68 catch locations, 890 encounter rows, 251 obtainable profiles, 11 methods, 13 conditions, and 5 condition groups.
- 181 SOS-tagged rows, 28 weekday-specific Island Scan rows, 64 Poké Pelago visitor rows, and 20 postgame-tagged rows.
- Lunala, Pheromosa, and Celesteela are present; Sun's Solgaleo, Buzzwole, and Kartana counterparts are absent.
- The independent wild comparison contains 465 ordinary PKHeX tuples versus 366 catalog tuples with 357 shared, and 454 SOS tuples versus 97 catalog tuples with 96 shared.

## Reproducible sources

- [PokeAPI data snapshot](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv): `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokeAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX Sun/Moon encounter sources](https://github.com/kwsch/PKHeX/tree/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Legality/Encounters/Data/Gen7): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`
- [pk3DS Generation VII table structures](https://github.com/kwsch/pk3DS/tree/6daaca934ca2284a73ab743bf89c848c57cd9de1/pk3DS.Core/Structures/Gen7): `6daaca934ca2284a73ab743bf89c848c57cd9de1`

`npm run catalog:audit:moon` asserts all counts, paired-version differences, the 6,136-byte/151-area PKHeX container with 540 ordinary and 545 SOS slots, table layout, mechanics, and version exclusives. Migrations 314–315 are prepared but unapplied.
