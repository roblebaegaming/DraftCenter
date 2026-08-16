# DraftCenter agent handoff: numbered Pokédex production release

- Date: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production commit:
  `88badbf810ec4ed67f30b156b15c4f336738d756`
- Release pull request:
  [#252](https://github.com/roblebaegaming/DraftCenter/pull/252)
- Latest Production migration: 408
- Release state: deployed and verified

## Start here

The requested Pokédex Tracker redesign is live. There is no unfinished
application, migration, provider, or deployment step from pull request 252.
Start future work from fresh `origin/main`; do not replay migration 408.

The original DraftCenter workspace contained unrelated owner changes during
this release. They were preserved. Do not stage, overwrite, hide, or merge a
dirty workspace wholesale.

## What changed

- Every game tracker is presented in that game's Pokédex order rather than
  National Dex order. Cards, search results, section counts, and box slots use
  the selected in-game number.
- Regional and DLC dexes are separate selectable sections. Scarlet and Violet
  expose Paldea, Kitakami, and Blueberry. Sword and Shield expose Galar, Isle
  of Armor, and Crown Tundra. Multi-area Kalos and Alola catalogs also keep
  their reviewed sections.
- A completed species in any game tracker contributes to the same account's
  Pokémon HOME National Dex. Direct HOME progress remains independent and is
  not removed when a linked game entry is unmarked.
- **Find a Pokémon** replaces Rescue. It searches the active dex, shows the
  reviewed places the species can be found in that game, and lists its local
  number in other supported games. It does not claim to inspect a save or
  perform a transfer.
- The box planner now follows the active game section in Pokédex order. It uses
  20-slot groups for Generation I and II storage, 30-slot groups for later
  games and HOME, and explicitly describes Let's Go groups as a planning view
  because those games do not use traditional PC boxes.
- The guided Bank Rescue dashboard and dialog, transfer-planning language, and
  Rescue navigation are removed. Existing legacy private fields are preserved
  silently so the redesign does not destroy older user data.
- Portable raw JSON recovery is hidden from regular users and retained only
  for the owner. Regular users keep bounded CSV import, the seven-tab workbook,
  installable-web-app support, and account-level recovery/export behavior.
- Product, landing, FAQ, SEO, beta, and monetization copy now uses direct,
  ordinary language and describes the numbered dex, finder, linked progress,
  and boxes that actually exist.

## Shared platform and privacy contract

Pokédex Tracker still uses the same DraftCenter account, Supabase project,
reviewed Pokémon/game data, installable web app, and protected private-record
RPCs. There was no user-data migration and no duplicate account system.

Migration 408 is forward-only. It adds catalog/encounter indexes, returns one
canonical row per species and Pokédex section in local number order, and derives
HOME registration from direct HOME progress plus the signed-in user's own game
trackers. It does not copy progress between users or create public table access.

Production postflight returned:

- HOME National Dex: 1,025 species;
- Scarlet sections: 400 Paldea / 200 Kitakami / 243 Blueberry;
- Sword sections: 400 Galar / 211 Isle of Armor / 210 Crown Tundra;
- both private tracker tables still force RLS;
- authenticated direct reads remain denied for both private tracker tables;
- the anonymous tracker-list RPC remains denied.

No real tracker entry, location, individual Pokémon, account, team, league,
provider setting, environment variable, or secret changed during release
validation.

## Validation evidence

- `pnpm audit --prod --audit-level high`: no vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed with 1,027 source rows.
- Focused Pokédex Tracker tests: 22/22 passed.
- App-platform tests: 3/3 passed.
- SEO tests: 18/18 passed.
- `npm run build`: passed with 303 static pages. The existing non-blocking
  dynamic-font warning for symbol glyphs remains unchanged.
- The exact retained Preview received migration 408 and passed its rollback-
  only two-account regression for linked HOME progress, cross-account denial,
  unlinking, direct HOME preservation, catalog counts, grants, and RLS.
- The hosted pull-request Preview passed desktop, 390px, and 320px review with
  no horizontal overflow or browser errors.
- Protected security, secret-scan, CodeQL, and Vercel checks passed.
- Production migration and postflight passed on the exact existing project.
- Vercel deployed exact merge commit `88badbf8` to Production.
- `npm run smoke:production` passed every public and protected-route check.
- The live Pokédex route showed Find rather than Rescue, separate Paldea,
  Kitakami, and Blueberry totals, numbered box groups, and no console errors.

## Ordered continuation

### 1. Run the August 19 aggregate attribution review

At 09:00 Pacific, review the already scheduled three-day launch window. Keep
Pokédex Tracker's `collector-founding-beta` and Team Lab's
`team-lab-battle-mode` separate. Report only aggregate confirmed account
creations, signup starts, focused-product journeys, defensible conversion
rates, and explicit gaps. Do not expose identities, email addresses, account
IDs, raw paths, tracker names, Pokémon choices, or notes.

### 2. Find 5-8 opt-in Pokédex testers

Use existing followers, known collectors, or people who engage organically.
Do not invite random people. Aim for HOME/living-dex collectors, shiny hunters,
spreadsheet users, and casual mobile users. The owner must approve the exact
people and destination before an invitation is prepared or sent.

Ask approved testers to cover:

1. whether game and DLC sections match the numbering they expect;
2. whether marking game progress updates HOME naturally without confusion;
3. whether Find gives useful, honest location guidance;
4. whether the box layout matches how they organize that game;
5. whether CSV/workbook tools are understandable without raw JSON;
6. any mobile overflow, excessive scrolling, or unclear wording.

Do not place tester identities in repository documentation.

### 3. Improve Find from observed gaps

Treat the reviewed encounter catalog as the source of truth. Prioritize
version exclusives, gifts, evolutions, forms, event-only cases, and entries
where a species is in a dex but has no useful wild location. Say that a method
needs verification when the reviewed data cannot support an answer. Do not
reintroduce Rescue branding or guessed transfer routes.

### 4. Validate box planning with real collectors

The released planner intentionally maps one local-dex number to one planning
slot. It is not a claim that the game automatically sorts storage or that one
physical specimen satisfies overlapping section entries. Use tester feedback
before adding drag-and-drop boxes, form slots, living-dex variants, or OCR.

### 5. Return to Team Lab after Pokédex feedback

For closed-sheet Battle Room, prioritize real-set crash recovery, fewer taps,
undo/edit clarity, best-of-three transitions, reusable rematch plans, and
post-set review. Test with actual players before native packaging or premium
collaboration.

### 6. Keep monetization gated

The released core remains free. Ko-fi is voluntary and grants no entitlement.
Do not add Stripe or another processor, a paywall, ads, public pricing, native
billing, or retroactive access restrictions before usage evidence, approved
tester research, explicit willingness-to-pay evidence, and qualified IP
review. If those gates are later met, prefer one shared DraftCenter Plus
entitlement over separate app subscriptions.

## Do not start automatically

- Do not send tester invitations or messages without the owner's exact audience
  and destination approval.
- Do not connect to Nintendo, Pokémon Bank, or Pokémon HOME as if the app can
  inspect or verify an external collection.
- Do not add camera/OCR entry before the manual numbered-dex and box workflows
  show demand and have a reviewed privacy/error model.
- Do not replay migration 408 or rewrite any migration that may have run.
- Do not modify Mushroom Cup or resume, restart, archive, or delete the paused
  historical Mushroom Hut drafts.

## Release procedure for the next slice

Use a short-lived `codex/` branch and protected pull request. Database changes
must be additive and forward-only. Run focused tests during development and
the applicable full checks before proposing another application release:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

Review the exact hosted Preview at desktop, 390px, and 320px. For a database
change, run a focused two-account privacy/RLS/grant matrix on the retained
Preview and clean up only exact disposable fixtures. After an authorized merge,
confirm the exact Production commit and run `npm run smoke:production`.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Pokédex Tracker contract: [`../pokedex-trackers.md`](../pokedex-trackers.md)
- Shared app-platform contract: [`../app-platform.md`](../app-platform.md)
- Monetization decision:
  [`../focused-app-monetization.md`](../focused-app-monetization.md)
- Founding beta boundary:
  [`../pokedex-founding-collector-beta.md`](../pokedex-founding-collector-beta.md)
- Team Lab contract: [`../team-lab.md`](../team-lab.md)
- Preceding focused-app handoff:
  [`DraftCenter-agent-handoff-2026-08-16-focused-apps-next.md`](DraftCenter-agent-handoff-2026-08-16-focused-apps-next.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
