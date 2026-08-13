# DraftCenter handoff: Sunday Super Bracket and Connections variety

Date: August 13, 2026

## Production record

The Daily Games release is deployed through application pull request
[#195](https://github.com/roblebaegaming/DraftCenter/pull/195). GitHub merged
the protected release as production commit
`f1aae4b5a9a6574b7134a311391718d7d5d9f440`. Vercel reports that exact `main`
commit Ready in Production, and the live site is
<https://www.draftcentral.gg/resources/daily-games>.

Forward-only migration 388 is applied to the exact core production project.
The first Sunday Super Bracket is scheduled for August 16, 2026. Production
preflight found its seeded bracket row, all six Monday-Saturday source rows,
and zero Sunday submissions. Postflight confirmed the row is a pending weekly
final, browser table reads are revoked, the finalizer is service-role-only,
the bounded context RPC is available to browser roles, and no Sunday submission
was introduced during deployment.

## Product behavior

- Monday through Saturday retain the ordinary eight-Pokémon Daily Draft
  Bracket.
- Sunday uses the six community champions from those days and enough
  performance wildcards to produce eight unique entrants. Under normal
  conditions this is six winners plus the two best-performing non-winners.
- A Pokémon that wins more than one daily bracket occupies one Sunday place;
  each duplicate opens one additional wildcard place.
- Wildcards and seeds rank by final wins, semifinal win percentage,
  quarterfinal win percentage, then Pokémon name.
- Sunday uses 1-vs-8, 4-vs-5, 2-vs-7, and 3-vs-6 first-round pairings.
- The lineup finalizes after Saturday closes at midnight Pacific through the
  existing hourly notification dispatch. It safely no-ops on other days and
  retries when source results are incomplete.
- Pending Sunday brackets hide the generic pre-seeded field and reject
  submissions. Finalized brackets retain qualifier sources and exact source
  dates for auditability.
- Connections boards before August 14, 2026 remain unchanged. Starting then,
  an exact group/title cannot recur within the preceding seven calendar days,
  categories cannot repeat on consecutive days, and each board uses four
  distinct categories and sixteen unique Pokémon.
- The Connections catalogue now covers roughly 80 strategy, measurement,
  shape, Egg Group, color, and other fact-backed themes. The schedule remains
  deterministic, so a date has the same board for every player.

The stable product contract is in [`../daily-games.md`](../daily-games.md).

## Database and security

Migration 388 adds `bracket_kind` and private qualification metadata to the
existing bracket table, marks future Sunday seed rows as pending weekly finals,
and installs the qualifier builder, finalizer, context RPC, and submission
gate. It also explicitly revokes Supabase's default browser privileges on the
two bracket tables. Browser clients continue through bounded
security-definer RPCs; server notification and Operations paths retain
service-role access.

The exact migration was rehearsed on the retained isolated
`multi-pod-pr-82` Supabase Preview branch. The rollback matrix in
[`../../supabase/tests/388-sunday-super-brackets-preview-regression.sql`](../../supabase/tests/388-sunday-super-brackets-preview-regression.sql)
passed all four recorded checks:

- RPC grants, RLS, and direct-table denials;
- eight-entry qualification with six daily winners and the correct wildcards;
- idempotent finalization; and
- rejection of submissions while Sunday qualification is pending.

The retained Preview branch now includes migration 388 and must not be deleted
without the owner's explicit approval. Do not replay migration 388 in
production; publish any later schema change as a new forward-only migration.

## Validation

The release passed:

- `pnpm audit --prod --audit-level high`, with no known vulnerabilities;
- 32 focused Daily Games, release-integration, and notification-security
  tests after the final database correction;
- a ten-year Connections schedule simulation;
- all eight Draft Lab analysis tests and every suite after the repository's
  unchanged generated-catalog drift gate;
- `npm run test:national-dex`, covering 1,027 rows;
- the optimized 243-page production build;
- desktop and 390×844 browser review, a complete Connections group, no
  horizontal overflow, and no browser console errors;
- the hosted Vercel Preview review;
- all six protected GitHub checks, with only the intentionally skipped
  automatic Supabase Preview check; and
- the post-deployment 19-check signed-out production smoke sweep.

`npm run test:all` still stops at the pre-existing
`draft-lab:build-catalog --check` generated-catalog drift gate on the prior
`main` baseline. This release does not modify the Draft Lab source or generated
catalog. The Draft Lab analysis suite and every later suite pass when run
directly.

## Preserved boundaries

- No real league, draft, roster, queue, membership, deadline, tournament, or
  existing Daily Games submission was changed to test or deploy this release.
- The intended production data change is limited to migration 388's schema,
  grants, functions, triggers, and future Sunday bracket classification.
- No provider setting, environment variable, secret, Supabase key, Vercel
  credential, or user identity was changed or disclosed.
- The original DraftCenter workspace's pre-existing local changes remained
  unstaged and untouched. Implementation, release, and this handoff used
  isolated worktrees.
- Main protection was not bypassed.

## Continuation

No application or database work from this release remains undeployed. On the
first Sunday, verify the ordinary Saturday bracket closes, the service-only
finalizer produces eight unique entrants, qualifier provenance is present,
and submissions open only after finalization. Begin with read-only logs and
authoritative database state; do not manually replay a timed-out finalizer
without first verifying the current Sunday row.

Broader Italian localization remains a separate future release. The existing
Italian Worlds route is live, but this Daily Games release does not add Italian
copy or locale infrastructure.
