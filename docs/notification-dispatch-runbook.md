# Notification dispatch runbook

## Purpose

`/api/notifications/dispatch` claims due notification events using the DraftCenter
Supabase service role and delivers them through email or Discord.

The current application has two triggers:

- Vercel Cron calls `GET` on the schedule in `vercel.json`.
- Signed-in league screens call `POST` periodically with the user's Supabase
  access token.

The browser trigger is a temporary availability mechanism, not the desired
long-term worker design. Do not remove it during the current league rehearsal
until a frequent scheduled worker has been deployed and verified.

## Required production configuration

Base dispatch requires:

- `NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL`
- `DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` for the Vercel Cron `GET` request

Email delivery additionally requires:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Discord delivery additionally requires:

- `DISCORD_BOT_TOKEN`

Never record values in this runbook, logs, issues, or screenshots.

## Failure investigation

1. Confirm the failing deployment and release SHA in Vercel.
2. Filter logs for `notification_dispatch_failed`.
3. Record the privacy-safe `category`, `correlation_id`, release, and timestamp.
4. Use the category to check only the relevant subsystem:
   - `configuration`: confirm required variable names and scopes.
   - `authorization`: confirm cron authorization or Supabase grants.
   - `database`: confirm the dedicated DraftCenter project and dispatcher RPCs.
   - `email_provider`: confirm Resend configuration and provider status.
   - `discord_provider`: confirm the bot token and Discord response.
   - `network`: check provider and platform network health.
5. Do not repeatedly invoke the endpoint until the configuration or code issue
   is understood; successful claims can produce real external notifications.

The endpoint deliberately returns a generic client-facing error. Diagnostic
detail belongs in protected Vercel logs.

## Verification

Use a disposable notification addressed to a test account.

1. Confirm the queue row is due and has a unique dedupe key.
2. Invoke the authorized dispatcher once.
3. Confirm a 200 response containing delivered/skipped/failed counts and a
   correlation ID.
4. Confirm the queue row is completed or deferred as expected.
5. Confirm the test recipient receives at most one notification.
6. Confirm a `notification_dispatch_completed` log with the same correlation ID.

Never test against a real participant without their knowledge.

## Desired follow-up design

After the rehearsal week:

1. Run the dispatcher from a platform-owned schedule every one to five minutes.
   Production uses the one-minute Vercel cron in `vercel.json`. Because Vercel
   cron targets Production only, Preview uses
   `supabase/239-autonomous-notification-dispatch.sql` after storing
   the deployment-specific dispatcher URL and matching `CRON_SECRET` in
   Supabase Vault as `draftcenter_notification_dispatch_url` and
   `draftcenter_notification_cron_secret`. If the target is a protected Preview,
   also store its Vercel Protection Bypass for Automation value as
   `draftcenter_vercel_automation_bypass_secret`.
2. Split Daily Three email delivery into its own daily job.
3. Remove browser-driven queue dispatch after the scheduled worker is verified.
4. Alert on last-success age, oldest queued event, retry count, and dead letters.

