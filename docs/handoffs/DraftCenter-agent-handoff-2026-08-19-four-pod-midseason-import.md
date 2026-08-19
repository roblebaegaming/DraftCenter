# DraftCenter agent handoff — four-pod midseason import

Date: August 19, 2026 Pacific  
Production: <https://www.draftcentral.gg>  
Supersedes: the four-pod pending-import sections of the August 18 consolidated
and private Tournament Organizer Demo handoffs

## Outcome

The supplied week-four league is imported and owner-visible in Production as
one private organization with four independent pods. The import was rehearsed
on an owner-approved disposable Supabase Preview, applied exactly once to the
exact Production project, and verified against both source workbooks. The
Preview was deleted immediately afterward; only the Supabase `main` branch
remains and no hourly Preview charge continues.

Live organization:

- [TrickRuby's Trans Charity Draft](https://www.draftcentral.gg/organizations/trickrubys-trans-charity-draft)

Signed-in pod workspaces:

- [Bearemy](https://www.draftcentral.gg/?league=trans-charity-draft-2026-bearemy)
- [Garchomp](https://www.draftcentral.gg/?league=trans-charity-draft-2026-garchomp)
- [Jellicent](https://www.draftcentral.gg/?league=trans-charity-draft-2026-jellicent)
- [Lechuga](https://www.draftcentral.gg/?league=trans-charity-draft-2026-lechuga)

The organization and leagues are private. An authorized signed-in owner or
member should use the workspace links above; the public `/league/<slug>` route
correctly does not disclose a private pod.

## Parallel commissioner-reminder release preserved

The commissioner inactivity reminder release completed before this import and
was not changed by the multi-pod work. Pull request
[#332](https://github.com/roblebaegaming/DraftCenter/pull/332) merged as
`b690c71f23e8b6fa4cf445bff864813b11f95eba` with Production migration 442,
ledger version `20260819040935` (`442_commissioner_inactivity_reminders`). Its
server-only Production kill switch was enabled during the separately
authorized release.

At that release's initial Production send:

- three eligible commissioners received personalized messages containing the
  commissioner display name, current league name, and direct league link;
- the provider confirmed all three deliveries;
- zero reminders remained pending, zero failed, and zero follow-ups existed;
  and
- no commissioner identity, email address, or league identifier was exposed in
  operational reporting or this repository record.

The durable reminder contract remains:

- an initial message can send after seven days without meaningful setup
  activity;
- one final reminder may send 30 days after the initial message's actual
  confirmed delivery;
- meaningful league activity cancels eligibility;
- no third automatic email can send;
- practice leagues are excluded; and
- delivery rechecks league state, commissioner ownership, deduplication, and
  the confirmed destination immediately before sending.

Migration 442's functions are security-invoker with a fixed `public` search
path, deny `anon` and `authenticated`, and allow only `service_role`. The
four-pod import added migration 443 afterward; it did not edit reminder rows,
eligibility, delivery state, provider configuration, or the kill switch.

## Production identities

| Object | Production identifier | Slug |
| --- | --- | --- |
| Organization | `22269752-44e4-401a-9120-394db4d3ca58` | `trickrubys-trans-charity-draft` |
| 2026 season | `21cdd707-5151-4fe9-844f-d76b7a391220` | active season |
| Bearemy | `00b859f3-7455-47d7-afca-53714fd00f8e` | `trans-charity-draft-2026-bearemy` |
| Garchomp | `32d2fdf4-53eb-41e8-bde0-d7edf2f89701` | `trans-charity-draft-2026-garchomp` |
| Jellicent | `298da7a0-3a31-4b5f-a125-a2cbac7e87b9` | `trans-charity-draft-2026-jellicent` |
| Lechuga | `158269bd-a1b4-4e0e-b5e8-4cf43647fa6b` | `trans-charity-draft-2026-lechuga` |

Use these exact identifiers for any future read-only audit or explicitly
authorized correction. Never identify a real league only by its display name.

## Imported season

- One private organization and one active `2026 Season`.
- Four private, eight-team pods and 32 durable team identities.
- Seven-week round robin in each pod, with the current league clock at Week 4.
- Top two teams per pod qualify for the planned eight-team championship path.
- VGC 2026 Regulation M-B, Pokémon Champions, closed team sheets, bring six,
  pick four, best of three.
- Snake draft settings retain a 105-point budget and roster range of 9–11.
- All 32 current seats are unclaimed. Source-manager labels remain visible so
  the correct person can claim later without rewriting historical team data.
- Bot result simulation is disabled because this is imported real history.

### Exact count reconciliation

| Pod | Teams | Current roster entries | Scheduled matches | Recorded winners |
| --- | ---: | ---: | ---: | ---: |
| Bearemy | 8 | 80 | 28 | 11 |
| Garchomp | 8 | 79 | 28 | 12 |
| Jellicent | 8 | 81 | 28 | 8 |
| Lechuga | 8 | 80 | 28 | 16 |
| **Total** | **32** | **320** | **112** | **47** |

Seventeen matches scheduled through Week 4 remain unplayed or lack a recorded
winner. Future scheduled matches remain intact. Production postflight found
zero standing mismatches and zero invalid result carriers.

## Source authority and integrity

Records authority:
<https://docs.google.com/spreadsheets/d/1ruM22i8fjk2VyyuK6H0OgkwYlSj6-dB_RHkKw65YtPI/edit?usp=sharing>

Roster authority:
<https://docs.google.com/spreadsheets/d/1HlIevHAYM-TygpG9m9W_cuDkpyBRrF2X7f56Xl9-qII/edit?usp=sharing>

The newer records workbook is authoritative for draft order, schedule, known
winners, and current records. The roster workbook is authoritative for current
Pokémon rosters. Both draft views in that workbook were reconciled before
normalization.

SHA-256 evidence:

- Records workbook: `5E6AD129246F5FA96E34003ED72A8A2BDEDD5FF154A2243BAAF70EE7F33FD14D`
- Rosters workbook: `D5E9CDC16AA9B1AA8AA8B3A70881A1A006F95BC4F4C97F01A7DD95E1DFE94E23`
- Normalized import manifest: `9b83c9320aa22e3832a318e06b0c22f43bf2e0aed42bfd6d20e7b46bb8a633c8`
- Transactional import SQL: `8955CB4868D37ECAE7935AEB6A6C3BBD6D20A293D20A34C3EB48B1B516A68681`

## Deliberate data boundaries

- The source workbooks provide known match winners but not reliable per-game
  scores. DraftCenter preserves those 47 winners and marks every imported
  result `gameScoreKnown=false`; the UI says the score is unavailable instead
  of presenting an invented 1–0.
- The source preserves current rosters and draft slots, but not a complete
  original pick-by-pick draft history. No missing historical picks were
  fabricated.
- One pod's midseason manager replacement is retained as source-manager versus
  current-roster-manager metadata. Historical wins remain attached to the
  durable team identity. Individual names are intentionally omitted from this
  repository handoff.
- Dropped or inactive managers remain represented by their team history. An
  unclaimed team can later be claimed through the bounded completed-draft claim
  flow without changing its draft position, roster, schedule, or results.
- The operation did not send invitations, create user accounts, publish the
  organization, or expose private member data.

## Release record

Pull request [#345](https://github.com/roblebaegaming/DraftCenter/pull/345),
merged as `09c4af5a5db5182d41bc9e980eb6752cf323e624`, released:

- safe display of historical winners with unavailable game scores;
- visible source-manager labels for unclaimed imported teams;
- tightly bounded completed-draft team claims;
- disabled bot simulation for imported real histories; and
- forward-only migration 443.

Production migration 443 is applied exactly once as ledger version
`20260819090000` (`443_completed_draft_team_claims`). It validates the signed-in
user and league membership, locks authoritative rows, allows only eligible
unclaimed teams in locked/completed drafts, and leaves execution granted only
to `authenticated` and `service_role`.

Pull request [#346](https://github.com/roblebaegaming/DraftCenter/pull/346),
merged as `183ed1f14dfee2e05c5c88a076ce67b0815bfda5`, routes a private
organization's pod buttons to the signed-in league workspace while preserving
the public route for public organizations.

## Validation evidence

Before the Production write:

- dependency audit passed with no known high-severity Production issue;
- complete application suite passed;
- National Dex validation passed all 1,027 rows;
- optimized Production build passed with 326 routes/pages;
- the full migration chain, import, completed-draft claim, replay rejection,
  rollback, RLS, grants, and advisor checks passed on the disposable Preview;
- the Preview import transaction rolled back cleanly and its branch was
  deleted before the Production import.

After the Production write:

- exact organization, pod, team, roster, schedule, result, standing, current
  week, commissioner-membership, and unclaimed-seat counts passed;
- all 47 imported winners have `gameScoreKnown=false`;
- invalid winner carriers: zero;
- standing mismatches: zero;
- RLS is enabled on every involved table;
- the completed-draft claim function has no anonymous or `PUBLIC` execute
  grant;
- Supabase security-advisor errors: zero;
- Supabase performance-advisor errors: zero; and
- no import-specific advisor finding was introduced.

After both application releases:

- all required pull-request Vercel, CodeQL, full-history secret, dependency,
  and security checks passed;
- Vercel reported exact application behavior commit `183ed1f` Ready;
- the live private organization exposed all four corrected workspace links;
- all four live pod workspaces loaded `SYNCED`, showed Week 4, retained
  Regulation M-B rules, and displayed their imported standings; and
- the complete 22-check signed-out Production smoke sweep passed.

## Safe continuation

1. Keep the organization private until the owner explicitly chooses a
   different visibility.
2. Let managers claim their existing team identity when the owner is ready;
   do not recreate teams or replay the import.
3. If a source correction is needed, compare it against the hashes and exact
   Production identifiers above, inspect the authoritative row first, and use
   the smallest reviewed forward correction.
4. Do not invent missing game scores, historical draft picks, or manager tenure.
5. Build the eight-team championship only when qualification is final or the
   owner explicitly requests a rehearsal based on current standings.
6. Preserve the original dirty checkout and continue release work from a clean
   branch based on current `origin/main`.

## Related records

- [Current status](../CURRENT-STATUS.md)
- [Previous consolidated handoff](DraftCenter-agent-handoff-2026-08-18-latest-production-continuation.md)
- [Multi-pod commissioner workspace handoff](DraftCenter-agent-handoff-2026-08-08-multi-pod-commissioner-workspace.md)
- [Permanent repository rules](../../AGENTS.md)

When this handoff conflicts with an older statement that the four-pod league
was not imported, this handoff, the current Production state, and the verified
database ledger take precedence.
