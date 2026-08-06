# Generation II Nuzlocke schema investigation

- Date: August 5, 2026
- Games: Pokémon Gold, Silver, and Crystal
- Status: pending research artifacts only; not independently audited or publishable
- PokéAPI snapshot: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- Candidate disassembly pins: pret/pokegold `add1dbe018170d7f25f7b7360e8046cec6354906`; pret/pokecrystal `5593381195342e481b69a2fd4ab25e202ddcf708`

## Initial snapshot counts

| Game | Pokédex | Locations | Encounter rows | Obtainable profiles |
| --- | ---: | ---: | ---: | ---: |
| Gold | 251 | 124 | 2,820 | 151 |
| Silver | 251 | 124 | 2,820 | 151 |
| Crystal | 251 | 126 | 3,183 | 170 |

All three snapshots expose 16 methods: walk, surf, three rods, three headbutt tables, Rock Smash, roaming grass, gift, gift egg, NPC trade, Poké Flute, SquirtBottle, and static.

The existing `conditions text[]` column losslessly retains the available source tokens for morning/day/night, swarm on/off, Friday, awakened-beast story progress, trades, prizes, and Crystal Virtual Console. It is sufficient for storage, but the current UI cannot let a player choose a time window, swarm state, or weekday. Publishing these games without condition controls would mix mutually exclusive schedules in one draw.

## Required product and schema work

1. Keep raw `conditions text[]` for source fidelity.
2. Add game capability metadata describing supported condition groups and exclusive choices, rather than hard-coding Generation II controls into the component.
3. Add request and shared-link condition filters and validate them against the selected verified game.
4. Define whether an unselected time filter means “all possible schedules” or a seeded schedule. Prefer an explicit player choice with an “Any time” option.
5. Keep headbutt table types as distinct encounter methods; do not flatten them into ordinary walking odds.
6. Treat roaming Pokémon as a distinct method and preserve the awakened-beast requirement.
7. Independently audit fishing groups and level/rarity tables against the disassemblies.
8. Add the Bug-Catching Contest explicitly. The pinned PokéAPI snapshot exposes National Park but does not identify a contest method or Tuesday/Thursday/Saturday condition, so the current artifact is incomplete.
9. Verify Crystal-only encounter areas and version-specific early, middle, and late encounters before any migration can mark a game verified.

No Generation II migration should be generated until the contest gap is filled and the condition-filter contract is implemented. Gold, Silver, and Crystal artifacts remain `pending` research inputs and must ship in a separate generation-sized pull request after Yellow.
