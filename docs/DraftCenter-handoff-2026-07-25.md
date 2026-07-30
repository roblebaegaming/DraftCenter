# DraftCenter hardening handoff — 2026-07-25

## July 30, 2026 — optional support launched

- Optional community support is live at `https://www.draftcentral.gg/support`.
- The site links to `https://ko-fi.com/draftcenter`; Ko-fi is connected to PayPal.
- Ko-fi uses US dollars, a $3 minimum, “Tip” wording, no monthly default, and Contributor mode off. Stripe, membership tiers, and paid DraftCenter features are not enabled.
- The support page promises no paywall, recurring commitment, or competitive advantage and explains that DraftCenter Pro remains exploratory.
- Vercel Web Analytics is enabled and the application includes `@vercel/analytics` for anonymized, cookie-free page-view measurement. Treat `/support` visits as the initial interest signal; no paid-plan conversion event exists yet.
- The privacy and third-party-service disclosures cover Vercel Web Analytics and Ko-fi.
- Production deployment completed successfully with all 43 routes, including `/support`.
- End-to-end payment verification passed July 30, 2026: Ko-fi recorded a one-time $3 tip and confirmed that the payment went to the connected PayPal account.

## Mission and product constraint

DraftCenter is in feature freeze. Protect the complete league lifecycle before
adding broad new utility:

1. pre-draft setup and permissions;
2. a reliable draft under every supported commissioner setting;
3. regular-season schedules, results, transactions, and reconnects;
4. every playoff format;
5. a durable archive and safe next-season rollover.

Prioritize correctness, privacy, permissions, mobile usability, data integrity,
performance, monitoring, backups, and recovery. Preserve existing work and keep
drafts, queues, roster constraints, match history, playoff history, and league
history server-authoritative.

The owner has separately confirmed the older migration 085, the older four-file
deployment, Vercel Ready status, and Weekly/Tournament planning verification.
The owner later said the recovery/monitoring batch was deployed. This handoff
does not independently verify the live Supabase or Vercel state.

## Important desktop stability warning

Do **not** open or sign in to Supabase through the Codex/ChatGPT in-app browser.
It repeatedly crashed the desktop app for the owner. Supabase dashboard checks,
backup verification, migration execution, and restore drills must be performed
by the owner in a normal external browser. Local repository inspection and
builds are safe.

## Repository locations and workflow

- Codex working copy:
  `C:\Users\rober\Documents\Codex\2026-07-22\files-mentioned-by-the-user-draftcenter\DraftCenter-work`
- Deployment repository:
  `C:\Users\rober\Documents\DraftCenter-github`
- Deployment branch: `main`
- Baseline commit before this uncommitted batch:
  `7d1ce5f Add private recovery exports and health monitoring`

Always inspect both repositories before editing. They are separate copies.
Never assume the Codex working copy is live. Preserve unrelated changes.

Every code batch must end with:

```powershell
$env:NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL='https://example.supabase.co'
$env:NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY='sb_publishable_placeholder'
npm run build
```

Never say a change is live until the deployment repository has been pushed and
Vercel production reports Ready.

## Current uncommitted batch

This batch exists locally and is **not confirmed deployed**:

- `src/components/PokemonDraftLeague.jsx`
- `supabase/089-live-snake-lifecycle-safety.sql`
- `supabase/090-all-playoff-result-paths.sql`
- `supabase/091-server-authoritative-member-transactions.sql`
- `supabase/092-atomic-season-rollover.sql`
- `supabase/093-atomic-team-owner-preferences.sql`

Run migrations in numeric order, then deploy the React file. Do not deploy the
React file before its RPC migrations are available.

### What the batch fixes

#### Pre-draft validation

- Adds a shared readiness audit before a draft can start.
- Rejects invalid team counts and league size mismatches.
- Rejects blank/duplicate team names and duplicate manager claims.
- Validates roster minimum/maximum, budgets, manual snake order, unique pool
  IDs/names, keeper legality, duplicate keepers, and keeper limits.
- Rejects drafts whose eligible pool is too small.
- Rejects auction or budgeted-snake settings that cannot mathematically reach
  the roster minimum.
- Shows the concrete issues in Setup and disables Start until they are fixed.

#### Hosted live snake draft

- Migration 089 provisions the official session, relational teams, eligible
  Pokémon, keepers, order, and started snapshot in one transaction.
- Keepers now count toward the team target instead of causing extra snake picks.
- Hosted keepers are supported instead of explicitly blocked.
- Pause/resume and expired-turn advancement are authoritative RPCs.
- Overnight pause reconciliation now updates the official snake session too.
- Restricted and Mega flags are persisted and checked server-side.
- `make_snake_pick` now validates roster size, budget, restricted cap, Mega cap,
  ownership, and availability under a row lock.
- Each official pick now materializes rosters, budgets, pool, pick index,
  deadline, and revision into the league snapshot. This closes a serious
  draft-to-season handoff gap where relational picks were official but the
  season snapshot could still contain only keeper rosters.
- Hosted auto-draft attempts are limited to the commissioner for unclaimed bot
  teams and the owner/commissioner for claimed auto-draft teams, reducing
  duplicate simultaneous attempts from every open browser.

#### Playoffs

- Migration 090 adds one permission-checked atomic result path for basic,
  winners, losers, grand-final, division, and champion brackets.
- Manager reporting now works beyond the basic bracket instead of falling back
  to a commissioner-only whole-snapshot save.
- Validates membership, participant ownership, bracket path, seeded teams,
  best-of score, Pokémon-alive totals, HTTPS replay URLs, and MVP membership on
  the winning roster.
- Saves the matchup participants with the result so later edits cannot silently
  change the pairing.
- Corrects division-pyramid wrappers that were dropping best-of and MVP values.
- The match editor now waits for the save and remains open on failure.
- Execute permission is removed from the older, weaker playoff result RPC.

#### Season transactions and manager permissions

- Migration 091 makes hosted instant free agency, claim submission/withdrawal,
  trade proposal/cancellation/response, roster limits, roster caps, budgets,
  ownership, deadlines, and transaction limits atomic and server-validated.
- Managers no longer depend on the commissioner-only snapshot save for these
  ordinary team actions.
- Free-agent drops are returned to the verified pool for later pickups.
- Trade acceptance rejects changed offers, over-cap rosters, overfull rosters,
  and negative remaining budgets.
- Whole-snapshot commissioner saves now reject a state whose revision is not
  strictly newer than the locked server state. This prevents a stale
  commissioner tab from erasing a concurrent result or manager transaction.
- The Transactions screen stays closed until the draft is actually complete,
  not merely started.

#### Atomic season rollover

- Migration 092 atomically validates the appended archive, preserves prior
  archives and team ownership, clears official draft/session rows, saves the new
  season snapshot, resets the relational league status, and records an event.
- The browser no longer clears official draft rows first and then hopes the
  archive snapshot save succeeds.
- Rollover uses revision compare-and-swap, so a stale tab cannot close a season
  after a newer result or transaction lands.
- The confirmation dialog closes only after the transition succeeds.

#### Hosted team-owner preferences

- Migration 093 makes auto-draft, draft strategies, keeper selections, team
  name/logo/color/description, and Draft Day Hero votes permission-checked and
  atomic for hosted leagues.
- This fixes controls that appeared available to managers but previously tried
  to use a commissioner-only whole-state save.

## Verification completed locally

- Both repositories were inspected before editing.
- The deployment repository was clean at baseline commit `7d1ce5f`.
- `git diff --check` passes.
- The final production build passes.
- Next.js generated all 16 routes successfully.
- No in-app browser or Supabase dashboard was opened.
- No migration was executed against production in this task.
- No deployment or Vercel readiness check was performed for this batch.

There is no automated test framework in the repository. Build success verifies
compilation and route generation, not multiplayer or database behavior.

## Highest-risk items still open

Treat these as the next hardening priorities, not optional polish.

### P0 — run the real multi-account lifecycle test

Use separate commissioner, manager A, manager B, and spectator sessions in a
safe league after migrations 089–093 are installed. A build cannot validate RLS,
RPC grants, concurrency, or reconnect behavior.

### P0 — scheduled automation still depends on an open browser

- Scheduled draft start runs in a commissioner browser.
- Unclaimed snake bot teams need a commissioner browser open to auto-pick.
- Automatic claim processing runs in a commissioner browser.

Move these to server jobs before promising unattended operation.

### P0 — FAAB bid privacy

Pending claims, including `bidAmount`, remain inside the member-readable league
snapshot. Competing managers can inspect bids. Move claims and bids to a private
table with owner/staff RLS, return sanitized claim summaries to other managers,
and process winners server-side.

### P0 — restart and rebuild are not yet atomic

`restartDraft` and `rebuildCurrentSeason` still call
`reset_live_snake_draft` before saving their reset snapshot. Migration 092 fixes
new-season rollover, but these two danger-zone flows need the same one-transaction
pattern. Until then, a failed snapshot save can leave official rows reset while
the old browser snapshot remains.

### P1 — commissioner reversals and claim processing

Commissioner trade/free-agent reversals and bulk claim processing still use a
whole-snapshot commissioner commit. Revision checks prevent silent overwrites,
but dedicated server RPCs would give stronger validation and clearer audit
events.

### P1 — manual/off-platform draft finalization

The manual draft importer silently skips unknown or duplicate Pokémon and relies
on a whole snapshot save. It should show a complete validation report, reject
underfilled/over-budget/over-cap rosters, and use an atomic server transition.

### P1 — playoff pairing derivation

Migration 090 verifies that first-report participants are seeded and the actor
controls one participant, then permanently stores the pair. It does not yet
derive every first-time advanced-bracket pairing entirely from earlier results
on the server. Add server bracket derivation before treating a manipulated
client as fully untrusted.

### P1 — post-report MVP edits

Initial regular-season and playoff reports save MVP data atomically. Some later
MVP-only edit controls still use a whole snapshot commit and can fail for
noncommissioners. Move MVP-only edits onto the result RPCs.

### P1 — manager identity changes

The older `renameMe` path rewrites display-name references inside the league
snapshot. Hosted identity should be account-ID based throughout; profile renames
should not require rewriting history or ownership.

### P1 — backup and restore operations

The repository contains exports, recovery SQL, monitoring, and documentation,
but cannot prove Supabase project backup settings.

Owner-run external-browser checks still required:

- automated database backups enabled;
- retention length recorded;
- restore permissions/access confirmed;
- off-account encrypted backup procedure confirmed;
- a real restore drill completed in a safe test project;
- results and recovery time recorded.

Do not perform these checks in the in-app browser.

## Required multi-account lifecycle matrix

Record pass/fail/evidence in
`docs/multi-account-hardening-test-record.md`.

### Pre-draft

- private/public/invite-only access;
- commissioner, co-commissioner, manager, replacement, and spectator roles;
- team claim and duplicate-claim prevention;
- queue add/remove/reorder privacy;
- team name/logo/color/description permissions;
- keeper selection permissions and costs;
- 2-, 4-, 8-, and 16-team readiness checks;
- random and manual snake order;
- roster minimum/maximum boundaries;
- unbudgeted snake, budgeted snake, and auction;
- restricted/Mega caps of zero, one, and unlimited;
- scheduled draft time and reopen behavior.

### Draft

- two managers attempt the same snake pick simultaneously;
- reconnect from mobile during a turn;
- pause, manual resume, overnight pause, and overnight resume;
- expired human turn, auto-draft owner, and unclaimed bot;
- back-to-back snake turns at a round boundary;
- keeper rosters and remaining pick count;
- budget exhaustion and cap exhaustion skip behavior;
- concurrent auction bids and timer expiry;
- final pick immediately hands correct rosters/budgets/pool into season screens.

### Season

- generate schedules under every schedule/division setting;
- both participants report/edit regular-season results;
- replay and MVP validation;
- simultaneous result reports;
- instant add/drop, roster-full drop, budget rejection, cap rejection;
- claim submit/withdraw/process;
- propose/reject/accept/cancel/reverse trades;
- stale commissioner tab cannot overwrite manager activity;
- playoff transaction lock and transaction deadlines;
- spectator cannot mutate.

### Playoffs

- basic bracket;
- double elimination winners, losers, and grand final;
- division brackets and champion bracket;
- every best-of option;
- participant manager reporting;
- unauthorized manager and spectator rejection;
- replay URL, Pokémon-alive, and MVP validation;
- reconnect and simultaneous reports.

### Archive and return

- archive a complete champion season;
- explicitly archive an incomplete season and verify the warning;
- history preserves standings, rosters, schedule, results, playoffs, draft log,
  managers, trades, and MVP data;
- same-rules and new-rules rollover;
- keeper carryover and increased keeper costs;
- official draft rows are cleared only if archive save succeeds;
- start the next draft and complete at least one pick;
- export the league, restore My Teams in a test account, and compare data.

### Mobile/performance

- widths 320, 360, 390, 430, tablet, and desktop;
- Setup navigation, draft board, queue, transactions, match report, playoffs,
  archive, and League Tools;
- slow-network reconnect and failed-save messaging;
- long team names, many claims/trades, 16 teams, maximum legal pool, and several
  archived seasons.

## Deployment order and reporting rules

1. Reinspect both repositories and hashes.
2. Review migrations 089–093 as complete files.
3. In the owner’s normal external browser, run each migration in numeric order.
4. Deploy the exact changed files from the deployment repository.
5. Wait for Vercel production to report Ready.
6. Run the multi-account smoke path before announcing success.
7. Report what was changed, what was actually tested, what is live, and what
   remains unverified.

Whenever SQL is required, provide the complete SQL and the exact instruction:

`Supabase → SQL Editor → New query → paste → Run.`

Whenever deployment is required, provide one complete PowerShell block that
copies every exact changed file, stages them, commits them, and pushes them.

## Product note for later

The owner wants a user calendar for agreed match times plus local and regional
events, integrated with My Teams. Keep it in the post-core roadmap. The current
priority is proving the league lifecycle, recovery, privacy, and unattended
reliability first.
