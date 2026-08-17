# DraftCenter agent rules

These rules are durable repository policy. Read
[`docs/CURRENT-STATUS.md`](docs/CURRENT-STATUS.md) and the
[current detailed handoff](docs/handoffs/DraftCenter-agent-handoff-2026-08-16-pokedex-numbered-dexes-production.md)
before production-sensitive work.

## Permanent safety rules

- Preserve existing user changes. Inspect `git status` before editing and never
  discard, overwrite, or hide work that is not yours.
- Never commit secrets or disclose Supabase keys, Cloudflare secrets, session
  tokens, provider credentials, passwords, recovery material, channel IDs, or
  user email addresses.
- Never automatically replay a timed-out draft mutation. Refresh and verify the
  authoritative state first.
- Use isolated practice leagues for destructive lifecycle tests and verify the
  exact league identifier before cleanup.
- Do not change a real league, draft, pick, roster, queue, membership, deadline,
  or provider configuration merely to test monitoring.
- Do not modify Mushroom Cup without a direct commissioner request and valid
  access. Do not resume, restart, archive, or delete the intentionally paused
  historical Mushroom Hut drafts.
- Never delete or replace a Supabase project based on its name. Require the
  exact project ID and explicit owner approval.
- Preserve the local `.vercel/` directory and never commit it.
- Keep Discord community editorial channels, commissioner league channels, and
  personal direct messages as separate scopes. Keep Operations identity
  reporting aggregate-only.
- Treat historical Operations events as history; verify timestamps and current
  authoritative state before declaring a recurring incident.

## Required validation

Run the narrowest relevant tests while developing. Before proposing an
application release, run the applicable full checks:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
npm run smoke:production
```

The production smoke test is post-deployment validation. Do not run it as proof
of an undeployed local change. A local build requires the public Supabase URL
and publishable key; keep server-only credentials out of `NEXT_PUBLIC_*`
variables. Document any check that cannot run and cite the authoritative CI,
preview, or production evidence used instead.

Database changes require a new forward-only migration under
`supabase/migrations/`, focused regression coverage, and verification of
affected RLS policies and grants. Use a UTC timestamp filename, keep the next
human migration number in its snake-case suffix, and never rewrite a migration
that may already have run. See [`docs/supabase-migration-workflow.md`](docs/supabase-migration-workflow.md).

## Release policy

- `main` is protected. Use a short-lived branch and pull request for every
  non-emergency release; do not push directly to `main`.
- When agents work in parallel, the user-designated integration agent is the
  only agent allowed to push branches, open or change pull requests, merge,
  deploy, apply migrations, or update `docs/CURRENT-STATUS.md`. Feature agents
  may commit in isolated local worktrees and must hand their exact worktree,
  branch, commit, validation, migration state, and overlap notes to the
  integration agent.
- Start integration from the current `origin/main`; never replay a historical
  feature stack or merge a dirty workspace wholesale. The integration agent
  owns shared-file reconciliation and the final release record.
- Require passing repository checks and review the preview before merge.
- Production is connected to `main`. A passing local build or preview is not a
  production deployment.
- Do not change production data, provider settings, environment variables, or
  secrets unless the task explicitly authorizes that exact production action.
- Confirm the deployed commit and run the signed-out production smoke sweep
  after an authorized release. Do not claim deployment success from local or
  preview evidence alone.

## Production boundaries

Begin production investigations read-only. Prefer logs, aggregate Operations
data, and authoritative database state. Any write to a real league, production
database, authentication configuration, Vercel setting, or connected provider
requires explicit scope and the smallest reversible change. The owner is the
sole production restore approver; quarterly restore drills and recovery
material follow [`docs/data-retention-and-recovery.md`](docs/data-retention-and-recovery.md).

## Documentation expectations

- Keep `docs/CURRENT-STATUS.md` short and current. It is the canonical status
  summary, not a running log.
- Keep the current detailed handoff in `docs/handoffs/`; put only superseded
  broad handoffs in `docs/handoffs/archive/`.
- Keep specialized security, retention, SEO, audit, incident, and roadmap
  records in their subject locations even when dated.
- Update stable operating documents when behavior changes. Use dated handoffs
  for historical context, not as the permanent source of policy.
- Repair and verify relative links whenever documentation moves. Do not add
  secrets, personal information, or machine-specific private data.
