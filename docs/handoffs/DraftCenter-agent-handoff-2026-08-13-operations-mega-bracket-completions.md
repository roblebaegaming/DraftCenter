# DraftCenter handoff: Operations Mega Bracket completions

Date: August 13, 2026

## Production record

The privacy-safe Mega Bracket completion item is deployed through application
pull request [#207](https://github.com/roblebaegaming/DraftCenter/pull/207).
GitHub squash-merged the protected release as production application commit
`727155b4316017d985af67a22b143634f8fabc73`. Vercel reports that exact commit
successfully deployed to Production.

Forward-only migration 390 is applied to the exact core production project.
The owner-only view remains <https://www.draftcentral.gg/operations>. At final
production verification, the new item showed **1 member completed** and **1
completed bracket**.

## Product behavior

- Owner Operations now includes a **Mega Bracket completions** section below
  the existing aggregate Pokemon Connections usage.
- **Members completed** counts distinct signed-in account IDs with at least one
  attempt whose authoritative status is `completed`.
- **Completed brackets** counts all authoritative completed attempts, so one
  member may contribute more than one bracket.
- The item deliberately excludes member names, emails, usernames, champions,
  Top 64 results, choice paths, frozen catalogues, active attempts, and
  abandoned attempts.
- If the aggregate RPC is temporarily unavailable, this item fails softly and
  the rest of Operations remains usable.
- Refreshing Operations reads current authoritative state; no separate counter
  or analytics event can drift from the private attempt store.

The stable owner Operations contract is in
[`../owner-league-operations.md`](../owner-league-operations.md), and the Mega
Bracket data contract is in [`../mega-bracket.md`](../mega-bracket.md).

## Database and privacy boundary

Migration
[`../../supabase/390-operations-mega-bracket-completions.sql`](../../supabase/390-operations-mega-bracket-completions.sql)
adds `public.get_operations_mega_bracket_completions()` as a stable
`security definer` aggregate. It returns exactly:

- `generated_at`;
- `completed_members`; and
- `completed_brackets`.

Execution is revoked from `public`, `anon`, and `authenticated` and granted
only to `service_role`. Direct `anon` and `authenticated` reads of
`public.mega_bracket_attempts` remain denied, and its RLS flag remains enabled.
The application calls the function only after the existing owner allowlist
gate has succeeded.

The migration was first applied to the retained isolated `multi-pod-pr-82`
Supabase Preview branch. The focused matrix in
[`../../supabase/tests/390-operations-mega-bracket-completions-preview-regression.sql`](../../supabase/tests/390-operations-mega-bracket-completions-preview-regression.sql)
created two random synthetic accounts and three synthetic completed attempts,
proved the aggregate increased by exactly two members and three brackets,
proved no extra or private fields were returned, and removed every fixture by
exact identifier. The counts returned to their exact baseline afterward.

The first attempt to submit that Preview matrix was rejected at SQL parse time
because the dashboard editor retained text from the preceding query. It made
no database change. The editor was explicitly cleared, and the complete clean
matrix then passed. Production migration 390 was submitted from a clean query
and completed in one transaction.

Production postflight confirmed migration 390 exists, both client roles cannot
execute it, `service_role` can execute it, both client roles still lack table
read access, RLS remains enabled, and the response contains only the three
documented aggregate keys.

## Validation

The release passed:

- `npm run test:operations-users`: 29/29;
- `npm run test:mega-bracket`: 8/8;
- every suite after the repository's unchanged Draft Lab catalogue-drift gate
  when run directly;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run test:national-dex`: all 1,027 rows;
- the optimized 244-page production build;
- migration 390 and its exact synthetic Preview privacy regression;
- GitHub CodeQL, JavaScript security analysis, dependency/security checks,
  full-history secret scanning, Vercel Preview, and unresolved-feedback gate;
- hosted signed-out Preview review with the owner gate intact and no horizontal
  overflow at the available desktop viewport;
- Vercel's exact Production deployment of commit `727155b`;
- live signed-in owner review of the aggregate card at one member and one
  bracket; and
- the post-deployment 19-check signed-out production smoke sweep.

`npm run test:all` still stops at the pre-existing generated Draft Lab
catalogue drift gate on the `main` baseline. All suites before that gate passed,
including the changed Operations suite, and every later suite passed directly.
This release does not modify or regenerate the frozen Draft Lab/Mega Bracket
catalogue.

## Preserved boundaries

- No real Mega Bracket attempt, user account, league, draft, pick, roster,
  queue, membership, deadline, tournament, or Daily Games submission was
  created, changed, or deleted for this release.
- Production writes were limited to the reviewed forward-only migration 390;
  production verification was aggregate and read-only.
- The two synthetic Preview users and three synthetic completed attempts were
  removed by exact identifier inside the successful regression transaction.
- No identity, champion, Top 64, choice path, frozen catalogue, email address,
  credential, token, provider setting, environment variable, or secret was
  exposed or changed.
- The retained `multi-pod-pr-82` Preview branch now includes migration 390 and
  must not be deleted without explicit owner approval.
- The original DraftCenter workspace's 81 pre-existing changes remained
  unstaged and untouched. Main protection was not bypassed.

## Continuation

No application, migration, or documentation step from this release remains
undeployed. Start future work from fresh `origin/main`, treat migration 390 as
immutable history, and use migration 391 or later for any database change.

Keep this metric aggregate-only unless the owner explicitly approves a new
privacy design. Do not add a member drill-down, champion list, Top 64 list, or
attempt inspection to Operations merely because the underlying service role
can read private rows. If future product decisions need retention or funnel
evidence, define a separate minimal aggregate and validate its access grants in
an isolated Preview branch first.

The preceding Nuzlocke location-grouping handoff remains valid historical
detail at
[`DraftCenter-agent-handoff-2026-08-13-nuzlocke-location-grouping.md`](DraftCenter-agent-handoff-2026-08-13-nuzlocke-location-grouping.md).
