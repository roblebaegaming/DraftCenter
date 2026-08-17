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

The reconciliation does not replay any migration against Production. Before
the reconciliation release, prove the full chain on a fresh data-less Preview
branch. Then register the already-applied versions in Production migration
history with their exact SQL statements so later branches can reconstruct the
same state. Verify Production schema counts, RLS, grants, application checks,
and a fresh branch after the history update.

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
