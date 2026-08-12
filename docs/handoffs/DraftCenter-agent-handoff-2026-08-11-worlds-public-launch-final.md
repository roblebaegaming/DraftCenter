# DraftCenter handoff: 2026 Worlds public launch final

- Date: August 11, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: <https://www.draftcentral.gg/worlds/2026>
- Verified Production application commit: `29bd86d636cf4d70c20f7a9b309104db5e33ca62`
- Latest Production migration: 377

## Outcome

The intended public launch is complete. VGC Masters, TCG Masters, and Pokémon
GO Pick 10 are live for signed-in members. Their public competition pages and
discipline leaderboards are live. Pokémon UNITE remains intentionally **Not
Live** until its team-based prediction experience can be built from complete
official tournament structure.

- Worlds Home: <https://www.draftcentral.gg/worlds/2026>
- VGC: <https://www.draftcentral.gg/worlds/2026/vgc>
- TCG: <https://www.draftcentral.gg/worlds/2026/tcg>
- Pokémon GO: <https://www.draftcentral.gg/worlds/2026/go>
- Official invitation-earned source:
  <https://worlds.pokemon.com/en-us/about/qualified/>

The combined leaderboard is present but remains empty until at least two
competitions have official scored results. Its final public explanation is:

> The combined table appears when at least two games have official scored
> results.

Read this document with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md) and
[`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work. The
[TCG and GO activation handoff](DraftCenter-agent-handoff-2026-08-11-worlds-tcg-go-live.md)
contains the detailed roster reconciliation and migration evidence. The
[preceding chat handoff](DraftCenter-agent-handoff-2026-08-11-worlds-final-chat.md)
contains the earlier interface, draft-preservation, sharing, status-label, and
Top Cut waiting-state decisions.

## Live competition state

| Competition | Public state | Prediction format | Reviewed pool | Results automation |
| --- | --- | --- | ---: | --- |
| VGC Masters | Picks open | Pick 10 + Your Champion | 438 | Disabled and unconfigured |
| TCG Masters | Picks open | Pick 10 + Your Champion | 880 | Disabled and unconfigured |
| Pokémon GO | Picks open | Pick 10 + Your Champion | 369 | Disabled and unconfigured |
| Pokémon UNITE | Not Live | Team-based design pending | No Production event | None |

VGC, TCG, and GO entries stay editable until their published locks. A member
must choose all 10 competitors and Your Champion before saving. Dirty,
unfinished local choices survive background event and leaderboard refreshes.
Never replay a timed-out save automatically; refresh and verify authoritative
state first.

Pre-lock selections remain private. The share panel offers one truthful
**Download** action for a public 1080 by 1350 PNG after the Pick 10 and champion
are complete. Downloading does not save or modify the DraftCenter entry.

## Final public wording

The final navigation and availability labels are **Worlds Home**, **Picks
open**, and **Not Live**. Internal build or source-audit labels are not public.

The VGC and TCG roster notice is:

> Masters Division only — Senior and Junior Division qualifiers are excluded.

Pull request [#163](https://github.com/roblebaegaming/DraftCenter/pull/163)
shipped that notice as Production commit
`fb52c258ec8e6f2e5ef9b90d3f1073cf8da82c6b`. It removed the awkward
adult-age explanation from the Masters pages without changing the separate GO
source/privacy notice or internal roster-safety checks.

Pull request [#164](https://github.com/roblebaegaming/DraftCenter/pull/164)
shipped the one-sentence overall-leaderboard explanation as Production commit
`29bd86d636cf4d70c20f7a9b309104db5e33ca62`. It removed the **Opens after two
competitions score** heading and the extra VGC-only explanation.

The incomplete sharing panel says **Choose your top 10, then choose your
champion.** The VGC Top Cut waiting screen contains no numbered backend-process
cards. These choices are deliberate natural-language cleanup and should not be
re-expanded without an owner request.

## Roster and scoring facts

TCG migration 376 opened 880 unique Masters competitors from 882 official
source rows after excluding two duplicate identities. GO migration 377 opened
369 unique Trainers from 370 official source rows after excluding one duplicate
identity. Both sources establish earned invitations, not confirmed attendance,
registration, GO pool assignments, or final event check-in.

VGC, TCG, and GO each use the same placement curve and Pick 10 plus Your
Champion contract. Each game is normalized to 100 points for the combined
leaderboard so one larger field cannot dominate another. Final ties use the
average finish of the six best-finishing picks, then the average finish of all
10. Provisional ranks remain points-only. Finalization fails closed when a
saved selection lacks a reviewed placement.

Do not rewrite migrations 369-377. Every future database change must be a new
forward-only migration with focused RLS, grant, privacy, scoring, and cleanup
coverage.

## Verified release evidence

Pull requests #160, #161, #163, and #164 passed their protected repository
checks and exact Vercel Preview builds. The final two public-copy releases also
passed:

- `pnpm audit --prod --audit-level high` with no known vulnerabilities;
- `npm run test:all`;
- `npm run test:national-dex` across 1,027 rows;
- the focused Worlds and SEO suites;
- `git diff --check`; and
- `npm run smoke:production` across all 19 public and protected routes after
  each Production deployment.

Vercel reported exact merged `main` commit `29bd86d` **Ready** in Production.
Read-only live HTML verification confirmed the requested Masters notice and
combined-leaderboard sentence are present, and all removed wording is absent.
No merge protection was bypassed.

The Worlds routes are indexable where released. VGC, TCG, and GO have public
metadata and are represented in the Production sitemap. UNITE remains excluded
from the released prediction inventory while it is **Not Live**.

## Remaining work

### Pokémon UNITE

The official source audit contains 185 player rows and 31 normalized team
names: 30 six-player listings and one five-player Legends Reappear listing. Do
not turn those 185 players into individual prediction entries. The intended
product is team-based.

Before release, obtain or confirm the final registered teams, stable aliases,
group assignments, advancement rules and counts, Group Stage match length,
playoff pairings, prediction lock, and the correct team scoring contract. Keep
UNITE **Not Live** until the missing structure is official and the complete
database/RLS/scoring experience passes an isolated Preview rehearsal.

### VGC Top Cut

Keep bracket predictions closed until the official Masters Top Cut field,
seeds, and first-round pairings are published and reviewed. Use the existing
announcement checklist and fail-closed setup path; do not invent matchups.

### Results and leaderboards

The public leaderboard surfaces are live, but no external results importer or
scheduler is enabled. Before automation, obtain explicit source/feed
permission, required attribution, exact event identifiers, and separate owner
authorization for scheduler configuration. Until then, use only an
owner-reviewed official results source and preserve the last-known-good
snapshot on missing, malformed, ambiguous, or incomplete data.

New member entries created after activation are real user data. Never edit or
delete an entry, roster, score, bracket, league, draft, provider setting, or
Production environment value merely to test monitoring or scoring.

## Next-agent starting point

There is no remaining VGC, TCG, or GO voting-launch work. Start with read-only
Production verification and current official-source review. The next
substantive product work is UNITE team modeling only after the missing official
structure exists, followed by VGC Top Cut when pairings are official. Results
automation remains a separate explicitly authorized release.

Preserve the current concise public language. Do not reopen obsolete pull
request #119, which models the superseded TCG Pick 16 experience.
