# DraftCenter handoff - multi-pod league organization foundation

- Date: August 7, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Branch: `codex/multi-pod-foundation-2026-08-07`
- Pull request: [#82](https://github.com/roblebaegaming/DraftCenter/pull/82)
- Implementation commit: `3be575a98e1a5fb99bea2f1ba2e8d3d58f12553e`
- Supabase Preview branch: `multi-pod-pr-82`
- Production status: not merged, not deployed, and migrations 350-351 not applied

## Outcome

The first infrastructure phase for multi-pod draft-league organizations is in
a draft pull request. It adds a private-by-default organization, season, pod,
qualifier snapshot, and connected-championship data contract without exposing
an unfinished user interface or changing any existing league.

Each pod remains an ordinary DraftCenter league and keeps the existing draft,
schedule, standings, roster, transaction, replacement, and commissioner
systems. Attaching a pod requires the caller to be both an organization
administrator and source-league staff.

The product rules confirmed by the owner are enforced in the model:

- a qualifying team retains its regular-season identity and complete roster;
- there is no championship redraft;
- manager replacement continues through the source league's existing rules;
- independent pods may qualify teams that own the same Pokemon; and
- no cross-pod Pokemon/species uniqueness constraint exists.

## Implementation

- `supabase/350-multi-pod-league-organizations.sql` adds eight RLS-enabled,
  private-by-default tables and bounded organization, season, pod, listing, and
  workspace RPCs.
- `supabase/351-fix-multi-pod-championship-qualifier-delete.sql` is the
  forward-only correction found during Preview lifecycle testing. It retains
  the qualifier-and-season composite foreign key while allowing its
  championship mapping to be removed during organization cleanup.
- Cross-table foreign keys prevent pods, qualifiers, championships, and
  tournament entrants from being connected across organization seasons.
- Qualifier storage reserves the source league, source team key, authoritative
  snapshot revisions, team snapshot, roster snapshot, and roster hash needed
  for a later atomic promotion workflow.
- `src/lib/multiPodLeague.js` normalizes qualification rules, constructs safe
  RPC arguments, and builds retained-team qualifier snapshots without
  deduplicating Pokemon across pods.
- `test/multi-pod-foundation.test.js` covers product rules, bounded settings,
  grants/RLS, authority checks, cross-season integrity, and the forward-only
  cleanup correction.
- `supabase/tests/350-multi-pod-league-organizations-preview-regression.sql`
  is the reusable database regression. It creates only synthetic identities
  and practice leagues, tests two authorization identities and championship
  mappings, removes every permanent fixture, and returns one JSON result.
- `docs/multi-pod-league-organizations.md` records the product contract and
  phased delivery plan.

The migration intentionally does not expose qualifier-promotion,
championship-creation, organization-update, or destructive lifecycle RPCs.
Those require commissioner recovery semantics, standings validation,
transactional roster hashing, and isolated database fixtures.

## Validation

- `npm run test:multi-pod`: 7 passed.
- `npm run test:all`: passed.
- `npm run test:national-dex`: all 1,027 rows verified.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- Production-configured `npm run build`: 179 generated pages passed.
- Vercel Preview: success.
- CodeQL: success.
- JavaScript security analysis: success.
- Security and dependency checks: success.
- Full-history secret scan: success.

The original CI Supabase Preview check was skipped because no isolated branch
existed at that time. The owner subsequently authorized the billable
`multi-pod-pr-82` branch, connected to
`codex/multi-pod-foundation-2026-08-07`. The generated Preview baseline was
older than current production and lacked the already-released tournament
tables, so released migration 340 was applied there only as fixture setup.
Migration 350 then executed successfully.

The first cleanup run exposed a conflicting delete path between qualifiers and
championship entrant mappings. Because migration 350 had already executed in
Preview, it was preserved unchanged and forward-only migration 351 corrected
the mapping delete action. Migration 351 executed successfully, and the full
database regression then returned one passing result with all controls true:

- all eight organization tables have RLS enabled;
- `anon` and `authenticated` have no direct table reads or writes;
- `service_role` and bounded RPC grants match the intended boundary;
- private organizations stay hidden while public organizations are viewable;
- a league commissioner without organization authority cannot attach a pod;
- an organization administrator without source-league commissioner authority
  cannot attach a pod;
- bounded settings, shared regulations, retained rosters, and duplicate
  Pokemon across pods behave as designed;
- cross-season championship mappings are rejected;
- audit history records the authorized actions; and
- both synthetic identities, both practice leagues, their tournaments, and all
  organization fixtures were removed and verified absent.

Validation after the correction passes:

- `npm run test:multi-pod`: 8/8;
- `npm run test:release-integration`: 5/5;
- `npm run test:all`;
- `npm run test:national-dex`: all 1,027 rows;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities; and
- public-configured `npm run build`: all 179 generated pages.

No local environment file or credential was copied into the feature worktree.
CI checks must be refreshed for the new migration and regression commit before
the pull request leaves draft state.

## Production and data boundaries

No production migration, real league, team, roster, membership, tournament,
environment variable, or secret changed. Preview migrations 340, 350, and 351
ran only on the isolated branch. The database regression used synthetic
identities and explicitly marked practice leagues, then removed and verified
every permanent fixture. The original workspace's 28 changed paths remain
preserved.

Applying migrations 350-351 requires the exact production Supabase project
identity and separate owner approval through the protected pull-request flow.
The owner asked that `multi-pod-pr-82` remain available after the eventual
merge. Do not delete the Supabase branch or its connected Git branch during
release cleanup; verify any automatic branch-deletion setting before merge.
The branch remains billable while retained.

## Recommended next implementation

1. Refresh the complete repository and CI gates for migrations 350-351, review
   the retained Preview evidence, and move PR #82 through protected review.
2. Add organization branding, administrator invitations, shared-regulation
   review, and pod linking behind the migrated schema.
3. Add season launch only after every pod confirms the shared regulations.
4. Add locked-standings qualification and roster hashing after commissioner
   forfeit, drop, disqualification, and replacement recovery is proven.
5. Add atomic championship promotion using the retained qualifier snapshots
   and allow cross-pod duplicate Pokemon by design.
