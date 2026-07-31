# DraftCenter agent handoff — Twitch, Discord, live matches, and season rollover

**Handoff date:** July 31, 2026  
**Public launch target:** Friday, September 4, 2026  
**Production:** https://www.draftcentral.gg  
**Repository:** `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter`  
**GitHub:** `roblebaegaming/DraftCenter`, branch `main`  
**Latest production commit before this handoff:** `6840b98 Show live matches on member dashboard`

## Purpose of this handoff

Continue the July 30–31 launch-hardening work without repeating setup or overstating test coverage. The current work centers on:

- Twitch automatic Live Now detection
- league-channel and personal Discord notifications
- manager self-service stream publishing
- public and member-dashboard live-match discovery
- Daily Three Discord announcements
- safe season finalization and rollover

The implementation is deployed and the live database shape has been verified. The final Mega Test end-to-end live-stream test is still pending.

## Read-first safety and operating rules

1. Never expose Twitch, Discord, Supabase, Resend, cron, PayPal, or Ko-fi credentials.
2. Keep all integration secrets server-only. Never add them to `NEXT_PUBLIC_*` variables.
3. Preserve league visibility rules. A private league must not appear on public Community pages.
4. Personal Discord DMs are opt-in per DraftCenter account.
5. League-channel Discord announcements require a separately configured league server/channel.
6. Do not confuse a deferred quiet-hours message with a failed delivery.
7. Build before deploying and inspect `git status` before committing.
8. `.vercel/` is an existing untracked local directory. Preserve it and do not commit it.
9. Do not include Discord IDs, Twitch secrets, user emails, or payment records in handoffs or commits.

## Current repository and production state

- `main` is pushed through commit `6840b98`.
- Production is aliased to `https://www.draftcentral.gg`.
- The latest local and Vercel production builds passed all 46 routes.
- `https://www.draftcentral.gg` returned HTTP 200 at handoff.
- `https://www.draftcentral.gg/explore` returned HTTP 200 at handoff.
- The tracked worktree was clean at handoff; only `.vercel/` remained untracked.

## What is implemented

### Twitch automatic detection

- Coaches, co-commissioners, and commissioners can publish a direct Twitch channel URL for a league battle.
- `/api/twitch/register` resolves the broadcaster through Twitch, stores the broadcaster identity, creates `stream.online` and `stream.offline` EventSub subscriptions, and checks whether the channel is already live.
- `/api/twitch/eventsub` verifies Twitch signatures, rejects stale messages, marks matching scheduled streams live, marks live streams ended when Twitch reports offline, and triggers notification dispatch.
- Twitch online events update DraftCenter without requiring a browser to remain open.
- YouTube remains manual by design. Its UI and provider-neutral database structure are ready for a future OAuth/quota-aware implementation.
- Setup documentation: `docs/twitch-live-detection-setup.md`.

Required server-side configuration names:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_EVENTSUB_SECRET`
- `TWITCH_EVENTSUB_CALLBACK_URL=https://www.draftcentral.gg/api/twitch/eventsub`
- `DISCORD_BOT_TOKEN`
- `CRON_SECRET`
- Supabase server credentials already used by the application

The owner used a personal Twitch account to create the DraftCenter developer application. This is acceptable. The application credentials, not the account name, are what production uses.

### Stream publishing and visibility

- Backend publishing already authorizes participating coaches as well as league staff.
- The league home now has an open **Share my live battle** panel.
- A manager only needs to paste a Twitch or YouTube URL. The title is optional and receives a safe automatic league title when omitted.
- The defaults are **Live now** and **Public Community Live Now** for easy sharing.
- Managers may instead choose scheduled, league-only, or private visibility.
- Private leagues are still excluded from public Community discovery, even if a stream is marked public.
- Setup now contains an **Open Share My Live Battle** button that switches to League Home and scrolls directly to the publishing panel.
- The manager action center also has a prominent **Share My Live Battle** shortcut.

### Website live-match discovery

- League home shows live and scheduled broadcasts in Broadcast Center.
- Public league pages show that league’s public broadcasts.
- `/explore` has a Community **Live Now** section with direct Watch buttons.
- The public Live Now section refreshes every 30 seconds.
- The signed-in dashboard checks visible streams for the user’s leagues every five seconds.
- A live match produces a red **MATCH LIVE NOW** dashboard banner with league, stream title, and direct Watch link.
- The affected dashboard league card changes to **MATCH LIVE**.
- Stream reads go through `get_league_live_streams`, preserving private/league/public access rules.

### Discord league-channel notifications

- Each league can connect a Discord server and announcement channel.
- League-wide announcements are independently configurable for drafts, matches, streams, transactions, results, and Daily Three.
- `stream_live` posts a league-channel Live Now message only when the league connection is enabled and live-stream announcements are enabled.
- Quiet hours are respected and can defer rather than fail a message.
- The immediate dispatch path attempts delivery when a manager marks a stream live; the normal notification dispatcher retains retry behavior.

### Personal Discord notifications

- Each DraftCenter profile can connect its own Discord identity through OAuth.
- Personal DMs and each category are opt-in.
- **League streams going live** is stored as `discord_user_connections.notify_live_streams`.
- A provider-neutral database trigger queues a `discord_dm` event for every opted-in member of the stream’s league when a stream first changes to `live`.
- This works for Twitch EventSub and manually marked Twitch/YouTube streams.
- `notification_events.dedupe_key` prevents duplicate personal messages for the same stream and recipient.
- Personal DM quiet hours are checked at dispatch time.

### Daily Three Discord announcements

- Migration 231 adds the league opt-in `notify_daily_three` setting.
- The existing daily notification job now prepares one league-channel post containing:
  - yesterday’s Poll of the Day leaders
  - yesterday’s most-selected Draft Bracket champion
  - yesterday’s quiz accuracy
  - today’s Question of the Day
  - a link to `https://www.draftcentral.gg/explore`
- `daily_three_discord_deliveries` prevents duplicate posts per league/date.
- The setting defaults off and is exposed as **Daily Three: yesterday’s results and today’s question** in league Discord settings.
- The Vercel cron currently runs `/api/notifications/dispatch` at `0 14 * * *` (14:00 UTC). This is 7:00 AM Pacific during daylight saving time and 6:00 AM Pacific during standard time.

### Season finalization and rollover

- Ending a season now freezes the champion, standings, rosters, bracket, awards, transactions, and history without immediately resetting the league.
- Starting the next season keeps that archive and resets the active season state.
- The original database rollover guard incorrectly required a second archive after finalization.
- Migration 229 accepts either:
  - the legacy one-step path that appends exactly one archive during rollover, or
  - the already-finalized path where the correct current-season archive is already present and unchanged.
- The canonical `league_status` enum value is `setup`, not `preseason`.
- Migration 230 repairs the rollover function and is idempotent when `setup` is already installed.
- The UI explicitly tells commissioners that the completed season remains archived.

## Applied and live-verified database migrations

The owner reported successful execution, and a subsequent read-only production query confirmed the relevant state:

- `227-automatic-twitch-live-detection.sql`
- `228-personal-discord-live-stream-notifications.sql`
- `229-allow-rollover-after-season-finalization.sql`
- `230-repair-finalized-season-rollover-status.sql`
- `231-discord-daily-three-announcements.sql`

Production verification on July 31 confirmed:

- `transition_league_to_new_season(uuid,jsonb)` contains `status = 'setup'`.
- `league_discord_settings.notify_daily_three` exists.
- `save_league_discord_daily_three(uuid,boolean)` exists.

Do not ask the owner to rerun these migrations unless a new verification proves one is absent or replaced.

## Mega Test: exact live configuration at handoff

Read-only production verification showed:

- League: **Mega Test**
- Slug: `mega-test-y1u94`
- League status: `drafting`
- League visibility: `private`
- League Discord server/channel settings: absent
- League-channel Live Now announcements: therefore unavailable
- League-channel Daily Three announcements: therefore unavailable

Two league member profiles have personal Discord connected:

1. DraftCenter account `draftcenter`
   - Discord username: `DraftCenterOfficial`
   - personal DMs enabled: yes
   - live-stream DMs enabled: yes
   - prior personal Discord test: delivered

2. DraftCenter account `roblebae`
   - Discord username: `Rob Lebae`
   - personal DMs enabled: yes
   - live-stream DMs enabled: yes
   - prior personal Discord test: delivered

Both profiles currently have quiet hours enabled from `22:00` to `08:00` in the `UTC` timezone. During July this corresponds approximately to 3:00 PM through 1:00 AM Pacific. For a clear test, temporarily disable quiet hours or set the intended timezone to `America/Los_Angeles`.

## What has been verified versus what remains

### Verified

- Twitch developer application and server credential configuration were completed earlier.
- Twitch EventSub online/offline subscriptions were created successfully.
- Earlier automatic Twitch detection reached the website after migration 227.
- Both personal Discord profiles can receive bot DMs; their explicit test messages delivered.
- Both profiles now have live-stream DMs enabled.
- Migrations 230 and 231 are installed in production.
- Production builds and deployments through `6840b98` succeeded.
- Public and dashboard Live Now UI code is deployed.

### Still pending — do not mark complete yet

1. Publish a Mega Test Twitch listing while the channel is offline.
2. Select **Scheduled** for the cleanest EventSub test.
3. Confirm the UI says Twitch automatic monitoring is connected.
4. Start the Twitch stream.
5. Confirm the Mega Test Broadcast Center changes to Live.
6. Return to the signed-in dashboard and confirm the **MATCH LIVE NOW** banner appears.
7. Confirm both `DraftCenterOfficial` and `Rob Lebae` receive exactly one personal Live Now DM.
8. Stop the Twitch stream and confirm the website listing ends.

Because Mega Test is private and has no league Discord channel:

- Do **not** expect it on the public Community Live Now page.
- Do **not** expect a league-channel Discord announcement.
- Those are configuration outcomes, not failures.

To test public discovery, change Mega Test to `watch` temporarily or use another watchable league, publish the stream with public visibility, and verify `/explore` within 30 seconds.

To test the league-channel and Daily Three features, first connect a test Discord server/channel to the league, enable the relevant preferences, and use a non-production/noise-safe channel.

## Recommended clean final-test sequence

1. Disable personal quiet hours temporarily on both connected profiles.
2. Keep Twitch offline.
3. Open Mega Test → League Home → **Share my live battle**.
4. Paste the direct channel URL, for example `https://twitch.tv/channelname`.
5. Choose **Scheduled**.
6. Publish and confirm automatic Twitch monitoring.
7. Open the DraftCenter dashboard in another signed-in window if desired.
8. Start Twitch.
9. Observe the website/dashboard for up to 30 seconds and check both Discord accounts.
10. Record whether each recipient received zero, one, or multiple DMs.
11. Stop Twitch and verify the listing ends.
12. Restore the intended quiet-hours settings.

If the website becomes live but DMs do not arrive, inspect `notification_events` for `stream_live` + `discord_dm`, including `scheduled_for`, `next_attempt_at`, `sent_at`, `failed_at`, `attempt_count`, and `last_error`. Check quiet hours before changing code.

## Important recent commits

- `2161f06` — Add automatic Twitch live detection foundation
- `8385e53` — Deliver stream going-live announcements immediately
- `97556c7` — Add opt-in Discord DMs for live league streams
- `37c1d6d` — Keep legacy Discord preference save compatible
- `b4f9b72` — Queue personal stream DMs for every live provider
- `22c630c` — Add explicit season finalization lifecycle
- `2eabcaf` — Offer season finalization after playoff finals
- `a6d22c1` — Allow rollover after season finalization
- `6a8919d` — Use canonical setup status in season rollover
- `bde8563` — Make rollover status repair idempotent
- `5f3b286` — Add opt-in Discord Daily Three announcements
- `6985759` — Make manager live-stream sharing easy to discover
- `1ac3bb6` — Link setup directly to live battle sharing
- `6840b98` — Show live matches on member dashboard

Related championship-artwork work is also present between these commits. Do not remove it while editing stream or lifecycle code.

## Main implementation files

- `src/components/SocialSharing.jsx`
- `src/components/LeagueHub.jsx`
- `src/components/PokemonDraftLeague.jsx`
- `src/components/PublicExplore.jsx`
- `src/components/PublicLeaguePage.jsx`
- `src/components/AuthGate.jsx`
- `src/app/api/twitch/register/route.js`
- `src/app/api/twitch/eventsub/route.js`
- `src/app/api/notifications/dispatch/route.js`
- `src/app/api/discord/personal-test/route.js`
- `src/app/api/discord/test/route.js`
- `src/lib/twitch.js`
- `docs/twitch-live-detection-setup.md`
- `supabase/227-automatic-twitch-live-detection.sql`
- `supabase/228-personal-discord-live-stream-notifications.sql`
- `supabase/229-allow-rollover-after-season-finalization.sql`
- `supabase/230-repair-finalized-season-rollover-status.sql`
- `supabase/231-discord-daily-three-announcements.sql`

## Known limitations and follow-up decisions

- YouTube automatic detection is intentionally deferred.
- Mega Test cannot validate public or league-channel announcements in its current private/unconnected configuration.
- The Daily Three Discord automation is installed but has not been end-to-end tested against a connected league channel.
- Season rollover has been database-verified but should be exercised once more through the UI after migration 230.
- The dashboard obtains visible streams per league during its existing five-second refresh. If users accumulate many active leagues, consolidate this into one server-authoritative `get_my_live_streams` RPC to reduce requests.
- The current Daily Three cron is UTC-fixed and shifts by one Pacific clock hour when daylight saving time changes.
- Twitch streams should use direct channel URLs. Video, clip, dashboard, or player URLs may not resolve as broadcaster channels.

## Build and deploy procedure

From the repository root:

```powershell
$env:NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL='https://example.supabase.co'
$env:NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY='test-key'
& .\node_modules\.bin\next.cmd build
```

Then inspect the diff, commit only intended files, push `main`, and deploy with the established Vercel project:

```powershell
npx --yes vercel@latest --prod --yes
```

Confirm the deployment aliases to `https://www.draftcentral.gg`.

## Broader launch and monetization context

- Public launch remains targeted for September 4, 2026, subject to lifecycle, privacy, recovery, and mobile launch gates.
- Optional Ko-fi support is live and its one-time `$3` PayPal path was verified.
- Do not add Stripe subscriptions or paywall current capabilities without explicit owner direction and evidence of a credible paid offer.
- The previous consolidated launch/monetization handoff remains useful historical context:
  `C:\Users\rober\Documents\Codex\2026-07-30\mes\outputs\DraftCenter-Agent-Handoff-Sep4-Launch-and-Monetization-2026-07-30.md`

## Next-agent start procedure

1. Read this handoff and inspect `git status` and the latest commits.
2. Do not rerun migrations reflexively; first verify production state.
3. Complete the pending Mega Test Twitch → website/dashboard → two personal Discord DMs test.
4. Check quiet hours before diagnosing delivery.
5. Record exact evidence and update this handoff.
6. If the final test passes, mark the Twitch/personal-DM path verified and move to a separate league-channel/public-discovery test only if the owner wants it.
7. Keep YouTube automation deferred unless the owner explicitly prioritizes it.
8. Continue launch hardening rather than expanding into unrelated major features.
