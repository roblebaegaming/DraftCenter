# Mega Bracket

Mega Bracket is DraftCenter's personal, replayable Pokémon preference challenge.
It is separate from the scheduled Sunday Super Bracket: Mega Bracket is private,
resumable, and designed to support both quick replays and long sessions.

## Launch experience

- The frozen launch catalogue contains 1,162 unique supported Pokemon and
  battle-relevant forms from `src/data/draft-lab-catalog.json`.
- The original Full Dex field remains the default. Players may instead build a
  bracket from one of the 18 types, one of Generations I-IX, or the 75 Mega
  Evolutions in the frozen catalogue.
- Every field with at least 64 eligible entries offers two formats: the complete
  eligible field or a deterministic randomized 64-entry draw. Ice currently has
  59 eligible entries, so its complete field is used without inventing five
  competitors.
- Each format supports **Pick your favorite** and **Pick the worst**. The latter
  explicitly asks the player to advance the worse choice all the way to a
  deliberately dubious winner; the objective is frozen with the attempt and is
  visible in play, history, recap copy, and downloads.
- A complete Full Dex attempt requires 1,161 head-to-head choices; focused brackets require one fewer choice than their frozen entrant count.
- The complete Full Dex field begins with 138 play-in matchups, producing a field of
  1,024. Choice 1,098 reveals the final 64.
- The final 64 are divided into four regions of 16 and continue through a
  familiar tournament bracket to the player's champion.
- Before the Top 64, players see one matchup at a time. From the Top 64 onward,
  they make each choice directly in a four-region visual bracket that preserves
  completed matchups and leads into a separate Final Four board.
- Named round milestones adapt to the frozen entrant count. Full Dex celebrates
  1,024, 512, 256, 128, 64, 32, 16, 8, 4, the championship match, and the final
  champion. A reached Top 64 celebration opens the visual bracket directly.
- Players can undo their latest choice throughout an active attempt.
- Progress is saved privately to the player's account and also retained in the
  browser while a cross-device save is pending.
- Completed attempts remain in private history. Launch has unlimited attempts.
- Owner Operations may read only aggregate completion totals: distinct signed-in
  members with at least one completed attempt and total completed attempts. It
  never receives member identities, champions, Top 64 results, bracket choices,
  active attempts, or abandoned attempts.
- Completion unlocks a private recap with the player's most-advanced type,
  leading generation in the frozen final field, lowest-BST qualifier, final
  winner's path, and an illustrated Final Four.
- Brackets that reach 64 entrants can export a high-resolution Top 64 image with
  Final Four and winner artwork. Every completed bracket can export a portrait
  result card, including compact fields below 64.

Purely cosmetic appearances are not separate entrants. Mega Evolutions and
other distinct battle-relevant forms present in the DraftCenter catalogue are
separate entrants.

The server validates every supported themed pool by its ordered count and
SHA-256 hash before applying a 64-entry draw. A browser may not relabel an
arbitrary subset as a type, generation, or Mega Evolution field.

## Product boundaries

The route is `/tools/mega-bracket`. Starting or saving an attempt requires a
free DraftCenter account, while the explanation and product landing page are
public and indexable.

There is no weekly limit or paid entitlement in the launch implementation.
If those rules are introduced later, enforce them in
`create_mega_bracket_attempt` so a client cannot bypass the limit. Existing
completed brackets should remain readable regardless of future entitlement.

Mega Bracket attempts are not public profiles or community rankings. Do not
expose an attempt, its full choice history, or its exports through a public URL
without a separate explicit sharing design and consent model.

## Pokemon artwork

The shared resolver in `src/lib/pokemonArtwork.js` uses PokeAPI Home artwork,
then official artwork or a front sprite. Reviewed aliases cover special names
whose DraftCenter and PokeAPI forms differ, including Calyrex riders, Paldean
Tauros breeds, Primal Groudon, Primal Kyogre, and Flabebe's accented display
name. Generic species names such as Deoxys or Giratina use the species' official
default variety. If an exact new form is not yet available, the UI may use that
species' base artwork and keeps the Pokemon name visible.

The frozen 1,162-entry catalogue must be checked end to end when this resolver
changes. The August 14, 2026 verification resolved artwork for all 1,162
entries; 34 generic or not-yet-published form names intentionally used a
reviewed default-variety or base-species fallback.

Artwork and recap data are derived in the browser. They add no public bracket
records and do not change the account-private attempt or Operations contracts.

## Data and synchronization contract

Migration `389-full-dex-mega-brackets.sql` creates the private
`mega_bracket_attempts` table and the only client-facing RPCs. Forward-only
migration `407-mega-bracket-variety.sql` generalizes an attempt to 2-1,162
entrants and freezes its scope, optional filter, favorite-or-worst objective,
eligible pool size, and optional 64-entry limit. Browser roles still have no
direct table access. Each attempt freezes its selected catalogue,
deterministic seed, winner path, field of up to 64, and final result.

The server reconstructs every matchup and rejects a winner who did not belong
to that matchup. Saves carry an expected revision. If two tabs collide, the
client keeps the local copy, refreshes the authoritative attempt, and only then
offers an explicit retry; it never blindly replays a timed-out mutation.

The source catalogue is accepted only when it has 1,162 unique names and this
canonical SHA-256 hash:

`acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36`

The canonical hash input is the alphabetically sorted catalogue names joined by
a newline. A catalogue change requires a new version and hash while preserving
old snapshots so existing attempts remain reproducible.

The creation RPC also validates the exact ordered count and hash for all 18
type fields, nine generation fields, and the Mega Evolution field. A Quick 64
is selected on the server from that validated pool and then stored as the
attempt's immutable catalogue snapshot.

## Validation and release

Focused local coverage is in `test/mega-bracket.test.js`. The isolated database
matrix is `supabase/tests/389-full-dex-mega-bracket-preview-regression.sql`; run
it only after migration 389 in a retained Preview branch. Variety coverage is
in `supabase/tests/407-mega-bracket-variety-preview-regression.sql`; run it only
after migration 407. The newer matrix exercises a 64-entry worst-of type
bracket and the complete 59-entry Ice field, rechecks grants and cross-account
privacy, and deletes fixtures by their exact identifiers before commit.

Migration 407 must be reviewed and exercised in Preview before this expansion
is released. A local build is not a deployment, and the production smoke sweep
belongs after the authorized merge and deployment of the reviewed commit.
