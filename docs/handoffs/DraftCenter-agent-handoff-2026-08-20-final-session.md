# DraftCenter agent handoff — August 20, 2026 final session

Date: August 20, 2026 Pacific  
Production: <https://www.draftcentral.gg>  
Production branch: `main`  
Verified Production application commit: `7f2236a27961de63ff48f6adeae88c5d1245a527`  
Latest applied Production migration: 453 (`20260820040500`)

## Outcome

The live competitive-workflow priorities from the August 19 continuation have
largely been released. Midseason retirement, tournament operator workflows,
private practice entrants, 4–32 player snake and auction Draft Tournaments,
direct auction nomination, stable private auction queues, completed-draft
commissioner claiming, league-scoped manager setup, all-week opponent prep,
consolidated navigation, four-field UTM campaign links, the Worlds operational
readiness audit, and explicit owner Operations navigation are all on current
Production `main`.

The final application release was protected pull request
[#369](https://github.com/roblebaegaming/DraftCenter/pull/369), merged at exact
commit `7f2236a27961de63ff48f6adeae88c5d1245a527`. Vercel reported that exact
commit Ready. The complete 22-check signed-out Production smoke sweep passed,
including the expected `401` boundary for unauthenticated Operations APIs.

This handoff is documentation-only. It makes no application, database,
Production-data, provider, secret, environment, invitation, advertising, or
payment change.

## Releases completed in this continuation

### Participant and tournament lifecycle

Pull request [#349](https://github.com/roblebaegaming/DraftCenter/pull/349)
released the seven forward migrations numbered 444–450 and their application
workflows:

- league teams can retire after an explicit week or Swiss round without
  rewriting completed results or standings history;
- tournament entrants can drop or be disqualified with explicit unresolved-
  match handling and exclusion from later Swiss rounds or Top Cut;
- reactivation fails safely after later competition depends on the inactive
  state;
- operators and participants have clearly separated tournament views;
- regulation, registration close, check-in opening, event start, next action,
  and draft-board access remain visible;
- pre-event manual seeding is removed from Draft Tournaments;
- private operators can add clearly labeled synthetic entrants, and capacity
  is a ceiling rather than a required quota;
- snake and auction Draft Tournaments both support 4–32 entrants; and
- operators have separate archive and guarded permanent-delete actions.

The detailed implementation and Preview evidence remain in the
[participant-retirement handoff](DraftCenter-agent-handoff-2026-08-19-participant-retirement.md).
The paid disposable Supabase Preview used for this release was deleted after
regression testing; the Production ledger currently ends at migration 453.

### Auction rehearsal and queue behavior

Pull requests [#358](https://github.com/roblebaegaming/DraftCenter/pull/358),
[#361](https://github.com/roblebaegaming/DraftCenter/pull/361), and
[#362](https://github.com/roblebaegaming/DraftCenter/pull/362) released direct
auction nomination, the empty-league initialization correction, and stable
private auction queues.

The owner-approved signed-in rehearsal used a separate private practice league
with five bots. Direct nomination worked without consuming the queued Pokémon,
the private queue stayed visible through polling and turn handoff, and the
server-controlled auction continued. That disposable practice league is now
private, archived, and has no active draft. The preserved completed 32-manager
Auction Swiss showcase was not reset or modified.

This was an auction draft-room rehearsal, not a complete new Tournament
Operator Swiss-to-Top-Cut rehearsal. If the owner still wants that exact
organizer exercise, create another private practice tournament and leave the
preserved showcase untouched.

### Four-pod claiming and league managers

Pull request [#365](https://github.com/roblebaegaming/DraftCenter/pull/365)
lets a commissioner or owner claim one eligible unclaimed team after a draft
is complete from Setup. The claim preserves the historical team, roster,
schedule, results, and draft position. Active-draft and retired-team guards
remain in place.

Pull request [#366](https://github.com/roblebaegaming/DraftCenter/pull/366)
adds a Setup workflow for a **League Manager**, backed by the existing
co-commissioner authority boundary. A League Manager can administer the
specific league to which that account is added. This is deliberately
league-scoped: adding someone to Bearemy does not automatically grant Garchomp,
Jellicent, or Lechuga. To give one person all four pods, add that account as a
League Manager in each pod separately.

The owner reported that a first invitation was sent and appeared to work. That
is useful user evidence, but it is not authorization for broad invitations and
does not prove every pod/account combination. The imported organization stays
private. Its exact source and Production identifiers remain in the
[four-pod import handoff](DraftCenter-agent-handoff-2026-08-19-four-pod-midseason-import.md).

Safe invitation order remains:

1. obtain approval from the outside commissioner/owner;
2. verify one controlled second account can accept and claim exactly the
   intended existing team;
3. invite one or two known managers in different pods and confirm their pod
   visibility and claim behavior; and
4. only then share more broadly with approved participants.

Do not recreate teams, replay the import, publish the organization, fabricate
missing scores, or invent historical draft picks.

### Team Lab opponent preparation

Pull request [#367](https://github.com/roblebaegaming/DraftCenter/pull/367)
lets a manager open Team Lab preparation for any scheduled opponent, not only
the current displayed week. The league remains the navigation context, the
opponent roster is pulled into the private matchup workspace, and the manager
can scout or write notes ahead of time without leaving the league flow.

### Navigation, UTM standard, and Worlds readiness

Pull request [#368](https://github.com/roblebaegaming/DraftCenter/pull/368)
released one consolidated global navigation system across desktop and phone.
It also released the privacy-safe four-field campaign contract:
`utm_source`, `utm_medium`, `utm_campaign`, and `utm_content`. Ready link
examples and naming rules are in the
[campaign link standard](../promotion/campaign-link-standard-2026-08-20.md).
No campaign, billing, audience, budget, publication, or spend was changed.

The same release recorded the August 20 read-only
[Worlds VGC operational readiness audit](../worlds-vgc-operational-readiness-audit-2026-08-20.md).
The feed and Top Cut systems are healthy and fail closed. Feed permission,
exact provider configuration, a reviewed Preview import, and the official Top
Cut field remain external live-window gates. GO Meta Picks must remain closed
until an official eligibility pool is reviewed.

### Owner Operations navigation

Pull request [#369](https://github.com/roblebaegaming/DraftCenter/pull/369)
gives the server-verified owner two clear desktop routes to Operations: the
Tools menu and the owner account menu. It also consolidates formerly
overlapping account actions into one dropdown.

On phones, the verified owner receives a sixth bottom-bar destination named
**Operations** between Tools and More. Signed-out and non-owner accounts retain
the normal five-item bar with no Operations link. Visibility is driven by the
existing server-verified owner access response, not by a user-controlled
display name. The Operations APIs retain their independent server-side owner
gate.

Automated owner/non-owner navigation coverage and the hosted signed-out phone
review passed. The owner should still perform one simple real-session check on
Production: sign in as `roblebae`, refresh at phone width, confirm the sixth
Operations item appears, and open it. Do not use another account as an owner
test or widen the owner allowlist merely to test the button.

## Validation at final Production commit

Before merge:

- `pnpm audit --prod --audit-level high` reported no known vulnerabilities;
- `npm run test:all` passed completely;
- `npm run test:national-dex` verified 1,027 rows;
- the configured `npm run build` compiled and prerendered all 335 pages;
- focused owner/navigation regression coverage passed;
- `git diff --check` passed; and
- Vercel, CodeQL, JavaScript security analysis, dependency/security checks,
  the full-history secret scan, and Preview deployment all passed.

Supabase Preview correctly skipped for pull request #369 because it contained
no `supabase` change.

After merge:

- Vercel reported exact commit `7f2236a27961de63ff48f6adeae88c5d1245a527`
  Ready in Production; and
- the complete Production smoke sweep passed 17 public routes plus five
  protected-route authentication boundaries.

The build retains the inherited nonfatal dynamic-font status-400 warning for
symbol glyphs; all 335 pages render and the build exits successfully.

## Remaining owner-led work

1. Get outside commissioner approval, then perform the staged four-pod
   invitation sequence above. Broad invitations are not yet authorized.
2. Confirm the `roblebae` Operations button once in a real signed-in phone
   session.
3. Run and observe the owner's real 45-second Battle Room session. Prioritize
   actual evidence about roster collapse/reopen, manual no-action turns,
   pivots, Auto-next, and tap density.
4. If still desired, run a new private Tournament Operator Auction Swiss
   rehearsal through check-in, draft, Swiss, and Top Cut without touching the
   preserved completed showcase.
5. Before the Worlds live window, satisfy the external feed-permission and
   official Top Cut publication gates. Do not infer or invent either state.
6. Use the four-field UTM standard before increasing ad spend. Publishing ads,
   changing billing, or spending money still requires explicit approval.

## Safety boundaries

- Preserve the original dirty checkout. Its uncommitted files are user-owned
  historical work and must never be pushed wholesale, hidden, reset, or
  discarded. Clean isolated branches based on `origin/main` remain the safe
  release path; the dirty checkout does not block Production releases.
- Use a short-lived branch and protected pull request for every release.
- Use forward-only migrations and an isolated Supabase Preview for database
  changes; delete paid disposable branches immediately after regression.
- Begin Production investigations read-only and verify exact identifiers
  before any authorized write.
- Do not modify Mushroom Cup or resume/restart/archive/delete the intentionally
  paused Mushroom Hut drafts.
- Keep PokeEarth paused until the owner directly requests resumption.
- Do not send broad invitations, publish the private organization, start a
  campaign, or change provider configuration without exact authorization.

## Repository state for the next agent

This document was created on branch `codex/session-handoff-20260820-final`
from clean `origin/main` commit
`7f2236a27961de63ff48f6adeae88c5d1245a527`. No application or database file
is changed by the handoff branch. The original dirty checkout remains
untouched.

When this handoff conflicts with an older continuation order, this document,
the current repository state, and verified Production commit `7f2236a` take
precedence.

