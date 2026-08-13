# DraftCenter handoff: August 13 global release state

- Date: August 13, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production application commit: `500566392d7d1bde1df2db1f9cdc0df3ba10ca8e`
- Latest production migration: 386
- Latest application release: [#187](https://github.com/roblebaegaming/DraftCenter/pull/187)

## Start here

Everything described as deployed below is already merged, migrated where
required, deployed, and connected. Start every future task from a fresh
`origin/main`. Do not continue an old feature branch, replay commits, or replay
migrations 381-386. Any new database change must use migration 387 or later.

Read this file with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md),
[`../../AGENTS.md`](../../AGENTS.md), and the stable operating document for the
feature being changed. This handoff supersedes the older broad continuation
handoffs for current production state; those files remain useful historical
implementation records.

The original long-lived DraftCenter workspace still contains unrelated owner
work. Preserve it. Inspect `git status`, fetch `origin/main`, and create a clean
short-lived `codex/` branch or worktree before editing.

## Final August 12-13 release chain

| Area | Protected release | Current production behavior |
| --- | --- | --- |
| TCG Meta Picks | [#168](https://github.com/roblebaegaming/DraftCenter/pull/168), migration 381 | TCG Meta Picks are open with 49 reviewed deck archetypes, 12 explicitly unofficial trend signals, five deck choices, and one double-scoring Champion Deck. |
| Connections, Operations, schema | [#170](https://github.com/roblebaegaming/DraftCenter/pull/170) | Pokémon Connections is restored across its intended surfaces, active-league Operations insights are live, and inaccurate Worlds event schema was corrected. |
| Website traffic | [#171](https://github.com/roblebaegaming/DraftCenter/pull/171) | Owner Operations shows aggregate Vercel Web Analytics with five-minute caching and quiet provider-failure handling. |
| Personal Calendar | [#172](https://github.com/roblebaegaming/DraftCenter/pull/172), migration 382 | `/calendar` combines league dates, private reminders, and the maintained official VGC schedule. |
| Private Calendar subscription | [#174](https://github.com/roblebaegaming/DraftCenter/pull/174), migration 383 | A revocable private iCalendar feed keeps Google Calendar updated without Google account access. |
| Pokédex filters | [#176](https://github.com/roblebaegaming/DraftCenter/pull/176) | Trait filters and sorting are readable, dark-theme aware, responsive, and keyboard clear. |
| Daily Games sharing | [#177](https://github.com/roblebaegaming/DraftCenter/pull/177) | Sharing is simplified and downloaded bracket champion cards keep copy and connectors within their border. |
| Italian Worlds | [#178](https://github.com/roblebaegaming/DraftCenter/pull/178) | `/it/worlds/2026` provides the focused Italian prediction experience without forced redirects; entries and leaderboards remain shared. |
| League scale | [#179](https://github.com/roblebaegaming/DraftCenter/pull/179), migration 384 | Leagues default to 2-16 teams, require an explicit unlock for 17-32, and require multi-pod play plus a second unlock above 32, capped at 128. |
| Tournament choices | [#181](https://github.com/roblebaegaming/DraftCenter/pull/181), migration 385 | Single elimination, double elimination, and Swiss are distinct format choices; elimination may bring teams or draft, while Swiss currently requires a shared draft. |
| Operations engagement | [#183](https://github.com/roblebaegaming/DraftCenter/pull/183), migration 386 | Operations reports aggregate Connections usage and a privacy-safe five-minute active-visitor estimate. |
| Worlds choice clarity | [#185](https://github.com/roblebaegaming/DraftCenter/pull/185) | Worlds Home separates player Pick 10 from Pokémon-team or deck Meta Picks and shows live saved-entry counts before entry. |
| Global home navigation | [#187](https://github.com/roblebaegaming/DraftCenter/pull/187) | Every page has an unambiguous **DraftCenter Home** action; mobile/tablet shows **Home** while retaining the full accessible name, and the home page exposes a selected/current-page state. |

Pull request #187 also moved the transitive `nanoid` override from 3.3.17 to
3.3.18 after a new high-severity advisory appeared during the release audit.
The production dependency audit is clean.

## Important current contracts

### Global navigation

- The sticky header's first action always links to `/?view=dashboard`.
- Its accessible name is always **DraftCenter Home**.
- Wider layouts show **DraftCenter Home**; the header's 760px-and-below layout
  shows **Home** to protect space for signed-in account controls.
- The target remains at least 44px tall with a visible keyboard focus ring.
- Only the root route receives `aria-current="page"` and the selected yellow
  treatment. Do not label it **Draft Home** again; that can be confused with a
  league's draft room.

### Operations and privacy

- Website traffic is owner-only and aggregate. It includes today/yesterday,
  seven-day daily average, 30-day visitors and page views, a 30-day chart, and
  the five most-visited public pages.
- `/operations` and private workspace paths are excluded from traffic and
  active-now reporting.
- **Active now** is a five-minute recent-visitor estimate from anonymized Web
  Analytics, not a presence channel or an exact connected-user count.
- Connections usage reports signed-in players, completions, account adoption,
  and a 30-day trend. Never expose names, guesses, puzzle answers, or per-user
  activity in Operations.
- Production analytics credentials are server-only. Do not expose, log, or
  move them into `NEXT_PUBLIC_*` variables.

### Calendar

- The owner's Google Calendar is already privately subscribed. Do not create,
  rotate, expose, log, revoke, or test with the private URL unless the owner
  explicitly asks for that exact action.
- DraftCenter has no Google account access. Only a SHA-256 subscription-token
  hash is stored.
- The feed always includes league dates, private reminders, and every
  maintained official VGC event. Interface filtering must not remove VGC
  events from the feed.
- Invalid or revoked feed URLs return 404 and stay non-indexed.
- Preserve all-day `calendar_start_date` and `calendar_end_date` values and
  league time zones. Update `src/data/vgcCalendarEvents.js` only from confirmed
  official listings, keep IDs unique and chronological, use valid HTTPS source
  links, and advance `VGC_CALENDAR_UPDATED_AT`.

### Worlds Predictions

- Player Pick 10 is open for VGC Masters, TCG Masters, and Pokémon GO. The
  cards' counts are live data; do not copy a historical count into permanent
  interface text.
- VGC and TCG Meta Picks are open as separate competitions. GO Meta Picks
  remain draft with no placeholder pool. Meta scores and player scores never
  mix.
- TCG Meta Picks use 49 reviewed archetypes, 12 trend signals, five choices,
  and one Champion Deck. Migration 381 is already applied; do not replay it.
- Pokémon UNITE remains **Not Live** with no production event. Keep it
  team-based and closed until official teams, groups, advancement rules, and
  playoff pairings are reconciled.
- Keep the VGC Top Cut bracket challenge closed until official pairings exist.
- Results importers remain disabled and unconfigured. Finalization requires an
  owner-reviewed official source and service-only execution.
- The Italian route shares accounts, entries, competitor IDs, and
  leaderboards with English. Do not fork prediction data by language.

### League and tournament scale

- The application and backend both enforce the 16/32/128 league thresholds,
  including hosted snake setup and auctions. Draft activation still requires
  enough Pokémon for every roster slot.
- A normal 32-team league may run a five-round 32-team playoff. Multi-pod
  leagues qualify within pods and may advance pod champions to a combined
  championship.
- New Swiss tournaments use three rounds for 4-8 managers and four for 9-16,
  record-based pairings, and rematch avoidance when possible. They currently
  finish on standings without a top cut.
- Do not reinterpret historical Draft Tournaments or modify real brackets to
  test these contracts. Use isolated fixtures and exact identifiers.

## Validation and deployment evidence

The global navigation release passed:

- focused navigation, help, and release tests: 17/17;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run test:national-dex`: 1,027 Pokémon rows;
- `npm run build`: optimized 242-page production build;
- all protected secret-scan, security, CodeQL, Vercel, and review checks;
- Vercel Preview review and live desktop visual/accessibility review;
- exact production deployment of
  `500566392d7d1bde1df2db1f9cdc0df3ba10ca8e`; and
- the post-deployment signed-out production smoke sweep across all 19 public
  and protected endpoints.

`npm run test:all` still reaches Calendar and the later suites successfully,
then stops at the pre-existing current-main check:

`Error: Migration 379 is not synchronized with the committed VGC option snapshot.`

This is the known baseline. Confirm it remains byte-identical to `main`; do not
hide it, edit migration 379, or casually regenerate the Worlds VGC snapshot as
part of unrelated work.

## Release procedure for the next agent

1. Read `AGENTS.md`, `docs/CURRENT-STATUS.md`, this handoff, and the relevant
   stable operating document.
2. Inspect `git status` and preserve unrelated owner work.
3. Fetch `origin/main` and create a clean short-lived `codex/` branch/worktree.
4. Make the smallest forward-only change. Use migration 387 or later for any
   database change and verify affected RLS policies and grants.
5. Run focused tests while developing.
6. Before an application release, run the dependency audit, `test:all`,
   National Dex verification, and the optimized build. Record the known
   migration-379 baseline accurately if it remains unchanged.
7. Push a protected pull request, wait for every required check, and review the
   Vercel Preview before merging.
8. If a migration is required, rehearse it on an isolated Preview database and
   apply only the new forward migration to the exact production project after
   the application is ready.
9. Confirm the exact merged commit is Ready in Production, review the live
   behavior, and then run `npm run smoke:production`.
10. Update `docs/CURRENT-STATUS.md` and this index through a follow-up protected
    documentation PR when the deployed state materially changes.

## Remaining product gates

- Keep GO Meta Picks closed until an official eligibility pool is reviewed and
  seeded. Do not invent placeholder Pokémon.
- Keep UNITE predictions and the VGC bracket challenge closed until their
  official inputs exist.
- Do not enable automated Worlds result polling without an exact approved
  structured source, permission, attribution, event identifier, and a
  separately authorized scheduler change.
- Maintain the official VGC Calendar only from confirmed event listings.
- Continue normal monitoring of Calendar feeds, Operations aggregate metrics,
  global navigation, tournament formats, expanded leagues, Daily Games,
  Pokédex filters, Italian Worlds, and live entry-count labels.
- Do not enable sitewide advertising yet. Reconsider only after at least one
  complete 30-day period around 10,000 or more page views. European traffic
  requires a Google-certified CMP and privacy updates first. If later approved,
  exclude Calendar, Operations, authenticated league/draft workspaces, private
  tools, and interactive games/predictions.

## Preserved boundaries

- No real league, draft, roster, queue, tournament, prediction entry, Calendar
  reminder, subscription token, or Connections completion was changed to test
  the final release.
- No production database, provider setting, environment variable, analytics
  credential, or secret was changed by the global navigation release.
- The owner identity remains aggregate-only in Operations reporting.
- The retained `multi-pod-pr-82` Preview branch must not be deleted.
- The original dirty DraftCenter workspace was left unstaged and untouched.

When this handoff conflicts with an older broad handoff, use the current
repository, [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), and this verified
production record. Specialized security, SEO, retention, recovery, Calendar,
Worlds, and tournament documents remain authoritative for their detailed
operating procedures.
