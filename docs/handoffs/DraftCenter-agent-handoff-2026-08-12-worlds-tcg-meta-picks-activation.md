# DraftCenter handoff: 2026 Worlds TCG Meta Picks activation

- Date: August 12, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Release branch: `codex/worlds-tcg-meta-picks-activation-2026-08-12`
- Release pull request: pending
- Base `main` commit: `959eab9e5bea884986bfa1367e52400e7d116cec`
- Latest production migration: 380
- Candidate migration: 381

## Outcome

The TCG Meta Picks activation candidate is ready for protected release review.
It adds a native expandable **How scoring works** guide to every VGC, TCG, and
Pokémon GO Meta Picks panel and prepares the reviewed 49-archetype TCG event to
open through forward-only migration 381.

The TCG opening gate is now satisfied by an event-specific official source.
The application and database validation are complete, including a real
authenticated five-deck save, mandatory Champion Deck enforcement, rejection
of an unreviewed archetype, pre-lock privacy, privilege boundaries, and fixture
rollback on an isolated Supabase Preview.

This handoff describes a release candidate, not a completed production change.
Production remains on migration 380 with TCG in `draft` until the application
release is merged and deployed and migration 381 is deliberately applied to
the exact production project.

Read this with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md),
[`../worlds-2026-meta-predictions.md`](../worlds-2026-meta-predictions.md),
[`DraftCenter-agent-handoff-2026-08-11-worlds-meta-picks-release.md`](DraftCenter-agent-handoff-2026-08-11-worlds-meta-picks-release.md),
and [`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work.

## Public scoring guide

Each discipline now uses a closed-by-default native disclosure labeled
**How scoring works**. It is keyboard accessible without client-side disclosure
state and uses responsive score grids on desktop and mobile.

### TCG

Members choose five reviewed deck archetypes and mark one **Champion Deck**.
Each selected archetype scores only its best Masters finish:

| Best finish | Points |
| --- | ---: |
| World Champion | 30 |
| Runner-up | 20 |
| Top 4 | 12 |
| Top 8 | 7 |
| Top 16 | 4 |
| Top 32 | 2 |
| Top 64 | 1 |

The Champion Deck scores double. The maximum raw score is 111 and is normalized
to 100. If an unlisted rogue archetype wins, nobody earns Champion Deck points
for that winner, while reviewed archetypes with Top 64 finishes still score.

### VGC and Pokémon GO

Members rank six Pokémon by confidence. Correct selections in positions one
through six earn 25, 20, 16, 13, 10, and 8 points. Predicting all six members of
the champion's registered team adds 8 points, producing a maximum of 100.

The disclosure explicitly says Meta Picks are separate from player Pick 10.
Meta scores never mix with the player competition, and the separate Meta
Overall appears only after at least two Meta disciplines have final results.

## Official TCG opening gate

The event-specific
[2026 Worlds TCG competitor packet](https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/011tcgcompetitorinfo)
confirms Standard Format with regulation marks H and onward. The
[official product-legality update](https://community.pokemon.com/en-us/discussion/22216/pokemon-tcg-product-legality-update)
uses a two-week release-to-legality window. The
[official Pitch Black release notice](https://www.pokemon.com/us/news/the-pokemon-tcg-mega-evolution-pitch-black-expansion-is-available-now)
records July 17, 2026, making the expansion tournament legal on July 31, before
Worlds begins August 28.

The combined Limitless Pitch Black community field was rechecked on August 12
and still matches the frozen 49-archetype taxonomy byte-for-byte. Its reviewed
source hash remains
`1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8`.
The source's broad **Other** bucket remains excluded, and the first 12 concrete
archetypes retain the explicitly unofficial **Trending** labels.

## Migration 381

[`../../supabase/381-open-worlds-2026-tcg-meta-picks.sql`](../../supabase/381-open-worlds-2026-tcg-meta-picks.sql)
is forward-only and fail-closed. It refuses to run unless it finds the exact
migration-380 TCG draft with:

- 49 selectable options, 12 trend labels, and the pinned source hash;
- no broad **Other** option;
- zero TCG entries and zero result snapshots;
- the original opening, lock, and tournament timestamps;
- VGC still `open` and GO still `draft`; and
- the expected private-table and RPC privilege boundary.

It updates only TCG source-review metadata and event status. It does not insert,
rename, or delete an archetype, create user data, change VGC or GO, enable a
result importer, or create a scheduler. Its postflight rechecks all of those
boundaries before commit.

## Validation evidence

Focused and repository checks passed:

- `npm run test:worlds` — 62 tests passed;
- `npm run test:security` — 14 tests passed;
- `npm run test:all`;
- `npm run test:national-dex` — 1,027 rows verified;
- `pnpm audit --prod --audit-level high` — no known vulnerabilities;
- `npm run worlds:verify:tcg-meta-source` — the live community field matched
  the committed taxonomy; and
- `git diff --check`.

The local optimized build compiled successfully and completed TypeScript. Page
generation then stopped at `/resources/daily-games` because this isolated
worktree intentionally has no public Supabase URL or publishable key. No secret
was copied into the worktree. The protected Vercel Preview is therefore the
authoritative optimized-build and visual-review gate for this release.

On the disposable Supabase Preview branch
`worlds-tcg-meta-open-2026-08-12`, migrations 378-381 and the focused
[`../../supabase/tests/381-open-worlds-2026-tcg-meta-picks-preview-regression.sql`](../../supabase/tests/381-open-worlds-2026-tcg-meta-picks-preview-regression.sql)
all completed successfully. Final read-only postflight returned:

| VGC | TCG | GO | TCG options | Trends | Entries | Results | Format | Minimum mark |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `open` | `open` | `draft` | 49 | 12 | 0 | 0 | Standard | H |

The transactional regression proved the signed-in five-deck round trip,
mandatory Champion Deck, unreviewed-option rejection, private pre-lock picks,
published placement curve, browser/client grants, authenticated finalization
denial, service-only finalization grant, and complete fixture cleanup. The exact
disposable Preview was permanently deleted after validation. The retained
`multi-pod-pr-82` branch and every real user, league, pick, entry, result,
provider setting, and production record were untouched.

## Safe release and activation sequence

1. Require all protected pull-request checks and review the Vercel Preview at
   desktop and mobile widths. Expand the scoring guide on TCG and VGC and verify
   the existing player Pick 10 panel is unchanged.
2. Merge the protected pull request and confirm Vercel reports the exact merged
   `main` commit **Ready** on the production domains.
3. Apply only migration 381 to the exact production Supabase project. Do not
   replay migrations 378-380 and do not run the transactional regression in
   production.
4. Run a read-only database postflight. Require TCG `open`, 49 selectable
   options, 12 trend signals, zero initial entries/results, Standard/H metadata,
   VGC `open`, GO `draft`, direct table reads denied, authenticated saves
   granted, authenticated finalization denied, and service finalization granted.
5. Review the live signed-out TCG page and an authorized member save. Confirm
   the disclosure, five-deck picker, Champion Deck choice, published August 28
   lock, separate Meta leaderboard, and unchanged player Pick 10 competition.
6. Run `npm run smoke:production` only after deployment and record the exact
   deployed commit, migration 381 postflight, live UI evidence, and smoke result
   in this handoff or a dated production follow-up.

## Preserved boundaries and next work

- Pokémon GO Meta Picks remain `draft` with zero options until an official
  eligibility pool is reviewed. Do not add placeholder Pokémon.
- Pokémon UNITE remains intentionally **Not Live** and outside this Meta Picks
  release.
- Results automation remains disabled. Final Meta results are immutable,
  service-only snapshots from an owner-reviewed official HTTPS source.
- Do not expose private pre-lock Meta selections or user identifiers.
- The next feature priority after the TCG release is the reviewed Pokémon GO
  option pool and its own forward-only activation migration.
