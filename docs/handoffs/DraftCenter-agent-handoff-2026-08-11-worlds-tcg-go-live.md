# DraftCenter handoff: TCG and Pokémon GO Worlds voting live

- Date: August 11, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: <https://www.draftcentral.gg/worlds/2026>
- Verified Worlds application commit: `5b07d274e31d914d7095005d78af878025422851`
- Latest production migration: 377

## Outcome

TCG Masters and Pokémon GO Pick 10 are live for signed-in members. VGC remains
open. Pokémon UNITE remains **Not Live** while its team and tournament structure
are completed.

- TCG: <https://www.draftcentral.gg/worlds/2026/tcg>
- Pokémon GO: <https://www.draftcentral.gg/worlds/2026/go>
- Official source: <https://worlds.pokemon.com/en-us/about/qualified/>

The official source says these competitors earned invitations. DraftCenter does
not present either list as confirmed registration or attendance. Both result
sources remain disabled and unconfigured; no feed, provider setting,
environment variable, or scheduler was enabled.

Read this handoff with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md) and
[`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work. The
[preceding chat handoff](DraftCenter-agent-handoff-2026-08-11-worlds-final-chat.md)
remains the detailed record for the natural-language, sharing, status-label,
bracket-waiting, and unfinished-pick fixes released earlier in the conversation.

## TCG release

Pull request [#160](https://github.com/roblebaegaming/DraftCenter/pull/160)
shipped as application commit
`c0191099d335d3eac5fa799d426a88143296def2`.

The official Masters table contained 882 rows. The reviewed activation excludes
two duplicate identities and publishes 880 unique competitors with stable
slugs and source order. It supersedes the earlier 437-player TPCi cutoff and
direct-invite working field because the official page includes the separately
managed regions in one list.

Forward-only migration 376:

- required the exact empty, zero-entry staged TCG event;
- inserted exactly 880 unique competitors;
- opened Pick 10 plus Your Champion;
- changed the roster source to the official Qualified Competitors page;
- retained private pre-lock entries and the authenticated complete-entry save
  contract;
- verified direct table reads stayed denied and RPC grants stayed intact; and
- required results polling to remain disabled with no feed URL or external
  event identifier.

Production had zero TCG entries immediately after activation. New member
entries after that point are real user data and must not be modified for tests.

## Pokémon GO release

Pull request [#161](https://github.com/roblebaegaming/DraftCenter/pull/161)
shipped as application commit
`5b07d274e31d914d7095005d78af878025422851`.

The official GO table contained 370 rows. `YUKI KISHIDA` and `Yuki Kishida`
were the same Japan identity; the reviewed source keeps one row, producing 369
unique Trainers. The committed source snapshot and fail-closed builder preserve
the exact audit because the live source began rate-limiting automated refreshes.
The builder fails if expected source metadata or counts change.

Forward-only migration 377:

- required the exact empty, zero-entry staged GO event;
- inserted exactly 369 unique Trainers;
- opened Pick 10 plus Your Champion;
- changed the roster source to the official Qualified Competitors page;
- retained private pre-lock entries and the complete-entry save contract;
- verified direct table reads stayed denied and RPC grants stayed intact; and
- required results polling to remain disabled and unconfigured.

The public page explicitly says this is not a confirmed attendance,
registration, or pool-assignment list. Pool assignments are not needed to score
the full-field placement game, so the truthful invitation-earned roster is
sufficient for Pick 10. The official Challonge shell can remain empty without
blocking voting. Production had zero GO entries immediately after activation.

## Verified Production state

Vercel reported the merged `main` commit `5b07d27` **Ready** in Production.
Read-only Production postflight confirmed:

| Event | Status | Pool | Initial entries | Results source |
| --- | --- | ---: | ---: | --- |
| TCG Masters | Open, Pick 10 | 880 unique | 0 | Disabled, unconfigured |
| Pokémon GO | Open, Pick 10 | 369 unique | 0 | Disabled, unconfigured |
| Pokémon UNITE | No database event | 0 | 0 | None |

Signed-out browser review confirmed:

- the GO page renders 369 Trainer cards and sign-in-gated selection controls;
- TCG and GO say **Picks open** in the discipline navigation;
- Worlds Home links **Make TCG picks** and **Make GO picks**;
- UNITE says **Not Live**;
- both TCG and GO are indexable and present in the production sitemap; and
- the post-deployment smoke sweep passed all 19 public and protected routes.

Both database migrations and their save/privacy regressions passed first in
isolated Supabase Preview branches. The exact disposable TCG and GO Preview
branches were permanently deleted after Production verification. The retained
`multi-pod-pr-82` branch and all unrelated branches were left untouched.

## Validation evidence

The exact release trees passed:

- all six protected pull-request checks;
- `pnpm audit --prod --audit-level high` with no vulnerabilities;
- `npm run test:all`;
- `npm run test:national-dex` across 1,027 rows;
- focused Worlds and SEO tests;
- optimized production builds, including 236 static pages for GO;
- isolated migration, RLS, grant, privacy, complete-save, and cleanup
  regressions; and
- `npm run smoke:production` after each authorized release.

No merge protection was bypassed.

## Pokémon UNITE audit and recommended product

The official Qualified Competitors page now includes player, country/region,
and team-name columns. The August 11 audit found:

- 185 player rows;
- 31 unique nonblank team names after Unicode, case, and whitespace
  normalization;
- 30 teams with six listed players;
- one team, Legends Reappear, with five listed players; and
- no duplicate player rows within a team.

This is valuable roster evidence, but the page describes invitation earners,
not a final registered field. It does not publish group assignments,
advancement details, Group Stage match length, or playoff pairings. The
separate official competitor page says Friday groups feed Saturday single
elimination and Sunday finals, but leaves important group details for an
on-site announcement.

The best product is team-based. Do not create 185 individual-player prediction
entries. The smallest safe sequence is:

1. Preserve and review a committed official team/player snapshot with stable
   team slugs and explicit aliases.
2. Reconcile whether the 31 named teams are the complete registered field and
   resolve the five-player roster without inventing a sixth player.
3. Obtain official groups, advancement count/rules, Group Stage match length,
   playoff pairings, and the prediction lock.
4. Add a forward-only migration after 377 for a team event, roster aliases,
   private entries, and scoring; do not repurpose the individual TCG/GO model.
5. Reuse the bracket dependency, complete-tree validation, correction, and
   privacy safeguards from VGC Top Cut, with a UNITE-specific team results
   adapter.
6. Rehearse all writes, RLS, grants, privacy, scoring, alias, and cleanup cases
   in one exact disposable Preview before proposing release.

An interim team Pick 10 could be considered only after the official source is
confirmed as the complete team field and a clear placement-scoring contract is
approved. Until then, **Not Live** is the truthful state.

## Remaining official or owner inputs

- UNITE: final registered team confirmation, groups, advancement details,
  Group Stage match length, playoff pairings, and lock time.
- VGC Top Cut: official field and first-round pairings.
- Results automation: exact permitted feed, attribution, event identifiers,
  explicit feed permission, and separate scheduler authorization.

Do not enable polling or create a scheduler merely because TCG and GO voting
are open. Their current prediction experiences work without live feeds.

## Preserved boundaries

- Never rewrite migrations 369-377; use a new forward-only migration.
- Never replay a timed-out prediction save automatically.
- Never edit a real member entry, roster, score, bracket, league, draft, or
  provider configuration merely for testing.
- Keep pre-lock selections private, public table reads denied, and finalization
  service-only.
- Fail closed on incomplete fields, ambiguous identities or aliases, missing
  placements, uncertain deadlines, and incomplete brackets.
- Treat official invitation-earned lists as invitation-earned lists, not proof
  of attendance.
- Preserve unrelated user work and retained Preview branches.

## Next-agent starting point

There is no remaining TCG or GO activation work. Monitor their public routes
and official source for corrections, but do not replace reviewed rosters
without a new source audit and forward-only migration. The next substantive
Worlds feature is UNITE team modeling after the missing official structure is
published, followed by VGC Top Cut and explicitly authorized results
automation.
