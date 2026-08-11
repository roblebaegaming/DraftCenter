# DraftCenter handoff: 2026 Worlds release and monitoring

- Date: August 11, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: <https://www.draftcentral.gg/worlds/2026>
- Production branch: `main`
- Verified production application commit:
  `6c55ad6f50f562242c1a2e66dc90ae945624464c`
- Latest production migration: 375
- Current state: every safe completed Worlds change is deployed; activation
  work is waiting for official inputs

## Read this first

There is no completed application or database work waiting to ship. Pull
request [#139](https://github.com/roblebaegaming/DraftCenter/pull/139) is
merged, Vercel Production is Ready on its exact merge commit, and the live
Worlds hub plus TCG, Pokemon GO, and Pokemon UNITE routes show the newly
verified tournament structures.

The obsolete TCG Pick 16 draft, pull request
[#119](https://github.com/roblebaegaming/DraftCenter/pull/119), is closed and
was not merged. Do not reopen or reuse it. Production uses Pick 10 and Your
Champion for individual events.

The remaining work depends on official rosters, assignments, pairings, feed
permission, or scheduler authorization. Do not invent those inputs, activate
empty events, or change production merely to test the deployed preparation
work.

Read [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), this handoff, and
[`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work. The
source-by-source decision record is
[`../worlds-2026-tcg-go-unite-structure-audit-2026-08-11.md`](../worlds-2026-tcg-go-unite-structure-audit-2026-08-11.md).

## August 11 release truth

Pull request #139 published format guidance without opening any roster-driven
feature:

- TCG explains that Swiss rounds are attendance-dependent and can span at most
  two days, with Standard regulation mark H onward. The final Masters roster,
  exact round count, and pairings remain unpublished.
- Pokemon GO shows 32 pools advancing two Trainers each into double
  elimination. Friday is the Pools Phase, Saturday reduces the Final Phase to
  two Trainers, and Sunday is the Grand Final. Matches are generally
  best-of-three; Winners Final, Losers Final, and Grand Final are best-of-five.
  The officially linked organizer shell had zero players at review time.
- Pokemon UNITE shows Friday single round-robin groups, Saturday
  single-elimination playoffs, and the Sunday Final. Matches are generally
  best-of-three, while the Top Four and Final are best-of-five. Registered
  teams, groups, advancement details, pairings, teams per group, and the Group
  Stage match length remain unpublished.

TCG and GO remain empty draft database events. UNITE remains an offline team
setup contract without a database event. All three public routes remain
fail-closed for predictions, saving, polling, and standings until authoritative
fields pass review.

## Verification completed

The release passed:

- the 49-test focused Worlds suite;
- the production dependency audit;
- the complete application suite;
- National Dex verification across 1,027 rows;
- the optimized 236-page production build;
- protected dependency, security, secret-scan, JavaScript analysis, CodeQL,
  and Vercel checks;
- desktop and 390px route review without browser errors or horizontal
  overflow;
- Vercel Production verification for exact commit `6c55ad6`; and
- the signed-out production smoke sweep across all public routes and protected
  401 boundaries.

Focused live checks also confirmed the new content at `/worlds/2026`,
`/worlds/2026/tcg`, `/worlds/2026/go`, and `/worlds/2026/unite`.

No roster, prediction entry, bracket, result snapshot, database row, migration,
provider setting, environment variable, feed configuration, or production
scheduler changed during this release.

## Monitoring now active

The Codex heartbeat automation **Monitor 2026 Worlds official inputs** is
active on the continuation task. It runs at 9:00 AM and 5:00 PM Pacific and
checks authoritative official sources for:

1. TCG Masters final roster, confirmed Swiss round count, and pairings;
2. Pokemon GO registered competitors, pool assignments, bracket, and pairings;
3. Pokemon UNITE registered teams, group assignments, advancement details,
   Group Stage match length, and playoff pairings;
4. VGC Top Cut pairings; and
5. explicit results-feed permission or scheduler authorization.

The monitor may report source changes and recommend the smallest safe next
steps. It must not modify the repository, production data, provider settings,
environment variables, scheduler configuration, or deployment without explicit
authorization. This Codex heartbeat is not the disabled production results
importer and is not a Vercel or provider scheduler.

## Remaining activation gates

### VGC Top Cut

Keep `/worlds/2026/vgc/bracket` in its waiting state until the complete official
field and first-round pairings are published and reviewed. Use
[`../worlds-vgc-top-cut-announcement-checklist.md`](../worlds-vgc-top-cut-announcement-checklist.md).
Publishing the field is a production-data action and requires explicit owner
authorization.

### VGC live scoring

Keep the importer disabled. Do not add a feed URL, enable polling, or create a
provider schedule until the exact feed, event identifier, permission,
attribution, and event window are approved. Scheduler creation is a separate
production-provider action. Use
[`../worlds-vgc-results-feed-permission-request.md`](../worlds-vgc-results-feed-permission-request.md)
and [`../worlds-vgc-live-scoring.md`](../worlds-vgc-live-scoring.md).

### TCG and Pokemon GO

Wait for a final registered field rather than treating invite-earned,
qualification, or empty organizer lists as attendance. Reconcile identities,
aliases, withdrawals, replacements, regional programs, and duplicates. Create
a new forward-only activation migration after 375 only when the roster is
complete and reviewed.

### Pokemon UNITE

Preserve team-based entries. Do not create the production event or results
adapter until the official registered teams, group assignments, advancement
rules, pairings, and stable team aliases are known. Do not treat the existing
15 TPCi-managed qualification awards as the complete global field.

## Next-agent sequence

1. Read current production state before acting; historical source checks may
   be stale even when their documents remain accurate history.
2. Review any monitor alert against the linked official source and capture its
   retrieval time. A changed page is not automatically a complete roster or
   usable bracket.
3. If only part of a field appears, update the audit record if useful but keep
   the feature closed.
4. When a complete official input appears, prepare it locally, reconcile all
   identities, and obtain explicit authorization for the affected production
   action.
5. For database activation, add a new forward-only migration after 375 and run
   the focused roster, RLS, grant, privacy, scoring, and cleanup matrices in an
   isolated Supabase Preview.
6. Review the exact Vercel Preview at desktop and narrow mobile widths, then
   release one discipline at a time through a short-lived branch and protected
   pull request.
7. After an authorized merge, verify the exact Production commit and run
   `npm run smoke:production` signed out.

## Preserved boundaries

- Do not change a real league, draft, roster, bracket, prediction entry,
  deadline, result source, or provider setting for testing.
- Do not describe invite-earned competitors or qualification awards as
  confirmed attendance.
- Do not enable or schedule the results importer without the two distinct
  authorizations described above.
- Do not expose raw feed rows, account identifiers, private selections, email
  addresses, credentials, tokens, or provider correspondence.
- Do not automatically replay a timed-out mutation.
- Do not delete the retained `multi-pod-pr-82` Preview branch.
- Preserve the original DraftCenter workspace and all unrelated user changes.

## Definition of done

The current code and documentation work is done. The live site accurately
publishes every verified format fact available on August 11 while keeping all
roster-dependent experiences closed. The obsolete conflicting pull request is
closed, the official-input monitor is active, and no unreviewed official input
is waiting to be integrated.

When an older Worlds handoff conflicts with this document, this handoff,
[`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), and current authoritative
production state take precedence.
