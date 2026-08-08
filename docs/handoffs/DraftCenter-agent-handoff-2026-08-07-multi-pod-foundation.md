# DraftCenter handoff - multi-pod league organization foundation

- Date: August 7, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Branch: `codex/multi-pod-foundation-2026-08-07`
- Pull request: [#82](https://github.com/roblebaegaming/DraftCenter/pull/82)
- Implementation commit: `3be575a98e1a5fb99bea2f1ba2e8d3d58f12553e`
- Production status: not merged, not deployed, and migration 350 not applied

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
- Cross-table foreign keys prevent pods, qualifiers, championships, and
  tournament entrants from being connected across organization seasons.
- Qualifier storage reserves the source league, source team key, authoritative
  snapshot revisions, team snapshot, roster snapshot, and roster hash needed
  for a later atomic promotion workflow.
- `src/lib/multiPodLeague.js` normalizes qualification rules, constructs safe
  RPC arguments, and builds retained-team qualifier snapshots without
  deduplicating Pokemon across pods.
- `test/multi-pod-foundation.test.js` covers product rules, bounded settings,
  grants/RLS, authority checks, and cross-season integrity.
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

The Supabase Preview check was skipped because the repository integration did
not provision an isolated branch. Migration 350 has therefore not received an
actual PostgreSQL execution or Preview RLS/grant audit and the pull request
must remain draft.

## Production and data boundaries

No production or Preview migration ran. No real or practice organization,
league, team, roster, membership, tournament, provider setting, environment
variable, or secret changed. The original workspace's 28 changed paths were
preserved.

Applying migration 350 requires the exact production Supabase project
identity and explicit owner approval. Before that approval, provision a
disposable Preview branch, run migration 350 there, verify every table has RLS,
verify browser roles have no direct writes, exercise the bounded create/list
RPCs with multiple identities, and clean up the exact disposable fixtures.

## Recommended next implementation

1. Validate migration 350 on an isolated Supabase branch and audit grants/RLS.
2. Add organization branding, administrator invitations, shared-regulation
   review, and pod linking behind the migrated schema.
3. Add season launch only after every pod confirms the shared regulations.
4. Add locked-standings qualification and roster hashing after commissioner
   forfeit, drop, disqualification, and replacement recovery is proven.
5. Add atomic championship promotion using the retained qualifier snapshots
   and allow cross-pod duplicate Pokemon by design.

