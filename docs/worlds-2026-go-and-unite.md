# 2026 Pokémon GO and UNITE prediction readiness

## Current status

Pokémon GO Pick 10 is live at `/worlds/2026/go`. Pull request
[#161](https://github.com/roblebaegaming/DraftCenter/pull/161) shipped as
production application commit
`5b07d274e31d914d7095005d78af878025422851`, and forward-only migration 377 is
applied to the exact Production project.

The reviewed GO pool contains 369 unique Trainers from 370 rows on Pokémon's
official Qualified Competitors page. One duplicate identity, `YUKI KISHIDA` /
`Yuki Kishida`, was retained once. The source says the Trainers earned
invitations; it is not a confirmed attendance, registration, or pool-assignment
list. Pick 10 scores full-field placement and does not require pool assignments
to accept entries. The result source remains disabled with no feed URL,
external event identifier, or scheduler.

Pokémon UNITE remains **Not Live** at `/worlds/2026/unite`. It has no Production
database event, prediction entry, result source, or scheduler. The official page
now publishes player and team labels, but final team registration and the full
group/playoff structure are still not confirmed.

## Shared source-registry boundary

The reviewable registries are:

- `src/data/worlds-2026-go-sources.json`
- `src/data/worlds-2026-unite-sources.json`

`src/lib/worldsSourceRegistry.js` validates them during the application build
and focused tests. GO's committed official snapshot is also reproduced by
`scripts/build-worlds-go-qualified-pool.mjs`. The live page began rate-limiting
automated refreshes, so the builder reads the reviewed browser snapshot and
fails closed if expected source metadata or counts change.

Preserve and review a new exact source snapshot before changing either pool.
Do not silently refresh a live roster from a rolling page. A qualification or
invitation-earned list must never be described as proof of attendance.

## Pokémon GO contract

GO uses individual Trainers with Pick 10 plus Your Champion, whose placement
points count twice. Migration 377 required the exact staged, empty, zero-entry
GO event before inserting the 369 reviewed Trainers and opening entries. It
also verified:

- unique stable slugs and source order;
- public table reads remained denied;
- the authenticated save and public leaderboard RPC grants remained intact;
- incomplete entries remained rejected;
- selections remain private before lock; and
- results polling remained disabled and unconfigured.

Production had zero GO entries immediately after activation. Any later entries
belong to real members and must not be changed for testing.

The official organizer shell still supports the published 32-pool structure
advancing two Trainers per pool into double elimination. Matches are
best-of-three except the Winners Final, Losers Final, and Grand Final, which are
best-of-five. At activation the shell contained no players or pairings. This
does not block Pick 10, but it does block pool-aware presentation or automatic
results mapping.

GO eligibility is not an adult-only guarantee. Do not collect or infer birth
dates. Store only published identity and qualification metadata needed for the
prediction game.

## Pokémon UNITE contract

UNITE uses 5-on-5 teams. Individual players are supporting roster attribution,
not separate prediction entries.

The official Qualified Competitors page currently contains 185 player rows
with nonblank team labels. Normalizing Unicode, case, and whitespace produces:

- 31 unique teams;
- 30 teams with six listed players;
- one team, Legends Reappear, with five listed players; and
- no duplicate player rows within a team.

This is strong team-roster evidence, but the page describes invitation earners,
not confirmed registration or attendance. The official competitor structure
confirms Friday single round-robin groups, Saturday single-elimination
playoffs, Sunday finals, best-of-three matches by default, and best-of-five Top
Four matches and Final. It does not yet publish the group assignments,
advancement count/rules, Group Stage match length, playoff pairings, or exact
prediction lock.

Do not open 185 individual-player picks. The safe product is a team prediction
experience with stable team aliases, private entries, and a UNITE-specific
group/bracket scoring adapter. Do not fuzzy match an organization or player
roster into a live score.

## Owner preparation tools

Owner Operations can still download blank setup JSON, review a completed file
locally, and download the validated copy. Loading a file does not save it to
Supabase, publish names, open entries, create pairings, or start polling.

The GO preparation tool is historical now that migration 377 is live. It must
not be used to replace the Production roster. Any roster correction requires a
reviewed source change, a new forward-only migration after 377, and a safe plan
for existing entries.

The UNITE tool remains useful for offline preparation. A blank waiting template
is valid; inferred teams, groups, seeds, advancement rules, or pairings are not.

## UNITE activation sequence

1. Preserve the official player/team snapshot and retrieval time.
2. Reconcile whether the 31 named teams are the complete registered field,
   stable team slugs and aliases, and the five-player roster without inventing
   a sixth player.
3. Obtain official group assignments, advancement details, Group Stage match
   length, playoff pairings, and lock time.
4. Approve a team prediction and placement-scoring contract. An interim team
   Pick 10 is reasonable only after the official team field is confirmed
   complete; do not repurpose the individual GO schema without review.
5. Add a new forward-only migration after 377 for the team event, aliases,
   private entries, and scoring. Never rewrite migrations 369-377.
6. Apply it first to one exact isolated Supabase Preview and test RLS, grants,
   privacy, aliases, incomplete inputs, corrections, scoring, and fixture
   cleanup.
7. Configure a structured result source only after exact permission, URL,
   attribution, and event identifier approval. Scheduling is a separate
   owner-authorized provider action.
8. Release through a protected pull request, review the exact Preview, confirm
   the deployed commit, and run the signed-out Production smoke sweep.

## Official references

- Official 2026 Qualified Competitors:
  <https://worlds.pokemon.com/en-us/about/qualified/>
- 2026 qualification rules: <https://championships.pokemon.com/en-us/about/>
- 2026 Pokémon UNITE Championship Series:
  <https://championships.pokemon.com/en-us/about/pokemon-unite-championship-series>
- Current Play! Pokémon documents:
  <https://play.pokemon.com/en-us/resources/documents/>
- 2026 Worlds competitor information:
  <https://worlds.pokemon.com/en-us/competitors/>
- 2026 Pokémon GO competitor structure:
  <https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/012gocompetitorinfo>
- 2026 Pokémon GO bracket shell:
  <https://pokemongochampionshipseries.challonge.com/2026_GO_WCS>
- 2026 Pokémon UNITE competitor structure:
  <https://reg.rainfocus.com/flow/pokemon/26sanfrancisco/landing/page/014unitecompetitorinfo>
