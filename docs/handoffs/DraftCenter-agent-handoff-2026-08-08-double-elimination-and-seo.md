# DraftCenter handoff — double elimination and SEO measurement

Date: August 8, 2026

## Outcome

Standalone double elimination and the requested external SEO measurement are
complete at the review checkpoint in [pull request
90](https://github.com/roblebaegaming/DraftCenter/pull/90). The pull request is
open and ready for review. CodeQL, repository security, the full-history secret
scan, Vercel, and preview feedback are green. The automatic Supabase check was
skipped, so the isolated manual Preview evidence below remains the database
proof. Nothing in this release has been merged, applied to the production
database, or deployed.

The separate Draft Tournament concept is not complete. Its exact scope and
missing lifecycle are recorded in
[`../draft-tournament-concept.md`](../draft-tournament-concept.md).

## Double-elimination release

Branch: `codex/standalone-double-elimination-2026-08-08`

Commit: `2f585b7`

Migration 355 adds:

- single- or double-elimination selection at tournament creation;
- bounded 4–64 entrant double-elimination graphs;
- winners and losers brackets, a Grand Final, and a conditional bracket reset;
- deterministic byes and atomic winner/loser routing;
- compatibility with the existing single-elimination format;
- commissioner forfeits, drops, disqualifications, corrections, and second-loss
  handling inside the existing recovery boundary;
- private graph internals, RLS-backed tables, explicit RPC grants, audit events,
  and revision protection;
- stage-aware bracket navigation and mobile round selection.

The isolated Supabase Preview branch is
`double-elimination-pr-2026-08-08`. Its baseline did not contain the recent
tournament schema, so migrations 340 and 354 were loaded there before migration
355. The production database and the retained `multi-pod-pr-82` branch were not
used or changed.

The Preview matrix passed every assertion:

- browser and service-role grants;
- single-elimination compatibility;
- graph structure and routes;
- five-entrant bye routing;
- Grand Final with a required reset;
- Grand Final without a reset;
- dropped-entrant elimination after the second loss;
- projection privacy;
- synthetic fixture cleanup.

An independent post-check confirmed that tournament and match RLS remained
enabled, the internal graph helper was unavailable to browser roles, the
commissioner lock RPC was available to authenticated users, and zero synthetic
tournaments remained.

## Validation

- Production dependency audit: no known vulnerabilities.
- Full application tests: passed.
- Tournament tests: 44 of 44 passed.
- National Dex paging: all 1,027 rows passed.
- Production-style build: passed with 180 generated pages.
- Migration 355 and the expanded Preview transaction matrix: passed.
- Diff whitespace check: passed.
- Pull-request CodeQL, security, secret-scanning, Vercel, and preview-feedback
  checks: passed.
- The signed-out Vercel `/tournaments` Preview rendered the new format language
  cleanly. Its tournament RPC remains intentionally unavailable because that
  application Preview is not connected to the manually migrated database
  branch.
- Production smoke was not run because this branch is not deployed.

## SEO checkpoint

The complete evidence is in
[`../seo-measurement-2026-08-08.md`](../seo-measurement-2026-08-08.md).

Key readings:

- Semrush crawled 1,544 pages after the limit was expanded from 100 to 5,000;
- Site Health is 83%, with 85 errors, 1,506 warnings, and 519 notices;
- the highest-priority error group is 71 invalid structured-data items;
- Search Console reported four clicks, 1,592 impressions, 0.3% CTR, and average
  position 40.6 in the available seven-day view;
- the successful sitemap reported 1,496 discovered pages;
- 414 submitted pages were indexed and 1,012 were not indexed, primarily
  “discovered — currently not indexed”;
- five sampled public URLs were on Google and self-canonical.

The Semrush account permits one Position Tracking target. The existing
Australia desktop target and its history were preserved. US desktop/mobile
targets require an upgrade or explicit approval to replace the current target
and lose that history.

## Multi-pod and Draft Tournament status

The deployed multi-pod foundation creates organizations, seasons, shared rule
snapshots, administrators, and links to existing leagues as independent pods.
The organizer-facing behavior and choices are in
[`../multi-pod-organizer-guide.md`](../multi-pod-organizer-guide.md).

Qualification and connected championships are still future multi-pod phases.
The Draft Tournament is also still future work: it needs one event draft,
roster lock, Swiss pairing and standings, optional top cut, and full recovery
testing across phase transitions.

## Safety and preserved state

- Production remains on migration 354.
- No real tournament, league, draft, roster, entrant, result, provider secret,
  or production user was changed.
- The retained `multi-pod-pr-82` Preview branch remains untouched and must not
  be deleted during routine cleanup.
- The new `double-elimination-pr-2026-08-08` Preview branch is billable and was
  deliberately left in place for review; deletion requires an explicit cleanup
  decision.
- The original DraftCenter workspace still has 37 pre-existing changed paths;
  none were staged, committed, hidden, discarded, or overwritten.

## Next safe order

1. Review pull request 90, its Vercel Preview, and migration 355 as a separate
   release. All automated checks are green.
2. Confirm the production release boundary and database target.
3. With explicit production approval, merge pull request 90.
4. Apply migration 355 to the exact production project, verify RLS and grants,
   confirm the deployed commit, and run the signed-out production smoke sweep.
5. Decide whether to remove only the new double-elimination Preview branch to
   stop its hourly charge. Do not remove `multi-pod-pr-82`.
6. Continue with multi-pod qualification, then connected championships. Build
   the Draft Tournament workflow as a later independent release.
