# Supabase migration-history reconciliation

- Date: August 18, 2026 Pacific
- Production project: `eukexfqpiuidwygllaye`
- Scope: migration-history metadata for migrations 429 through 438 only
- Schema or application-data change: none

## Outcome

Production's migration history now uses the exact timestamps from the standard
files under `supabase/migrations/`. The reconciliation changed only the
`version` primary key on ten existing rows in
`supabase_migrations.schema_migrations`. It did not execute migration SQL,
change a table, function, policy, grant, index, trigger, sequence, provider
setting, environment variable, or application row.

The final local and Production histories each contain 233 versions. Their sets
are identical, with `20260818080111` as the latest version.

## Exact mapping

| Migration | Previous Production version | Repository version |
| --- | --- | --- |
| 429 | `20260817230435` | `20260817234500` |
| 430 | `20260818001231` | `20260818003000` |
| 431 | `20260818011145` | `20260818010000` |
| 432 | `20260818011149` | `20260818010001` |
| 433 | `20260818011152` | `20260818010002` |
| 434 | `20260818020922` | `20260818015000` |
| 435 | `20260818072020` | `20260818044408` |
| 436 | `20260818072029` | `20260818053222` |
| 437 | `20260818072325` | `20260818060829` |
| 438 | `20260818090807` | `20260818080111` |

The inverse of this table is the complete rollback map. Because the repair
preserved every non-version field, an inverse primary-key remap would restore
the prior ledger without changing stored SQL or application state.

## Proof before the write

- The exact connected Production project was healthy in `us-west-2`.
- All ten previous versions existed and none of the ten repository versions
  existed.
- The history table contained 233 rows, only numeric versions, and no foreign
  key referenced its rows.
- Migrations 429, 430, 432, and 435 through 438 had identical SQL fingerprints
  after comments and whitespace were removed.
- The executable bodies of migrations 431 and 433 were identical; their local
  files additionally contain only `COMMIT` and a PostgREST schema-reload
  notification.
- The executable body of migration 434 was identical; its local file
  additionally contains only `BEGIN`, `COMMIT`, and the same PostgREST
  schema-reload notification.
- A local database URL was rejected after preflight showed it was not scoped to
  the exact Production project. It was not used for any operation.
- The public-schema metadata baseline contained 3,427 items with fingerprint
  `c19c1400d0f4d13e14461b2c6d93171f`.

## Repair method

The owner explicitly authorized the reconciliation. The exact connected
Supabase session performed one transaction with lock and statement timeouts,
precondition assertions, a ten-row version remap, a changed-row assertion, and
postcondition assertions. This provides the migration-history-only effect of
Supabase's documented repair workflow while retaining the existing `name`,
`statements`, `created_by`, `idempotency_key`, and `rollback` fields rather than
rebuilding them.

The transaction committed only after it proved that all ten old versions were
absent and all ten repository versions were present. Total history remained
233 rows.

## Verification

- Every non-version row-content fingerprint matched its pre-repair value.
- The public-schema item count and fingerprint remained exactly 3,427 and
  `c19c1400d0f4d13e14461b2c6d93171f`.
- Production remained `ACTIVE_HEALTHY`.
- Local and Production histories were 233-for-233 identical with no local-only
  or remote-only version.
- `npm run test:supabase-migrations` passed.
- The existing Supabase branch set was unchanged and no paid Preview branch was
  created.
- The post-repair advisor sweep contained no error-level security or
  performance finding. The 420-item security set remained the established
  informational/warning baseline. The 239 performance notices were also only
  informational or warning level, with no repair-specific finding.

## Prevention

Production should normally receive a new migration from the exact standard
file through the protected Supabase GitHub integration after merge. If an
owner-authorized emergency path records a generated timestamp instead, the
same release must prove SQL equivalence and reconcile that row to the standard
repository timestamp before the release is considered complete.
