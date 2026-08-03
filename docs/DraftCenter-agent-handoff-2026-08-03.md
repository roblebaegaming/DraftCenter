# DraftCenter agent handoff — August 3, 2026

- Production: https://www.draftcentral.gg
- Repository: `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter`
- GitHub: `roblebaegaming/DraftCenter`, protected branch `main`
- Production Supabase project: `eukexfqpiuidwygllaye`
- Latest verified functional production commit: `5ace5f2`
- Previous comprehensive handoff: `docs/DraftCenter-agent-handoff-2026-08-02-post-launch.md`

## Executive status

DraftCenter is approved for a monitored public launch and real drafts. The
confirmed launch blockers have been resolved. Production tests, builds,
required repository checks, deployments, and signed-out smoke sweeps passed for
the releases documented below.

No evidence of lost picks, corrupt rosters, or damaged active drafts was found.
Do not infer that an inactive or commissioner-paused league is broken without
authoritative state evidence and commissioner confirmation.

The only outstanding hands-on launch check is a human Cloudflare Turnstile pass
in a normal signed-out private browser. Strict Turnstile enforcement remains
off until that succeeds. This does not need to delay real drafting.

Optional Apple Mail, Samsung Email, or Thunderbird rendering coverage remains
non-blocking.

## August 3 production releases

### Community Discord routing — `f1282e1`, pull request #15

The Question of the Day and Daily Three were incorrectly sharing the
user-connected league-channel delivery path. This explained both the missing
community Question of the Day and a Daily Three post appearing in a league
channel.

The production behavior is now separated:

- Question of the Day posts only to `DISCORD_QOTD_CHANNEL_ID`.
- Daily Three results post only to
  `DISCORD_DAILY_THREE_RESULTS_CHANNEL_ID`.
- User-connected league channels no longer receive either editorial post.
- Commissioner league Discord settings no longer offer a Daily Three option or
  preview control.
- The hourly dispatcher evaluates configured local time zones and hours.
- Operational delivery claims prevent duplicate community posts and are
  released when delivery fails so a later hourly run can retry.
- League announcements and personal Discord DMs retain their existing,
  separate behavior.

The configured production community guild and channel variables already
existed before the code correction. Never expose their values or the bot token
in logs, documentation, or commits.

### Commissioner Help and guide clarity — `cf37b86`, pull request #16

Commissioners now have a prominent yellow **Help** button immediately beside
**Commissioner Tools** inside a league.

The commissioner manual now includes:

- a fast-answer panel at the top;
- direct links to league setup, draft preparation, and the draft-day checklist;
- the exact support path: **Commissioner Tools → Get help with this league →
  Create support request**;
- current **Commissioner Tools** wording instead of the obsolete **League
  Tools** label; and
- a mobile-safe layout with full-width 44-pixel action targets and no horizontal
  overflow at the tested narrow viewport.

The global donation link is now labeled **Support DraftCenter**, so it cannot be
mistaken for product help. The global **Help** link continues to open the
manuals.

### Owner-visible registered-user totals — `5ace5f2`, pull request #17

The owner-only Operations page now has a **Registered users** summary sourced
from Supabase Auth rather than the public profile table. It includes:

- total Auth accounts;
- accounts with an Email identity;
- accounts with a Discord identity; and
- accounts with both Email and Discord identities linked.

These are aggregate counts only. The endpoint and page do not expose emails,
Discord usernames, or per-user identity records.

Interpretation: **Discord identity** means Discord authentication is currently
attached to the account. A user who originally registered by email and linked
Discord later is counted in the Discord and linked totals; the number should not
be described strictly as “originally signed up through Discord.”

## Supabase performance incident and remediation

### Initial warning

Supabase warned that the production project was depleting its Disk IO budget.
The initial seven-day Infrastructure view showed approximately:

- CPU peak: 95%;
- memory: 65–73%;
- Disk IO budget consumed: rising from about 11% to 56%;
- disk used: about 16%;
- database size: 46–47 MB; and
- compute upgraded from Nano to Micro.

The 95% Infrastructure CPU value was the peak across the displayed seven-day
window, not current CPU. During the investigation, the hourly Database report
showed current CPU near 2.5%, so the database was not continuously saturated.

### Production safety during investigation

The investigation began read-only. No real league, draft session, pick, queue,
team, membership, snapshot, deadline, or user record was modified.

At release time production included:

- Mushroom Cup Draft League with an active slow-draft session;
- Mushroom Hut Draft League with a paused session; and
- a Mushroom Hut practice league with a paused session.

The newest pick associated with an active or paused session was timestamped
`2026-08-02 20:06:03+00`. The migration was released during a roughly 24-hour
quiet period after owner confirmation and did not query or update protected
league records.

### Confirmed cause: Community Explore aggregation

`public.get_public_explore()` was the clearest temporary-Disk-IO source.
Recorded variants in `pg_stat_statements` showed:

- mean execution around 500–617 ms;
- approximately 9.1 million temporary blocks read and written for one variant;
- approximately 3.2 million temporary blocks for another variant; and
- roughly 2,000 calls across the recorded statistics period.

The function repeatedly recalculated Community ADP, historical eligibility,
favorites, polls, and public-league information. Its aggregate and sorting work
spilled to PostgreSQL temporary disk.

### Confirmed cause: League Hub polling

League Hub refreshed every five seconds for every open dashboard. Each refresh
could request memberships and league metadata, public league cards, complete
league-state snapshots, and current-turn information. It continued in hidden
browser tabs.

### Migration 249: cached public Explore aggregates — `0956db8`

Migration: `supabase/249-cache-public-explore-aggregates.sql`

It:

1. renamed the original function to `public.get_public_explore_uncached()`;
2. revoked uncached execution from `public`, `anon`, and `authenticated`;
3. created private table `public.public_explore_cache`;
4. enabled RLS and revoked direct browser-role access to that table;
5. created a new public `get_public_explore()` wrapper;
6. cached only caller-independent `leagues`, `popularity`, and `adp` data for
   15 minutes;
7. continued calculating `signed_in`, the current poll, authenticated poll
   counts, and `selected_key` per caller; and
8. used a transaction-scoped advisory lock to prevent concurrent rebuilds when
   an expired cache receives a visitor burst.

Personalized poll data is never stored in the shared cache.

Production verification confirmed one shared cache row after population, no
personalized keys in the cached payload, no anonymous access to the uncached
function, and no anonymous direct read access to the cache table.

Migration 249 contains a commented rollback procedure. Rollback requires a
quiet period and restores the uncached function and intended grants before
dropping the cache.

### League Hub polling reduction — `0956db8`

`src/components/LeagueHub.jsx` now:

- uses a 60-second non-draft fallback interval instead of five seconds;
- pauses interval refreshes while the document is hidden;
- refreshes immediately when the tab becomes visible or the window regains
  focus;
- prevents overlapping refresh requests; and
- preserves immediate initial loading.

Active live-draft synchronization was deliberately not changed. It needs
separate multi-account and timing regression coverage before reducing its
polling fallback.

Regression coverage is in `test/performance-remediation.test.js` and runs with
`npm run test:performance`.

### Remaining performance workload

The following were observed but intentionally left for later work:

- `public.reconcile_autonomous_league_claims()` had about 11,356 calls with a
  mean near 784 ms.
- Supabase Realtime WAL processing had more than 816,000 recorded calls.
- Statistics included many complete-snapshot, Pokémon-pool, public-card, and
  private-queue reads.
- Active draft pages still combine frequent polling with Realtime.

Current concern immediately after remediation was assessed around 35/100. It
was not an emergency because current hourly CPU was low, disk space and database
size were healthy, the clearest temporary-IO source was remediated, Micro added
capacity, production validation passed, and no draft data was changed.

Continued monitoring is still necessary because Disk IO had already reached
56%, memory is relatively high for a 1 GB Micro instance, other broad scheduled
and Realtime workloads remain, and the post-remediation consumption rate needs
normal-draft-day evidence.

## Performance monitoring instructions

### Supabase Settings → Infrastructure

Use this for the seven-day overview. Disk IO is cumulative within its budget
period and is not expected to decrease immediately; watch its rate of increase.

- Approximately 56–65% after 24 hours: good.
- Approximately 65–75%: improved, but continue optimization.
- Above 80%: investigate remaining workload.
- 85–90%: high concern.
- Approaching 100%: consider temporary Small compute and immediate
  investigation.

Do not interpret the displayed seven-day CPU peak as current CPU.

### Supabase Observability → Database

Use **Last 60 Minutes** for current conditions.

- CPU below 50%: healthy.
- Sustained CPU 60–80%: watch.
- Sustained CPU above 80–90%: investigate.
- Memory below about 850 MB on Micro: generally acceptable.
- Memory consistently above 900 MB: investigate.
- Growing swap or sustained IOwait: investigate promptly.

### Supabase Observability → Query Performance

Monitor:

- `get_public_explore()` call count, duration, and temporary blocks;
- `reconcile_autonomous_league_claims()`;
- snapshot reads;
- Pokémon-pool reads;
- private-queue reads;
- public-league-card calls; and
- Realtime/WAL work.

Expected Explore behavior is one expensive rebuild approximately every 15
minutes followed by inexpensive cached requests.

## Validation completed

The August 3 releases collectively passed:

- 31 automated tests in the current full suite;
- the Next.js production compiler and TypeScript validation;
- GitHub full-history secret scan;
- security tests and production dependency audit;
- CodeQL JavaScript analysis on the protected pull-request releases;
- Vercel preview deployments;
- Vercel production deployments;
- live commissioner-manual desktop and mobile layout review;
- production `/explore` rendering after the cache release; and
- the signed-out production smoke sweep: all public routes returned 200 and all
  protected operations/account endpoints returned 401.

Performance commit `0956db8` was released through an owner-authorized direct
`main` bypass during the incident. GitHub recorded the bypass. Later Discord,
Help, and user-count releases used the normal protected pull-request workflow
and passed all required checks. Future non-emergency releases should continue
using pull requests.

## Authentication and email status

### Gmail flow complete

Gmail web passed confirmation, password reset, sign-in, and sign-out. The long
plus-alias signup failure was fixed in `e3ec339`, applied to production, and
verified with a fresh account. The temporary account was permanently deleted.

Apple Mail, Samsung Email, Thunderbird, or another renderer may be checked for
optional compatibility coverage but is not a launch blocker.

### Turnstile human check still pending

Turnstile remains staged fail-open. The widget and public site key are live,
but strict application enforcement and Supabase Bot and Abuse Protection remain
disabled until a person completes the real widget in a normal signed-out
private browser.

Required sequence:

1. Open https://www.draftcentral.gg in a normal signed-out private/incognito
   browser.
2. Confirm the visible Security check completes normally.
3. Only after that pass, set `NEXT_PUBLIC_TURNSTILE_ENFORCED=true` for Vercel
   Production and redeploy.
4. Configure Supabase Auth Bot and Abuse Protection with the Turnstile secret
   stored outside GitHub and Vercel.
5. Immediately test sign-in, signup, and password reset.
6. If any path fails, disable Supabase enforcement and remove or set the Vercel
   flag to false. The public site key may remain.

## Retention and recovery policy

Approved policy:

- Supabase daily backups retained for seven days;
- operational and automatic recovery history retained for 30 days; and
- only the newest two quarterly encrypted off-account archives retained, with
  no archive older than six months.

The owner is the current sole backup custodian, restore operator, and production
restore approver. Quarterly restore drills remain required. Archive and MFA
recovery material stay outside the corresponding production provider.

## Recommended next work

1. Complete the human Turnstile check and only then consider strict
   enforcement.
2. Measure Disk IO after several hours, after 24 hours, and across normal live
   draft days.
3. Optimize `reconcile_autonomous_league_claims()` to identify only leagues
   with due work instead of broad every-minute processing.
4. Determine whether its one-minute schedule can safely become less frequent
   without harming slow-draft claim timing.
5. Reduce duplicated live-draft polling while retaining a reliable Realtime
   fallback.
6. Replace repeated complete-snapshot reads with smaller revision, deadline,
   and status projections where safe.
7. Confirm inactive pages release their Realtime channels.
8. Add alerting for temporary disk spills and rapid Disk IO budget consumption.
9. Retain Micro until several normal draft days show that a lower tier is safe.
10. Optionally test another major email client.

## Safety rules for the next agent

1. Do not modify Mushroom Cup without a direct commissioner request and valid
   access. The owner is not its commissioner.
2. Do not resume, restart, archive, or delete either Mushroom Hut draft. Their
   commissioners intentionally paused them.
3. Preserve `.vercel/` and never commit it.
4. Never disclose authentication material or recovery secrets for Supabase,
   Discord, Twitch, user accounts, or encrypted archives.
5. Never automatically replay a timed-out draft mutation. Refresh and verify
   authoritative state first.
6. Use isolated practice leagues for destructive lifecycle tests and verify the
   exact league ID before cleanup.
7. Do not delete a Supabase project based on its name. Require an exact project
   ID check and explicit owner approval.
8. Separate historical Operations entries from new post-deployment events.
9. Treat Discord community editorial channels, user league channels, and
   personal DMs as three distinct delivery scopes.
10. Preserve privacy: Operations user identity metrics are aggregate-only.

## Commit sequence

- `e3ec339` — fix signup defaults for long email aliases.
- `1280b2f` — record Gmail signup and reset verification.
- `f1282e1` — separate community Discord editorial posts.
- `0956db8` — reduce Supabase Explore and League Hub load.
- `cf37b86` — make commissioner Help easy to find.
- `5ace5f2` — show registered Auth-user totals in Operations.

## Primary files

- `docs/DraftCenter-agent-handoff-2026-08-02-post-launch.md`
- `docs/DraftCenter-agent-handoff-2026-08-03.md`
- `docs/DraftCenter-security-remediation-2026-08-02.md`
- `docs/data-retention-and-recovery.md`
- `src/app/api/notifications/dispatch/route.js`
- `src/app/api/operations/overview/route.js`
- `src/components/LeagueHub.jsx`
- `src/components/OperationsDashboard.jsx`
- `src/components/PokemonDraftLeague.jsx`
- `src/lib/authUserTotals.js`
- `src/lib/manualContent.js`
- `src/lib/ownerOperations.js`
- `supabase/249-cache-public-explore-aggregates.sql`
- `test/help-guides.test.js`
- `test/operations-user-count.test.js`
- `test/performance-remediation.test.js`
- `test/security-notification-dispatch.test.js`
