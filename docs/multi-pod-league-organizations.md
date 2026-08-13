# Multi-pod league organizations

Multi-pod organizations are DraftCenter's planned flagship league expansion.
They let one organization run several normal draft leagues under a shared
season, then promote qualifying teams into one championship without redrafting
or rebuilding rosters.

## Product contract

- An organization season owns the shared regulations and qualification rules.
- Each pod remains a normal DraftCenter league with its own draft, schedule,
  standings, transactions, managers, and commissioner tools.
- Pod commissioners continue using the existing league roles. Organization
  owners and administrators coordinate the overall season but do not silently
  acquire league authority.
- A manager or commissioner in one pod may open every other active pod in the
  same organization season. In a sibling pod they may read completed league
  activity, use the League Board, and make predictions, but they cannot claim
  or edit a team, draft, transact, trade, or send direct messages there.
- An invited spectator may see only standings, predictions, the official draft
  board, and playoffs. Spectators cannot read league activity or the League
  Board and cannot comment or contact managers.
- A manager replacement follows the source league's existing replacement
  rules. The replacement manager takes over the same team, roster, record, and
  schedule.
- A qualifying team keeps its regular-season identity and complete roster.
  There is no championship redraft.
- Because pods draft independently, the same Pokemon may appear on qualifying
  teams from different pods. Cross-pod species duplicates are valid and must
  never be deduplicated during promotion.
- The championship is a connected tournament made from promoted teams. It is
  not a new league and does not own a second copy of the draft process.

## Foundation data model

Forward-only migration
`350-multi-pod-league-organizations.sql` reserves the following boundaries.
Forward-only migration
`351-fix-multi-pod-championship-qualifier-delete.sql` preserves the composite
season identity check while allowing organization cleanup to cascade through
the qualifier-to-championship mapping. Forward-only migration
`352-harden-multi-pod-season-rule-boundaries.sql` rejects null, duplicate, and
multidimensional tiebreaker lists at the authoritative RPC boundary and
explicitly removes browser-role access to the organization audit sequence:

Forward-only migration `353-multi-pod-commissioner-workspace.sql` adds the
first commissioner workspace controls: HTTPS-only organization artwork,
bounded branding updates, hashed one-time administrator invitations,
administrator removal, shared-regulation confirmation, revision-aware season
launch, and public organization lookup. The invite token is returned once and
is never stored in plaintext.

Forward-only migration `387-organization-division-and-draft-planning.sql`
adds the large-season planning layer. An administrator can choose 2-32
concurrent pods when creating a season; DraftCenter atomically provisions each
pod as a private, ordinary league. Each pod may have its own draft time. The
organization workspace also stores private manager availability notes and an
optional pod placement. Placing or moving a manager grants the normal coach
membership only in the selected pod and requires both organization authority
and commissioner authority in every affected source pod.

1. **Organizations** hold identity, visibility, administrators, and audit
   history.
2. **Organization seasons** hold an immutable shared regulation snapshot,
   qualification rules, retained-roster policy, and duplicate-species policy.
3. **Pods** link existing leagues and the exact source league-season number.
   Attaching a pod requires both organization-administrator authority and
   commissioner authority in the source league.
4. **Qualifiers** reserve the exact source league, source team key, league
   snapshot revision, team snapshot, roster snapshot, and roster hash. No
   Pokemon or species uniqueness constraint exists across qualifiers.
5. **Championships** connect one organization season to one standalone
   tournament. Their entrant mapping prevents a qualifier, tournament entrant,
   or season from being crossed accidentally.

The foundation migration intentionally exposed no qualifier-promotion or
championship-creation mutation. Forward migrations 356-358 now add the bounded
qualification workflow described below. Championship creation remains a
separate release so tournament promotion can be reviewed atomically.

## Pod navigation and observer access

Forward-only migration `366-multi-pod-manager-and-spectator-access.sql`
introduces a virtual `pod_manager` access result. It is derived at request time
from a manager, co-commissioner, or commissioner membership in another active
pod from the same organization season; it is not written into the target
league's membership table and therefore does not broaden existing transaction
RPCs.

Forward migrations `367-fix-pod-access-metadata-portability.sql` and
`368-create-missing-league-prediction-match.sql` preserve that boundary on
retained Preview schemas with optional league metadata and ensure a league's
first prediction creates its missing matchup object.

The migration also replaces direct spectator snapshot reads with an explicit
server-side allow-list. Both spectator and sibling-manager projections include
the season data required for standings, predictions, the draft board, and
playoffs. The sibling-manager projection additionally includes the League
Board, the manager's own board read receipt, free-agent activity, completed
trade outcomes, and administrative activity. It excludes private queues,
pending claims, pending trades, direct messages, and every transaction control.

The signed-in league header obtains its pod list from the same organization
season and links each label back through the authenticated league opener. A
manager therefore moves between private pods without converting them to public
leagues or receiving a target-pod membership.

## Shared regulations

The organization season stores the canonical regulations. A newly attached
pod begins with `regulations_status = pending`; the system must not claim its
league settings match until a commissioner reviews and confirms them. A later
release can offer **Apply shared regulations** while preserving pod-specific
branding, managers, draft order, and schedule.

Changing regulations after a season begins must create a revision and record
an audit event. It must not silently rewrite an active pod.

## Qualification and tiebreakers

The initial rule model supports:

- a configurable number of automatic qualifiers per pod;
- optional organization-wide wild cards; and
- an ordered set of wins, differential, head-to-head, game-win percentage,
  and an explicit commissioner draw as a final manual resolution.

Uneven pod sizes therefore do not require a different schema. The organization
can use equal automatic spots, additional wild cards, or a later configurable
percentage rule without changing the source leagues.

### Qualification automation review release

Forward migration `356-multi-pod-qualification-automation.sql` adds a staged,
revision-aware qualification run. An organization administrator begins the
run, but each pod can be locked only by someone who is also staff in that
source league. Locking requires a complete, valid schedule and captures the
source state revision, exact team snapshot, complete roster snapshot, and a
SHA-256 roster hash.

Configured objective tiebreakers are applied in order. A recorded
commissioner draw is requested only for a still-tied group that crosses an
automatic-qualifier or wild-card boundary. Finalization fails if a source pod
changed after it was locked. It writes the chosen automatic and wild-card
teams into the existing qualifier table without changing their identity or
rosters. A later source-league manager replacement can synchronize only the
manager identifier after proving that the team and roster hash are unchanged.

Forward migration `357-fix-multi-pod-qualification-digest-path.sql` exposes
the `extensions` schema only to the two roster-hashing functions. Forward
migration `358-fix-multi-pod-qualification-candidate-cleanup.sql` keeps the
composite pod identity check while allowing season cleanup to cascade through
locked candidate rows. Both corrections were discovered and verified on the
retained Preview branch; the already-applied migration 356 was not rewritten.

## Delivery phases

1. **Foundation:** private-by-default schema, bounded organization/season/pod
   creation RPCs, public-safe workspace projection, application validators,
   audit boundaries, and focused tests.
2. **Commissioner workspace:** organization branding, administrator management,
   shared-regulation review, pod creation/linking, season launch, and public
   organization pages.
3. **Qualification:** locked standings, deterministic tiebreakers, wild cards,
   immutable team/roster snapshots, manager replacement handling, and an
   auditable qualification review.
4. **Championship:** atomic entrant promotion into single or double
   elimination, retained rosters, allowed cross-pod duplicates, results, and
   public playoff presentation.
5. **Community layer:** organization history, champions, records,
   announcements, following, and reusable season templates.

### Connected championship review release

Forward migration `359-multi-pod-connected-championships.sql` gives the
organization owner one atomic promotion action after qualification is final.
It creates a normal DraftCenter Tournament, maps every qualifier to exactly
one entrant, assigns deterministic seeds, and immediately locks either a
single- or double-elimination bracket. There is no open registration window,
no redraft, and no new roster copy. A database trigger rejects later entrant
inserts into a connected championship.

The owner chooses public or private playoff coverage, best of 1 or 3, and one
of three seeding policies: overall record, pod-finish bands, or pod-finish
bands with best-effort avoidance of same-pod first-round matches. Completion
of the Tournament automatically updates the connected championship and
organization season. Public projections expose pod, qualification kind,
placement, and roster size without exposing private roster snapshots or user
identifiers.

Forward migration `360-fix-connected-championship-manager-sync.sql` keeps the
pre-championship synchronization guard intact while giving mapped entrants a
separate dual-authority recovery path. Before that entrant has begun play, an
organization administrator who is also source-league staff can synchronize a
replacement manager only after the exact source team and SHA-256 roster hash
still match the finalized qualifier.

## Commissioner workspace boundary

- An organization administrator may edit branding, create seasons, and link a
  league only when they also have commissioner authority in that source
  league.
- A newly planned season may provision 2-32 independent pod leagues in one
  transaction. The creator is commissioner of every generated pod; other
  organization administrators do not silently receive source-pod authority.
- Draft times are pod-specific. Saving a time in League Operations does not
  schedule an automatic start; a pod commissioner must still open Draft Setup,
  prepare the draft, and confirm automatic-start readiness. A scheduled start
  must be cancelled in Draft Setup before its time is changed centrally.
- Manager availability can be recorded before a pod is chosen. Assigning,
  moving, or removing the manager requires source-pod authority, stops after a
  draft begins, and refuses to detach a manager who still owns or is assigned
  to a team.
- Only the organization owner may create or revoke administrator invitations
  and remove an accepted administrator. These actions never alter a person's
  roles in an existing league.
- A linked pod remains pending until an organization administrator who is also
  source-league staff explicitly confirms that the league was reviewed against
  the shared regulations.
- Launch requires every planned pod (and at least two), confirmed regulations for every pod, an
  unchanged source-league season number, and the same source snapshot revision
  that was reviewed. Any changed pod must be reviewed again.
- Launch changes only organization and pod status. It does not create or edit a
  draft, roster, schedule, standing, transaction, or tournament.

## Production boundary

Migrations 350-360 are deployed through protected pull requests 82, 85, 91,
and 92. All organization tables use RLS, browser roles have no direct table
access, owner and invited-administrator actions remain bounded, and production
grant, trigger, and function-search-path audits pass.

Migrations 366-368 and their application changes are deployed through
protected pull request 103. They were applied in order to the exact core
production project after isolated Preview database verification and exact
application Preview review. Production object, policy, grant, and function
postflight checks pass without changing a real league.

The retained `multi-pod-pr-82` Preview branch passes the complete foundation,
qualification, single-elimination championship, and double-elimination
championship transaction matrices. Every synthetic league, organization, run,
candidate, qualifier, championship, Tournament, entrant, and account is
removed by those checks. The branch remains available and must not be deleted
as routine cleanup. No real league should be attached merely to test the
workflow.

The same retained branch also passes the migration 366-368 observer-access
matrix. Its result confirms RLS and grants, safe linked-manager and spectator
projections, allowed board and prediction actions, denied claims,
transactions, and direct messages, direct-staff full state, and exact fixture
cleanup.
