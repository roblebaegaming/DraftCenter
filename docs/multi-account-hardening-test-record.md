# Multi-account hardening test record

Use this record against a safe test league before each major release. Do not use a production league for destructive lifecycle tests.

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

- [ ] A brand-new standard or practice league persists its displayed setup before the first team claim; the first claim succeeds without a manual settings save or refresh.
- [ ] The default legal pool passes stable-ID validation, including the built-in Pokémon whose stable ID is numeric zero.
- [ ] Start Draft shows an in-place progress state, prevents duplicate submission, and displays any server rejection beside the Start button.
- [ ] Hosted snake start reloads saved queues without a client runtime exception and opens the Draft room.
- [ ] Signed-out users cannot read private league, roster, notebook, queue, or planning data.
- [ ] Spectators cannot change league settings, rosters, results, queues, trades, or draft state.
- [ ] Managers can change only their permitted team data.
- [ ] Commissioners can use commissioner tools without exposing those controls to other roles.
- [ ] Private notebooks and account exports contain only the signed-in user's data.
- [ ] A manager removed from a league immediately loses private league access.

## Concurrent draft and reconnect

- [ ] Two managers submit different picks at nearly the same time; only valid server-authoritative picks are accepted.
- [ ] Two sessions attempt the same Pokémon; only one succeeds.
- [ ] Queue changes remain private and correctly ordered.
- [ ] Refresh, background/foreground, network loss, and reconnect recover the authoritative draft state.
- [ ] Commissioner pause, resume, undo, and correction operations remain consistent across connected clients.
- [ ] Draft completion creates the expected rosters and does not leave stale active-draft state.
- [ ] Bot teams value weather enablers and beneficiaries, low-speed Trick Room fits, and proven cross-type partners without repeatedly stacking one type.
- [ ] Bot teams that become heavily physical or special prefer a credible attacker from the opposite side when one is affordable.
- [ ] A transient hosted bot-pick rejection refreshes the authoritative board and retries once; a repeated rejection shows the server error instead of silently freezing.
- [ ] After a human pick, the 300 ms and 900 ms authoritative refreshes do not cancel and permanently suppress the next bot's delayed pick.
- [ ] If a hosted draft snapshot loses its cached `liveDraft.basePool`, refresh reconstructs the available board from authoritative undrafted `league_pokemon` rows without restarting the draft.
- [ ] A randomized snake draft board displays columns in actual first-round order and marks alternating round direction (`→`, `←`).
- [ ] Budgeted snake rejects any pick that would leave less than 1 point for each missing minimum roster slot in both the UI and database.
- [ ] A budgeted snake session cannot enter `complete` while any team is below the configured roster minimum, including after budget exhaustion or turn advancement.
- [ ] At or above the minimum, a budgeted-snake team can finish below the maximum; all of its future turns are removed and other teams continue normally.
- [ ] Unclaimed budget-snake bots finish at stable targets across the configured roster range instead of every bot being forced to the maximum.
- [ ] Draft rules clearly show Restricted and Mega limits, and candidates beyond the current team’s cap are blacked out, labeled, and unselectable.

## Season and transactions

- [ ] Free-agent add/drop obeys roster ranges, deadlines, weekly limits, and season limits.
- [ ] Manager A can see their own pending FAAB bid after refresh and reconnect.
- [ ] Manager B and spectators receive a sanitized pending-claim summary but cannot read Manager A's bid in page data or network responses.
- [ ] Commissioners can see all bids required to process claims; nonstaff cannot call claim processing.
- [ ] Simultaneous claim submission, withdrawal, and processing leaves each claim in exactly one state and never republishes bid amounts in the league snapshot.
- [ ] Claim processing rejects a stale claim set, applies each winning add/drop once, and preserves claims submitted after processing.
- [ ] Trades require the correct participants and cannot move Pokémon a team does not own.
- [ ] Commissioner transaction reversal restores all affected rosters and records an audit entry.
- [ ] Simultaneous roster changes cannot exceed roster limits or duplicate ownership.
- [ ] League spreadsheet export contains current rosters, results, draft log, and archived history.

## Results, playoffs, archive, and new season

- [ ] Only permitted participants or commissioners can submit or correct results.
- [ ] Standings recalculate correctly after result entry and correction.
- [ ] Playoff qualification, bracket progression, ties, and champion selection are correct.
- [ ] Archiving preserves season settings, rosters, results, standings, and draft history.
- [ ] Starting a new season clears only active-season state and preserves archived history.
- [ ] Returning members retain the correct role; removed members do not regain access.
- [ ] Restart Draft rejects a season with competition activity and atomically clears snapshot and official draft rows for a draft-only reset.
- [ ] Rebuild This Season atomically clears draft, schedule, results, transactions, playoffs, private claims, and official draft rows while preserving team ownership and every archive.
- [ ] A stale commissioner tab cannot restart or rebuild after a newer result, transaction, claim, or settings change.
- [ ] A forced reset failure leaves both the snapshot and all official draft rows unchanged.
- [ ] Restart/rebuild succeeds on a snake league with no auction activity, and the required auction-owner relation exists for every deployment.
- [ ] Restart/rebuild and new-season rollover return the relational league status to the canonical `setup` enum value.
- [ ] Restart Draft always opens a confirmation dialog describing cleared and preserved data; Cancel makes no change and Confirm cannot submit twice.

## Mobile and performance

- [ ] Setup, League Tools, My Team, Messages, draft, transactions, and exports work at narrow phone widths.
- [ ] Primary controls are reachable without horizontal scrolling or being covered by fixed navigation.
- [ ] Long team names, league names, Pokémon lists, and messages wrap without hiding actions.
- [ ] Initial league load, draft updates, and roster saves remain responsive on a throttled mobile connection.
- [ ] Failed saves show a useful error and do not display a false success state.

## Recovery and monitoring

- [ ] Account-wide private export downloads and opens as valid JSON.
- [ ] My Teams spreadsheet is readable.
- [ ] My Teams recovery export restores into a separate test account or clean test state.
- [ ] A simulated failed league save creates an operational health event without exposing private payloads.
- [ ] A simulated notification failure creates an operational health event and preserves retry behavior.

## Findings

Record each failure with the account, role, device, exact action, expected result, actual result, screenshot or log reference, and severity.

| ID | Area | Severity | Reproduction | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |
