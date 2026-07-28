# Testing-week integration handoff

## Purpose

This note is for the Codex agent who integrates parallel operational-safety work
with the active DraftCenter league-testing branches.

Do not edit the owner's current handoff document as part of this integration.
Update it only when the owner or the handoff agent explicitly assigns that work.

## Current source state observed

At the time this note was prepared:

- Main testing worktree branch: `release/autonomous-drafts`
- Main testing head: `31a7168` (`Repair spectator schedule view`)
- Tournament branch: `feature/tournament-platform`
- Tournament head: `1e266e2` (`Repair spectator schedule view`)
- Safety branch: `codex/notification-release-safety`
- Safety base: `37d3b8d`

The testing branches moved after the safety branch was created. Since the safety
base, the main testing branch changed only
`src/components/PokemonDraftLeague.jsx`. The safety commits do not modify that
file, so conflict risk is currently low.

Recheck all heads and worktree status before integration. Treat newer commits as
authoritative and preserve the modified `.gitignore`, `.vercel/`, and
`supabase/.temp/` state in the main worktree.

## Commits to integrate

Cherry-pick these commits onto the newest intended integration branch, in order:

1. `f56f007` — `Harden notification dispatch diagnostics`
2. `47a3768` — `Add baseline project quality checks`

Do not merge the safety branch wholesale if the testing branch has advanced.
Cherry-picking keeps the testing work and safety work easy to review.

The safety branch contains:

- privacy-safe notification failure categories and correlation IDs;
- server-side success/failure logs;
- graceful skipping of Daily Three email when Resend is not configured;
- focused configuration tests;
- an accurate environment-variable example;
- notification and release runbooks;
- a rewritten README;
- a GitHub Actions test/build workflow;
- `pnpm test` and `pnpm check`.

## Files affected

- `.env.local.example`
- `.github/workflows/quality.yml`
- `README.md`
- `docs/notification-dispatch-runbook.md`
- `docs/release-state-runbook.md`
- `package.json`
- `src/app/api/notifications/dispatch/route.js`
- `src/lib/notification-dispatch-config.js`
- `test/notification-dispatch-config.test.js`

No league component, rule, migration, Supabase data, Vercel setting, domain, or
deployment was changed.

## Verification already completed

- Three focused Node tests pass.
- `pnpm check` passes with a valid local Supabase environment.
- Next.js 16.2.12 production build passes.
- `git diff --check` passes.

The build requires syntactically valid public Supabase build variables because
some current pages instantiate the browser client while prerendering. CI uses
non-secret build-only placeholders.

## Live issue that remains

Vercel reports an active medium-severity alert for
`/api/notifications/dispatch`, with no successful requests in the previous day.
The new code makes the next failure diagnosable and removes one optional
configuration failure mode, but it has not been deployed or verified in
Production.

The current dispatch architecture is transitional:

- signed-in league screens call `POST` roughly every 30 seconds;
- Vercel Cron calls `GET` only once daily;
- Daily Three email and the general queue share the `GET` execution.

Do not remove browser dispatch during the testing week. After rehearsals, move
general queue processing to a platform-owned schedule every one to five minutes,
split Daily Three into a separate daily job, verify both, and then remove browser
polling.

## Integration procedure

1. Inspect status and recent commits in both testing worktrees.
2. Confirm no agent is editing the affected files.
3. Cherry-pick `f56f007`, then `47a3768`.
4. Run `pnpm install --frozen-lockfile`.
5. Run `pnpm test`.
6. Run `pnpm build` with the intended non-production environment.
7. Review the environment-variable name/scope matrix in Vercel without revealing
   values.
8. Confirm Production still intentionally remains on its current deployment.
9. Coordinate a deployment window after active league checks reach a safe stop.
10. Deploy the integrated commit intentionally; do not undo the current rollback
    state without understanding its reason.
11. Use one disposable test notification and follow
    `docs/notification-dispatch-runbook.md`.
12. Record the Vercel deployment ID, commit, correlation ID, result, and
    known-good rollback.

## Environment review

The Vercel project currently contains dedicated DraftCenter variables alongside
generic legacy Supabase/Postgres variables. It also displayed a suspicious
truncated-looking `NEXT_PUBLIC_DRAFTCENTER_SUPABASE_` key.

Do not delete or edit variables during integration. First produce a name-only
matrix showing:

- key;
- Production/Preview/Development scope;
- branch restriction;
- code consumer;
- required/optional;
- proposed retain/remove decision.

Preview deployments must not receive production service-role, Discord bot,
Resend, or cron secrets by default.

## Production reconciliation

Vercel displayed Production as rolled back and automatic production-domain
assignment as disabled. The canonical domain is `www.draftcentral.gg`;
`www.centraldraft.gg` is the transposed alias.

Before the next release, record:

- active production deployment ID;
- active commit SHA;
- rollback reason;
- database project reference and migration head;
- next promotion method;
- known-good rollback deployment.

Do not infer these from the local branch or an older handoff.

## Conflict rules

- Testing fixes win for league behavior.
- Safety changes win for the new logging/configuration helper unless a newer
  tested fix supersedes them.
- Do not resolve a conflict by replacing an entire route or component.
- Preserve all newer notification behaviors added after the safety branch base.
- Never copy `.env.local`, `.vercel/`, browser storage, or Supabase temp state
  into a commit.
- Never rewrite an applied migration.

## Definition of done

Integration is done only when:

- both safety commits are present on the newest intended branch;
- tests and build pass;
- no testing-week changes were lost;
- Production deployment remains intentional;
- the notification test succeeds or produces a specific actionable failure
  category;
- release/deployment evidence is recorded;
- no secret values or private participant data appear in evidence.

