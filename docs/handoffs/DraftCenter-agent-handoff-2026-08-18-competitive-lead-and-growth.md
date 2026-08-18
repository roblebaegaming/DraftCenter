# DraftCenter agent handoff: competitive lead and growth

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `31e9d5691c69e166a381ced4999479097a6b5378`
- Latest applied Production migration: 437
- Latest released stack: pull requests #308 and #309, migrations 435–437

## Executive decision

DraftCenter should stop treating feature count as the primary race. The product
already covers an unusually wide connected surface: league setup, several live
draft formats, hosted auctions, Swiss and elimination tournaments,
organizations, private communications, predictions, player preparation,
Battle Room, collection tracking, Daily Games, exports, and public Pokémon
research.

The competitive risk is that a narrower product can explain one job faster,
get a commissioner to first value sooner, or automate one painful step better.
The next phase should therefore make DraftCenter the easiest complete operating
system for a Pokémon draft league, not add another unrelated product area.

The recommended public promise is:

> Set up, run, play, and preserve a complete Pokémon draft league without
> managing the season across spreadsheets, Discord-only state, and five
> separate tools.

DraftCenter's strongest defensible position is the connection between the
commissioner's full season and each manager's private preparation workspace.
That is harder to reproduce than an isolated draft board, team builder, ladder,
or Pokédex.

## Current release state

### Production

The August 17 backlog and the August 18 collection and Daily Games stack through
pull request #309 are complete and deployed.
Production includes autonomous hosted bot auctions, 4–32-manager Auction Draft
Tournaments, Swiss and elimination formats, multi-pod organizations, reusable
prediction events, private member email, Team Lab and Battle Room, Open Team
Sheets, Legends: Z-A and Alpha tracking, collection tools, Daily Games, public
Pokémon profiles, recovery/export foundations, and mobile-focused workflows.

PokeEarth remains intentionally paused. Do not resume it without a direct owner
request. GO Meta Picks remains closed until an official eligibility pool is
reviewed.

### August 18 protected releases

Pull request [#308](https://github.com/roblebaegaming/DraftCenter/pull/308)
released the expanded private Pokédex collection system:

- reviewed postgame Pokédex coverage;
- searchable individual Pokémon by name, type, game, ball, ribbon, mark, and
  form;
- Vivillon patterns, Furfrou trims, and other collectible forms;
- marks, Pokémon GO, and specific hunt targets such as a marked or Alpha
  Pokémon; and
- Pokémon Champions badges and eligible-Pokémon Trainer Titles.

It owns migrations 435–436. Its hosted security, CodeQL, secret-scan, and
Vercel checks passed. The collectible-form generator was made newline-safe
after the stacked full suite exposed a Windows-only comparison failure.

Pull request [#309](https://github.com/roblebaegaming/DraftCenter/pull/309) was
released after #308. It adds:

- a ten-day exact-theme cooldown for Pokémon Connections beginning August 19;
- four different theme categories per board;
- base-species-aware boards with no consecutive-day Pokémon;
- seven-day reuse weighting while preserving every previously playable board;
  and
- one base species per ordinary Daily Draft Bracket, with the earned Sunday
  Super Bracket intentionally exempt.

Migration 437 repairs only untouched future ordinary brackets. It never
rewrites the current day, historical results, submitted brackets, or Sunday
qualifiers.

The combined 435–437 stack passes the full application suite, 1,027-row
National Dex verification, production dependency audit, migration-history
gate, focused Daily Games tests, release integration, and a 316-page
production-style build. Hosted security and Vercel checks pass for both pull
requests.

Both pull requests are deployed. The owner approved deletion of obsolete
nonpersistent branch `pokedex-home-completion-2026-08-13` and temporary Preview
usage at the confirmed $0.01344/hour starting rate. The obsolete branch was
deleted and confirmed absent.

The first disposable Preview exposed a real migration-435 SQL output-alias
failure. The migration and its focused source test were corrected before any
Production change. A fresh sequential Preview then replayed the deployed
baseline, applied the missing 433–434 baseline migrations, and validated 435,
436, and 437 immediately followed by each migration's rollback-only regression.
The matrices covered two-account privacy, grants, forced RLS, collection and
restore, Champions progress, postgame counts, forms, marks, Pokémon GO, hunt
targets, ordinary-bracket species variety, and the Sunday exception.

Fresh advisors found only intentional RPC-only RLS-without-policy notices and
authenticated account-scoped security-definer notices among the new private
surfaces. Covering indexes were added for the newly reviewed composite foreign
keys. The paid Preview was deleted and confirmed absent, so no hourly charge
continues. Migrations 435–437 were then applied forward-only to Production,
#308 merged at `6326fbf326f055b0a94e499f0b1cca3dc6e03f42`, #309 merged at
`31e9d5691c69e166a381ced4999479097a6b5378`, and both exact deployments passed
the complete 22-check signed-out Production smoke sweep.

## Competitive landscape reviewed August 18

This is a directional product review of public claims, not an exhaustive audit
or a statement about private usage, reliability, or customer counts.

| Product | Public wedge | Competitive lesson for DraftCenter |
| --- | --- | --- |
| [Drafteon](https://drafteon.com/) | Complete league lifecycle, automatic schedules and playoffs, Showdown replay import, cross-league analytics, and a $5 Pro tier | Replay-to-result automation and one clear commissioner promise are the most important direct threats. |
| [DraftDex](https://draftdex.net/) | Guided VGC/Champions league lifecycle, live drafting, free agency, matchup planning, playoffs, and replay-linked results | A simple six-step journey can feel easier than a broader platform even when DraftCenter supports more formats. |
| [Metronome](https://www.pkmndraftleague.com/) | No-login live drafts and AI mock drafts, with editable points and current regulations | Near-zero setup and immediate practice are powerful acquisition wedges. |
| [BattleIQ](https://battleiq.ca/) | Focused team building, matchup summaries, speed tiers, and preparation guidance | Team Lab must reach useful matchup insight faster and explain its output more clearly. |
| [TopCut VGC](https://topcutvgc.com/) | Champions-first native app, legality, teams, calcs, training, ranked ladder, achievements, and creator discovery | Do not chase a separate general Champions ladder. Keep Champions as a first-class format inside DraftCenter's league and preparation loop. |
| [PokeReplicas](https://pokereplicas.com/) | Native Champions team discovery, Replica codes, team building, speed tools, and a large creator/team library | Do not compete head-on for replica-team inventory. Integrate league-ready Champions workflows and preserve DraftCenter's private-planning advantage. |

### What competitors are doing well

1. They lead with one sentence and one first action.
2. Several explicitly replace spreadsheet work.
3. Drafteon automates Showdown replay ingestion and resulting statistics.
4. Metronome removes account friction for the first live or mock draft.
5. Champions-focused products publish regulation-specific utility and ship on
   mobile app stores.
6. Focused products make their useful path obvious even when their total
   feature surface is smaller.

### DraftCenter advantages to protect

1. **Full organizer lifecycle:** snake, budgeted snake, auction, server-owned
   bot auctions, transactions, schedules, Swiss, single and double elimination,
   Draft Tournaments, recovery, organizations, and connected championships.
2. **Organizer-to-player continuity:** a league roster can flow into private
   Team Lab, opponent scouting, open or closed sheets, Battle Room, performance
   history, and workbook export.
3. **Trust and portability:** private-by-default data, RLS-backed boundaries,
   backups, readable exports, spreadsheet workbooks, recovery records, and
   explicit source quality gates.
4. **Multiple acquisition and retention surfaces:** Daily Games, predictions,
   public Pokémon research, collection tracking, Nuzlocke tools, Worlds, and
   organization discovery can bring users back between league actions.
5. **Format breadth:** singles, doubles, historical generations, Champions,
   Legends, VGC regulations, Mega Evolution, Tera, and custom pools can share
   one account and data model.

Breadth becomes an advantage only when the first-run path stays simple. Hidden
capability does not win adoption.

## The work that really matters

### Completed prerequisite: ship the protected stack

This is complete. Migrations 435–437 passed sequential Preview validation,
#308 and #309 merged in order, both Production deployments completed, and both
signed-out smoke sweeps passed. The collection, Champions,
Connections-variety, and ordinary-bracket-form requests are live.

### Priority 0: make the product understandable in under one minute

DraftCenter needs one commissioner-focused landing and activation path with a
single primary action: **Run a league**. It should explain the lifecycle in no
more than five steps and then offer a safe practice league or guided setup.

Required decisions and work:

- choose and consistently use one public brand between **DraftCenter** and the
  `draftcentral.gg` domain;
- make the global home page state the primary league promise before listing
  adjacent tools;
- separate **Run a league**, **Join a league**, and **Prepare for a match**;
- provide format presets with plain-language recommended defaults;
- add a setup checklist that ends at a scheduled or started draft; and
- measure time from landing to league creation, first invite, draft scheduled,
  draft started, and draft completed.

The goal is not fewer capabilities. It is one obvious path through them.

### Priority 0: build the switching wedge

The most valuable acquisition feature is a safe **Move my existing league to
DraftCenter** workflow. Commissioners already using a spreadsheet or Discord
have the strongest need but the highest switching cost.

Start with an import specification before implementation:

- CSV/TSV paste or upload for managers, teams, draft pools, costs, and current
  rosters;
- a preview-and-map step with no writes until the commissioner confirms;
- duplicate, unknown-form, capacity, and privacy validation;
- a downloadable error report instead of partial silent imports;
- safe support for a new season before attempting historical reconstruction;
- exact rollback or deletion behavior for a failed import; and
- a practice-only import walkthrough.

Do not promise arbitrary Google Sheet compatibility. Publish one documented
template first, then add reviewed adapters based on real commissioner files.

### Priority 0: automate Showdown replay results

Drafteon's public replay importer is the clearest direct feature gap. A
DraftCenter importer should accept a Showdown replay URL, fetch immutable
battle data server-side, show the proposed match and game results, and require
authorized confirmation before changing league records.

The first release should:

- support reviewed Showdown singles and doubles replay formats;
- verify participants against the scheduled matchup;
- extract score, winner, Pokémon brought, KOs/faints, and replay provenance
  only when the source supports them;
- detect duplicate replay submissions and conflicting results;
- keep manual cartridge entry available;
- never infer an authoritative result from a timed-out or malformed fetch;
- preserve the existing correction, audit, and commissioner authority model;
  and
- optionally seed private Battle Room post-set facts only with the manager's
  explicit action.

Do not build a game-client reader or claim automatic cartridge capture.

### Priority 0: recruit lighthouse commissioners and measure activation

The next moat comes from completed seasons and trusted commissioner references,
not more anonymous feature inventory.

After exact owner approval of the audience and destination, recruit five to
eight commissioners representing small friend leagues, established Discord
leagues, VGC/Champions, singles, and at least one auction or larger event.
Offer concierge setup and collect structured feedback at creation, draft,
first result, and season completion.

Run the already scheduled aggregate-only attribution review at 09:00 Pacific
on August 19. Then establish these product metrics:

1. leagues created that reach a scheduled draft;
2. leagues that complete a draft;
3. leagues that record a first matchup result;
4. leagues active in weeks two and four;
5. completed seasons;
6. median time to first draft and first result;
7. commissioner setup abandonment by step;
8. manager weekly active use of roster, matchup, and schedule surfaces; and
9. import and replay-processing success/failure rates.

The north-star metric should be **active leagues progressing through a real
season**, supported by manager retention. Raw accounts and page views are
diagnostics, not the goal.

### Priority 1: turn weekly league activity into a retention loop

Once activation is clearer, make the account home answer three questions:

1. What do I need to do next?
2. When is my next match, draft, or deadline?
3. What changed in my league since I last visited?

Build on existing Calendar, notifications, Discord separation, and organization
email. Prefer a private weekly agenda, pending action cards, commissioner
health checklist, optional digest, and installable-PWA reminders. Every message
must respect opt-out, scope, and rate limits.

### Priority 1: publish proof, not only feature announcements

The current promotion package is ready, but growth should add evidence:

- one complete practice league walkthrough from creation through champion;
- one Auction Draft Tournament demonstration for 32 managers;
- short commissioner case studies with measured setup time and saved work;
- a public comparison of workflows, without unverifiable competitor claims;
- current screenshots and a 60–90 second product tour; and
- SEO pages centered on commissioner intent such as Pokémon draft league
  manager, auction draft, league spreadsheet alternative, and Showdown replay
  statistics.

External publication, tester outreach, partner messages, and case-study
requests require owner approval of the exact audience and destination.

### Priority 1: complete reliability and portability proof

Keep the existing product-roadmap hardening work ahead of another platform
expansion:

- exercise a documented restore drill with the owner as restore approver;
- verify exports for completed snake, budgeted, auction, playoff, archived, and
  second-season leagues;
- expose backup/export status in plain language;
- keep account-owned data export complete and restorable; and
- add product-level monitoring for draft mutations, replay imports, result
  confirmation, notifications, and export failures.

Competitors can copy a screen faster than they can copy a proven trust record.

### Priority 2: create a privacy-safe data advantage

DraftCenter already has league usage, win-rate, matchup, move, and profile
foundations. After adoption grows, publish useful aggregates only above the
existing privacy thresholds and with clear sample size, format, generation,
date range, and source explanation.

Do not expose private teams, small-cohort behavior, identities, unpublished
lineups, or cross-league scouting. The goal is a trusted draft metagame
reference, not surveillance.

### Priority 2: evaluate native packaging and DraftCenter Plus only after use

TopCut VGC and PokeReplicas make native distribution a visible competitive
factor. DraftCenter should first make its focused apps excellent installable
PWAs and measure repeated mobile use. Native packaging is justified only when
retention, notifications, store discovery, or device integration has a clear
measured benefit.

Do not add billing now. If sustained use and commissioner research support a
paid offer, test one shared DraftCenter Plus proposition manually before adding
Stripe, entitlements, a paywall, or native-store billing. Never retroactively
gate user data, export, restore, or core league access.

## What not to chase now

- Do not build a general Pokémon Champions ranked ladder; TopCut VGC is already
  specialized there and it does not strengthen DraftCenter's league wedge.
- Do not build a large Replica-code team marketplace; PokeReplicas is focused
  on that network and inventory.
- Do not add another broad tracker, quiz, bracket variant, or language before
  current activation and retention are measured.
- Do not start native apps merely to match a competitor's distribution badge.
- Do not add AI coaching that presents generated advice as authoritative battle
  or legality data.
- Do not weaken privacy thresholds to make public statistics look larger.
- Do not create payments, ads, sponsorship promises, or external invitations
  without the existing evidence and owner-approval gates.

## Recommended 30-day execution order

### Completed August 18 prerequisites

1. The exact old-Preview deletion and $0.01344/hour confirmation were obtained.
2. Migrations 435–437 passed the sequential disposable-Preview matrix.
3. #308 and #309 were merged and released in order.
4. Production postflight and both signed-out smoke sweeps passed.

The next scheduled operational step is the August 19 aggregate attribution
review.

### Days 3–7

1. Decide the canonical public brand and homepage promise.
2. Map the commissioner activation funnel and current abandonment points.
3. Write the import-template and Showdown replay-ingestion contracts.
4. Select five to eight lighthouse commissioner candidates for owner review.

### Days 8–14

1. Release the commissioner landing, presets, practice path, and setup
   checklist without adding a migration unless evidence requires one.
2. Test first-run setup with the approved lighthouse group.
3. Publish one current product tour using only synthetic or approved data.

### Days 15–30

1. Build the reviewed league import slice.
2. Build the smallest safe Showdown replay importer and confirmation flow.
3. Add weekly next-action and league-health surfaces.
4. Publish the first approved commissioner case study.
5. Review activation, week-two retention, and support burden before choosing
   the next feature.

## Owner decisions required

1. Choose the canonical public naming direction: DraftCenter, DraftCentral, or
   an explicitly documented relationship between product and domain.
2. Approve the exact lighthouse commissioner audience and outreach destination.
3. Confirm that Showdown replay import is the next engineering priority.
4. Decide whether concierge migration from a real league spreadsheet may use a
   redacted owner-approved example as the first import template.

## Administrative cleanup

Pull request [#140](https://github.com/roblebaegaming/DraftCenter/pull/140) is a
stale Worlds monitoring handoff. Verify that it contains no unique current
record, then close it as superseded in a separate documentation-only action.
This is not a competitive priority.

The preserved original dirty `DraftCenter` checkout remains quarantined and
must never be pushed, reset, cleaned, or removed wholesale. Start every product
slice from fresh `origin/main` or the explicit protected stack it depends on.

## Permanent boundaries

- Use a short-lived branch and protected pull request for every release.
- Use new forward-only migrations and isolated Preview regression for database
  work; never rewrite or replay an applied migration.
- Never change a real league, draft, roster, result, membership, or provider
  setting merely to demonstrate a workflow.
- Preserve private Team Lab sets, Battle Room records, collection details,
  replay history, communications, predictions, identities, and email addresses.
- Keep PokeEarth paused until the owner directly requests resumption.
- Do not modify Mushroom Cup or the intentionally paused historical Mushroom
  Hut drafts without a direct commissioner request.
- Keep external outreach and publication behind exact audience and destination
  approval.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Previous completion handoff:
  [`DraftCenter-agent-handoff-2026-08-17-backlog-completion-and-cleanup.md`](DraftCenter-agent-handoff-2026-08-17-backlog-completion-and-cleanup.md)
- Product roadmap: [`../product-roadmap.md`](../product-roadmap.md)
- Promotion plan:
  [`../promotion/DraftCenter-promotion-plan-2026-08-18.md`](../promotion/DraftCenter-promotion-plan-2026-08-18.md)
- Auction Draft Tournament contract:
  [`../auction-draft-tournaments.md`](../auction-draft-tournaments.md)
- Team Lab contract: [`../team-lab.md`](../team-lab.md)
- Data retention and recovery:
  [`../data-retention-and-recovery.md`](../data-retention-and-recovery.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
