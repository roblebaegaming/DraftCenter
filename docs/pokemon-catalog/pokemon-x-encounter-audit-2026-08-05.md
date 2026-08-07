# Pokémon X encounter audit

Date: August 5, 2026

## Reviewed artifact

- 454 Pokédex rows, 61 catch locations, 1,469 encounter rows, 358 obtainable profiles, 20 methods, and 17 source conditions.
- 196 Friend Safari rows exactly match the pinned PKHeX species/form list. Its 18 type tables are one catch location; red, yellow, and blue Floette remain separate form entries.
- Xerneas and Clauncher are present; Yveltal is absent. The final legendary-bird catch is starter-matched and postgame-only. The uncapturable roaming phase is omitted.
- Kalos starters are Chespin, Fennekin, and Froakie. Final evolutions stop at species 721 and preserve the three obtainable Friend Safari Floette/Florges colors.

## Reproducible sources

- PokeAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokeAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX X wild container and Friend Safari implementation](https://github.com/kwsch/PKHeX/tree/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Resources/legality/wild/Gen6): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`
- [pk3DS X/Y encounter layout](https://github.com/kwsch/pk3DS/blob/6daaca934ca2284a73ab743bf89c848c57cd9de1/pk3DS.WinForms/Subforms/Gen6/XYWE.cs): `6daaca934ca2284a73ab743bf89c848c57cd9de1`
- Veekun: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`; 1,090 tuples, 1,006 shared with the enriched artifact.

`npm run catalog:audit:x` asserts all counts, the 92-table/17,476-byte PKHeX container, pk3DS layout markers, Friend Safari forms, version differences, and the exact Veekun comparison. Migrations 304–305 are prepared but unapplied.
