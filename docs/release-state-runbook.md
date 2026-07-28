# Release state and rollback runbook

## Production identity

- Canonical domain: `https://www.draftcentral.gg`
- Vercel project: `draftcenter`
- Supabase: the dedicated DraftCenter project, not generic legacy variables

`www.centraldraft.gg` is an alias with the words transposed. It must not be used
as the canonical URL in product copy, verification records, or release notes.

## Current reconciliation requirement

As of July 27, 2026, Vercel displays Production as rolled back and says automatic
custom-domain assignment is disabled. Before the next production change, record:

- current production deployment ID;
- current production commit SHA;
- rollback reason and time;
- known-good rollback deployment;
- whether the next release will be promoted manually or assigned automatically;
- dedicated Supabase project reference and latest verified migration.

Do not infer the production commit from the checked-out branch or handoff alone.
Vercel's active production deployment is authoritative for application code;
the Supabase migration ledger is authoritative for database state.

## Frozen rehearsal record — July 28, 2026

- Frozen source commit: `351f3ba`
- Immutable Git tag: `rehearsal-candidate-2026-07-28`
- Active production deployment:
  `dpl_CQVxzSULkrtNzSnCapoqCTaSN3Ht`
- Active deployment URL:
  `https://draftcenter-107n19vqk-rob-lebae.vercel.app`
- Canonical alias: `https://www.draftcentral.gg`
- Known-good application rollback deployment:
  `dpl_6xB5btMSLetEsxdJzRowdeDEXCSx`
- Latest verified production migration:
  `237-repair-notification-event-created-at.sql`
- Custom-domain assignment is manual. Reconfirm the canonical alias after every
  deployment or rollback.
- Cleanup work belongs on `cleanup/pre-rehearsal-2026-07-28` and must not be
  deployed over the frozen candidate without a critical safety decision.

## Release checklist

1. Start from the single designated production branch.
2. Confirm the worktree is clean and the commit is pushed.
3. Run install, tests, and production build from the lockfile.
4. Confirm required Vercel variable names and environment scopes without
   revealing values.
5. Confirm the target Supabase project before applying forward-only migrations.
6. Apply migrations and record their ledger status.
7. Create the deployment and record its deployment ID and commit SHA.
8. Promote intentionally.
9. Verify the canonical domain, authentication, one public route, one test
   league route, and notification health.
10. Record the result and known-good rollback deployment.

## Rollback rule

Roll back application code only when the previous application version remains
compatible with the current database. Never roll back an applied production
migration by editing or rerunning its file. Use a new forward-fix migration.

Every rollback record must contain:

- triggering symptom or metric;
- issue/correlation ID;
- deployment being removed;
- deployment restored;
- database compatibility decision;
- owner of the forward fix.

## Branch policy target

Use one protected production branch with required checks. Long-lived branches
must not be treated as manually mirrored production applications. Tournament
work should flow through review and integration rather than paired hand-written
commits across two permanent branches.

