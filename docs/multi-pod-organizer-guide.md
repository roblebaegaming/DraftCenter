# How multi-pod organizations work

Multi-pod organizations let one community run several ordinary DraftCenter
leagues under one shared season and then send qualifying teams to a connected
championship.

```text
Organization
└── Season
    ├── Pod A → its own draft, schedule, standings, and rosters
    ├── Pod B → its own draft, schedule, standings, and rosters
    ├── Pod C → its own draft, schedule, standings, and rosters
    ├── Pod D → its own draft, schedule, standings, and rosters
    └── Championship → qualifying teams promoted with their existing rosters
```

## The normal season flow

1. The organization owner creates an organization and adds trusted
   organization administrators.
2. An administrator creates a season with one shared regulation snapshot,
   qualification rules, and an ordered tiebreaker list.
3. Existing DraftCenter leagues are linked as pods. The person linking a pod
   must be both an organization administrator and staff in that source league.
4. Each pod commissioner reviews the source league against the shared
   regulations. A pod stays pending until that review is explicitly confirmed.
5. The organization season can launch only after at least two pods are
   confirmed and none of the reviewed source leagues has changed.
6. Every pod then runs as a normal independent league. Its league remains the
   source of truth for the draft, schedule, standings, transactions,
   replacements, teams, and rosters.
   Managers can use the pod links in the league header to visit sibling pods.
   While visiting, they can follow activity, comment on the League Board, and
   predict, but all team and transaction actions stay in their own pod.
7. At the end of the pod seasons, an administrator begins qualification. Each
   pod is locked by someone who is also staff in that source league. DraftCenter
   snapshots the exact standings, teams, rosters, and source revision, applies
   the shared tiebreakers, and asks for a recorded draw only when a remaining
   tie crosses a qualification boundary.
8. Qualifying teams will be promoted into one connected Tournament. They keep
   their exact team identity and roster; there is no playoff redraft.

Pods draft independently, so two qualifiers may own the same Pokemon. Those
cross-pod duplicates are valid in the championship.

## What is live now

The complete workflow is deployed through pull requests
[91](https://github.com/roblebaegaming/DraftCenter/pull/91) and
[92](https://github.com/roblebaegaming/DraftCenter/pull/92), with production
migrations applied through 360. Owners can create organizations, manage
bounded administrator access, create seasons, link existing leagues as pods,
confirm shared-regulation reviews, launch a reviewed season, finalize
qualifiers, and promote them into a connected championship. Linking and
coordinating pods does not alter their drafts, schedules, standings, or
rosters.

The retained Supabase Preview branch passes the foundation, qualification,
single-elimination championship, and double-elimination championship
transaction matrices. Production object, grant, trigger, search-path, smoke,
and signed-out page checks also pass without creating organization or
championship data.

The sibling-pod manager and spectator access clarification is deployed through
protected pull request
[103](https://github.com/roblebaegaming/DraftCenter/pull/103) and production
migration 368. Forward migrations 366-368 also pass the retained Preview
branch's full observer-access matrix and production read-only postflight.

### Qualification review flow

1. Begin one qualification run for the launched organization season.
2. Have an authorized source-league commissioner lock each pod's final
   standings. An organization role alone is not enough.
3. Review the deterministic automatic and wildcard rankings.
4. If DraftCenter identifies a boundary tie, record the displayed draw order.
5. Finalize only after every pod is locked and unchanged. Any later source
   revision forces a cancel-and-restart instead of silently accepting stale
   standings.
6. If a source league replaces a manager afterward, synchronize that manager
   identity only after DraftCenter confirms the same team and roster hash.

## Choices the organizer can make

### Pod structure

- **Number of pods:** two or more. Four pods is a clean first-season shape.
- **Pod size:** pods may be even or uneven. Similar sizes are easier to explain,
  but uneven sizes do not break the model.
- **Pod names and source leagues:** each pod links one existing league and its
  exact season number.
- **Pod staff:** league commissioners keep their normal league authority.
  Organization administrators do not silently gain control of a pod.

### Shared season rules

- **Regulations:** one canonical regulation snapshot for the whole season.
- **Pod confirmation:** every pod must be reviewed against that snapshot before
  launch.
- **Later rule changes:** changes must become a recorded revision; an active
  pod is never silently rewritten.

### Qualification

- **Automatic places:** choose the top number from every pod, such as top two.
- **Wild cards:** optionally add the best remaining teams across all pods.
- **Uneven pods:** use equal automatic places, add wild cards, or later adopt a
  percentage-based rule if the organization prefers proportional access.
- **Tiebreakers:** order the available rules: wins, differential,
  head-to-head, game-win percentage, and a recorded commissioner draw as the
  final manual resolution.

### Championship

- **Roster policy:** fixed by the product contract—qualifiers retain their
  complete rosters and do not redraft.
- **Duplicate Pokemon:** fixed by the product contract—duplicates across pods
  remain legal.
- **Bracket format:** connected championships support both single and double
  elimination without creating a second draft or roster.
- **Seeding:** choose pure overall record, pod-finish bands, or pod-finish
  bands with best-effort avoidance of same-pod first-round matches.
- **Transactions:** the finalized qualification roster is the championship
  roster. Later source-league roster changes do not flow into the championship
  and prevent replacement-manager synchronization. Write the transaction
  freeze into the shared rules and enforce it in each source league before
  qualification is finalized.
- **Replacement managers:** replacements continue through the source league
  and take over the same team, roster, record, and schedule. Qualification can
  synchronize only that manager identity after verifying the unchanged team
  and roster hash.

### Creating the connected championship

After qualification is finalized, the organization owner chooses the bracket,
seeding, series length, and visibility. DraftCenter then promotes every
qualifier and locks the bracket in one transaction. There is no public signup
period, so an unrelated entrant cannot take a championship place. The
Tournament page shows the organization, season, source pod, qualification
kind, seed, and retained roster size beside the ordinary bracket and recovery
tools.

Only the organization owner creates this high-impact mapping. Pod and
organization administrators still handle qualification. If a manager is
replaced after promotion, an administrator with authority in both the
organization and source league synchronizes the same mapped entrant before
that entrant begins play. Drop, disqualification, forfeit, and result recovery
continue through the existing Tournament controls.

### Visibility and administration

- **Visibility:** organizations are private by default and may expose a bounded
  public organization page.
- **Spectator links:** use these for people who should see only standings,
  predictions, the official draft board, and playoffs. Spectators cannot see
  league activity or comments and cannot message managers.
- **Manager links:** these add the person to that specific pod so they can
  claim a team and use its transaction tools. A manager who already belongs to
  another pod does not need a second invite merely to visit and comment.
- **Pod switching:** managers see clickable pod labels inside every linked pod.
  Opening another label grants the sibling-pod view, not a team or transaction
  role in that league.
- **Delegation:** the owner may invite organization administrators, while pod
  permissions continue to come from each source league.
- **Audit history:** administrator, regulation, pod-review, launch,
  qualification, and championship actions are recorded without exposing
  private account or roster data publicly.

## Recommended first-season defaults

- Four pods with roughly equal manager counts.
- Top two teams from each pod; no wild cards in the first season unless pod
  sizes differ substantially.
- Tiebreakers in this order: wins, differential, head-to-head, game-win
  percentage, commissioner draw.
- Qualifiers keep complete rosters; cross-pod duplicate Pokemon remain legal.
- Write and enforce the source-league transaction freeze before finalizing
  qualification.
- Seed by pod finish and avoid same-pod matchups in the first championship
  round where possible.
- Use single elimination for the simplest first championship, or double
  elimination if the organization accepts the longer schedule and possible
  bracket-reset final.

The permanent technical and security contract is in
[`multi-pod-league-organizations.md`](multi-pod-league-organizations.md).
