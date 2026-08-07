# Pokémon Legends: Arceus encounter audit

Date: 2026-08-05

- Artifact: 242 Pokédex rows, 112 catch locations, 7,523 encounter rows, 245 Pokémon profiles, 8 methods, and 5 condition groups.
- PKHeX container: `86,760` bytes / `1,738` areas / `7,132` source slots.
- Source area types: 519 standard, 213 space-time distortion, 169 landmark, 227 mass outbreak, and 610 massive mass outbreak tables.
- Reviewed output includes 5,097 ordinary overworld rows, 746 landmark rows, 518 optional distortion rows, 454 optional mass-outbreak rows, 629 optional massive-outbreak rows, 3,815 Alpha-tagged rows, scripted encounters, and all fixed Unown.
- Regional evolution checks include Hisuian starter finals, Wyrdeer, Kleavor, Ursaluna, Sneasler, Overqwil, and both Basculegion forms.
- Independent structure check: pinned [pkNX Legends: Arceus encounter tooling](https://github.com/kwsch/pkNX/tree/d191cd0e5c05f2af81d9a41c1f1d82e6621b351a/FlatBuffers/Arceus) independently confirms ordinary spawners, distortions, landmarks, both outbreak types, species, form, Alpha state, and levels.

`npm run catalog:audit:legends-arceus` passes every exact-count, source-container, mechanic, form, location, and regional assertion. The catalog remains local and pending-first.
