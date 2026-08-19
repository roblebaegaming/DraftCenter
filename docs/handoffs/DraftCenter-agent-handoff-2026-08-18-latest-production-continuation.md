# DraftCenter agent handoff: latest Production and continuation

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Final repository record at handoff creation:
  `ba0bd961837938bddca591ae17be2c41b56e90c4`
- Verified Production application and asset commit:
  `2c5c0df7185a82eee9ec56743cf032e993a6e516`
- Latest applied Production migration: 442, canonical version
  `20260819040935`
- Handoff state: documentation-only consolidation; no application, database,
  provider, environment, account, league, tournament, or advertising state was
  changed while creating this record

## Read this first

The August 18 release sequence is complete. The owner-facing 32-manager
Tournament Organizer Demo is live and intentionally preserved. Battle Room's
phone-first four-slot workflow, competitive suggestions, Auto-next option,
compact six-Pokemon roster, reload restoration, and exports are live. English,
Italian, and Spanish Worlds VGC pages use one shared competition and expose the
released bounded leaderboard profiles. The necessary post-release SEO update
is also live.

The most important continuation boundary is that the real week-four four-pod
league has **not** been imported into Production. Its source workbooks were
audited and reconciled, but no organization, season, pod league, manager seat,
roster, schedule, result, or standings row was created. There is therefore no
DraftCenter URL for that league yet.

The immediately preceding request only asked for links. It did not authorize
or perform a four-pod Production import.

## Owner links

### Completed tournament showcase

The preserved private organizer showcase is:

https://www.draftcentral.gg/tournaments/owner-practice-32-manager-auction-swiss-cad8eeca

It is complete with 32 entrants and teams, six Regulation M-B Pokemon per
team, one Mega per team, 192 unique roster entries, visible auction prices and
budgets, five Swiss rounds, a highlighted Top 8, and all seven playoff matches.
Tournament elimination and Top Cut cards show the entrants' Pokemon. The page
is private, `noindex,nofollow`, absent from the sitemap, and must not be reset
unless the owner explicitly requests a new rehearsal.

### League Organizations

The signed-in organization workspace is:

https://www.draftcentral.gg/organizations

This is the product hub, not a link to the planned real four-pod season. The
four-pod season will receive its own organization URL only after a reviewed and
authorized Production import.

## Released Tournament Organizer Demo

Pull request [#333](https://github.com/roblebaegaming/DraftCenter/pull/333)
and migration 440 upgraded the private demo to the largest supported Auction
Swiss teaching path:

- one owner seat and 31 unmistakably synthetic bot seats;
- six-Pokemon Regulation M-B rosters with one Mega per team;
- a 120-point budget with every winning bid, spend, and balance visible;
- five completed Swiss rounds, 80 matches, and 160 standings snapshots;
- a seeded single-elimination Top 8; and
- manual organizer reporting plus bounded practice fast-forward controls.

Pull requests [#339](https://github.com/roblebaegaming/DraftCenter/pull/339)
and [#340](https://github.com/roblebaegaming/DraftCenter/pull/340) added the
six-Pokemon team strip to elimination and Top Cut match cards and repaired the
form-aware artwork fallback. Swiss remains roster-free for scan speed.

Five presentation captures are retained under
`docs/captures/tournament-organizer-demo/`. The current completed-final capture
shows both finalists' teams. These are appropriate for the tournament-operator
walkthrough as long as the synthetic-demo label remains clear.

## Released Battle Room state

The current Battle Room is designed for a 45-second doubles turn:

- Pokemon Champions set editing is EV-only; imported IVs are discarded.
- Reload restores the exact private Team Lab workspace, battle, working draft,
  selected tab, and scroll position when the authoritative report has not
  changed. League draft URLs also preserve the Draft tab.
- Four active cards are shown at once: two opposing Pokemon above and two own
  Pokemon below.
- Pokemon, action, target, switch, and Out/faint controls are directly
  clickable from the field.
- Four move slots remain visible, including empty slots that can be filled when
  an opposing move is first revealed.
- Move, item, and ability inputs provide type-ahead suggestions. Saved and
  revealed facts come first. Ladder-like sessions use current Pokemon
  Champions evidence; online-tournament sessions use the pinned anonymous
  derivative of 737 reviewed open team sheets, with a labeled Champions
  fallback.
- Switch actions retain both the outgoing and incoming Pokemon. Pivot moves
  prompt for the replacement before the sequence is complete.
- Tailwind, Trick Room, Gravity, screens, Aurora Veil, Safeguard, and Mist have
  bounded counters that expire naturally.
- Optional Auto-next advances only after every currently eligible field
  Pokemon has recorded a move or switch. Manual Next turn remains available
  for sleep, flinch, recharge, and other no-action cases that cannot be safely
  inferred.
- Six permanently expanded own-team cards were replaced with a compact roster
  strip. It shows only name and Brought, Benched, or Out, opens a read-only
  saved set on demand, and collapses after both leads are selected.
- Each game has a CSV export and the complete workbook includes the richer
  session, switch, target, timed-effect, rating, replay, and reveal context.

The next useful Battle Room work is real-match testing, not another speculative
redesign. During filming, record the exact game, turn, four active Pokemon,
action sequence, and visible state for any failure or avoidable delay.

## Worlds VGC state

Pull request [#337](https://github.com/roblebaegaming/DraftCenter/pull/337)
and migration 441 made the English, Italian, and Spanish VGC pages explicit
views of the same `2026-vgc-masters` competition. Localization changes the
presentation only; entries, scores, standings, odds, results, and privacy
thresholds are shared.

Clicking a leaderboard coach opens a localized, internally scrollable profile
with only the public username, display name, profile photo, first six favorite
Pokemon, and earned badges. Account IDs, email addresses, timezones, Discord
identifiers, and pre-lock selections remain private.

The public Worlds methodology panel and descriptions under individual odds
were removed as requested. Champion odds remain transparent, editorial,
non-betting predictions. The prepared Instagram image remains a separate
presentation artifact and is not an advertising conversion asset.

## SEO state

Pull requests [#342](https://github.com/roblebaegaming/DraftCenter/pull/342)
and [#343](https://github.com/roblebaegaming/DraftCenter/pull/343) completed the
post-release SEO alignment.

- Public Team Lab metadata describes the released four-slot Battle Room,
  open/closed sheets, fast entry, pivots, timed effects, Auto-next, recovery,
  and exports.
- Public tournament-organizer metadata describes private synthetic rehearsal,
  Auction Swiss, Top Cut, prices, and authorized team previews.
- English, Italian, and Spanish Worlds metadata consistently describes one
  Pick 10 competition, non-betting champion odds, and coach profiles.
- Two authored guides cover Auction Swiss to Top Cut and fast open/closed-sheet
  VGC tracking.
- Refreshed social images render at 1200 by 630.
- Private Team Lab workspaces, saved reports, tournament detail pages, and
  organization administration remain non-indexed and outside the sitemap.

No further SEO change is currently required for these releases. Reassess only
after new public functionality or measured Search Console evidence.

## Commissioner inactivity reminders

Pull request [#332](https://github.com/roblebaegaming/DraftCenter/pull/332)
and migration 442 added a tightly bounded commissioner check-in path for an
otherwise untouched real league after seven days and one final follow-up 30
days after confirmed first delivery. Practice leagues and any league with
qualifying activity fail closed. The notification worker rechecks eligibility
immediately before delivery, and no third message is sent.

The server-only `COMMISSIONER_INACTIVITY_REMINDERS_ENABLED` value is the kill
switch. Unless it is exactly `true`, queueing and delivery remain inert. Do not
change the environment or send messages without an exact owner instruction.

## Four-pod league: audited, not imported

The owner supplied two source workbooks for one active 2026 competition:

- [records, draft order, schedule, and current standings](https://docs.google.com/spreadsheets/d/1ruM22i8fjk2VyyuK6H0OgkwYlSj6-dB_RHkKw65YtPI/edit?usp=sharing)
- [current roster authority](https://docs.google.com/spreadsheets/d/1HlIevHAYM-TygpG9m9W_cuDkpyBRrF2X7f56Xl9-qII/edit?usp=sharing)

The read-only audit established:

- four independent eight-team snake-draft pods: Bearemy, Garchomp, Jellicent,
  and Lechuga;
- 32 teams and 320 current roster entries;
- bring six, pick four, best of three, closed team sheet, and seven weeks of
  pod round-robin play;
- no Pokemon duplicated inside a pod, while cross-pod duplicates are valid;
- nine current-roster differences between the workbooks, resolved in favor of
  the roster-authority workbook;
- 112 scheduled matches, 47 recorded results, and 65 unplayed matches;
- all 32 displayed standings records exactly reconcile to the 47 recorded
  schedule rows; and
- 17 blank matches through week four, which must remain unplayed unless the
  commissioner explicitly classifies them.

The source does not reliably distinguish played results from forfeits or no
contests and does not contain complete departed-manager tenure data. It also
does not provide a complete pick-by-pick draft history. Do not invent any of
those facts.

### Decisions still required before implementation

1. Confirm the organization and season display names.
2. Confirm the effective week of the Garchomp pod slot-seven manager change.
3. Identify every other departed or replacement manager and effective week.
4. Identify any of the 47 recorded results that were forfeits or no contests.
5. Classify the 17 blank matches through week four; the safe default is
   unplayed.
6. Approve importing original draft slots and current rosters without claiming
   unavailable pick-by-pick history.
7. After an isolated Preview succeeds, approve the exact Production
   organization and four pod targets, counts, account-claim plan, and recovery
   snapshot before any Production write.

### Required import behavior

- Preview the normalized organization, pods, teams, rosters, schedule, results,
  standings, and manager-tenure mapping before application.
- Preserve each team as the durable competitive identity when a manager leaves
  or a replacement later claims it.
- Attribute historical results to the team and only to a manager's confirmed
  tenure.
- Keep open teams bot-controlled or unclaimed without fabricating missing
  games.
- Keep the four drafts independent while connecting the pods to one
  organization season.
- Make the operation atomic, revision-aware, retry-safe, RLS-protected, and
  recoverable from an exact pre-import snapshot.

Until these gates are complete, the correct answer to a request for the
four-pod DraftCenter link is: **there is no live link yet**.

## Google Ads boundary

Do not launch Google Ads yet. The current recommendation is to prepare one
small commissioner-focused Search experiment only after the aggregate
attribution review, tournament-operator feedback, conversion and privacy
design, landing page, Keyword Planner forecast, intellectual-property review,
and exact budget approval.

No ad account, Google tag, Analytics property, consent mechanism, billing
method, campaign, audience, or spend is authorized. Do not use the private
tournament showcase as a public ad destination.

## Validation and safety record

The latest public product release passed the dependency audit, complete
application suite, 1,027-row National Dex check, 326-page optimized build,
protected checks, desktop and phone Preview review, and the complete 22-check
signed-out Production smoke sweep. Database releases used forward-only
migrations and rollback-only disposable Preview matrices. Paid disposable
branches were deleted after validation; no hourly charge from those branches
continues.

The original dirty checkout contains substantial unrelated unfinished work and
must not be pushed, reset, cleaned, or used as a release source. PokeEarth
remains intentionally paused. Do not modify Mushroom Cup, the historical
Mushroom Hut drafts, another real league, or provider settings for testing.

## Ordered continuation

1. Use the owner's real Battle Room filming session to test 45-second-turn
   speed, the compact roster, Auto-next on and off, a pivot move, one manual
   no-action turn, and source-ranked suggestions.
2. Show the completed tournament and five current captures to the tournament
   operator. Preserve the event until the owner explicitly requests a reset.
3. Collect the seven four-pod commissioner decisions above and present the
   exact normalized dry-run. Do not write Production yet.
4. Implement and validate the midseason import and team-claim support on one
   isolated Preview only after the mapping is approved.
5. Request explicit approval for the exact Production import targets, counts,
   and recovery plan, then apply once and verify every pod, roster, result, and
   standing before sharing links.
6. Prepare the Google Search experiment package without launching or spending.
7. Keep broad feature work behind complete commissioner-season proof and
   current operational evidence.

## Authoritative follow-up records

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- [`DraftCenter-agent-handoff-2026-08-18-tournament-demo-regulation-mb-top-cut.md`](DraftCenter-agent-handoff-2026-08-18-tournament-demo-regulation-mb-top-cut.md)
- [`DraftCenter-agent-handoff-2026-08-18-battle-lab-compact-roster.md`](DraftCenter-agent-handoff-2026-08-18-battle-lab-compact-roster.md)
- [`DraftCenter-agent-handoff-2026-08-18-battle-lab-auto-next.md`](DraftCenter-agent-handoff-2026-08-18-battle-lab-auto-next.md)
- [`DraftCenter-agent-handoff-2026-08-18-battle-lab-competitive-suggestions.md`](DraftCenter-agent-handoff-2026-08-18-battle-lab-competitive-suggestions.md)
- [`DraftCenter-agent-handoff-2026-08-18-worlds-shared-localized-leaderboard-profiles.md`](DraftCenter-agent-handoff-2026-08-18-worlds-shared-localized-leaderboard-profiles.md)
- [`DraftCenter-agent-handoff-2026-08-18-google-ads-readiness.md`](DraftCenter-agent-handoff-2026-08-18-google-ads-readiness.md)
- [`../seo-review-2026-08-18-post-release-products.md`](../seo-review-2026-08-18-post-release-products.md)
- [`DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md`](DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md)
- [`../../AGENTS.md`](../../AGENTS.md)

When this handoff conflicts with older records, the current Production state,
the latest verified database ledger, and later dated release evidence take
precedence.
