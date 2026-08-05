# DraftCenter agent handoff - Pallet Town test-draft feedback

- Date: August 4, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Working branch: `codex/test-draft-feedback-rollup`
- Pull request: [#34 - Apply Pallet Town test-draft feedback](https://github.com/roblebaegaming/DraftCenter/pull/34)
- Implementation head before this documentation update: `2f3cca6`
- Production state: unchanged by this work

## Read this first

Pull request #34 contains the fixes derived from the live Pallet Town test
draft. The branch is pushed and reviewable, but it is not merged or verified in
production. Never tell the owner that these changes are live until the deployed
commit is confirmed and the signed-out production smoke sweep passes.

The Pallet Town league is real production data. The investigation and this
implementation did not alter its picks, rosters, queues, memberships, teams,
deadlines, or provider settings. Continue to inspect it read-only unless the
owner explicitly authorizes a narrowly scoped production action.

For the earlier verified production history, authentication and provider
posture, performance findings, recovery policy, and stable operating context,
also read
[`DraftCenter-agent-handoff-2026-08-04-final.md`](DraftCenter-agent-handoff-2026-08-04-final.md).

## What happened during the test draft

The owner and participants reported these concrete issues:

- Human auto-draft ignored the manager's queue and chose the next alphabetical
  Pokemon.
- Reloading could return a manager to the wrong league section instead of the
  active draft board.
- Public visitors could join without clearly reaching team selection, and an
  unassigned member could see the first team as **My Team**.
- Setup, Operations, and the public directory showed different claimed-team
  totals.
- The commissioner removal menu appeared longer than the manager list because
  it mixed assigned managers with members who joined without claiming a team.
- Lowering league size did not clearly guarantee that open bot slots would be
  removed before human-controlled teams.
- A manager who joined too late could not take over an open bot team during the
  draft.
- With many teams, managers could not easily find their own team, see the
  upcoming order while scrolling, or identify usernames on the board.
- The message badge could appear without a visible message because League Board
  and direct-message unread state were not routed separately.
- Participants wanted League Board chat inside the draft board.
- Unlimited free-agent transactions allowed immediate roster churn without a
  meaningful default safeguard.

## Implemented in pull request #34

### Draft queue and navigation

- Human auto-draft now uses the manager's authoritative private queue.
- A commissioner cannot force an alphabetical fallback for a human team whose
  hosted queue snapshot is empty; bot teams retain bot behavior.
- League, tab, and draft-section navigation are stored in the URL so reloads
  return the user to the active location.

Primary files: `src/lib/draftQueueSafety.js`,
`src/lib/leagueNavigation.js`, and `src/components/PokemonDraftLeague.jsx`.

### Claims, resizing, and manager removal

- Joining a public league opens team selection instead of silently skipping it.
- Unassigned managers can claim from League Details.
- **My Team** is hidden until the signed-in account actually owns a team.
- Claimed teams are compacted ahead of open bot slots.
- Commissioners cannot reduce league size below the number of human-controlled
  teams; safe shrinking removes open bot slots first and remaps private queues.
- Removing a manager clears both durable account ownership and legacy
  display-name ownership.
- The removal menu now separates **Managers with teams** from **Joined without a
  team** and explains the exact consequence before confirmation.
- Public directory, Setup, and Operations totals all recognize both
  `claimedBy` and `claimedByUserId`, and the UI consistently labels the number
  as **teams claimed**.

Primary files: `src/lib/teamOwnership.js`, `src/components/AuthGate.jsx`,
`src/components/LeagueHub.jsx`, and migrations 252, 253, and 255.

### Live draft board

- A sticky live-draft context bar keeps the timer, current manager, upcoming
  picks, and the signed-in manager's next pick visible while scrolling.
- The signed-in manager's team remains highlighted even when another team is on
  the clock.
- A jump action moves directly to the manager's team.
- Draft-board and roster-grid labels include manager usernames.

Primary files: `src/lib/draftBoardContext.js` and
`src/components/PokemonDraftLeague.jsx`.

### Draft chat and unread routing

- The existing durable League Board conversation is embedded in the draft.
- League Board unread alerts and direct-message unread alerts route to their
  respective views.
- Visible draft chat is marked read; a failed send does not clear unread state.
- Spectators and role previews see a read-only chat view.

Primary file: `src/components/PokemonDraftLeague.jsx`.

### Transactions and live bot-team takeover

- Newly created leagues default to one free-agent transaction per week.
- Existing leagues with an explicit unlimited setting remain unlimited.
- Instant free-agent moves show the remaining allowance and require
  confirmation.
- During an active draft, a commissioner can assign an open bot team to an
  already-joined, unassigned manager.
- Takeover preserves existing picks, roster, budget, private queue, draft order,
  and deadlines, disables bot control, and rejects a team currently on the
  clock.
- The takeover records an audit/lifecycle event and updates relational ownership
  for snake and auction drafts.

Primary files: `src/components/AuthGate.jsx`,
`src/components/PokemonDraftLeague.jsx`, and migration 254.

## Forward-only database migrations

- `supabase/252-clear-removed-manager-team-claims.sql`
- `supabase/253-claimed-first-team-ownership-and-safe-resize.sql`
- `supabase/254-live-bot-team-takeover.sql`
- `supabase/255-consistent-public-team-claim-counts.sql`

Do not rewrite these migrations. Before release, review the affected function
grants and RLS assumptions. After deployment, verify that all four migrations
applied in order before testing the corresponding UI.

## Validation evidence

Completed on the integrated branch:

- `npm run test:all` - passed, including all seven focused feedback suites.
- `pnpm audit --prod --audit-level high` - no known vulnerabilities.
- `npm run test:national-dex` - all 1,027 Pokemon rows verified.
- Full Next.js build - passed compilation, TypeScript, page collection, and all
  106 static-page generations.

The ordinary shell initially lacked the public Supabase values, so a direct
`npm run build` stopped while prerendering `/my-teams`. This was a local
configuration issue, not an application error. It was resolved without
printing or committing values:

```powershell
npx --yes vercel@latest pull --yes --environment=preview
npx --yes dotenv-cli -e .vercel/.env.preview.local -- npm run build
```

The linked Preview environment is stored under the ignored `.vercel/`
directory. Preserve `.vercel/` and never commit its contents. A production
smoke test was intentionally not run because PR #34 is not deployed.

## Release checklist for the next agent

1. Read the current PR conversation and wait for all required GitHub checks.
2. Review the Preview deployment without changing the real Pallet Town league.
3. Exercise the new workflows in an isolated practice league or approved
   preview fixture: queued auto-draft, reload resume, public claim, team shrink,
   removal grouping, unread routing, transaction allowance, and live takeover.
4. Confirm migrations 252-255 are forward-only and retain least-privilege
   grants.
5. Do not merge while required checks or review are incomplete.
6. After an authorized merge, confirm the deployed commit rather than assuming
   the Preview is production.
7. Run `npm run smoke:production` only after deployment.
8. Verify public, Setup, and Operations claimed-team totals read the same for a
   suitable league without mutating it.
9. Record the verified release in `docs/CURRENT-STATUS.md` and update this
   handoff from pre-release to deployed status.

## Known pending items

- PR #34 is open and was created with required checks pending.
- PR #33 contains the earlier manager-removal subset and is superseded by #34;
  it was not closed automatically.
- No production deployment or migration was performed in this work.
- No production smoke result exists for this branch yet.
- Existing leagues keep their explicitly saved transaction setting. The new
  one-per-week default applies to newly created leagues.
- Managers do not independently claim an arbitrary team once a draft is live;
  the safe path is the commissioner-controlled open bot-team takeover.

## Safety boundaries

- Never mutate Pallet Town merely to verify these fixes.
- Never automatically replay a timed-out draft mutation; refresh and verify the
  authoritative state first.
- Use isolated practice leagues for destructive lifecycle tests and verify the
  exact league identifier before cleanup.
- Do not modify Mushroom Cup without a direct commissioner request and valid
  access. Do not resume, restart, archive, or delete the intentionally paused
  historical Mushroom Hut drafts.
- Do not change production data, auth settings, Vercel settings, Supabase
  settings, or provider configuration without explicit authorization for that
  exact action.
- Never disclose or commit Supabase values, provider credentials, session
  tokens, recovery material, channel IDs, or user email addresses.
- Preserve `.vercel/` and unrelated user work.
- Keep Operations identity reporting aggregate-only and distinguish historical
  events from current authoritative state.

## Focused regression coverage

- `test/draft-experience.test.js`
- `test/team-ownership.test.js`
- `test/draft-board-ux.test.js`
- `test/draft-chat-routing.test.js`
- `test/transaction-takeover.test.js`
- `test/manager-removal-claim-cleanup.test.js`
- `test/league-count-consistency.test.js`

## Implementation commits in PR #34

- `b35aff5` - clear removed manager team claims.
- `8f4ecce` - fix queue auto-draft and league resume.
- `7e8fea5` - fix team claiming and safe league resizing.
- `2f4a215` - improve live draft-board context.
- `0b4da82` - add draft chat and route unread messages.
- `a011321` - add transaction safeguards and live team takeover.
- `2f3cca6` - clarify league members and unify claim counts.
