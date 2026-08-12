# DraftCenter handoff: 2026 Worlds TCG Meta Picks activation

- Date: August 12, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Release branch: `codex/worlds-tcg-meta-picks-activation-2026-08-12`
- Release pull request: [#168](https://github.com/roblebaegaming/DraftCenter/pull/168)
- Base `main` commit: `959eab9e5bea884986bfa1367e52400e7d116cec`
- Production application commit: `49ef9975d04f86d169c589580575a00220c2dfa5`
- Latest production migration: 381
- Applied migration: 381

## Outcome

The TCG Meta Picks activation is complete in production. It adds a native
expandable **How scoring works** guide to every VGC, TCG, and Pokémon GO Meta
Picks panel and opens the reviewed 49-archetype TCG event through forward-only
migration 381.

The TCG opening gate is now satisfied by an event-specific official source.
The application and database validation are complete, including a real
authenticated five-deck save, mandatory Champion Deck enforcement, rejection
of an unreviewed archetype, pre-lock privacy, privilege boundaries, and fixture
rollback on an isolated Supabase Preview.

Production is on application commit `49ef9975d04f86d169c589580575a00220c2dfa5`
and migration 381 with TCG `open`.

Read this with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md),
[`../worlds-2026-meta-predictions.md`](../worlds-2026-meta-predictions.md),
[`DraftCenter-agent-handoff-2026-08-11-worlds-meta-picks-release.md`](DraftCenter-agent-handoff-2026-08-11-worlds-meta-picks-release.md),
and [`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work.

## Production release record

Pull request #168 was squash-merged after all six active checks passed. Vercel
then reported the exact merged commit Ready on both production domains. Only
after that confirmation, the migration-381 production preflight was run against
project `eukexfqpiuidwygllaye`; it matched every migration-380 prerequisite.
The exact committed migration blob
`817e9907b770f14a27e6eb818c119b5adfb41ea8` was applied in one guarded
transaction.

The read-only production postflight passed all 20 checks:

- TCG is `open` with 49 options, 49 selectable options, 12 trend labels, zero
  Meta entries, and zero result snapshots;
- the event records Standard format, regulation mark H onward, the satisfied
  official-format gate, and the August 12 review date;
- VGC remains `open` and Pokémon GO remains `draft`;
- direct browser reads of the private option and entry tables remain denied;
- public hub access and authenticated saves remain granted; and
- authenticated finalization remains denied while service-role finalization
  remains granted.

The signed-out live TCG page showed **Picks open**, the five-deck and Champion
Deck contract, zero Meta entries, the separate player Pick 10 competition, and
the complete placement, normalization, rogue-deck, and Standard/H scoring
guide. No browser warnings or errors were recorded. The post-activation
production smoke sweep passed 14 public routes and five protected routes.

No production test entry was created. The authorized five-deck save and privacy
round trip remain covered by the exact disposable Preview rehearsal, preserving
the production event's verified zero-entry opening state. No result source,
scheduler, provider setting, environment variable, or secret changed.

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

Before merge, pull request #168 was **Ready to merge** with all six active
checks successful:
the full-history secret scan, security tests and dependency audit, CodeQL,
Vercel, and the Vercel review integration. The repository's automatic Supabase
Preview check was skipped, as expected for this manually managed migration
directory; the independent exact database rehearsal below supplies the required
migration evidence. On the Ready Vercel Preview, the TCG disclosure expanded
cleanly and exposed the complete placement curve, Champion Deck multiplier,
111-to-100 normalization, rogue-deck rule, separate-competition explanation,
and official-format link. Player Pick 10 remained a separate panel.

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

## Completed release and activation sequence

1. All protected pull-request checks and the Vercel Preview passed.
2. Pull request #168 was squash-merged, and Vercel reported exact `main` commit
   `49ef9975d04f86d169c589580575a00220c2dfa5` Ready in Production.
3. Only migration 381 was applied to the exact production Supabase project;
   migrations 378-380 and the transactional Preview regression were not replayed.
4. The read-only database postflight passed all 20 required state and privilege
   checks.
5. The signed-out TCG page showed the expected open competition, scoring guide,
   privacy gate, separate Meta leaderboard, and unchanged player Pick 10.
6. `npm run smoke:production` passed all 19 public and protected route checks.

The production event was deliberately left at zero Meta entries. The real
authenticated save was not repeated in production because the exact Preview
round trip already proved saving and privacy without mutating a live account.

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
