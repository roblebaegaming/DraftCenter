# Multi-account hardening test record

Use this record against a safe test league before each major release. Do not use a production league for destructive lifecycle tests.

## Validation session — August 1, 2026

- Date: August 1, 2026
- Tester: Codex with the existing `@roblebae` production session
- Build or commit: `13fcd71` plus the production smoke automation added in this validation pass
- Environment: Production (`https://www.draftcentral.gg`)
- Desktop browser: Codex in-app browser
- Mobile browser/device: 390 × 844 responsive viewport
- Safe test league: Mega Test (`mega-test-y1u94`)

Read-only evidence collected in this session:

- Mega Test opens as Season 2 and displays the preserved Season 1 champion archive.
- The Season 2 League Home, Messages, and League Tools surfaces fit without document-level horizontal overflow at 390 px.
- Setup and My Team now match the 382 px content viewport at 390 px after the targeted mobile layout fixes.
- Owner Operations loads successfully and correctly requires commissioner-approved support access for leagues where the owner is not a member.
- Owner Operations reports Mega Test as `DRAFTING`. A direct lifecycle-field check confirmed this is correct: Season 2 is locked, its hosted snake draft is complete, and Season 1 remains archived.
- Mega Test's July 31 automatic recovery point now appears consistently in League Tools and Owner Operations under “Last recovery.”
- A signed-out production sweep confirmed 14 public routes load while five owner/account/recovery APIs reject access with 401.

## Validation session — August 2, 2026

- Date: August 2, 2026
- Tester: Codex
- Build or commit: release candidate including Supabase migrations 239–240 and production deployment `G9KSRDjnq3sUfeYKjRQAutJsDyud`
- Environment: Production (`https://www.draftcentral.gg`)
- Desktop browser: Codex in-app browser plus independent Supabase clients with session persistence disabled
- Safe test league: Multi Account Validation 2026-08-02 (`multi-account-validation-2026-08-02-mt2mx`), permanently deleted after validation
- Accounts: one existing commissioner, two dedicated temporary managers, and one dedicated temporary spectator; all three temporary Auth users were deleted after validation

Evidence collected in this session:

- Creating the practice league initially exposed a real initialization race: the page displayed six saved teams while the server snapshot still contained no teams. Commit `1b42fd8` now initializes an empty server snapshot as soon as league staff first open it. The production retest persisted six teams at revision 1 before invitations were used.
- Two manager accounts accepted the reusable manager invitation and received `coach` memberships; the spectator received a `viewer` membership.
- Two managers claimed the same open team concurrently. Exactly one succeeded, the other received the expected already-claimed rejection, and that manager then claimed a second team successfully.
- Spectator team claims, spectator preference writes, cross-team manager preference writes, cross-team queue reads, spectator queue reads, and direct nonstaff snapshot writes were rejected.
- Manager A's private queue was visible only to Manager A; Manager B's own queue remained empty.
- The live snake draft opened successfully. A concurrent duplicate pick using stable numeric Pokémon ID `0` produced one accepted pick and one rejection, with the authoritative pick count increasing by exactly one.
- A second same-Pokémon race across Manager A and Manager B accepted only the on-clock manager's pick and rejected the out-of-turn request.
- Commissioner pause and resume both worked in production. The new latest-pick undo returned only the latest Pokémon to the pool, restored its roster slot and budget, moved the turn pointer back exactly once, and rejected a stale concurrent undo.
- The hosted snake draft completed through all 36 picks. Every one of the six teams finished with six unique active roster entries, 36 league Pokémon were marked drafted, and the draft session moved to `complete` with no stale active session.
- Manager A completed an instant free-agent add/drop while retaining a six-Pokémon roster. Manager B and the spectator were both blocked from applying the same move to Manager A's team.
- Manager A proposed a one-for-one trade to Manager B. The proposer and spectator were blocked from accepting it; Manager B accepted it, both Pokémon moved exactly once, and both rosters remained at six.
- Manager A and Manager B submitted competing FAAB claims with bids of 31 and 47. Each manager saw only their own bid; the competing bid was `null` for the other manager and spectator, and neither bid appeared in the shared snapshot. A manager could withdraw their own claim but could not withdraw the other manager's claim.
- Season transaction limit, weekly transaction limit, and transaction deadline branches each rejected a new add/drop with the expected server message. The test settings were returned to their prior unlimited state afterward.
- The commissioner processed the remaining FAAB claim once. The winning roster stayed at six and its FAAB balance moved from 100 to 53 for the 47-point bid.
- A five-week round-robin schedule generated from the completed draft. Manager A reported a matchup involving team 0, while Manager B and the spectator were rejected because that matchup did not involve their teams. Manager A corrected the result from 2-0 to 1-2; standings immediately changed to a 2-1 winner and 1-2 loser with matching differentials.
- Manager B's membership was removed while their authenticated session remained active. Private snapshot reads immediately returned zero rows, private queue access was rejected, and their membership list became empty. Restoring the exact membership and team-owner link immediately restored private snapshot access.
- Two fresh clients reconnected to the same authoritative draft state, including matching pick count, turn, rosters, and available pool.
- The private account export downloaded as valid versioned JSON with the expected personal workspace, league memberships, and discussion sections.
- The My Teams spreadsheet downloaded with separate team and planning sheets; both rendered cleanly and the formula-error scan returned no matches.
- The league spreadsheet downloaded with 12 readable worksheets covering current and archived state. Every sheet was rendered and checked for formula errors; manager columns were widened where the visual review found clipping.
- The league recovery JSON restored into the isolated practice league and reproduced all meaningful protected state; only the expected snapshot revision changed.
- The owner-only My Teams recovery function restored both insert and update cases, preserved all 19 supported fields, rejected signed-out use, and prevented one account from restoring over another account's workspace.
- The full competition lifecycle completed: 15 regular-season matches, a four-team playoff bracket, Kano as champion, archive/finalization, and a clean Season 2 rollover that preserved the Season 1 champion and Regulation M-B while clearing current-season activity.
- The latest-pick undo passed commissioner UI, manager rejection, completed-draft reopening, budget/pool/roster restoration, and two-request race tests in production.
- Final cleanup used exact guards before deletion: the practice league verified at zero remaining rows, all three temporary users had zero owned leagues and memberships, and all three then verified absent from Auth.

## Final draft-edge validation — August 2, 2026

- Environment: Production with a new disposable practice league; the league and both disposable managers were removed after the checks.
- A two-manager budgeted snake session used a 10-point budget, roster minimum of two, and roster maximum of three. An opening 10-point pick was rejected because it would leave no point for the missing minimum slot.
- Four legal picks completed the draft with both teams at the minimum of two, both below the maximum of three. Future turns were pruned, the final turn pointer advanced to six, the saved budgets were 6 and 0, and one unaffordable Pokémon remained available.
- The same two accounts then ran a hosted auction with one-slot rosters. A manager could not bid for the other team, an over-budget bid was rejected, a valid competing bid became the leader, and the server resolved the sale after the reset timer.
- The full-roster manager could not bid again. The commissioner safely skipped that full team's nomination turn, the remaining manager completed the second sale, and the auction ended with one Pokémon per team and final budgets of 9 and 8.
- Exact league ID, slug, name, practice flag, and creator checks passed before deletion. The creator owned no other leagues, the second manager owned none, and all three disposable Auth test accounts used in the final Auth/draft pass were removed.

## Test setup

- Date:
- Tester:
- Build or commit:
- Environment:
- Desktop browser:
- Mobile browser/device:
- Commissioner account:
- Manager account A:
- Manager account B:
- Spectator account:
- Signed-out session:

## Permissions and privacy

- [x] A brand-new standard or practice league persists its displayed setup before the first team claim; the first claim succeeds without a manual settings save or refresh. (fixed and production-verified August 2)
- [x] The default legal pool passes stable-ID validation, including the built-in Pokémon whose stable ID is numeric zero. (production live-pick verification August 2)
- [ ] Start Draft shows an in-place progress state, prevents duplicate submission, and displays any server rejection beside the Start button.
- [ ] Hosted snake start reloads saved queues without a client runtime exception and opens the Draft room.
- [x] Signed-out users cannot read private league, roster, notebook, queue, or planning data. (production API rejection plus public-projection/access-policy review, August 1)
- [x] Spectators cannot change league settings, rosters, results, queues, trades, or draft state. (independent production spectator session, August 2)
- [x] Managers can change only their permitted team data. (own-team preference and cross-team rejection verification August 2)
- [x] Commissioners can use commissioner tools without exposing those controls to other roles. (manager and spectator rejection checks, August 2)
- [x] Private notebooks and account exports contain only the signed-in user's data. (owner isolation plus private account-export validation, August 2)
- [x] A manager removed from a league immediately loses private league access. (live-session removal and exact restoration, August 2)

## Concurrent draft and reconnect

- [ ] Two managers submit different picks at nearly the same time; only valid server-authoritative picks are accepted.
- [x] Two sessions attempt the same Pokémon; only one succeeds. (same-session duplicate and cross-account race verification August 2)
- [x] Queue changes remain private and correctly ordered. (independent manager and spectator sessions, August 2)
- [x] Refresh and reconnect recover the authoritative draft state. (two fresh independent clients matched after reconnect, August 2)
- [x] Commissioner pause, resume, and latest-pick undo remain consistent across connected clients. (permission, stale-board, budget, roster, pool, and race checks, August 2)
- [x] Draft completion creates the expected rosters and does not leave stale active-draft state. (36-pick production completion, six teams × six unique Pokémon, August 2)
- [ ] Bot teams value weather enablers and beneficiaries, low-speed Trick Room fits, and proven cross-type partners without repeatedly stacking one type.
- [ ] Bot teams that become heavily physical or special prefer a credible attacker from the opposite side when one is affordable.
- [ ] A transient hosted bot-pick rejection refreshes the authoritative board and retries once; a repeated rejection shows the server error instead of silently freezing.
- [ ] After a human pick, the 300 ms and 900 ms authoritative refreshes do not cancel and permanently suppress the next bot's delayed pick.
- [ ] If a hosted draft snapshot loses its cached `liveDraft.basePool`, refresh reconstructs the available board from authoritative undrafted `league_pokemon` rows without restarting the draft.
- [ ] A randomized snake draft board displays columns in actual first-round order and marks alternating round direction (`→`, `←`).
- [x] Budgeted snake rejects any pick that would leave less than 1 point for each missing minimum roster slot in both the UI and database. (production server rejection and UI rule path, August 2)
- [x] A budgeted snake session cannot enter `complete` while any team is below the configured roster minimum, including after budget exhaustion or turn advancement. (production two-manager minimum-floor pass, August 2)
- [x] At or above the minimum, a budgeted-snake team can finish below the maximum; all of its future turns are removed and other teams continue normally. (both teams completed at two of three slots; future turns pruned, August 2)
- [ ] Unclaimed budget-snake bots finish at stable targets across the configured roster range instead of every bot being forced to the maximum.
- [ ] Draft rules clearly show Restricted and Mega limits, and candidates beyond the current team’s cap are blacked out, labeled, and unselectable.

## Season and transactions

- [x] Free-agent add/drop obeys roster ranges, deadlines, weekly limits, and season limits. (all server branches verified August 2)
- [x] Manager A can see their own pending FAAB bid after refresh and reconnect. (fresh isolated client verification August 2)
- [x] Manager B and spectators receive a sanitized pending-claim summary but cannot read Manager A's bid in page data or network responses. (August 2)
- [x] Commissioners can see all bids required to process claims; nonstaff cannot call claim processing. (commissioner UI processing plus function authorization review, August 2)
- [ ] Simultaneous claim submission, withdrawal, and processing leaves each claim in exactly one state and never republishes bid amounts in the league snapshot.
- [ ] Claim processing rejects a stale claim set, applies each winning add/drop once, and preserves claims submitted after processing.
- [x] Trades require the correct participants and cannot move Pokémon a team does not own. (propose/respond authorization and one-for-one ownership transfer, August 2)
- [ ] Commissioner transaction reversal restores all affected rosters and records an audit entry.
- [ ] Simultaneous roster changes cannot exceed roster limits or duplicate ownership.
- [x] League spreadsheet export contains current rosters, results, draft log, and archived history. (12-sheet download and rendered visual review, August 2)

## Results, playoffs, archive, and new season

- [x] Only permitted participants or commissioners can submit or correct results. (participant save/correction and manager/spectator rejection, August 2)
- [x] Standings recalculate correctly after result entry and correction. (production UI verification, August 2)
- [x] Playoff qualification, bracket progression, and champion selection are correct. (four-team bracket and persisted champion, August 2)
- [x] Archiving preserves season settings, rosters, results, standings, and draft history. (Season 1 archive comparison, August 2)
- [x] Starting a new season clears only active-season state and preserves archived history. (clean Season 2 plus preserved Regulation M-B and champion, August 2)
- [x] Returning members retain the correct role; removed members do not regain access. (removed membership stayed inaccessible until explicit restoration as `coach`, August 2)
- [ ] Restart Draft rejects a season with competition activity and atomically clears snapshot and official draft rows for a draft-only reset.
- [ ] Rebuild This Season atomically clears draft, schedule, results, transactions, playoffs, private claims, and official draft rows while preserving team ownership and every archive.
- [ ] A stale commissioner tab cannot restart or rebuild after a newer result, transaction, claim, or settings change.
- [ ] A forced reset failure leaves both the snapshot and all official draft rows unchanged.
- [ ] Restart/rebuild succeeds on a snake league with no auction activity, and the required auction-owner relation exists for every deployment.
- [ ] Restart/rebuild and new-season rollover return the relational league status to the canonical `setup` enum value.
- [ ] Restart Draft always opens a confirmation dialog describing cleared and preserved data; Cancel makes no change and Confirm cannot submit twice.

## Mobile and performance

- [x] Setup, League Tools, My Team, Messages, draft, transactions, and exports work at a 390 × 844 phone viewport. (production responsive pass, August 1–2)
- [x] Primary controls are reachable without horizontal scrolling or being covered by fixed navigation. (production responsive pass, August 1–2)
- [ ] Long team names, league names, Pokémon lists, and messages wrap without hiding actions.
- [ ] Initial league load, draft updates, and roster saves remain responsive on a throttled mobile connection.
- [ ] Failed saves show a useful error and do not display a false success state.

## Recovery and monitoring

- [x] Account-wide private export downloads and opens as valid JSON. (versioned production download inspected, August 2)
- [x] My Teams and league spreadsheets are readable. (both My Teams sheets and all 12 league sheets rendered without formula errors, August 2)
- [x] My Teams recovery export restores into a separate test account or clean test state. (insert/update, 19-field, signed-out, and cross-owner checks, August 2)
- [ ] A simulated failed league save creates an operational health event without exposing private payloads.
- [ ] A simulated notification failure creates an operational health event and preserves retry behavior.

## Findings

Record each failure with the account, role, device, exact action, expected result, actual result, screenshot or log reference, and severity.

| ID | Area | Severity | Reproduction | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DC-VAL-001 | Season rollover | High | Open Mega Test after its Season 1 archive, then compare League Home with Owner Operations and the lifecycle fields. | The relational status matches the active season's actual phase while prior archives remain intact. | Confirmed: Season 2 is locked, its snake draft session is complete, Season 1 is archived, and `DRAFTING` is therefore the correct active-season status. | Passed — initial finding was a false positive |
| DC-VAL-002 | Mobile layout | Medium | Open Mega Test Setup or My Team at a 390 × 844 viewport. | No document-level horizontal scrolling. | Both pages now have equal 382 px document and viewport widths after targeted fieldset, preset-wrap, legality-grid, and ability-selector fixes. | Passed in production |
| DC-VAL-003 | Recovery monitoring | Medium | Compare Mega Test League Tools recovery history with its Owner Operations card. | Backup/recovery status is consistent or clearly distinguishes the two record types. | Operations now combines manual backup events with automatic and pre-restore recovery snapshots; Mega Test shows its July 31 recovery point under “Last recovery.” | Passed in production |
| DC-VAL-004 | New-league setup persistence | High | Create a practice league, invite managers immediately, and attempt the first team claim. | The displayed six-team setup already exists in the server snapshot. | The initial snapshot had no teams and both claims returned `Team not found.` Commit `1b42fd8` now initializes the setup on first staff open; production retest persisted six teams and both manager claims completed safely. | Fixed and passed in production |
| DC-VAL-005 | Multi-account permissions | High | Use two managers and one spectator against the same practice league, including concurrent claims, cross-team writes, queue reads, and direct snapshot writes. | Only the authorized role and team owner can mutate or read private data. | All negative checks were rejected; the concurrent claim produced one winner; private queues remained isolated. | Passed in production |
| DC-VAL-006 | Hosted snake undo | Medium | Open a live hosted snake draft as commissioner and reverse the latest pick while another client may be active. | Exactly the latest pick is reversed, budget and availability are restored, and stale or unauthorized requests fail. | The production UI and guarded database operation passed manager rejection, completed-draft reopening, exact-state restoration, and a two-request race where only one undo succeeded. | Fixed and passed in production |
