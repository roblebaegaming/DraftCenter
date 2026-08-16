# DraftCenter agent handoff: focused apps next

- Date: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Production repository commit at preparation:
  `f6693694a3bdfcd3607a46be9b55f5db9620817f`
- Verified focused-app feature commit:
  `9ad9734cc976464de42f53d210b0a3fd61410385`
- Latest Production migration: 407
- Release state: Pokédex Tracker and Team Lab focused shells plus the first
  guided Bank Rescue project are released and verified

## Start here

There is no unfinished application, migration, provider, payment, or deployment
step from pull requests 248-250. The current safe action is evidence gathering,
not another feature or billing release.

Start future work from fresh `origin/main`. The original DraftCenter workspace
contains older unrelated owner work; do not stage, overwrite, hide, or merge it
wholesale. Do not replay migration 407 or any prior focused-app release.

## What is live

- Pull request [#248](https://github.com/roblebaegaming/DraftCenter/pull/248)
  released a shared focused-app foundation and the Pokédex Tracker Rescue
  dashboard. Pokédex Tracker and Team Lab retain one DraftCenter account,
  reviewed Pokémon data, Supabase project, export foundation, and compatible
  routes while presenting focused navigation and installable-web-app behavior.
- Pull request [#249](https://github.com/roblebaegaming/DraftCenter/pull/249)
  released the resumable Access map, Important Pokémon, Intentions, and Archive
  guide. It reuses the existing owner-scoped collection inventory and does not
  claim to inspect Bank, HOME, a game save, or a completed transfer.
- Pull request [#250](https://github.com/roblebaegaming/DraftCenter/pull/250)
  reconciled the canonical status and post-launch handoff. The verified feature
  deployment remains `9ad9734`; migration 407 remains current.
- Security, secret, CodeQL, hosted build, dependency audit, complete application
  suite, 1,027-row National Dex verification, the 20-check signed-out Production
  smoke sweep, and a signed-in non-mutating Rescue walkthrough passed for the
  application release.
- No Production collection record, team, matchup, battle report, league,
  account, provider setting, environment variable, secret, payment setting, or
  tester audience changed during these releases.

## Decision made in this continuation

The focused apps should not receive payment code or a paywall now. Every
released Rescue, collection, Team Lab, Battle Mode, export, and recovery
workflow remains free during validation. The existing voluntary Ko-fi support
does not grant an entitlement.

If later evidence supports a paid product, prefer one shared **DraftCenter
Plus** entitlement over separate app subscriptions. Pricing and offer ideas are
unpublished hypotheses. Commercial activation is gated on usage evidence,
owner-approved tester research, explicit willingness to pay, and qualified IP
review. The complete decision is in
[`../focused-app-monetization.md`](../focused-app-monetization.md).

This decision does not authorize Stripe or another processor, a database
entitlement, ads, sponsorship, a pricing page, native billing, or a customer
message.

## Exact continuation order

### 1. Measure the launches

Run the scheduled aggregate-only attribution reviews at 09:00 Pacific on
August 19, August 23, and September 15, 2026. Report Pokédex Tracker's
`collector-founding-beta` and Team Lab's `team-lab-battle-mode` separately:

1. attributed confirmed account creations;
2. signup starts;
3. focused-product feature journeys;
4. conversion rates only when the aggregates support them;
5. explicit gaps and limitations.

Do not report identities, emails, account IDs, raw paths, tracker or team names,
Pokémon choices, notes, full referrers, or other personal data.

### 2. Find opt-in testers

Look for 5-8 candidates among existing followers, known collectors, and
organically engaged users. Aim for a mix of HOME or living-dex collectors,
shiny hunters, spreadsheet users, and casual mobile users. Do not invite random
people. The owner must approve the exact audience and destination before an
invitation is prepared or sent.

For Team Lab, prioritize players who can test a real closed-sheet best-of-three
set. Keep candidate identities out of repository documentation.

### 3. Research the deeper Rescue catalog

The next Pokédex Tracker engineering slice is a dated, source-backed catalog of
species, forms, acquisition paths, legacy value, and transfer constraints. Its
purpose is explainable owned-game routing, not a guessed universal answer.

Research and schema design must precede UI. Every recommendation needs a dated
source and a reason. Unsupported cases must say **Verify before acting**. Do
not infer availability from artwork, community folklore, a species name, or an
owner-entered form label.

Before implementation, produce:

- a source hierarchy and review cadence;
- a normalized species/form and game-availability model;
- explicit unknown, regional, event, service, and legacy-value states;
- conflict handling and provenance fields;
- a test corpus covering edge cases and forms;
- a plan for source changes after Bank is no longer available.

### 4. Add an access profile only if routing requires it

A cross-tracker profile for owned systems, games, saves, subscriptions, Bank
access, and HOME access may require a new forward-only migration. Owner-entered
access is a planning input, not external verification. Use an isolated Preview,
two-account privacy regression, focused RLS and grant review, portable account
export, and explicit deletion behavior before Production.

### 5. Build and validate the routing experience

Once the catalog and access-profile contracts are reviewed, add the smallest
useful personalized Rescue route. Preserve the existing guide and exports.
Explain why an action is recommended, show source freshness, and fail closed
when evidence is missing.

### 6. Stabilize Team Lab Battle Room

After the deeper Rescue slice, make closed-sheet Battle Room dependable in real
sets. Prioritize local crash recovery, fewer taps, undo/edit clarity, reusable
rematch plans, best-of-three transitions, and post-set review. Test with actual
players before adding native packaging or premium collaboration.

### 7. Revisit monetization and native packaging

Apply every activation gate in the monetization decision. Use a manual offer
test before billing. Keep both products as installable web apps until sustained
use justifies App Store and Play Store policy, billing, and support work.

## Do not start automatically

- Do not invent or display a Pokémon Bank shutdown deadline without a current
  official source that states one.
- Do not connect to Nintendo, Pokémon Bank, or Pokémon HOME as if the app can
  inspect or verify an external collection or transfer.
- Do not add camera or OCR box scanning before the manual Rescue flow proves
  demand and a privacy/error model is approved.
- Do not add a payment processor, entitlement migration, public pricing, ads,
  sponsorship, or native-store release from this handoff.
- Do not retroactively gate existing user data, export, restore, Rescue, or
  Battle Mode access.
- Do not send tester invitations until the owner approves the exact people and
  message destination.
- Do not modify Mushroom Cup or the paused historical Mushroom Hut drafts.

## Release gates for the next application slice

Use a short-lived `codex/` branch and protected pull request. Database changes
must be additive and forward-only. Run focused tests while developing and the
applicable full release checks before proposing an application release:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

Review the exact hosted Preview at desktop and narrow mobile widths. For a
database slice, run the focused privacy/RLS/grant matrix on an isolated Preview
and clean up only exact disposable fixtures. After authorized merge, verify the
exact Production commit and run `npm run smoke:production`. Never use a local
build as evidence of Production deployment.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Monetization decision:
  [`../focused-app-monetization.md`](../focused-app-monetization.md)
- Preceding post-launch handoff:
  [`DraftCenter-agent-handoff-2026-08-16-post-launch-final.md`](DraftCenter-agent-handoff-2026-08-16-post-launch-final.md)
- Pokédex Tracker contract: [`../pokedex-trackers.md`](../pokedex-trackers.md)
- Team Lab contract: [`../team-lab.md`](../team-lab.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
