# Supabase migration workflow

DraftCenter's deployable database history lives in `supabase/migrations/`.
Supabase Branching and the GitHub integration read only that standard
subdirectory. The numbered SQL files retained directly under `supabase/` are
historical release artifacts and regression inputs; they are not an automation
source.

## Reconciled baseline

`20260726010406_remote_schema.sql` is the normalized SQL stored in Production's
existing July 26 `remote_schema` migration. Migrations 204 through 413 follow it
in their original release order. Their standard copies are byte-equivalent
after line-ending normalization and retain the human migration number in each
filename.

The fresh-chain replay also proved that Production's anonymous grant removal on
`personal_teams` was missing from the historical SQL. The standard-only bridge
`20260726010644_364_revoke_legacy_personal_teams_anon.sql` records that existing
privacy boundary before migration 365 asserts it. It is idempotent on
Production, denies anonymous table access, preserves the four authenticated
owner-policy operations, and does not change a private row.

Four Production changes had been displaced when historical root migration
numbers were reused. Standard migrations 414 through 417 recover match
availability, tester feedback, commissioner ownership repair, and match
scheduling from the exact historical files. Migration 418 restores three
service-only Operations tables and the remaining schema details. Migrations
419 and 420 normalize the Production routine definitions and direct privileges.
Migration 421 restores 14 badge definitions and the retired
`pokemon-champions` alias that predate migration 204 and therefore could not be
present in a schema-only baseline.

Migration 422 is the forward-only recovery for a partial Production replay of
migrations 204 through 248 during the migration-history repair release. It
restores the 16 affected functions from a fresh replay of migrations 204
through 421 and removes the retired weekly-claim-cycle overload again.

A separate historical security-lint file was deliberately excluded after the
fresh replay proved it never ran in Production: applying it would have added a
Daily Games export policy and changed future function grants. Git history alone
is not evidence that a migration reached Production.

The current Production security and performance advisors were re-audited on
August 17, 2026 after migration 433. Both returned zero findings. That fresh
evidence does not justify a replacement security-lint migration; the excluded
historical file remains unapplied and must not be repurposed as migration 382
or any other current migration.

The complete chain was proved on a fresh data-less branch. Its audited public
schema matched Production across 158 relations, 1,431 columns, 1,042
constraints, 348 indexes, 55 policies, 392 routines, 45 triggers, 12 sequences,
and the direct schema/table/routine privilege sets. Routine comparison
normalizes CRLF versus LF because line endings do not change PostgreSQL
behavior. Public seed datasets also matched after excluding import timestamps;
the finalized Victory Road bracket event is runtime Production data and is not
copied into a data-less branch.

Register already-applied versions in Production migration history only with
their exact SQL text and only after this replay evidence passes. Do not replay
the historical DDL or copy private/runtime rows. After registration, create a
second fresh branch and repeat schema, RLS, grant, reference-data, advisor, and
application checks before calling the history repaired.

## New migrations

1. Find the next unused human migration number from both the historical root
   files and standard filenames.
2. Create one forward-only file named
   `supabase/migrations/<UTC timestamp>_<number>_<snake_case_name>.sql`.
3. Add focused regression coverage under `supabase/tests/` and verify affected
   RLS policies and grants.
4. Run `npm run test:supabase-migrations` plus the narrowest feature tests.
5. Push the branch and require the Supabase Preview check to apply the migration
   successfully before merge.
6. After authorized merge, verify the exact Production migration version and
   database postflight. Never rewrite a standard migration that may have run.

Do not add a second root-level copy for migration 414 or later. The historical
204-413 copies remain only to preserve existing links, generated-data tooling,
and release records.
