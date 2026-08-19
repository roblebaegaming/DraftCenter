# DraftCenter agent handoff: Regulation M-B auction demo and Top 8

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Feature commit: `ca1dd680552da833260e1ae60b79903f8ecc1f08`
- Feature pull request: [#333](https://github.com/roblebaegaming/DraftCenter/pull/333)
- Production migration: 440, canonical version `20260819013208`
- Release state: merged, deployed, database-verified, captured, and owner showcase complete

## Outcome

Private Tournament Organizer Demos now present the largest supported Auction
Swiss lifecycle as a complete teaching and sales sandbox:

- one real owner account and 31 clearly labeled synthetic bot seats;
- six Regulation M-B Pokémon per team, with one Mega and five non-Megas;
- a 120-point auction budget with every winning bid, team spend, and remaining
  budget visible in the event recap;
- five Swiss rounds with the final Top 8 highlighted in the standings;
- a seeded, single-elimination Top 8 with four quarterfinals, two semifinals,
  and one final; and
- manual organizer reporting for rehearsal plus bounded fast-forward controls
  for presentations.

The feature remains private, synthetic, resettable, and owner-controlled.
Ordinary tournaments retain their chosen roster size and tournament behavior.

## Completed owner showcase

The completed showcase is intentionally preserved at:

https://www.draftcentral.gg/tournaments/owner-practice-32-manager-auction-swiss-cad8eeca

Exact identifiers:

- tournament: `cad8eeca-b65b-4535-acc8-39461be0f753`;
- event: `e6e2ccf5-1c6f-449c-ab9d-a80af5b62c2a`;
- visibility: private;
- demo flag: enabled; and
- final tournament/event state: complete at event revision 185.

Read-only Production postflight confirmed:

- 32 entrants and 32 teams;
- 192 roster entries and 192 unique drafted Pokémon;
- exactly six Pokémon and one Mega on each team;
- synthetic winning bids from 5 to 35 points;
- team spend from 110 to 112 of the 120-point budget;
- 80 Swiss matches and 160 standings snapshots;
- eight seeded Top 8 entries;
- all seven playoff matches complete; and
- Demo Coach 09 won the generated final 2–0 over Demo Coach 17.

The description and rules now state the six-Pokémon Regulation M-B, auction,
Swiss, Top 8, and synthetic-practice boundaries. Do not reset this showcase
unless the owner explicitly asks to start a new rehearsal.

## Organizer practice path

For a full manual teaching session:

1. Use **Reset demo to check-in** only after the owner approves clearing the
   current completed showcase.
2. Check in the owner and synthetic seats, then lock the field.
3. Run nominations and bids in the hosted auction room. The generated-auction
   control can replace this step when a presentation needs to move quickly.
4. Review all six Pokémon and their winning prices, then lock the rosters.
5. Report Swiss match scores round by round, or use **Complete demo Swiss** to
   generate the remaining results and seed the Top 8.
6. Review the highlighted cut line and the #1-vs-#8, #4-vs-#5, #2-vs-#7, and
   #3-vs-#6 quarterfinal pairings.
7. Report every playoff result manually, or use **Complete demo playoffs** to
   generate all seven matches and preserve the champion view.

No synthetic entrant becomes an account, ordinary membership, or claimable
team owner. Generated prices, pairings, standings, and results must never be
presented as real competition data.

## Presentation captures

The current organizer-ready captures are:

- [Private sandbox overview](../captures/tournament-organizer-demo/regulation-mb-top-cut-overview.png)
- [Highlighted Swiss Top 8](../captures/tournament-organizer-demo/regulation-mb-top-8-standings.png)
- [Six-Pokémon auction recap and prices](../captures/tournament-organizer-demo/regulation-mb-auction-recap.png)
- [Live seeded Top 8 quarterfinals](../captures/tournament-organizer-demo/regulation-mb-top-8-bracket-live.png)
- [Completed Top 8 final](../captures/tournament-organizer-demo/regulation-mb-top-8-final.png)

The older four-Pokémon captures remain as historical evidence of the demo
foundation release, not the current presentation set.

## Validation and release evidence

- Focused draft-tournament suite: 21 of 21 passed.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 Pokémon rows.
- `pnpm audit --prod --audit-level high`: passed with no known vulnerabilities.
- Production build: passed using public browser configuration only.
- Migration 440 passed a disposable rollback-only Supabase Preview matrix for
  authorization, defaults, Regulation M-B configuration, 32 teams, 192 unique
  Pokémon, one Mega per team, budget and price boundaries, 192 roster entries,
  80 Swiss matches, 160 standings snapshots, eight Top 8 entries, seven
  playoff matches, reset cleanup, and ordinary-tournament isolation.
- The paid Preview branch was deleted immediately and confirmed absent.
- Production applied canonical migration version `20260819013208` once.
- Supabase advisors returned zero errors and no migration-specific performance
  finding. The authenticated security-definer warning for the browser-callable
  playoff helper is intentional and bounded by its proven owner checks.
- Pull request #333 passed CodeQL, JavaScript security analysis, secret scan,
  dependency/security audit, and Vercel. The automatic Supabase Preview check
  was canceled only because existing Preview branches occupied the integration
  concurrency limit; the stricter disposable Preview matrix supplied the full
  database proof. Those older branches were not deleted or repurposed.
- Vercel reported the feature commit Ready in Production.
- The complete Production smoke sweep passed: 17 public routes returned 200
  and all five protected endpoints returned 401 while signed out.

## Safety record

- The original dirty workspace was not edited, reset, or cleaned.
- No real tournament, league, entrant, team, draft, or provider setting was
  modified. Production writes targeted only the exact private owner showcase.
- Every lifecycle mutation was preceded by an authoritative state read and was
  guarded by exact tournament, event, owner, privacy, demo, phase, and revision
  checks. No timed-out mutation was replayed.
- The application release used a short-lived branch and protected pull request;
  the remote feature branch was deleted after merge.
- The retained older Supabase Preview branches remain untouched. They require
  exact identification and separate owner authorization before deletion.

## Continuation

1. Show the live completed event and five current captures to the tournament
   operator and gather feedback on the auction, Swiss cut, and playoff flow.
2. Preserve the completed showcase until the owner explicitly wants to reset
   it for a hands-on practice or teaching session.
3. During that future rehearsal, use manual reporting first so the owner can
   learn each organizer surface; use fast-forward only to skip sections already
   understood.
4. Keep future Regulation M-B data or legality changes versioned and do not
   silently rewrite this captured historical showcase.
