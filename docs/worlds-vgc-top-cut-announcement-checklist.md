# 2026 VGC Masters Top Cut announcement checklist

## Purpose

Use this checklist when Pokémon publishes the official 2026 VGC Masters Top
Cut. The production challenge is already deployed and waiting at
`/worlds/2026/vgc/bracket`. This process publishes the reviewed field without a
code release while keeping member entries private before lock.

Do not begin from Swiss standings, the invite-earned roster, a broadcast
graphic without a stable public source, or a prior Worlds field size. The first
required fact is the official power-of-two field: Top 4, 8, 16, 32, or 64.

## Decisions to make before announcement day

- Use progressive correct-winner weights of `1 / 2 / 4 / ...` unless the owner
  explicitly approves another complete whole-number scoring curve before any
  member entry exists.
- Open entries as soon as the complete reviewed field and first-round pairings
  are published.
- Set the lock before the first Top Cut match begins. Do not use the start of
  the broadcast as a substitute when match play starts earlier.
- Keep automatic final backfill enabled. It runs only from an owner-finalized
  placement snapshot, never provisional Swiss standings.
- Assign one owner to enter the field and a second review pass to compare every
  slot, name, seed, source, and time before publication.

## Build the reviewable setup draft

1. Open owner Operations and refresh **Worlds Top Cut challenge**.
2. Confirm the state is **waiting for official bracket**, with zero published
   slots. If an entry or revision unexpectedly exists, stop and investigate.
3. Open the official public bracket source in a separate tab and record the time
   checked.
4. Choose the exact published Top Cut size in Operations.
5. Select **Download setup JSON**. The file is a local draft; downloading it
   does not publish or change production.
6. Fill the opening time, lock time, official HTTPS source, source-check time,
   round points, and every first-round slot. Use roster slugs selected from the
   Operations name search, not hand-invented slugs.
7. Include a seed only when the official source publishes it. Seeds must be
   unique whole numbers inside the field size.
8. Save the file without adding the typed confirmation phrase. The import file
   deliberately cannot authorize publication.

The generated file has this production-compatible shape:

```json
{
  "bracket_size": 8,
  "opens_at": "2026-08-29T16:00:00.000Z",
  "locks_at": "2026-08-29T18:00:00.000Z",
  "source_url": "https://worlds.pokemon.com/REPLACE-WITH-OFFICIAL-BRACKET",
  "source_checked_at": "2026-08-29T15:55:00.000Z",
  "round_points": { "1": 1, "2": 2, "3": 4 },
  "participants": [
    {
      "slot": 1,
      "competitor_slug": "REPLACE-WITH-REVIEWED-SLUG",
      "source_seed": 1
    }
  ]
}
```

The values illustrate the schema only. They are not a field, schedule, source,
or permission to use Top 8. A real Top 8 file must contain eight participant
records; other supported sizes require their exact number of records and round
weights.

## Review and publish

1. Use **Load setup JSON**. Confirm the page says the file is loaded for review
   and that nothing has been published.
2. Compare every displayed name and country with the official source. Resolve
   missing or ambiguous roster identities before proceeding; never substitute a
   similarly named invitee.
3. Confirm each adjacent slot pair is the official first-round matchup and that
   no competitor or seed appears twice.
4. Confirm the opening time is not in the future unless intentionally staged,
   and the lock precedes the first match with enough time for members to finish
   a full bracket.
5. Confirm the public source URL is stable, HTTPS, and shows the same field.
6. Read the complete scoring curve aloud during the second review pass.
7. Type `PUBLISH OFFICIAL TOP CUT` only after both review passes are complete,
   then publish once.
8. Open the public bracket signed out and signed in. Check desktop and narrow
   mobile widths, the displayed source and deadline, all first-round matchups,
   and the ability to complete and save a bracket.
9. Announce the entry window only after the public verification passes.

Once any member saves an entry, the field becomes immutable. A source correction
after that point requires an audited forward-only migration and an explicit
entry-remediation decision.

## Lock, scoring, and finalization

- At lock, confirm other members' picks become visible and new edits are denied.
- Record only reviewed official match winners and use the stable official source
  URL for every result action.
- Correct a winner only before a downstream match depends on it.
- Prefer the automatic backfill after the VGC placement snapshot is finalized.
  It fails closed on missing or tied placements.
- If every winner was reviewed directly, use the bracket-specific finalization
  action with the official final bracket URL and exact confirmation phrase.
- Run the signed-out production smoke sweep after any code release. Publishing
  the already-supported field itself does not require a deployment.

## Stop conditions

Stop without publishing when the official field size, a first-round matchup,
the opening or lock time, a roster identity, or the source is uncertain. Keep
the waiting page live and explain that the official field is still under review.
