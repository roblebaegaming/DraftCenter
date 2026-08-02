# DraftCenter security remediation record — August 2, 2026

This record responds to the independent read-only security audit delivered on
August 2, 2026. It distinguishes completed remediation from remaining work and
does not claim that DraftCenter is free from vulnerabilities.

## Production baseline after remediation

- Application commit: `d27ae61`
- Production Supabase project: `eukexfqpiuidwygllaye`
- Applied security migrations: `243`, `244`, and `245`
- Production smoke test: passed after deployment
- Security unit tests: five passed
- Regulation tests: two passed
- National Dex verification: 1,027 rows passed
- Local compiler and TypeScript: passed
- Local prerender remains blocked only by the previously documented missing
  local public Supabase configuration.

## Finding status

### DC-SEC-01 — authenticated global notification dispatch

Status: **Remediated and deployed**.

- Global dispatch now requires the exact cron bearer.
- A normal authenticated request must include one valid league ID.
- The server verifies the user through Supabase Auth and verifies membership in
  that exact league.
- The browser request can claim due events only for that league through the new
  service-role-only `claim_league_notification_events` function.
- Anonymous and authenticated database roles cannot execute that function.
- Four regression tests cover anonymous, ordinary bearer, oversized request,
  and exact cron scope behavior.

Commit: `1def1b8`. Migration: `243-scope-user-triggered-notification-dispatch.sql`.

Live verification: an ordinary invalid bearer without a league received `400`
before privileged work; the former endpoint behavior would have attempted user
authentication and could have reached global dispatch for a valid account.

Still recommended: review Vercel invocation logs for historical non-cron POSTs.
No credential rotation was performed because no evidence of secret exposure was
found in this remediation pass.

### DC-SEC-02 — Twitch EventSub replay and envelope validation

Status: **Remediated and deployed**.

- Signed notifications require the expected subscription type/version/status.
- The event broadcaster must match the subscription condition.
- The broadcaster must already be registered to a DraftCenter Twitch stream.
- Twitch message IDs are claimed atomically and retained for 24 hours; replayed
  notifications are acknowledged without repeating mutations.
- The replay table has RLS enabled and browser roles have no table or function access.
- Raw Twitch bodies are capped at 256 KiB before processing.

Commit: `4598a20`. Migration: `244-deduplicate-twitch-eventsub-messages.sql`.

The existing real Twitch broadcast test remains owner-operated and is still
needed to validate Twitch’s external online/offline delivery after hardening.

### DC-SEC-03 — missing rate limits

Status: **Substantially remediated for the identified high-cost routes**.

A durable Supabase-backed limiter now protects:

- authenticated league notification checks;
- commissioner support requests;
- Twitch monitoring registration;
- league Discord test messages;
- personal Discord test messages; and
- championship artwork rendering.

Keys are SHA-256 digests of the relevant user/league scope. The limiter table
has RLS enabled and is service-role-only. Limits permit normal use and draft
polling while bounding provider and rendering abuse.

Commit: `d27ae61`. Migration: `245-durable-api-rate-limits.sql`.

Remaining: extend rate-limit coverage to any newly identified expensive route,
add monitoring for repeated `429` responses, and revisit thresholds using real
traffic without storing raw IP addresses.

### DC-SEC-04 — browser security headers

Status: **Initial remediation deployed**.

Production now returns:

- `Content-Security-Policy-Report-Only`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- a restrictive `Permissions-Policy`
- `X-Frame-Options: DENY`
- the existing long-duration HSTS policy

Commit: `4598a20`.

CSP intentionally remains report-only until violations from Supabase realtime,
Vercel analytics, images, and application scripts are reviewed. Do not enforce
it without browser and authenticated-route validation.

### DC-SEC-05 — inconsistent body and structure limits

Status: **Partially remediated**.

- Notification browser requests are capped at 1 KiB and require a UUID.
- Twitch raw webhook requests are capped at 256 KiB.
- Existing semantic limits remain for support messages and selected inputs.

Remaining: implement a shared bounded JSON reader and explicit nested
array/string/numeric schemas across all privileged routes. Championship artwork
should ultimately load authoritative season data server-side instead of trusting
the complete client-supplied record.

### DC-SEC-06 — internal error disclosure

Status: **Open**.

Some routes still return or persist raw database/provider error text. A later
pass should add stable public error codes, redacted server logging, and
correlation IDs. Do not discard operational evidence needed for support.

### DC-SEC-07 — incomplete `.gitignore`

Status: **Remediated**.

The repository now ignores `.vercel/`, all `.env*` files except the committed
example, logs, coverage, archives, backups, and exports. The previously
untracked `.vercel/` directory no longer appears in repository status and was
not committed.

Commit: `1def1b8`.

### DC-SEC-08 — retention and recovery policy

Status: **Open; owner/policy decision required**.

The technical backup controls remain in place, but final retention periods,
error redaction at ingestion, deletion evidence, and recurring restore cadence
still require explicit policy approval.

### DC-SEC-09 — GitHub and provider security settings

Status: **Open; authenticated provider review required**.

Branch protection, required reviews/checks, GitHub secret scanning and push
protection, Dependabot/code scanning, Actions permissions, production deploy
approval, rollback, and provider MFA were not modified. These should be reviewed
read-only before configuration changes.

## Production database verification

For each new function, production catalog checks confirmed:

- `SECURITY DEFINER` enabled;
- fixed `search_path=public`;
- anonymous execution: false;
- authenticated execution: false;
- service-role execution: true; and
- RLS enabled on the associated replay/rate-limit tables.

No real league, user, stream, notification, or provider credential was changed
during the database migrations.

## Next safe actions

1. Complete the real Twitch online/offline broadcast test.
2. Review CSP report-only violations, then design an enforcement candidate.
3. Add bounded JSON/schema validation to the remaining privileged routes.
4. Replace raw public/provider error responses with stable redacted errors.
5. Conduct authenticated read-only GitHub, Vercel, and Supabase settings review.
6. Approve data-retention periods and incident-response ownership.

Any aggressive testing, credential rotation, paid rate-limit service, provider
configuration change, or real-league mutation still requires explicit owner approval.
