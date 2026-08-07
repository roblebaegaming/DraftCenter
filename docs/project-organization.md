# Project organization

DraftCenter is a single Next.js application. The repository keeps route entry
points, reusable interface code, server and domain helpers, database changes,
tests, and operational notes in separate top-level areas.

## Directory map

```text
DraftCenter/
|-- .github/          Dependency and security automation
|-- data/             Pinned catalog and competitive-data artifacts
|-- docs/             Product, operations, security, and handoff notes
|-- public/           Files served directly from the site root
|-- scripts/          Production smoke tests and targeted verification tools
|-- src/
|   |-- app/          Next.js App Router pages, layouts, metadata, and APIs
|   |-- assets/       Source-controlled fonts and their licenses
|   |-- components/   Reusable and feature-level React components
|   `-- lib/          Domain logic, security helpers, and service clients
|-- supabase/         Ordered database migrations and email templates
|-- test/             Node test-runner suites
|-- AGENTS.md         Durable repository and production safety policy
|-- package.json      Dependencies and supported development commands
|-- next.config.mjs   Next.js, Turbopack, and HTTP security configuration
`-- vercel.json       Deployment schedules and Vercel configuration
```

Generated and machine-local directories such as `.next/`, `.vercel/`, and
`node_modules/` are not source code. Do not document or depend on files inside
them. The `.vercel/` directory contains local deployment linkage and must not
be committed.

## Application source

### `src/app`: routes and request boundaries

This project uses the Next.js App Router. A folder containing `page.js` defines
a web page; a folder containing `route.js` defines an HTTP endpoint. Bracketed
folders such as `[slug]`, `[name]`, and `[id]` are dynamic route segments.

- Public discovery and content live under `explore`, `formats`, `guides`,
  `leagues`, `pokemon`, and `resources`.
- Authenticated league workflows begin under `league` and `my-teams`.
- Internal operator screens live under `operations`.
- User assistance and policy pages live under `manuals`, `support`, and `legal`.
- Server endpoints live under `src/app/api`, grouped by capability such as
  Discord, Twitch, notifications, support, and operations.
- Site-wide metadata and presentation are defined by `layout.js`, `globals.css`,
  `manifest.js`, `robots.js`, and `sitemap.js`.

Keep route files focused on routing concerns: metadata, parameter handling,
authorization boundaries, and composition. Put reusable UI in `src/components`
and shared business or service logic in `src/lib`.

### `src/components`: interface and feature modules

Components range from small shared controls to complete product surfaces.
Names describe the surface they implement, for example `LeagueHub`,
`PersonalTeams`, `PokemonDirectory`, and `OperationsDashboard`.

`PokemonDraftLeague.jsx` is the legacy core application surface and is much
larger than the other modules. Changes there should be kept narrowly scoped and
tested against the affected league workflow. New independent functionality
should be extracted into a focused component or library module when practical.

### `src/lib`: shared logic and integrations

Library modules hold code that should not be owned by a page or component:

- `supabase/` contains browser, public-server, and privileged admin clients.
- `discord/` contains Discord role synchronization logic.
- `apiSecurity.js`, `apiRateLimit.js`, and the capability-specific `*Security.js`
  modules protect server endpoints.
- Catalog and content modules such as `regulation-catalog.js`,
  `publicPokemonIndex.js`, and `seoContent.js` provide reusable domain data.
- Operational modules such as `ownerOperations.js`, `supportAccess.js`, and
  `notificationDispatchAuth.js` centralize privileged workflows.

Never import an admin or server-only client into a client component. Public
Supabase configuration is separate from privileged credentials for this reason.

## Data and infrastructure

### `data`: pinned source artifacts

Source-controlled catalog and competitive-data artifacts live under `data/`.
Their builders and verification scripts live under `scripts/`, while focused
regressions live under `test/`. Treat generated artifacts as reviewed inputs:
regenerate them through their documented command, preserve source provenance,
and commit the builder, artifact, and verification changes together.

### `supabase`: database history

The SQL files are ordered, forward-only migrations. Each migration records a
database change and its security policy changes. Add a new migration for a new
schema or behavior change; do not rewrite a migration that may already have run
in another environment. Preserve the numeric prefix and use a descriptive,
hyphenated filename.

Email markup used by Supabase Auth lives in `supabase/email-templates`.

### `scripts` and `test`: verification

`test/` contains fast Node test-runner suites invoked by the `test:*` package
commands. `scripts/` contains broader checks that exercise catalogs, database
permissions, draft recovery behavior, or the deployed production site.

When adding a check:

- Put deterministic source-level behavior in `test/`.
- Put environment-dependent, production, or one-off integrity checks in
  `scripts/`.
- Add a discoverable command to `package.json` when the check is expected to be
  run repeatedly.

## Documentation

Use `docs/` for information that is useful to maintainers but does not belong
in source comments or the README.

- Stable operating procedures use topic names, such as
  `data-retention-and-recovery.md`.
- Time-bound audits, roadmaps, and handoffs include an ISO-style date.
- The README remains the short entry point for setup, release checks, and links
  to deeper guides.

When behavior changes, update the closest stable guide in the same change. A
dated handoff is a historical snapshot and should not be treated as the lasting
source of truth.

## Parallel agent workflow

Parallel feature work uses one user-designated integration agent. Supporting
agents work in isolated local worktrees and may make local commits, but they do
not push, change pull-request state, merge, deploy, apply migrations, or update
the canonical status. They hand the integration agent:

- the worktree and branch;
- the final local commit;
- focused and full validation completed;
- migrations created or required;
- files shared with another active task; and
- anything intentionally left undeployed.

The integration agent starts from current `origin/main`, reconciles final file
trees rather than replaying stacked branch histories, and is the sole owner of
remote changes. Release records must distinguish the feature-branch head, the
pull-request squash commit on `main`, the currently deployed commit, and the
latest applied production migration. Only the integration agent updates
`docs/CURRENT-STATUS.md` after verifying authoritative repository and
deployment state.

Keep one active release candidate per product area. Once a pull request is
merged or superseded, close its obsolete stacks and remove clean worktrees only
after preserving any unique local commit. Never remove or reset a dirty
worktree as part of routine cleanup.

## Where new work belongs

| Change | Primary location |
| --- | --- |
| New page or public route | `src/app/<route>/page.js` |
| New server endpoint | `src/app/api/<capability>/route.js` |
| Shared or feature UI | `src/components/` |
| Domain logic or service access | `src/lib/` |
| Pinned generated catalog or data artifact | `data/` |
| Database function, table, trigger, or policy | New `supabase/<number>-<name>.sql` migration |
| Unit or regression test | `test/` |
| Production or integrity verification | `scripts/` |
| Maintainer procedure or decision record | `docs/` |
| Directly served static file | `public/` |

Prefer the narrowest existing capability folder. Create a new folder only when
it establishes a boundary that more than one file will use.

## Change checklist

Before finishing a change:

1. Confirm secrets remain server-only and are not placed in `NEXT_PUBLIC_*`
   variables.
2. Add or update the narrowest relevant test.
3. Run that test, then the broader release checks appropriate to the change.
4. Add a forward-only migration for database changes.
5. Update stable documentation when setup, architecture, or operations change.
6. Keep generated output and local deployment linkage out of version control.
