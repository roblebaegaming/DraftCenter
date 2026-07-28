# PokemonDraftLeague extraction plan

This plan is preparation work only. Do not merge the structural refactor into
the frozen rehearsal candidate.

## Current shape

`src/components/PokemonDraftLeague.jsx` contains approximately 17,000 lines and
combines:

- Pokémon and regulation datasets;
- type, stat, ability, sprite, and cost utilities;
- initial league state and compatibility normalization;
- persistence and Supabase mutation orchestration;
- draft setup, snake, auction, and timer behavior;
- schedules, match reporting, standings, and playoffs;
- free agency, claims, trades, and activity;
- export, recovery, and commissioner tools;
- almost every league UI view.

The refactor must preserve behavior and public exports. Each extraction should
be independently reviewable and revertible.

## Characterization boundary

Before moving stateful code, add tests around:

- regulation eligibility and prices;
- draft-order and turn calculations;
- roster limits and budget calculations;
- schedule and playoff derivation;
- transaction and claim validation;
- serialization and recovery normalization.

UI extraction should initially move components without changing props, markup,
copy, state ownership, RPC names, or timing behavior.

## Extraction phases

### Phase 1 — static data and pure utilities

Create:

- `src/domain/pokemon/catalog.js`
- `src/domain/pokemon/regulations.js`
- `src/domain/pokemon/type-matchups.js`
- `src/domain/draft/costs.js`
- `src/domain/draft/formatting.js`

Move the large raw datasets, regulation allowlists/cost tables, generation
metadata, type-defense calculations, slug helpers, and pure formatting helpers.

Acceptance criteria:

- existing named exports remain available through re-exports;
- catalog counts and regulation results are characterized by tests;
- no hooks, network calls, storage access, or UI markup move in this phase.

### Phase 2 — reusable presentation

Create:

- `src/components/pokemon/MonSprite.jsx`
- `src/components/pokemon/MonAbilities.jsx`
- `src/components/pokemon/MonDefenseChart.jsx`
- `src/components/pokemon/MonStats.jsx`
- `src/components/teams/TeamLogo.jsx`
- `src/components/teams/TeamDefenseSummary.jsx`

Move presentation components with unchanged props and markup.

### Phase 3 — setup and commissioner tools

Create:

- `src/components/league/setup/SetupView.jsx`
- `src/components/league/setup/FormatCard.jsx`
- `src/components/league/setup/PriceBoard.jsx`
- `src/components/league/setup/ScheduleAndPlayoffsCard.jsx`
- `src/components/league/setup/BackupRestoreCard.jsx`
- `src/components/league/setup/DangerZoneCard.jsx`

Keep all mutations and state orchestration in the parent initially. Pass existing
callbacks through unchanged.

### Phase 4 — draft room

Create:

- `src/components/draft/DraftView.jsx`
- `src/components/draft/DraftBoard.jsx`
- `src/components/draft/PickTimer.jsx`
- `src/components/draft/AuctionPanel.jsx`
- `src/components/draft/DraftRecapCard.jsx`

Do not change timer ownership, automatic rollover behavior, or server-authority
boundaries during extraction.

### Phase 5 — season and playoffs

Create:

- `src/components/season/ScheduleView.jsx`
- `src/components/season/MatchCard.jsx`
- `src/components/season/StandingsView.jsx`
- `src/components/playoffs/PlayoffsView.jsx`
- `src/components/playoffs/DoubleElimView.jsx`
- `src/components/playoffs/DivisionPlayoffsView.jsx`

Characterize bracket and standings calculations before moving their helpers.

### Phase 6 — transactions and communications

Create:

- `src/components/transactions/FreeAgentsBrowser.jsx`
- `src/components/transactions/TransactionsView.jsx`
- `src/components/transactions/PendingTradeCard.jsx`
- `src/components/league/LeagueActivityView.jsx`
- `src/components/league/MessagesView.jsx`

Do not combine extraction with RPC, privacy, claim-order, or reversal changes.

### Phase 7 — orchestration hooks

Only after the prior phases are stable, split the main component's state and
effects into domain hooks:

- `useLeaguePersistence`
- `useLeagueIdentity`
- `useDraftLifecycle`
- `useLeagueTransactions`
- `useSeasonResults`
- `useLeagueNotifications`

Each hook must have a narrow input/output contract and must not duplicate
subscriptions or timers.

## Pull-request strategy

- One phase per pull request.
- No phase may include product enhancements.
- Run unit tests, production build, and an authenticated smoke test after every
  phase.
- Compare league snapshot output before and after any state-related extraction.
- Keep the original file as the composition root until Phase 7.
- Merge only after the supervised rehearsal unless a separate critical safety
  review explicitly approves an earlier phase.

## Definition of done

- The main file is a composition layer rather than the owner of all domains.
- Pure domain logic has direct tests.
- Timer, subscription, and RPC behavior remains singular.
- Snapshot serialization remains backward-compatible.
- No commissioner, ownership, invite, notification, or draft-authority behavior
  changes as a side effect of extraction.
