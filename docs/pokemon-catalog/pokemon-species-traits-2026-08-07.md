# Pokémon species color, shape, and Egg Group metadata

- Date: August 7, 2026
- Expanded: August 9, 2026
- PokeAPI source commit: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- Scope: Pokédex profiles, taxonomy indexes, interactive filters, and Nuzlocke team themes

## Data contract

DraftCenter uses the species-level Pokédex color, shape, and Egg Group assignments from
the same pinned PokeAPI data commit as the 37 verified Nuzlocke encounter
catalogs. The generated artifact contains all 1,025 species and maps all 1,351
PokeAPI battle profiles to one of 10 colors, one of 14 shapes, and one or two
of the 15 Egg Groups. Alternate forms inherit the classification of their
species, matching the PokeAPI species contract.

The committed artifact is
`data/pokemon/pokemon-species-traits.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`.
It is generated from PokeAPI's Pokémon, species, color, shape, localized shape
prose, Egg Group, localized Egg Group prose, and species-to-Egg-Group CSV files. Run
`npm run catalog:build:traits` to rebuild it deterministically from the pinned
commit. A different source commit must be supplied explicitly and reviewed
with the corresponding encounter-catalog update.

## Product behavior

Each public Pokémon profile displays and links the species' Pokédex color,
shape, and localized English Egg Group names. Forms and battle varieties
continue to have distinct profile pages where appropriate, but they share
species-level color, shape, and Egg Group facts.

The interactive Pokédex can combine color, shape, and Egg Group selections
with its existing name, National Dex number, type, generation, ability, and
sorting controls. The public `/pokemon/colors`, `/pokemon/egg-groups`, and
`/pokemon/shapes` hubs lead to one indexable page per reviewed category. Every
category page has a self-canonical, unique metadata, breadcrumb and collection
structured data, an interactive-filter link, and matching profile links. All
42 taxonomy routes are included in the sitemap with a fixed reviewed date.

Nuzlocke Draft exposes optional shape and Egg Group themes alongside its
existing type, color, and evolution-stage themes. Leaving them blank preserves
the existing generator behavior. Selecting multiple themes requires a Pokémon
to match every selected category. Species themes apply to every Pokémon
displayed on the Run Card, including an included starter. When final-evolution
mode is enabled, shape and Egg Group rules apply to the displayed final
evolution rather than the original catch. If an included starter cannot match,
the generator fills that slot from eligible encounters and never adds an
off-theme starter. No rule is silently relaxed when the selected themes cannot
fill the requested team size.

Shape and Egg Group selections are validated against the bounded pinned
catalog and are preserved as `shape` and `egg_group` values in shared team
links. The Nuzlocke API fails closed if its species-trait source commit does not
match the verified game's source commit. This feature does not add a database
migration or change any league, draft, roster, queue, membership, or provider
configuration.

## Regression coverage

Focused tests verify all 10 color labels, all 14 shape labels, all 15 Egg Group
labels, every mapped PokeAPI profile, and complete trait coverage for the
source and final profiles in all 37 game-specific evolution catalogs.
Generator tests cover shape-only, Egg-Group-only, combined, invalid, starter,
and final-evolution themes. UI and route tests cover source matching, bounded
options, profile facts, interactive filters, index metadata, sitemap coverage,
and shared-link restoration.
