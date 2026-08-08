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
7. At the end of the pod seasons, the qualification phase will lock the chosen
   standings, apply the shared tiebreakers, and record an auditable list of
   qualifiers.
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

The qualification and championship phases are not automated yet. In
particular, DraftCenter does not yet lock final pod standings, select wild
cards, snapshot qualifying rosters, or promote those snapshots into a live
championship bracket. Those are the next two multi-pod releases.

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
- **Bracket format:** single elimination is already live. Double elimination is
  the next independently validated Tournament release and can become an option
  for connected championships after that release is deployed.
- **Seeding:** the qualification release still needs a policy choice between
  pure overall ranking, pod-finish bands, or pod-finish bands that avoid
  same-pod first-round matches.
- **Transactions:** the organization can keep normal source-league transaction
  rules through the championship or freeze transactions at a stated playoff
  deadline. The qualifying roster snapshot must make that choice explicit.
- **Replacement managers:** replacements continue through the source league
  and take over the same team, roster, record, and schedule. The qualification
  release must synchronize the championship identity without creating a new
  team.

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
