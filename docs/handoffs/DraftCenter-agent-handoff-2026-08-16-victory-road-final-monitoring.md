# DraftCenter agent handoff: Victory Road final monitoring and public brackets

- Date: August 16, 2026 Pacific
- Final live review: August 16, 2026 at 4:25 PM Pacific
- Production: https://www.draftcentral.gg
- Public challenge: https://www.draftcentral.gg/worlds/2026/vgc/victory-road-to-san-francisco
- Official bracket: https://battlefy.com/victoryroad/victory-road-to-san-francisco-phase-2-top-cut/6a60ab274f0d45001a7281b6/stage/6a820c17b2796d0019f6d118/bracket/
- Official final match: https://battlefy.com/victoryroad/victory-road-to-san-francisco-phase-2-top-cut/6a60ab274f0d45001a7281b6/stage/6a820c17b2796d0019f6d118/match/6a820c2bb2796d0019f6d158
- Verified Production feature commit: `0c9e07b348f5f91d5062e20cbdb6b04a8b33a276`
- Latest Production migration: 412
- Completed monitor: `victory-road-top-cut-live-scoring`, stopped after final verification

## Current live state

The official Battlefy bracket is complete. Its final-match page shows seed 21,
alias `케이`, defeating seed 18, alias `Thacrow`, 2-1. The reviewed field from
the original standings maps seed 21 to Hyungwoo Shin and seed 18 to João Felipe
Leite. This makes Hyungwoo Shin the official champion over João Felipe Leite.

The final result was recorded through the owner-only Operations controls after
refreshing the authoritative 6/7 state and isolating the unfilled final.
DraftCenter was then finalized against the same Battlefy bracket URL. The final
signed-in Production review confirmed:

- challenge state: `final`;
- active Top 8 results: 7/7;
- active entries: 1;
- champion: Hyungwoo Shin;
- runner-up: João Felipe Leite;
- private audit events: 12;
- finalization: complete.

The public page was reloaded after finalization. It shows `Final results`, all
15 Top 16 archive results, Rob Lebae at 4/32 in the original archive, and Rob's
Top 8 carryover ranked first at 0/12. The five-minute heartbeat was then deleted
because the tournament was complete. Do not recreate it or change these
official results unless a documented official correction appears.

## Competition and scoring

The active challenge is revision 2, the official Top 8 replacement. It locked
at 2:10 PM Pacific / 21:10 UTC and awards 1 point per quarterfinal, 2 per
semifinal, and 4 for the final, for a 12-point maximum. Rob Lebae's earlier Top
16 submission is represented in two intentionally separate ways:

- the active Top 8 leaderboard contains the audited side-preserving carryover;
- the original Top 16 archive preserves the exact names and original picks,
  including Markus Hamann's original path, and scores 1/2/4/8 for a 32-point
  maximum.

Do not replace either field. The active bracket is the live competition; the
Top 16 bracket is the historical record.

The reviewed active results already recorded before the final are:

1. Dorian Quiñonez over Shohei Kimura
2. Hyungwoo Shin over Kandai Nagatome
3. João Felipe Leite over Shunsuke Minami
4. Héctor Sánchez over Masahiro Ito
5. Hyungwoo Shin over Dorian Quiñonez
6. João Felipe Leite over Héctor Sánchez

The official seventh result is Hyungwoo Shin over João Felipe Leite.

## Completed five-minute monitor

The thread heartbeat `victory-road-top-cut-live-scoring` ran on a five-minute
interval. Its completed contract was to:

1. compare the official Battlefy bracket with the current owner state;
2. record only newly completed official winners in feeder-match order;
3. never infer a result from a partial score, stream graphic, Swiss standing,
   or unreviewed alias;
4. never overwrite a conflicting DraftCenter result;
5. verify the public leaderboard after every accepted result;
6. finalize only after all seven results match the official bracket; and
7. verify the final leaderboard, report completion, and stop.

The final result, finalization, public status, Top 8 leaderboard, and Top 16
archive were verified. The automation has been deleted and no result-monitoring
work remains.

## Public entrant bracket release

Pull requests [#271](https://github.com/roblebaegaming/DraftCenter/pull/271)
and [#272](https://github.com/roblebaegaming/DraftCenter/pull/272) added and
polished the public entrant-bracket gallery at exact Production commit
`26a95dc5ae66cde281a0c6a8cdda5ee41c25d448`.

After lock, a visitor can select a leaderboard row and inspect that entrant's
complete read-only bracket. Saved predictions are yellow and official winners
are aqua, so the bracket continues to show both the original choice and the
live scoring outcome. Entrant brackets remain private before lock. The public
payload omits account identifiers and does not grant direct access to private
tables.

The final mobile review used a 390 by 844 viewport. The entrant viewer opens
near the selected row, round navigation fits without horizontal page overflow,
and the browser reported no page warnings or errors. No database migration was
required for these two releases.

Pull request [#274](https://github.com/roblebaegaming/DraftCenter/pull/274)
then added dependency-free PNG downloads for the member's completed bracket,
the public Top 16 archive, and each post-lock leaderboard bracket. Exports are
generated locally from the same authorized payload, start at 1,920 by 1,350
pixels, and contain the event, Trainer, score, round values, saved picks,
official winners, and public URL. They do not expose account IDs, publish
anything new, or make another member's pre-lock picks available.

## Release and validation evidence

- Pull request #266 and migration 412 released the exact Top 16 archive at
  commit `cabe7fdc6b07d8fdcd760538af5b9673b7963752`.
- Pull requests #269 and #270 made that original bracket the prominent archive
  view and corrected status language.
- Pull requests #271 and #272 released the post-lock entrant gallery and mobile
  navigation at commit `26a95dc5ae66cde281a0c6a8cdda5ee41c25d448`.
- Pull request #274 released bracket PNG downloads at exact Production commit
  `0c9e07b348f5f91d5062e20cbdb6b04a8b33a276`.
- Focused bracket and image-export tests: 12/12 passed.
- Focused prediction-bracket tests: 9/9 passed.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 rows.
- Environment-backed `npm run build`: passed with 305 static pages; the
  existing non-blocking symbol-font warning remained unchanged.
- Protected security, secret-scan, CodeQL, JavaScript analysis, and Vercel
  checks passed.
- Vercel verified the exact feature deployment.
- `npm run smoke:production`: all public routes and protected boundaries
  passed after deployment.
- Live desktop and mobile checks confirmed the archive, entrant gallery,
  leaderboard interaction, responsive layout, and clean browser console.
- The generated 1,920 by 1,350 preview was visually reviewed, and both the
  archived-bracket and public entrant-bracket Production downloads encoded
  successfully with their completion status announced in the page.

## What remains

### Immediate tournament work

No live-scoring work remains. The seventh result, 7/7 scoring, 15/15 archive,
final state, final leaderboard, and stopped monitor have all been verified.
Preserve the page as the completed event record.

### Next bracket-product work

1. Add a tournament directory for live and completed bracket challenges so
   this page becomes part of a permanent former-tournament repository.
2. Move non-Worlds competitions toward a neutral event route while preserving
   redirects from the current `/worlds/2026/vgc/...` URL.
3. Add permanent shareable URLs for individual entrant brackets. The current
   viewer opens from the leaderboard but does not provide a durable per-entry
   address.
4. Add search and pagination before events exceed the bounded first 100 public
   entries.
5. Turn the Victory Road configuration into a reusable event setup for future
   single-elimination tournaments, including event branding, scoring, locks,
   official sources, and archive status.
6. Add an explicit reviewed player-identity and alias map for official feeds
   so seed and stream aliases never require last-minute manual reconciliation.
7. Test the live experience with a real opt-in participant cohort before the
   next time-sensitive event.

### Separate product priority

The Pokédex Tracker remains the broader product priority. Continue its
game-numbered dex, DLC separation, linked National Dex, box-planner, and
location-data quality work from the dedicated Pokédex handoff. Do not combine
that product's database or release work with final Victory Road scoring.

## Preserved boundaries

No league, draft, roster, team, account, authentication setting, provider
setting, environment variable, or secret changed in the entrant-gallery
release. No unrelated tournament or Worlds challenge changed. The original
dirty workspace, Mushroom Cup, and intentionally paused Mushroom Hut drafts
remain untouched.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Bracket contract: [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- Pokédex continuation: [`DraftCenter-agent-handoff-2026-08-16-pokedex-numbered-dexes-production.md`](DraftCenter-agent-handoff-2026-08-16-pokedex-numbered-dexes-production.md)
- Preceding Victory Road handoff: [`DraftCenter-agent-handoff-2026-08-16-victory-road-bracket-production.md`](DraftCenter-agent-handoff-2026-08-16-victory-road-bracket-production.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
