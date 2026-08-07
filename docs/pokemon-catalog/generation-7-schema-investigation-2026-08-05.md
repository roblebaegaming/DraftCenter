# Generation VII Nuzlocke schema investigation

Date: August 5, 2026

## Decision

Generation VII fits the existing versioned catalog schema. No database schema change is required for Sun, Moon, Ultra Sun, Ultra Moon, Let's Go Pikachu, or Let's Go Eevee.

The existing encounter method, level/chance fields, `conditions text[]`, bounded condition groups, form labels, and one-area-per-catch-location contract cover the reviewed mechanics:

- Alola treats ordinary initial encounters as the default. SOS allies, Island Scan, Poké Pelago visitors, postgame encounters, Ultra Warp Ride, pair-required wormhole legends, and the USUM QR gift are explicit choices.
- Island Scan retains its exact Sunday-through-Saturday schedule. The pinned legality export aggregates ordinary day/night tables, so the product does not claim unsupported per-time odds.
- Ultra Space and Ultra Space Wilds share one displayed met location and therefore one Nuzlocke catch. Internal zones cannot award extra catches.
- Let's Go treats visible overworld encounters as ordinary. Rare/catch-combo pools, high-flying postgame spawns, and repeat roaming legendary birds are explicit choices. A Catch Combo changes availability and odds; it does not create a second encounter at the same location.
- Every floor, internal map, and crossover area resolves to its displayed met location. GO Park transfers are excluded because they are transferred Pokémon, not local wild catches.
- Alolan forms and game-specific Lycanroc outcomes are retained in final-evolution mode. Let's Go keeps Kanto evolution outcomes for ordinary Pikachu, Exeggcute, and Cubone while preserving Alolan in-game trades.

## Source boundary

The primary data and sprite snapshots are PokeAPI commits `5064f1d72746b3a6a931616dae3fb6445c556d4f` and `5841d46f1a0d2b8918a29a7376b1424878b86b59`. Independent comparisons use PKHeX commit `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`; Alola table structure is additionally checked against pk3DS commit `6daaca934ca2284a73ab743bf89c848c57cd9de1`.

Veekun's pinned snapshot identifies the six version records but has no Generation VII encounter rows, so it is not treated as an encounter audit source. Migrations 312–323 are pending-first and have not been applied to Preview or production.
