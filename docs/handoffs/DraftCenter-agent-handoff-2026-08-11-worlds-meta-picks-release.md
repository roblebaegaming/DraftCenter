# DraftCenter handoff: 2026 Worlds Meta Picks release

- Date: August 11, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: <https://www.draftcentral.gg/worlds/2026>
- Feature pull request: [#166](https://github.com/roblebaegaming/DraftCenter/pull/166)
- Verified production application commit: `bdc8349822e16fadff02dd73b48030c13dbddae5`
- Latest production migration: 380

## Outcome

Worlds Meta Picks are a separate competition from predicting the actual
players. Player Pick 10 remains unchanged on VGC, TCG, and Pokémon GO, with its
own discipline and overall leaderboards. Meta Picks have their own discipline
leaderboards and a separate normalized overall leaderboard, so knowledge of
players and knowledge of teams or decks can each win.

VGC Meta Picks are live. TCG and GO use the same reusable infrastructure but
remain intentionally fail-closed until their missing official inputs are
reviewed. Pokémon UNITE remains intentionally **Not Live** under the preceding
public-launch plan and is not part of the new individual Meta Picks contract.

Read this document with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md),
[`../worlds-2026-meta-predictions.md`](../worlds-2026-meta-predictions.md), and
[`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work. The
[preceding public-launch handoff](DraftCenter-agent-handoff-2026-08-11-worlds-public-launch-final.md)
remains the record for the player competitions and UNITE state.

## Production state

| Meta competition | State | Picks | Reviewed options | Trend signals | Initial entries |
| --- | --- | ---: | ---: | ---: | ---: |
| VGC champion team | Open | Rank 6 | 235 | 24 | 0 |
| TCG champion decks | Draft | Choose 5 | 49 | 12 | 0 |
| Pokémon GO champion team | Draft | Rank 6 | 0 | 0 | 0 |

VGC entries lock at midnight Pacific on August 28, 2026. Signed-out live
verification shows the published lock instead of the fail-closed **Not open
yet** state. TCG shows **49 ready** but remains **Not open yet** behind the exact
official-format gate. GO remains **Not open yet** with **Review required** and
no placeholder Pokémon.

Pre-lock choices are private. Public and authenticated clients read the
privacy-aware hub through RPCs rather than direct table access. Authenticated
members can save their own complete entry. Finalization is not available to
authenticated users; it is service-only and requires an owner-reviewed official
HTTPS source. No result importer, scheduler, or automated result writer was
enabled.

## Game and scoring decisions

### VGC

Members rank six Pokémon by confidence. Matches in positions one through six
are worth 25, 20, 16, 13, 10, and 8 points. Predicting all six members of the
World Champion's registered team adds an 8-point bonus, for a perfect score of
100. The official pool names registered species and forms; Mega Evolutions are
not separate options.

The 235 selectable options come from the official Regulation M-B eligibility
page:
<https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178066986988lmoqpm/en/pokemon.html>.
The frozen reviewed source hash is
`642fed0034500c778894e10ca33418cb06eabf9403136e8acce277047bccf4f6`.

The 24 **Trending** shortcuts are explicitly unofficial community signals from
10 Limitless events covering 737 teams. They help casual players browse the
large official pool but do not claim to be Worlds usage or official rankings.
All 235 reviewed options remain selectable.

### TCG

The intended game is five deck archetypes plus one **Champion Deck**. Each
archetype scores its best Masters placement on the 30 / 20 / 12 / 7 / 4 / 2 / 1
curve through Top 64, and the Champion Deck scores double. The raw maximum of
111 is normalized to 100 for the Meta overall leaderboard.

The frozen 49-archetype Pitch Black taxonomy comes from the combined Limitless
view at
<https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1>.
It covers 292 tournaments, 21,000 deck classifications, and 47,509 matches. Its
reviewed source hash is
`1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8`.
The broad **Other** bucket is intentionally excluded.

If an unlisted rogue archetype wins, finalization records
`unlisted_champion`. Nobody receives Champion Deck points for that winner, but
all reviewed archetypes that place through Top 64 still score. TCG must remain
closed until an official 2026 Worlds source confirms the exact event format;
the current community taxonomy is not enough to open entries by itself.

### Pokémon GO and Meta overall

GO has the rank-six, confidence-weighted scoring contract but no reviewed option
pool. Keep it closed until official Worlds eligibility rules or the limited
event meta are published and reviewed.

Each finalized discipline is normalized to 100. The separate Meta overall
leaderboard appears only after at least two Meta disciplines have finalized
results. It does not combine with the player Pick 10 overall leaderboard.

## Database release

- Migration 378 creates the reusable fail-closed events, options, private
  entries, immutable final snapshots, RPCs, RLS policies, grants, validation,
  scoring, and normalized leaderboard contract. All three events start in
  `draft` with empty pools.
- Migration 379 seeds the pinned 235-option VGC pool, attaches the 24 trend
  signals, verifies the reviewed source metadata, and explicitly opens only
  VGC.
- Migration 380 seeds the 49-option TCG taxonomy and 12 trend signals, verifies
  the official-format opening gate, and deliberately leaves TCG in `draft`.

Do not rewrite migrations 378-380. Every future change must use a new
forward-only migration with focused RLS, grant, privacy, locking, scoring, and
cleanup coverage. Do not run destructive regression fixtures against
production.

## Release and verification evidence

The three migrations and their focused regression matrices passed on an exact
disposable Supabase Preview branch. The branch was permanently deleted after
verification. The retained `multi-pod-pr-82` Preview branch and all real
leagues, drafts, rosters, tournaments, player entries, provider settings, and
accounts were untouched.

Pull request #166 passed all protected checks and Vercel Preview. Local release
evidence includes:

- `pnpm audit --prod --audit-level high` with no known vulnerabilities;
- `npm run test:all`;
- `npm run test:national-dex` across 1,027 rows;
- the 61-test Worlds suite and security suite;
- both pinned live-source verification commands;
- `git diff --check`; and
- an optimized production build.

CodeQL found one high-severity double-unescape path in the TCG source decoder
during review. The decoder was changed to one-pass entity replacement and a
regression now proves nested entities stay encoded by one layer. The alert was
resolved, the security suite passed, and the live TCG source check still
matched the frozen taxonomy.

After the merge, Vercel reported exact `main` commit `bdc8349` **Ready** on the
production domains and all repository deployment checks passed. Migrations
378-380 were then applied to the exact production project. Read-only postflight
confirmed:

- VGC `open`, 6 picks, result size 6, 235 selectable options, 24 trend signals,
  and zero initial entries;
- TCG `draft`, 5 picks, result size 64, 49 selectable options, 12 trend signals,
  and zero entries;
- GO `draft`, 6 picks, result size 6, zero options, and zero entries;
- anonymous hub reads and authenticated entry saves are granted; and
- authenticated finalization is denied while service finalization is granted.

Live signed-out page checks confirmed the VGC lock and scoring, the TCG
official-format gate and **49 ready** wording, the GO eligibility gate, separate
competition wording, private-pick safeguards, and disabled automation. The
post-deployment `npm run smoke:production` sweep passed all 14 public 200 routes
and five protected 401 boundaries. The final handoff follow-up also replaced a
stale zero-entry sentence with **No Meta entries yet. Saved entries will appear
here.** and added a focused regression. No merge protection was bypassed.

## Remaining official inputs and next steps

1. Keep VGC open through its published lock. Do not inspect or expose private
   selections. After the tournament, obtain the World Champion's official
   registered six-Pokémon team, review it, and finalize manually from the
   official source.
2. Confirm the exact official 2026 Worlds TCG format. Recheck the frozen
   taxonomy against that format, update only through a new reviewed migration,
   and open TCG only if the gate is satisfied.
3. Obtain and review the official GO eligibility pool. Build and verify a frozen
   option source, seed it through a new migration, and open GO only after the
   privacy and scoring matrices pass.
4. After any discipline ends, final results must come from an owner-reviewed
   official source. Preserve the last-known-good state on missing, malformed,
   ambiguous, or incomplete data.
5. Keep results automation disabled unless exact feed permission, attribution,
   event identifiers, and separate scheduler authorization are obtained.

There is no remaining release work for the VGC Meta Picks launch. The next
agent should begin read-only, verify current official inputs and timestamps,
and preserve the fail-closed TCG and GO gates until the required sources exist.
