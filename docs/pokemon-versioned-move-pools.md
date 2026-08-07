# Versioned Pokédex move pools

Last reviewed: August 7, 2026

DraftCenter keeps move pools separate by source version group. It does not
combine a newer game's moves into an older game, combine Sun/Moon with the
Ultra games, or treat a Legends game's real-time rules as standard turn-based
legality.

## Published catalog

The Pokédex exposes 28 move-bearing pools:

| Generation | Pools |
| --- | --- |
| IX | Pokémon Champions; Legends: Z-A; Legends: Z-A — Mega Dimension; Scarlet/Violet + DLC |
| VIII | Legends: Arceus; Brilliant Diamond/Shining Pearl; Sword/Shield + DLC |
| VII | Let's Go Pikachu/Eevee; Ultra Sun/Ultra Moon; Sun/Moon |
| VI | Omega Ruby/Alpha Sapphire; X/Y |
| V | Black 2/White 2; Black/White |
| IV | HeartGold/SoulSilver; Platinum; Diamond/Pearl |
| III | FireRed/LeafGreen; XD; Colosseum; Emerald; Ruby/Sapphire |
| II | Crystal; Gold/Silver |
| I | Yellow; international Red/Blue; Japanese Blue; Japanese Red/Green |

The PokeAPI snapshot has 638,321 raw learnset rows across 32 cataloged version
groups. Twenty-six groups contain move rows. The remaining six are not silently
presented as complete:

- Isle of Armor and Crown Tundra have zero standalone rows; their additions are
  present in the current Sword/Shield pool. Calyrex is a pinned regression.
- Teal Mask and Indigo Disk have zero standalone rows; their additions are
  present in the current Scarlet/Violet pool. Ogerpon and Pecharunt are pinned
  regressions.
- PokeAPI defines Legends: Z-A and Mega Dimension but has zero learnset rows for
  them. DraftCenter imports separate pre- and post-expansion Pokémon Showdown
  snapshots instead.

The source catalog, exact counts, method names, and supplemental Z-A rows are in
[`data/pokedex/pokemon-move-catalog.pinned.json`](../data/pokedex/pokemon-move-catalog.pinned.json).
All 638,321 PokeAPI learnset rows are also imported into 64 deterministic static
shards under `public/data/pokemon-move-pools/`. A profile downloads only the
shard containing its selected Pokémon, and decoding fails closed if the source
version does not match the pinned commit.

## Pinned sources

- PokeAPI CSV commit
  [`5064f1d72746b3a6a931616dae3fb6445c556d4f`](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv)
- Base Legends: Z-A Pokémon Showdown learnsets
  [`b971dd072e64610cbb1b3a847af8e050e111bf21`](https://github.com/smogon/pokemon-showdown/blob/b971dd072e64610cbb1b3a847af8e050e111bf21/data/mods/gen9legends/learnsets.ts)
- Post–Mega Dimension Pokémon Showdown learnsets
  [`e13942b7219ecd4428a567f31c53ba465f146fbf`](https://github.com/smogon/pokemon-showdown/blob/e13942b7219ecd4428a567f31c53ba465f146fbf/data/mods/gen9legends/learnsets.ts)

The two Z-A snapshots are intentionally separate. The post-expansion pool is
cumulative, while the earlier snapshot preserves the base-game comparison.
Both are labeled as real-time game rules in the UI.

## Rebuild and verification

Rebuild the pinned artifact after intentionally changing a source commit:

```powershell
npm run pokemon-moves:build
```

Confirm the checked-in artifact reproduces exactly from its pinned sources:

```powershell
npm run pokemon-moves:audit
npm run test:pokemon-moves
```

The focused test verifies all 28 published source keys, all 32 upstream version
groups, the six zero-row groups and their explicit resolution, source counts,
BDSP's exact identifier, Champions training data, Stadium Surfing Pikachu, DLC
coverage samples, Z-A separation, bounded supplemental responses, and retention
of multiple learn methods for the same move.

## Database and release boundary

Forward-only migration
[`349-catalog-complete-versioned-pokemon-move-pools.sql`](../supabase/349-catalog-complete-versioned-pokemon-move-pools.sql)
adds source/count metadata to `pokemon_game_versions`, records all 32 source
groups, marks the four empty DLC aliases non-selectable, retires the mistaken
`pokemon-champions` alias, and preserves read-only public access under RLS.

The historical PokeAPI payload is split across bounded static shards instead of
shipping a 638,321-row client bundle or relying on mutable live learnsets. The
two missing Z-A snapshots are served from the local pinned artifact. This keeps
the selected profile reproducible without mixing sources.

Migration 349 is not a production deployment by itself. Apply it only through
the protected release flow, verify its RLS/grant assertions in Preview, and do
not use production data writes as a move-pool test.
