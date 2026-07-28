# Pre-rehearsal operator sequence

Run these steps from the cleanup branch for validation. Do not deploy the cleanup
branch over the frozen rehearsal candidate.

## Local quality and public production smoke

```powershell
pnpm check
pnpm smoke:production
```

To include the public league route:

```powershell
$env:DRAFTCENTER_SMOKE_LEAGUE='concurrency-rehearsal-jul-27-9nnn5'
pnpm smoke:production
Remove-Item Env:DRAFTCENTER_SMOKE_LEAGUE
```

## Read-only database preflight

In the Supabase SQL editor, run:

1. `ops/sql/rehearsal-health-report.sql`
2. `ops/sql/verify-rehearsal-ownership.sql`

Expected disposable state:

- exactly one commissioner;
- Surat owned by OmniSports;
- Artazon owned by MyFriendMalamar;
- remaining teams open;
- no ownership mismatches;
- no unexplained failed notifications.

## Two-account collision harness

The harness is intentionally excluded from `pnpm check` because it changes the
disposable league briefly and requires two test-account credentials.

Set these values only in the local shell or `.env.local`; never in Vercel:

- `DRAFTCENTER_CONCURRENCY_USER_A_EMAIL`
- `DRAFTCENTER_CONCURRENCY_USER_A_PASSWORD`
- `DRAFTCENTER_CONCURRENCY_USER_B_EMAIL`
- `DRAFTCENTER_CONCURRENCY_USER_B_PASSWORD`

The accounts must be OmniSports and DraftCenter. Then run:

```powershell
pnpm test:concurrency
```

The command:

1. verifies the exact disposable league and test-account identities;
2. requires Littleroot Mudkips to be open;
3. submits both claims concurrently;
4. requires one success and one `already claimed` rejection;
5. verifies snapshot and relational ownership identify the same winner;
6. restores the exact snapshot and relational ownership captured before the
   test, even when an assertion fails.

Do not run the harness while another person is using the disposable league.

## Mutating reset

Use `ops/sql/reset-disposable-rehearsal.sql` only when the disposable league
needs restoration. Immediately follow it with
`ops/sql/verify-rehearsal-ownership.sql`.

Never change the reset script's slug or account guards to target another league.

## Final release check

Before the supervised rehearsal:

1. Confirm the canonical domain still points to
   `dpl_CQVxzSULkrtNzSnCapoqCTaSN3Ht`.
2. Confirm the application remains at tagged commit `351f3ba`.
3. Confirm migration 237 is present in the production ledger.
4. Send at most one disposable notification to the known test destination.
5. Record the correlation ID and delivered/skipped/failed counts.
