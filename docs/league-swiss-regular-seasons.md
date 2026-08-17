# League Swiss regular seasons

Ordinary DraftCenter leagues can use either a round-robin or Swiss regular season after a snake or auction draft. Swiss is a scheduling choice, not a draft type: managers keep the roster they drafted, play the configured Swiss rounds, and then enter the league's existing playoff flow.

## First-release limits

- One shared table with 4–16 teams.
- No pods, divisions, or manual matchup editing.
- Three recommended rounds for 4–8 teams and four for 9–16 teams.
- Commissioners may choose 2–10 rounds before Round 1 is paired.
- The format and round count lock when the regular season starts.

Larger and multi-pod leagues continue to use round robin. Draft Tournaments retain their separate Swiss event workflow and roster lock.

## Pairing and standings contract

Round 1 follows the saved team order. Every later round ranks teams by completed results and pairs the nearest available match-win records. The pairing search avoids repeat opponents whenever a complete no-rematch solution exists; if a rematch is mathematically unavoidable, it uses the minimum possible number of rematches.

An odd field gives the lowest-ranked eligible team a bye. A team cannot receive a second bye until every active team has already received one. A bye counts as one match win, adds no games, and is not treated as a played opponent.

The published ranking chain is:

1. match wins;
2. opponent match-win percentage (OMWP);
3. game-win percentage (GWP);
4. opponent game-win percentage (OGWP); and
5. initial team order.

Opponent percentages apply a one-third floor to each opponent's match-win and game-win percentage. Commissioners cannot replace the chain mid-season, and the same final order seeds the playoffs.

## Round progression and corrections

Only a commissioner or co-commissioner can pair a round. Round 1 becomes available after the draft is complete; another round becomes available only after every real matchup in the current round has a completed result. Hosted leagues pair against a locked authoritative snapshot and reject stale revision requests.

Changing an earlier competitive result can alter every later pairing. If later pairings exist but have no results, DraftCenter removes those empty rounds and asks the commissioner to pair them again from the corrected standings. Once any later result exists, the earlier score, series length, and differential cannot change. Replay-link and Match MVP edits remain available because they do not affect pairings.

## Data and access

Swiss pairings, byes, and results remain inside the league's existing private state snapshot. Migration 425 adds no public table and does not weaken row-level security. Pairing and result changes use dedicated atomic functions; ordinary whole-snapshot saves cannot replace the authoritative Swiss schedule. Spreadsheet and recovery exports preserve the format, tiebreakers, byes, pairings, results, and archived season record.

## Verification

The browser engine has deterministic tests for recommended round counts, score groups, bye rotation, rematch avoidance, standings, and completion. The isolated database regression covers a five-team season, correction rollback, later-result lockout, noncompetitive edits, function grants, and existing snapshot RLS. Run `npm run test:league-swiss` for the application checks and `supabase/tests/425-league-swiss-preview-regression.sql` only in a disposable Preview branch.
