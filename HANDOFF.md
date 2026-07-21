# DraftCenter — Setup & Change Handoff

This document records everything that was done to get the project running, so any
developer or AI agent can pick up from a known-good state.

## Stack
- **Framework:** Next.js (App Router) + React, JavaScript (`.js`/`.jsx`)
- **Package manager:** pnpm
- **Backend:** Supabase (Auth + Postgres + Realtime)
- **Supabase client:** `@supabase/ssr` (`createBrowserClient`)

## Environment variables (provided by the Supabase integration)
The app reads these at runtime and build time:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These are auto-injected by the connected Supabase integration on Vercel. Locally
they live in `.env.development.local`. If you see the error
`@supabase/ssr: Your project's URL and API key are required`, the vars simply are
not present in that environment — connect Supabase / add the vars and restart.

## What was fixed during setup
1. **Imported the codebase** from an uploaded ZIP (Windows-zipped) into the repo.
2. **Fixed `pnpm-workspace.yaml`** — it contained an invalid placeholder value that
   broke `pnpm install`.
3. **Connected Supabase** and restarted the dev server so env vars load. Next.js
   only reads env vars at server start, so a restart is required after connecting.
4. **Applied the full database schema** (see below). The DB was empty on arrival.
5. **Verified the production build passes** when Supabase env vars are present.

## Database schema (applied to Supabase, in order)
All SQL lives in `supabase/` and was executed against the Supabase project in this
exact order. Re-running is safe (idempotent: `if not exists`, `create or replace`,
`drop policy if exists`).

- `001-supabase-schema.sql` — **RECONSTRUCTED base schema.** The original base file
  was missing from the upload, so it was rebuilt from what migrations 002–005 and
  the app code require. Creates:
  - `membership_role` enum (`commissioner`, `co_commissioner`, `coach`, `viewer`)
  - Tables: `profiles`, `leagues`, `league_memberships`, `teams`, `league_pokemon`,
    `roster_entries`, `draft_sessions`, `draft_picks`
  - Helper fns: `is_league_member(uuid)`, `is_league_staff(uuid)`
  - RLS enabled on all tables + read policies
- `002-create-profiles-on-signup.sql` — `handle_new_user()` trigger on `auth.users`
  that auto-creates a `profiles` row on signup.
- `003-league-hub-and-state-bridge.sql` — `league_state_snapshots`, `league_invites`
  tables + `create_league(...)` and `save_league_snapshot(...)` RPCs.
- `004-secure-draft-core.sql` — `league_events` table, roster ownership index,
  and RPCs `claim_team`, `start_snake_draft`, `make_snake_pick`; adds tables to the
  `supabase_realtime` publication.
- `005-public-league-discovery.sql` — `join_public_league(text)` RPC.

**Result:** 11 tables and 9 functions in the `public` schema, RLS active.

> NOTE: `001` is a reconstruction. If the original base schema is ever recovered,
> diff it against `001` before relying on exact column parity.

## Known configuration still required (not code)
- **Supabase Auth → URL Configuration:** set **Site URL** and **Redirect URLs** to
  the deployed domain.
- **Supabase Auth → Email:** the built-in email service is heavily rate-limited
  (`email rate limit exceeded`). For testing, turn OFF "Confirm email". For
  production, configure custom SMTP.

## Vercel
- Single project: **`draftcenter`** (a duplicate empty project was deleted).
- Connected GitHub repo: `roblebaegaming/DraftCenter`.
