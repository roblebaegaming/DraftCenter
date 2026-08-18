# Legends Alpha Dex

Date: August 17, 2026

Status: released through pull request #298 and Production migrations 431–433

## Product boundary

Alpha Dex is an optional third checklist for Pokémon Legends: Arceus and
Pokémon Legends: Z-A. It is independent from the standard and shiny lists.
Only species that can legitimately be obtained as Alpha in the selected game
appear in the Alpha view; Alpha-locked species are omitted.

This is species-level completion tracking, not a specimen inventory. DraftCenter
does not claim that every individual of an eligible species can be Alpha, and it
does not expose Alpha locations, levels, probabilities, or progression gates.
The Z-A encounter catalog remains pending and unavailable to Nuzlocke tools.

## Eligibility rule and exact counts

A species is eligible when a reviewed source contains a direct Alpha encounter,
gift, or static specimen, or when it can evolve from a directly obtainable Alpha
in the same reviewed evolution family.

| Game | Game Pokédex | Alpha eligible | Alpha locked |
| --- | ---: | ---: | ---: |
| Legends: Arceus | 242 | 224 | 18 |
| Legends: Z-A | 364 | 339 | 25 |

The seven Z-A Pokédex species without direct source rows—Annihilape, Sirfetch’d,
Gholdengo, Milotic, Runerigus, Armarouge, and Ceruledge—are eligible through
evolution from a reviewed Alpha source in the same family.

The reproducible species-only artifact is
`data/pokemon/pokemon-legends-alpha-availability.json`. It pins the Legends:
Arceus reviewed encounter catalog and the separate PKHeX Z-A source audit. The
builder refuses count drift, unknown Pokédex entries, duplicate species, or an
eligibility/lock partition that does not cover the entire game Pokédex.

## Privacy and storage

- Alpha eligibility and Alpha catches use dedicated tables with forced RLS.
- Browser roles cannot read either table directly.
- Account-scoped functions return only the signed-in user's tracker data.
- Existing standard and shiny entry storage is unchanged.
- Portable JSON backups use schema version 4 and preserve the Alpha option and
  caught flags; version 3 restores remain supported.
- Workbook exports identify the progress layer and include Alpha totals without
  exposing any encounter-source details.

## Rebuild and validation

```powershell
npm run catalog:build:legends-alpha
npm run catalog:check:legends-alpha
npm run test:legends-za
npm run test:pokedex-tracker
```

The disposable Preview regression applied migrations 431–433, verified the
364-entry Z-A split and zero Z-A encounters, checks anonymous and authenticated
grants, creates both Legends tracker types inside a rolled-back transaction,
and confirms a version-4 export/restore roundtrip. The authorized paid Preview
branch used on August 17 was deleted immediately after those checks passed.

Production postflight confirmed 364 Z-A Pokédex entries, zero Z-A locations and
encounters, both exact Alpha counts, denied direct browser table access, and the
account-scoped Alpha function grant. Deployment `e6f5da2` then passed the full
22-check signed-out smoke sweep and phone-width Z-A directory review.
