# DraftCenter

DraftCenter is a hosted Pokémon draft-league platform for commissioners,
managers, and spectators. It supports league setup, snake and auction drafts,
teams, schedules, transactions and claims, results, playoffs, community
features, calendar events, and notifications.

The canonical production site is
[www.draftcentral.gg](https://www.draftcentral.gg). The similarly named
`www.centraldraft.gg` address is an alias, not the canonical product URL.

## Technology

- Next.js App Router
- React
- Supabase Auth, Postgres, Storage, and database functions
- Vercel hosting and scheduled functions
- Discord and Resend integrations
- pnpm

## Local setup

Requirements:

- Node.js 20.9 or newer
- pnpm 11.9
- access to a non-production Supabase project

Install and run:

```text
pnpm install --frozen-lockfile
copy .env.local.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

Fill `.env.local` with development or staging values. Do not use production
service-role keys for ordinary local development and never commit `.env.local`.

## Configuration

Browser-safe values:

- `NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL`
- `NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_DISCORD_INSTALL_URL`
- `NEXT_PUBLIC_DRAFTCENTER_RELEASE`

Server-only values:

- `DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DRAFTCENTER_SITE_URL`

Use the dedicated DraftCenter Supabase variables. Generic Supabase/Postgres
variables may point to a different legacy project and should not be treated as
authoritative.

## Checks

```text
pnpm test
pnpm build
pnpm check
pnpm audit --prod
```

`pnpm audit --prod` currently reports the documented high-severity `xlsx`
advisories. The dependency is retained only for export compatibility and must
not be used to parse uploads, request bodies, or remote workbooks. See
`docs/dependency-security-2026-07-27.md`.

## Project structure

- `src/app/` — pages and server routes
- `src/components/` — product UI
- `src/lib/` — shared clients and operational helpers
- `supabase/` — historical forward-only SQL migrations
- `docs/` — operating, testing, release, and recovery documentation
- `test/` — automated checks

`src/components/PokemonDraftLeague.jsx` is the current large league application
surface. Refactor it incrementally behind automated behavior checks; do not
replace it wholesale during stabilization.

## Database changes

Production migrations are forward-only:

1. Confirm the exact Supabase project before running SQL.
2. Inspect the production migration ledger.
3. Add a new numbered migration.
4. Never edit or routinely rerun an applied migration.
5. Verify permissions, grants, RLS, and behavior.
6. Record the applied environment and evidence.

Do not apply production migrations from an unverified generic Supabase
connection.

## Releases

Before changing Production, read:

- `docs/release-state-runbook.md`
- `docs/notification-dispatch-runbook.md`
- `docs/data-retention-and-recovery.md`
- `docs/launch-stabilization-checklist.md`

Production code identity comes from Vercel's active deployment, not merely the
current local branch. Database identity comes from the dedicated Supabase
project and its migration ledger.

The intended long-term workflow is one protected production branch, required CI,
intentional promotion, a canonical-domain smoke test, and a recorded rollback
deployment.

## Safety rules

- Preserve unrelated working-tree changes.
- Never commit credentials, browser sessions, private notes, or unmatched
  availability.
- Use separate real accounts for permission/privacy tests.
- Keep consequential multiplayer mutations server-authoritative.
- Do not rehearse destructive operations in the public league.
- Do not expose production service-role credentials to general preview branches.

## Discord authentication

Discord sign-in uses the Supabase Auth Discord provider and `/auth/callback`.
Enable Discord under Supabase Authentication -> Providers, use the Supabase
project callback URL in the Discord developer application, and allow
`http://localhost:3000/auth/callback` plus each deployed callback URL in
Supabase URL Configuration.

This sign-in provider is intentionally separate from the profile and
league-server Discord connection under `/api/discord/oauth/*`, which continues
to use the server-only `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
