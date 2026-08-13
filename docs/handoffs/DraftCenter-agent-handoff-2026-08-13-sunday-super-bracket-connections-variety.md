# DraftCenter handoff: Sunday Super Bracket and Connections variety

Date: August 13, 2026

## Scope

This release candidate adds a Sunday weekly final to the existing Daily Draft
Bracket and replaces independent Connections shuffles with a deterministic,
history-aware rotation. It does not change a real league, roster, draft,
provider setting, environment variable, secret, or existing user submission.

## Product behavior

- Monday through Saturday retain the ordinary eight-Pokémon Daily Draft
  Bracket.
- Sunday uses the six community champions from those days and enough
  performance wildcards to produce eight unique entrants. Under normal
  conditions this is the requested six winners plus two non-winners.
- Repeated daily champions occupy one place; each duplicate opens one more
  wildcard place.
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
  exact themes have a seven-day cooldown, categories cannot repeat on
  consecutive days, and each board uses four distinct categories and sixteen
  unique Pokémon.

The permanent contract is in [`../daily-games.md`](../daily-games.md).

## Database and security

Forward-only migration 388 adds `bracket_kind` and private qualification
metadata to the existing bracket table. Browser clients continue to use
bounded security-definer RPCs and retain no direct table access. The finalizer
is service-role-only; the read-only context RPC is available to anonymous and
authenticated clients. A trigger blocks pending Sunday submissions.

The isolated transaction matrix is
[`../../supabase/tests/388-sunday-super-brackets-preview-regression.sql`](../../supabase/tests/388-sunday-super-brackets-preview-regression.sql).
It must run against the isolated Supabase Preview before release; local Docker,
PostgreSQL, and the Supabase CLI were not present in this workspace.

## Validation

Passed locally:

- production dependency audit: no known vulnerabilities;
- focused Daily Games, release-integration, and notification-security tests;
- a ten-year Connections rotation simulation;
- every suite after the repository's pre-existing Draft Lab catalog drift gate;
- National Dex paging across 1,027 rows;
- the optimized 243-page build;
- desktop and 390×844 browser review, one complete Connections group, no
  horizontal overflow, and no browser console errors.

`npm run test:all` stops only at `draft-lab:build-catalog --check` because the
current-main generated Draft Lab catalog is stale. This branch does not modify
the Draft Lab source or generated catalog; its eight analysis tests pass when
run directly, and all subsequent suites pass.

Do not run `npm run smoke:production` until the exact application and migration
are deployed. Before release, require the protected checks, isolated migration
matrix, desktop/mobile Preview review, migration 388 RLS/grant verification,
confirmed production commit, and signed-out production smoke sweep.
