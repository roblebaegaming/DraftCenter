# DraftCenter agent handoff: Worlds odds release and continuation

- Date: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- English Worlds page: https://www.draftcentral.gg/worlds/2026/vgc
- Italian Worlds page: https://www.draftcentral.gg/it/worlds/2026
- Release pull request: [#276](https://github.com/roblebaegaming/DraftCenter/pull/276)
- Release application commit: `b150de459bf3aba15d51b712a87fb01ef75367aa`
- Verified Production merge commit: `5a7b8f6b1291bb29fb1765d1a5bc3170f6950369`
- Latest applied Production migration: 413

## Released behavior

The Worlds VGC page now includes a Top 10 champion outlook derived from the
complete 438-competitor invite-earned snapshot. The initial configurable model
weights are season standing and form 35%, event wins 20%, International wins
15%, Worlds titles 15%, and community picks 15%. The full probability
distribution totals 100%, and every competitor is capped at 5% before Worlds.

The outlook links to the official VGC Masters season standings and explains
that Japan, Korea, and Asia-Pacific use regional equivalents because their
qualification systems do not map directly to the Championship Points
leaderboard. The model wording distinguishes invite-earned competitors from
confirmed attendees and records withdrawals separately. English and Italian
copy and responsive layouts are live.

## Privacy and database boundary

Forward-only migration 413 adds
`get_worlds_vgc_champion_popularity_2026()`. The SECURITY DEFINER function has
an explicit `public, pg_temp` search path, returns only complete-entry counts,
and exposes community popularity only after 25 complete entries. Anonymous and
authenticated clients may execute that bounded aggregate; the service role is
not granted execution through the public API. Direct anonymous and
authenticated reads of Worlds entry rows remain denied. All three Worlds tables
retain forced RLS.

Production preflight found 438 competitors and 17 complete entries. After
migration 413, the function returned `entry_count = 17`,
`sample_ready = false`, 438 safe competitor objects, and zero nonzero pick
counts. Therefore the release did not expose a lineup or use a private early
community signal. Focused regression coverage also proved the exact boundary
at 24 entries, 25 entries, and after lock.

Migration 413 was applied as the repository's established manually released
forward SQL after an exact-project read-only preflight. It was not inserted
into the provider migration ledger because that ledger currently contains only
the imported remote-schema baseline while the repository's later numbered SQL
files live outside the standard migrations directory. Treat this mismatch as
an active automation-repair task, not as permission to replay migrations or
rewrite Production history.

## Release evidence

- `pnpm audit --prod --audit-level high`: passed with no known high-severity
  Production dependency vulnerability.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 rows.
- Environment-backed `npm run build`: passed with 305 static pages.
- Pull request security, secret-scan, JavaScript analysis, Supabase Preview,
  and Vercel checks passed.
- Vercel deployed exact merge commit `5a7b8f6` to Production.
- `npm run smoke:production`: the complete public sweep and protected 401
  boundaries passed after deployment.
- English desktop at 1440 by 1000 and mobile at 390 by 844 showed the Top 10,
  official standings link, model weights, 17-entry state, no horizontal
  overflow, and no browser errors.
- Italian mobile at 390 by 844 showed the localized Top 10, standings link,
  privacy threshold, weights, and 17-entry state with no overflow or errors.
- The temporary Supabase branch used for release validation was deleted by its
  exact branch identifier. It had no lasting fixtures or user data.

## Continuation order

1. Reconcile the Supabase GitHub integration and migration history in an
   isolated branch. Prove a fresh branch receives the intended schema before
   considering any Production ledger repair.
2. Build and release the permanent tournament directory and durable public
   entrant-bracket URLs. Entrant brackets remain unavailable before lock; use
   public opaque identifiers rather than account identity in URLs and payloads.
3. Add Spanish Worlds localization in a separate protected pull request after
   the tournament directory release.
4. Audit Pokédex Tracker data quality and implement the highest-priority
   evidence-backed corrections without changing private tracker progress.

## Preserved boundaries

No real league, draft, roster, team, account, provider setting, environment
variable, authentication setting, or secret changed. Production entry rows
were not read through the browser, no private lineup was inspected, and no
Worlds submission was modified. The original dirty workspace, Mushroom Cup,
and the intentionally paused Mushroom Hut drafts were untouched.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Worlds odds model: [`../worlds-2026-champion-outlook.md`](../worlds-2026-champion-outlook.md)
- Prediction-bracket contract: [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
