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

The organization foundation and commissioner workspace are deployed. Owners
can create organizations, manage bounded administrator access, create seasons,
link existing leagues as pods, confirm shared-regulation reviews, launch a
reviewed season, and show a public organization page. These actions do not
alter the linked leagues.

Qualification automation is in pull request 91, and connected championships
are implemented on the separate stacked review branch. Both pass on the
retained Supabase Preview branch, but neither is merged or deployed. Until
those releases are approved in order, production does not expose their
qualification or championship controls.

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
- **Bracket format:** standalone single and double elimination are live. The
  connected-championship release can expose either format without creating a
  second draft or roster.
- **Seeding:** choose pure overall record, pod-finish bands, or pod-finish
  bands with best-effort avoidance of same-pod first-round matches.
- **Transactions:** the organization can keep normal source-league transaction
  rules through the championship or freeze transactions at a stated playoff
  deadline. The qualifying roster snapshot must make that choice explicit.
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
- Freeze transactions when the championship begins.
- Seed by pod finish and avoid same-pod matchups in the first championship
  round where possible.
- Use single elimination for the simplest first championship, or double
  elimination when the new format is deployed if the organization accepts the
  longer schedule and possible bracket-reset final.

The permanent technical and security contract is in
[`multi-pod-league-organizations.md`](multi-pod-league-organizations.md).
