# DraftCenter final agent handoff — August 4, 2026

- Production: https://www.draftcentral.gg
- Repository: `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter`
- GitHub: `roblebaegaming/DraftCenter`, protected branch `main`
- Production Supabase project: `eukexfqpiuidwygllaye`
- Latest verified functional production commit: `cb33c5a`
- Turnstile enforcement deployment: `A3PpmpcA1WJsF9tYnocNsrhakgSE`
- Previous broad handoffs:
  - `docs/DraftCenter-agent-handoff-2026-08-02-post-launch.md`
  - `docs/DraftCenter-agent-handoff-2026-08-03.md`

## Executive status

DraftCenter is ready for a monitored public launch and real drafts. The
identified launch blockers and the additional August 3–4 operational issues
have been resolved. No evidence of lost picks, corrupt rosters, or damaged
active drafts was found.

Cloudflare Turnstile is now fully enforced for production authentication. The
owner completed the real widget in a normal signed-out Chrome session, Vercel
production now has `NEXT_PUBLIC_TURNSTILE_ENFORCED=true`, and Supabase Auth Bot
and Abuse Protection validates tokens with Cloudflare Turnstile. Signed-out
signup, sign-in, and password-reset calls reached Supabase without CAPTCHA
rejection after enforcement was enabled.

The final production smoke sweep passed all public pages and protected API
authorization checks. The only optional compatibility work is an additional
Apple Mail, Samsung Email, or Thunderbird rendering check. It is not a launch
blocker.

## Final launch assessment

The following blockers are closed:

- private draft-queue collisions;
- stale whole-league save conflicts;
- fractional timer input failures;
- confusing network and provider-timeout messages;
- draft lifecycle and long-pause visibility;
- the long Gmail plus-alias signup defect;
- missing and misrouted community Discord editorial posts;
- failed Pallet Town and Goonsquad notification deliveries;
- unclear commissioner Help and support directions;
- owner visibility into Auth-user totals and human/bot draft control; and
- staged-only Turnstile protection.

Treat the site as a monitored production service, not an unfinished test
environment. Review Operations regularly and prioritize failures occurring
after the latest deployment. Historical events remain visible for context and
do not prove recurrence.

## Authentication, email, and Turnstile

### Long plus-alias signup fix — `e3ec339`, pull request #13

A long Gmail plus alias exceeded the live 40-character profile display-name
constraint and caused the Auth profile trigger to abort signup. Migration
`supabase/248-safe-default-profile-display-names.sql` now strips the plus tag,
trims the generated name to 40 characters, and falls back to `Coach` when the
result is too short. Browser metadata uses the same bounded default while the
database trigger remains authoritative.

The migration was applied to production. A real plus-alias signup produced the
expected profile, and the temporary Auth user was permanently deleted.

### Gmail production flow

Gmail web passed:

- branded confirmation-email rendering and confirmation action;
- password-reset rendering, reset action, and password update;
- sign-in and sign-out before and after the password change; and
- the long plus-alias regression check.

The temporary account was permanently deleted. Apple Mail, Samsung Email,
Thunderbird, or another renderer remains optional compatibility coverage.

### Turnstile human check and strict rollout — August 4

Owner-provided screenshot evidence showed the live production widget in its
green **Success!** state in a normal signed-out Chrome session.

The final rollout then completed the original guarded sequence:

1. Added `NEXT_PUBLIC_TURNSTILE_ENFORCED=true` to Vercel Production only.
2. Redeployed the existing production release without build cache.
3. Verified deployment `A3PpmpcA1WJsF9tYnocNsrhakgSE` reached **Ready** and
   received `www.draftcentral.gg`.
4. Enabled Supabase Auth **Bot and Abuse Protection**.
5. Selected **Turnstile by Cloudflare** and stored the Cloudflare secret only
   in Supabase Auth configuration. The secret was not added to GitHub or
   Vercel.
6. Exercised signed-out signup, sign-in, and password-reset calls after the
   change. Each reached the expected Supabase Auth response without a CAPTCHA
   error.
7. Refreshed the Cloudflare widget dashboard after those calls. Its earlier
   **Siteverify isn't being called** warning was no longer present.
8. Used a reserved disposable address for the rollout check. Supabase retained
   no test user, so no production account required cleanup.

The public site key remains in Vercel for Production and Preview. Strict
application enforcement is production-only.

Rollback if authentication becomes unavailable:

1. Disable Supabase Auth CAPTCHA protection.
2. Remove `NEXT_PUBLIC_TURNSTILE_ENFORCED` or set it to `false` in Vercel
   Production.
3. Redeploy production.
4. Keep the public site key and widget in place while investigating.

## Discord architecture and remediation

DraftCenter has three deliberately separate Discord scopes:

1. **Community editorial bot posts** for DraftCenter's own Discord server.
2. **League-connected bot posts** sent to channels selected by commissioners.
3. **Personal Discord DMs** selected by individual DraftCenter users.

Never route a community editorial post through a commissioner league setting.

### Editorial routing — `f1282e1`, pull request #15

Question of the Day and Daily Three originally shared the league-connected
delivery path. This caused a missing Question of the Day and a Daily Three post
in the wrong channel.

Production now routes:

- Question of the Day only to `DISCORD_QOTD_CHANNEL_ID`;
- Daily Three results only to `DISCORD_DAILY_THREE_RESULTS_CHANNEL_ID`;
- league announcements only through each league's Discord settings; and
- personal reminders only through linked-user DM preferences.

Commissioner settings no longer offer the community Daily Three editorial
post. Community, league, and DM credentials and channel IDs must never appear
in logs, documentation, or commits.

### Delivery-ledger root cause and fix — `cb33c5a`, pull request #27

The hourly production cron returned 200 but the community posts did not send.
Vercel External APIs showed HTTP 400 inserts into
`operational_health_events`. The dispatcher was trying to use that failure-only
table to claim successful community deliveries with unpermitted kinds:

- `community_discord_question_of_the_day`;
- `community_discord_daily_three_results`.

That design both prevented delivery and would have made successful posts look
like Operations errors.

Migration `supabase/251-community-discord-delivery-ledger.sql` created private
table `public.community_discord_deliveries` with:

- atomic primary key `(delivery_kind, delivery_date)`;
- RLS enabled;
- no `public`, `anon`, or `authenticated` access; and
- service-role-only select, insert, and delete grants.

The dispatcher now claims through this ledger, treats `23505` as an already
delivered skip, releases a claim if provider delivery fails, and records only
privacy-safe failure metadata.

Production verification confirmed:

- ledger RLS and grants are correct;
- exactly one `question_of_the_day` claim and one `daily_three_results` claim
  were created for the verification date;
- Vercel recorded two successful outbound Discord message calls to two distinct
  configured channels;
- a second invocation could not duplicate either post; and
- no new notification or community-Discord failure event occurred after the
  release.

## Notification delivery findings

The August 3 Operations entries for Goonsquad Draft and Pallet Town were real
provider delivery failures, not draft corruption.

After Resend configuration and guarded retry:

- Goonsquad had six Discord notifications sent, zero due-pending, and zero
  failed.
- Pallet Town had one league-channel reminder, one personal DM, and six email
  reminders sent.
- Pallet Town's second set—one channel reminder, one DM, and six emails—was
  correctly future-scheduled at the final audit rather than stuck or failed.
- Resend showed all six due Pallet Town emails delivered.
- No due notification remained pending and no notification row remained
  failed.

Historical `notification_dispatch_failed` health events remain in Operations
for 30 days. Use current `notification_events` state and the event timestamp to
distinguish a recovered historical incident from a new failure.

## Operations, account totals, and draft control

### Auth-user totals — `5ace5f2`, pull request #17

The owner-only Operations page now counts Supabase Auth users, including
Discord identities that may not be obvious from the database table view. It
shows aggregate totals for:

- all accounts;
- Email identities;
- Discord identities; and
- accounts with both Email and Discord linked.

At the final production audit there were 39 Auth accounts: 39 with Email, zero
with Discord, and zero with both. The feature is ready to count future Discord
identities automatically.

These are aggregate identity counts only. Operations does not expose emails,
Discord usernames, or per-user identity details. **Discord identity** means
Discord is attached now; it does not prove Discord was the account's original
signup method.

### Human and bot teams — `d8aab99`, pull request #23

Operations now labels draft team control as:

- human-controlled teams;
- bot teams; and
- human-controlled teams using auto-draft.

The label appears both in the league card and active/paused draft lifecycle
detail without granting entry to a private league.

Final read-only production observations:

- **Goonsquad Draft:** four human-controlled teams, zero bots, zero human teams
  using auto-draft. Its snake draft completed all 40 picks successfully.
- **Pallet Town:** six human-controlled teams and ten bot teams, with no human
  team using auto-draft at the observation point. No draft session had started
  yet.

## Commissioner Help and guide quality

### Prominent Help path — `cf37b86`, pull request #16

Commissioners now have a yellow **Help** button immediately beside
**Commissioner Tools** inside a league. The commissioner manual starts with a
fast-answer panel and gives the direct human-support path:

**Commissioner Tools → Get help with this league → Create support request**

The global donation link is labeled **Support DraftCenter**, so it cannot be
confused with product help. The global **Help** link opens the manuals.

### Practical guides — `2170ddc` and `441d3fe`, pull requests #24 and #25

Production provides six plain-language guides, including:

- a beginner explanation of draft leagues;
- a commissioner walkthrough;
- snake-versus-auction guidance;
- tier-list methodology;
- a first-league onboarding guide; and
- a copyable rules template and launch checklist.

Live review confirmed the commissioner manual uses current product labels,
matches the actual DraftCenter workflow, has clear chapter links and a
draft-day checklist, and renders with readable contrast and spacing. The rules
template copy button was exercised successfully in production.

## Supabase Disk IO incident and remediation

This section incorporates the August 3 Supabase Performance Remediation
Handoff Addendum.

### Initial incident

The seven-day Infrastructure dashboard initially showed approximately:

- CPU peak: 95%;
- memory: 65–73%;
- Disk IO budget consumption rising from about 11% to 56%;
- disk used: about 16%;
- database size: 46–47 MB; and
- a compute upgrade from Nano to Micro.

The 95% CPU number was a seven-day peak, not current load. The hourly Database
view showed current CPU near 2.5%, so production was not continuously
CPU-saturated.

The investigation was read-only until the guarded release. No real league,
draft session, pick, queue, team, membership, snapshot, deadline, or user row
was modified.

### Confirmed sources

`public.get_public_explore()` was the clearest temporary-Disk-IO source.
Recorded variants showed:

- mean execution around 500–617 ms;
- approximately 9.1 million temporary blocks read and written for one variant;
- approximately 3.2 million temporary blocks for another; and
- about 2,000 calls across the retained statistics period.

League Hub also refreshed every five seconds in every open and hidden tab,
repeatedly loading memberships, public cards, complete snapshots, and current
turn data.

Additional ongoing load included broad autonomous-claim reconciliation,
Realtime WAL processing, complete-snapshot reads, Pokémon-pool reads,
public-card reads, and private-queue reads.

### Migration 249 and polling remediation — `0956db8`

The original local implementation commit was `57ec3cd`; the guarded
production release was `0956db8`.

`supabase/249-cache-public-explore-aggregates.sql`:

1. renamed the original implementation to
   `public.get_public_explore_uncached()`;
2. revoked uncached execution from browser roles;
3. created private, RLS-protected `public.public_explore_cache`;
4. cached only caller-independent `leagues`, `popularity`, and `adp` for 15
   minutes;
5. kept `signed_in`, the active poll, authenticated counts, and `selected_key`
   caller-specific; and
6. used a transaction-scoped advisory lock to prevent a visitor burst from
   rebuilding an expired cache concurrently.

Personalized poll data is never stored in the shared cache.

League Hub now uses a 60-second non-draft fallback, pauses interval refreshes
while hidden, refreshes on visibility/focus, and prevents overlapping requests.
Active live-draft synchronization was intentionally preserved pending deeper
multi-account regression coverage.

Focused regression coverage is in `test/performance-remediation.test.js` and
runs with `npm run test:performance`.

### Follow-up health observation

The follow-up production review found:

- Disk IO budget still at 56% and flat rather than continuing to climb;
- current CPU about 2.25%;
- memory about 904 MB on the 1 GB Micro instance;
- disk used about 17%;
- database size about 62 MB; and
- WAL about 96 MB.

Memory is the main watch item, not an emergency. Query Performance still showed
`reconcile_autonomous_league_claims()` as the largest cumulative workload at
about 41.9%, 11,807 calls, and 2 hours 30 minutes total. Realtime WAL processing
was about 22.2% with 852,087 calls.

### Performance monitoring thresholds

Use **Settings → Infrastructure** for the seven-day overview. Disk IO is
cumulative within its budget period, so monitor its rate of increase:

- 56–65% after 24 hours: good;
- 65–75%: improved but continue optimization;
- above 80%: investigate remaining workload;
- 85–90%: high concern; and
- approaching 100%: consider temporary Small compute and immediate
  investigation.

Use **Observability → Database → Last 60 Minutes** for current conditions:

- CPU below 50%: healthy;
- sustained CPU 60–80%: watch;
- sustained CPU above 80–90%: investigate;
- memory below about 850 MB on Micro: generally acceptable;
- memory consistently above 900 MB: investigate; and
- growing swap or sustained IOwait: investigate promptly.

In Query Performance, monitor Explore cache rebuilds, autonomous-claim
reconciliation, snapshot reads, Pokémon-pool reads, private queues, public
league cards, and Realtime/WAL work. Expected Explore behavior is one expensive
rebuild about every 15 minutes followed by inexpensive cached reads.

Migration 249 contains a commented quiet-period rollback that restores the
uncached function and intended grants before dropping the cache. Returning
League Hub to five-second polling is not recommended unless required for
incident recovery.

## Security, repository, and provider posture

The independent security audit and implementable remediation are complete. See
`docs/DraftCenter-security-remediation-2026-08-02.md` for detailed evidence.

Confirmed controls include:

- scoped notification dispatch with exact cron-secret validation;
- signature, broadcaster, subscription, and replay verification for Twitch
  EventSub;
- durable rate limits for notification, Discord, support, Twitch, OAuth, and
  artwork routes;
- sanitized public and stored failure messages;
- CSP, HSTS, frame, MIME, referrer, permissions, opener, and resource policies;
- RLS and least-privilege function grants throughout the public schema;
- hardened password/session settings and leaked-password protection;
- GitHub secret scan, push protection, dependency monitoring, CodeQL, and
  protected `main` requirements;
- protected Vercel preview/build/source access and production connected to
  `main`; and
- MFA for the owner on GitHub, Vercel, and the production Supabase
  organization.

The real Twitch online and offline callbacks passed. The signed-in member live
banner appeared and cleared correctly, one configured private league-channel
notification and one eligible personal DM were accepted, and no duplicate or
failed provider delivery remained.

## Retention and recovery

Approved policy:

- Supabase daily backups retained for seven days;
- operational and automatic recovery history retained for 30 days; and
- only the newest two quarterly encrypted off-account archives retained, with
  no archive older than six months.

The owner is the current sole backup custodian, restore operator, and production
restore approver. Quarterly restore drills remain required. Archive keys and
MFA recovery material must remain outside the corresponding production
provider.

## Validation completed

The release chain passed, as applicable:

- 40 automated tests after the Discord delivery-ledger change;
- focused security and performance suites;
- Next.js compilation and TypeScript validation;
- production builds and Vercel preview checks;
- GitHub full-history secret scan;
- dependency/security audit;
- CodeQL JavaScript analysis;
- migration 249 and 251 production verification;
- live Discord outbound-call and dedupe verification;
- live Resend delivery verification;
- live commissioner-manual and guide review;
- the human external-browser Turnstile pass;
- strict application and Supabase CAPTCHA rollout checks; and
- the final signed-out production smoke sweep:
  - 14 public routes returned 200; and
  - five protected endpoints returned 401.

The local Next.js build may stop during prerender when the current shell lacks
the public Supabase URL/key. Production builds and smoke checks are the
authoritative deployment evidence for that known local-environment limitation.

## Remaining work and priorities

There are no known launch-blocking defects.

Operational follow-up:

1. Confirm Pallet Town's future one-hour reminder batch processes at its
   scheduled time; its pending state was correct at the final audit.
2. Continue watching Operations for failures occurring after the newest
   deployment rather than repeatedly treating historical entries as current.
3. Measure Disk IO and memory across normal live-draft days.
4. Optimize `reconcile_autonomous_league_claims()` to identify only leagues
   with due work, then determine whether its one-minute cadence can safely be
   reduced without harming slow-draft timing.
5. Reduce duplicated live-draft polling while preserving a reliable Realtime
   fallback.
6. Replace complete-snapshot reads with smaller revision, deadline, and status
   projections where safe.
7. Confirm inactive pages release Realtime channels.
8. Add alerting for temporary disk spills and rapid Disk IO budget consumption.
9. Retain Micro until several normal draft days establish that a lower tier is
   safe.
10. Optionally test Apple Mail, Samsung Email, or Thunderbird rendering.

## Safety rules for the next agent

1. Do not modify a real league, draft, pick, roster, queue, membership, or
   deadline merely to test monitoring.
2. Do not modify Mushroom Cup without a direct commissioner request and valid
   access; the owner is not its commissioner.
3. Do not resume, restart, archive, or delete either historical Mushroom Hut
   draft. Their commissioners intentionally paused them.
4. Never automatically replay a timed-out draft mutation. Refresh and verify
   authoritative state first.
5. Use isolated practice leagues for destructive lifecycle tests and verify
   the exact league ID before cleanup.
6. Do not delete a Supabase project based on its name. Require an exact project
   ID check and explicit owner approval.
7. Preserve `.vercel/` and never commit it.
8. Never disclose Supabase keys, Cloudflare secrets, session tokens, Discord or
   Twitch credentials, passwords, recovery fragments, archive passphrases,
   channel IDs, or user emails.
9. Keep community editorial channels, commissioner league channels, and
   personal DMs as distinct Discord scopes.
10. Keep Operations identity reporting aggregate-only.
11. Distinguish historical Operations events from new post-deployment events.
12. Use the protected pull-request workflow for non-emergency releases.

## Important commits

- `133b722` — collision-safe private draft queue handling.
- `117a8de` — commissioner league archiving.
- `075c1da` — suppress harmless duplicate draft-start warnings.
- `aa69377` — guarded stale-save retry.
- `947251f` — draft lifecycle and transient-failure guidance.
- `e5b6bb6` — long-paused-draft reminder.
- `37fd599` — staged Turnstile client integration.
- `d09ce76` — retention evidence and mobile launch improvements.
- `e3ec339` — bounded signup profile defaults.
- `1280b2f` — Gmail confirmation and reset record.
- `f1282e1` — separate community Discord editorial routing.
- `0956db8` — cache public Explore aggregates and reduce League Hub polling.
- `cf37b86` — prominent commissioner Help.
- `5ace5f2` — aggregate Auth-user totals in Operations.
- `ab0cfbd` — reduce scheduled and live league polling load.
- `d8aab99` — human/bot team control in Operations.
- `2170ddc` — practical human guide workflows.
- `441d3fe` — first-league guide and copyable rules template.
- `cb33c5a` — private community Discord delivery ledger.
- `bbb5569` — record the owner's successful human Turnstile check.

## Primary files

- `docs/DraftCenter-agent-handoff-2026-08-04-final.md`
- `docs/DraftCenter-security-remediation-2026-08-02.md`
- `docs/data-retention-and-recovery.md`
- `docs/browser-network-and-search-audit-2026-08-02.md`
- `src/app/api/notifications/dispatch/route.js`
- `src/app/api/operations/overview/route.js`
- `src/components/AuthGate.jsx`
- `src/components/TurnstileChallenge.jsx`
- `src/components/LeagueHub.jsx`
- `src/components/OperationsDashboard.jsx`
- `src/components/PokemonDraftLeague.jsx`
- `src/lib/authCaptcha.js`
- `src/lib/authUserTotals.js`
- `src/lib/draftParticipants.js`
- `src/lib/manualContent.js`
- `src/lib/ownerOperations.js`
- `supabase/241-collision-safe-private-queue-reordering.sql`
- `supabase/242-commissioner-league-lifecycle-archive.sql`
- `supabase/248-safe-default-profile-display-names.sql`
- `supabase/249-cache-public-explore-aggregates.sql`
- `supabase/251-community-discord-delivery-ledger.sql`
- `test/help-guides.test.js`
- `test/operations-user-count.test.js`
- `test/performance-remediation.test.js`
- `test/security-notification-dispatch.test.js`
