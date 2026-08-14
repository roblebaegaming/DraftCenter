# Mega Bracket

Mega Bracket is DraftCenter's long-form Full Dex preference challenge. It is a
separate product from the scheduled Sunday Super Bracket: Mega Bracket is
personal, resumable, and designed to take as many short sessions as the player
needs.

## Launch experience

- The frozen launch catalogue contains 1,162 unique supported Pokemon and
  battle-relevant forms from `src/data/draft-lab-catalog.json`.
- A complete attempt always requires 1,161 head-to-head choices.
- The randomized draw begins with 138 play-in matchups, producing a field of
  1,024. Choice 1,098 reveals the final 64.
- The final 64 are divided into four regions of 16 and continue through a
  familiar tournament bracket to the player's champion.
- Players see one matchup at a time, can undo their latest choice, and follow
  the bracket through named round milestones.
- Progress is saved privately to the player's account and also retained in the
  browser while a cross-device save is pending.
- Completed attempts remain in private history. Launch has unlimited attempts.
- Owner Operations may read only aggregate completion totals: distinct signed-in
  members with at least one completed attempt and total completed attempts. It
  never receives member identities, champions, Top 64 results, bracket choices,
  active attempts, or abandoned attempts.
- Completion unlocks a high-resolution Top 64 bracket image and a portrait
  champion card for sharing.

Purely cosmetic appearances are not separate entrants. Mega Evolutions and
other distinct battle-relevant forms present in the DraftCenter catalogue are
separate entrants.

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

## Data and synchronization contract

Migration `389-full-dex-mega-brackets.sql` creates the private
`mega_bracket_attempts` table and the only client-facing RPCs. Browser roles
have no direct table access. Each attempt freezes its catalogue, deterministic
seed, winner path, Top 64, and champion.

The server reconstructs every matchup and rejects a winner who did not belong
to that matchup. Saves carry an expected revision. If two tabs collide, the
client keeps the local copy, refreshes the authoritative attempt, and only then
offers an explicit retry; it never blindly replays a timed-out mutation.

The catalogue is accepted only when it has 1,162 unique names and this canonical
SHA-256 hash:

`acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36`

The canonical hash input is the alphabetically sorted catalogue names joined by
a newline. A catalogue change requires a new version and hash while preserving
old snapshots so existing attempts remain reproducible.

## Validation and release

Focused local coverage is in `test/mega-bracket.test.js`. The isolated database
matrix is `supabase/tests/389-full-dex-mega-bracket-preview-regression.sql`; run
it only after migration 389 in a retained Preview branch. It creates synthetic
users and an attempt, validates grants and progression, and deletes fixtures by
their exact identifiers before commit.

Migration 389 must be reviewed and exercised in Preview before release. A local
build is not a deployment, and the production smoke sweep belongs after the
authorized merge and deployment of the reviewed commit.
