# 2026 Worlds Meta Picks

Worlds Meta Picks is a separate competition from the player Pick 10. It appears
on the same VGC, TCG, and Pokémon GO prediction pages, but it has its own entry,
discipline leaderboard, and overall leaderboard. This lets player knowledge and
format knowledge stand on their own.

## Competition design

### VGC — first priority

Entrants choose six Pokémon they expect on the World Champion's registered team
and rank them by confidence. Correct picks earn 25, 20, 16, 13, 10, and 8
points from the first slot through the sixth. Predicting the exact six adds an
8-point bonus, for a maximum of 100.

The reviewed option pool is the 235-entry eligible Pokémon list linked from the
official Pokémon Champions Regulation M-B notice. The notice was updated on
August 5, 2026, and the source snapshot was checked on August 11. The generator
pins the official payload's SHA-256 value and fails if its content changes,
forcing another human review before a new pool can be generated.

The pool represents registered species and forms. Mega Evolutions are not
separate entry choices: for example, an entrant chooses Charizard rather than
Mega Charizard Y. This official list is intentionally separate from the repo's
307-name draft-league Regulation M-B tier sheet, which serves a different
product and is not the authority for Pokémon Champions eligibility.

To make 235 choices approachable, the picker starts with a 24-option Trending
view. Those labels are derived from anonymous team sheets in 10 explicitly
unofficial online Limitless community events covering 737 teams. They are a
browsing aid, not official Worlds odds, and never add to or remove from the
official eligibility pool. Search always covers all 235 options.

### TCG — second priority

Entrants choose five reviewed deck archetypes and mark one as the Champion
Deck. Each archetype scores its best Masters placement on the existing Worlds
curve: 30 for champion, 20 for runner-up, then 12 / 7 / 4 / 2 / 1 through Top
64. The Champion Deck scores double. The theoretical 111-point raw maximum is
normalized to 100.

The reviewed draft taxonomy contains 49 concrete combined archetypes observed
in the current Pitch Black Standard community field. Its pinned Limitless
cohort covers 292 tournaments, 21,000 deck classifications, and 47,509 matches.
The source's broad `Other` bucket is deliberately excluded because it combines
unrelated rogue strategies and would be unfair as one prediction option.
If an unlisted rogue archetype actually wins Worlds, the reviewed final result
records its name separately: nobody receives Champion Deck points, while every
listed archetype's best Top 64 placement still scores. This keeps finalization
possible without turning the entire rogue field into one oversized choice.

Related deck variants are combined into stable archetypes. The picker will
start with 12 Trending choices for newcomers and retain search across all 49.
The taxonomy is community evidence, not an official Worlds deck list or a
prediction of the winner.

Official Pokémon sources establish the H/I/J Standard rotation and Pitch
Black's July 17 release, but the official Worlds competitor page still says
more competitor information is forthcoming. TCG therefore remains draft-locked
until an official 2026 Worlds source confirms the exact format and Pitch Black
eligibility. Saved entries will retain stable option keys if display wording is
clarified after the event opens.

### Pokémon GO — third priority

The game uses the same ranked six and exact-team scoring as VGC. It remains
closed until the official Worlds eligibility rules, bans, newly released
Pokémon timing, and any approved limited meta have been reviewed.

## Shared behavior

- Picks remain private to their owner until the event locks.
- Each discipline scores from 0 to 100.
- Meta Overall opens only after at least two disciplines have final reviewed
  results. Missing an entry earns zero for that finalized discipline.
- Result inputs are immutable snapshots finalized manually from an official
  HTTPS source. There is no polling, feed, scheduler, or automatic scoring
  finalization.
- Browser clients have no direct table access. They use privacy-aware read and
  authenticated save functions.
- An event cannot accept entries unless its status is explicitly `open`, its
  time window is active, and every pick belongs to its reviewed selectable
  option pool.

## Migration and rollout state

Migration 378 creates all three events in `draft` with empty option pools.
Migration 379 requires the untouched VGC draft, inserts the pinned 235-option
official pool, verifies the pool and provenance, and then opens only VGC.
Migration 380 requires the untouched TCG draft, inserts the pinned 49-option
taxonomy, and deliberately leaves TCG in `draft` behind its official-format
opening gate. All migrations are forward-only and refuse to run over existing
options, entries, or results.

As of this implementation handoff, migrations 378-380 exist locally and have
not been applied to Preview or production. This workspace has no isolated
Preview connection or local Postgres runtime, so the included transaction
matrices have not been executed. TCG and Pokémon GO remain fail-closed draft
events; migration 380 would seed TCG without accepting entries.

Rollout order:

1. Apply 378 and 379 on an isolated Supabase Preview branch, run both preview
   regression scripts, and review the signed-in VGC six-pick experience.
2. Apply migration 380 in the same isolated Preview and verify that the TCG
   taxonomy is readable but entries remain rejected.
3. After exact official Worlds format confirmation, re-verify the taxonomy and
   open TCG with a separate forward-only migration.
4. Review the official Pokémon GO Worlds meta and eligibility, then open GO
   with a new forward-only migration.

Applying migration 378 alone is safe: it publishes no speculative options,
accepts no entries, changes no existing player competition, and enables no
results automation.

## Reproducible VGC source check

- `npm run worlds:build:vgc-meta` fetches the official eligible Pokémon page,
  verifies the expected option count and source hash, joins only explicit
  community trend mappings, and regenerates the snapshot plus migration 379.
- `npm run worlds:check:vgc-meta` performs a network-free integrity check: the
  committed options must reproduce the pinned official hash and community
  cohort, and migration 379 must match the snapshot byte-for-byte.
- `npm run worlds:verify:vgc-meta-source` fetches the official page and requires
  it to match the committed reviewed snapshot before running the integrity
  check.
- If the official page changes, both commands stop instead of silently updating
  eligibility. Review the official notice and pool before intentionally pinning
  a replacement snapshot in a later forward-only migration.

## Reproducible TCG taxonomy check

- `npm run worlds:build:tcg-meta` fetches the combined 2026 Standard / Pitch
  Black Limitless field, requires the pinned cohort and archetype payload, omits
  only the broad `Other` bucket, and regenerates the snapshot plus migration
  380.
- `npm run worlds:check:tcg-meta` reconstructs the complete 50-row source
  payload from the committed 49 options and recorded exclusion, verifies its
  pinned hash, and requires migration 380 to match byte-for-byte.
- `npm run worlds:verify:tcg-meta-source` fetches the current community field
  and requires it to remain identical to the reviewed snapshot.
- Community-source drift requires a fresh taxonomy review, but it never opens
  TCG. Exact official Worlds format confirmation remains a separate gate and
  must produce a later forward-only opening migration.
