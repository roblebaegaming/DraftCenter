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

The first migration intentionally exposes no qualifier-promotion or
championship-creation mutation. Those operations require the commissioner
recovery rules, standings validation, roster hashing, and transactional
tournament integration planned for later releases.

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

## Commissioner workspace boundary

- An organization administrator may edit branding, create seasons, and link a
  league only when they also have commissioner authority in that source
  league.
- Only the organization owner may create or revoke administrator invitations
  and remove an accepted administrator. These actions never alter a person's
  roles in an existing league.
- A linked pod remains pending until an organization administrator who is also
  source-league staff explicitly confirms that the league was reviewed against
  the shared regulations.
- Launch requires at least two pods, confirmed regulations for every pod, an
  unchanged source-league season number, and the same source snapshot revision
  that was reviewed. Any changed pod must be reviewed again.
- Launch changes only organization and pod status. It does not create or edit a
  draft, roster, schedule, standing, transaction, or tournament.

## Production boundary

Migrations 350-352 were verified on the retained Supabase Preview branch and
then released through protected pull request 82. Migration 353 and the
commissioner workspace remain unreleased until their own Preview regression,
RLS/grant review, application Preview review, protected checks, and explicit
production approval finish. No real league should be attached for testing;
use an isolated organization and practice leagues.
