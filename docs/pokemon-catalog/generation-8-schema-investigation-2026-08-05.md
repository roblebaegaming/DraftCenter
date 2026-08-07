# Generation VIII Nuzlocke catalog investigation

Date: 2026-08-05

## Result

The existing versioned encounter schema can represent Sword, Shield, Brilliant Diamond, Shining Pearl, and Pokémon Legends: Arceus without a schema migration. The five games use forward-only catalog import and verification migrations `324` through `333`; none have been applied to Preview or production.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX Generation VIII encounter data](https://github.com/kwsch/PKHeX/tree/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Legality/Encounters/Data/Gen8): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`
- [pkNX](https://github.com/kwsch/pkNX/tree/d191cd0e5c05f2af81d9a41c1f1d82e6621b351a): `d191cd0e5c05f2af81d9a41c1f1d82e6621b351a`
- [BDSP-Randomizers](https://github.com/Ai0796/BDSP-Randomizers/tree/1be7f719a44586321eadb9a54ac8f0351fbc8073): `1be7f719a44586321eadb9a54ac8f0351fbc8073`

PokéAPI supplies the Sword/Shield base-game encounter rows and all five games' Pokédex/evolution metadata. It has no BDSP or Legends: Arceus encounter rows and no Sword/Shield expansion-area encounter rows, so those rows come from the pinned PKHeX containers. pkNX and BDSP-Randomizers independently confirm the source table structures and special encounter families.

## Nuzlocke scoping decisions

- Sword/Shield ordinary encounters use one catch location per displayed met location. Isle of Armor and Crown Tundra encounters are optional. Stock Max Raid pools collapse to one catch location for the base Wild Area and one for each expansion; event distribution raids are excluded. Dynamax Adventures use Max Lair as one optional catch location.
- BDSP surface encounters use displayed met locations. Grand Underground rooms collapse by displayed hideaway name, such as `Grand Underground (Spacious Cave)`, and are off by default. Honey Trees remain an explicit filter. Limited Darkrai/Shaymin events and other-game save gifts are off by default.
- Legends: Arceus ordinary spawners and landmarks use named met locations. Space-time distortions, mass outbreaks, and massive mass outbreaks use the broad field region emitted first by the audited table and are off by default. Alpha encounters remain visible through their own filter.
- After catch-location normalization, identical rows are collapsed and their occurrence counts are added to `chance`. This prevents internal table duplication from exceeding the bounded API payload while retaining relative weight in authentic mode.

## Form and evolution behavior

Generation VIII introduces mixed cosmetic and regional forms in the same game. Evolution lookup is now keyed by both Pokémon profile and source form, with a profile-only fallback for older artifacts. East and West Sea Shellos, Unown letters, Burmy cloaks, Antique Sinistea, Galarian lines, Hisuian lines, Kubfu branches, and white-striped Basculin therefore retain the correct final form.

## Release boundary

All import migrations remain pending-first and all verification migrations fail closed on exact counts, mechanics, locations, methods, starters, and version exclusives. Preview application and visual testing are separate release steps; production was not changed.
