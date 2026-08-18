# Supabase migration-history reconciliation: migration 439

- Date: August 18, 2026 Pacific
- Scope: migration-history metadata for migration 439 only
- Schema or application-data change from reconciliation: none
- Repository version: `20260818220437`
- Previous Production version: `20260818224616`
- Documentation pull request: [#324](https://github.com/roblebaegaming/DraftCenter/pull/324)

## Outcome

Production's migration history now records the exact repository timestamp for
`20260818220437_private_tournament_demo_mode.sql`. The schema migration itself
executed exactly once. The later reconciliation changed only the `version`
primary key on its existing row in `supabase_migrations.schema_migrations`.

The final local and Production histories each contain 234 versions and their
sets are identical, ending at `20260818220437`.

## Proof before the write

- The previous Production version existed exactly once and the repository
  version did not yet exist.
- The history table contained 234 rows and no foreign key referenced its rows.
- Normalized local and stored SQL had the same MD5 fingerprint:
  `cbded131c0426a3828573dfc31d801bc`.
- The public-schema metadata fingerprint was
  `33a0c086f855c19b8f53de9e4c193e5a`.

## Repair and verification

One transaction remapped `20260818224616` to `20260818220437` with precondition
and postcondition checks. It preserved the migration name, statements,
creation metadata, idempotency key, and rollback metadata.

After commit:

- the previous version was absent and the repository version existed exactly
  once;
- total migration history remained 234 rows;
- every non-version field was unchanged;
- the public-schema fingerprint remained
  `33a0c086f855c19b8f53de9e4c193e5a`; and
- local and Production migration sets matched 234-for-234 with no local-only or
  remote-only version.

This was the same owner-approved history-only procedure documented for
migrations 429 through 438 in
[`docs/supabase-migration-history-reconciliation-2026-08-18.md`](supabase-migration-history-reconciliation-2026-08-18.md).
It did not rerun migration SQL or change application data, policies, grants,
provider settings, environment variables, or Preview branches.
