# DraftCenter security hardening and provider review — August 2, 2026

This record closes the implementable findings from the independent security
audit delivered on August 2, 2026. It records code, database, production-log,
and provider-setting evidence. It does not claim that DraftCenter is immune to
future vulnerabilities.

## Release baseline

- Application release: `b0a755e` plus the documentation/workflow follow-up that
  contains this record
- Production Supabase project: `eukexfqpiuidwygllaye`
- Applied production security migrations: `243` through `247`
- Security tests: 12 passed
- Regulation tests: 2 passed
- National Dex verification: 1,027 rows passed
- Production dependency audit: no known production vulnerabilities
- Compiler and TypeScript checks: passed
- Full local prerender: still requires the previously documented local public
  Supabase URL and anonymous key; this is a local-environment limitation, not a
  compiler failure

## Finding status

### DC-SEC-01 — global notification dispatcher authorization

Status: **remediated, deployed, and reviewed in production logs**.

- Global dispatch requires the exact cron bearer.
- An authenticated browser must provide one valid league UUID.
- The server verifies the Supabase user and membership in that exact league.
- Browser calls can claim only that league's events through the service-only
  `claim_league_notification_events` function.
- Eleven security tests now include proof that anonymous, ordinary-user,
  commissioner-style, malformed-bearer, and oversized requests cannot reach
  global database/provider work. A commissioner-style request reaches only the
  explicit league-scoped handler.

Vercel log review found no evidence requiring credential rotation. Successful
browser requests called Supabase Auth, league membership, the durable limiter,
and the league-scoped claim only. Rejected requests completed with no outgoing
database or provider calls. A resolved Vercel timeout anomaly was attributed to
Supabase authentication/RPC connectivity failures; it did not indicate misuse
of the global dispatcher. No token, email, or notification payload was exported.

### DC-SEC-02 — Twitch EventSub replay and envelope validation

Status: **remediated and deployed**.

- Signed requests require a fresh timestamp and expected subscription
  type/version/status/condition.
- The event broadcaster must match a registered DraftCenter Twitch stream.
- Message IDs are claimed atomically and retained for 24 hours; replays are
  acknowledged without repeating mutations.
- The replay table and claim function are service-only.
- Raw request bodies are capped at 256 KiB.

The real Twitch online/offline owner broadcast passed August 2. A fresh
offline-registered stream transitioned from `scheduled` to `live` to `ended`;
the signed-in member banner appeared and cleared; exactly one league-channel
event and one eligible non-creator personal DM event were accepted by Discord;
and no duplicate or failed delivery record appeared. Stream creators are
intentionally excluded from personal live-stream DMs.

### DC-SEC-03 — application rate limits

Status: **remediated for the audited routes**.

The durable, service-only Supabase limiter now covers:

- league-scoped notification checks;
- commissioner support requests;
- Twitch registration;
- Discord channel discovery, league tests, personal tests, and role sync;
- Discord OAuth start and callback (per user and per redacted IP key);
- league-created notification delivery; and
- championship artwork rendering.

Limits preserve normal draft polling while bounding outbound messages, OAuth
attempts, provider calls, and rendering work. Keys are SHA-256 digests rather
than stored raw identifiers.

### DC-SEC-04 — browser security headers

Status: **remediated in this release**.

- CSP is enforced after testing the required Supabase, Vercel analytics, image,
  font, and PokeAPI sources.
- `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'` are set.
- HTTPS subresources are upgraded.
- `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Frame-Options`, HSTS, COOP, and CORP are set centrally.

Production pages and authenticated routes were rechecked after release. The
policy is enforced in production and the authenticated owner Operations view
loaded without browser warnings.

### DC-SEC-05 — request and structure limits

Status: **remediated for all JSON API routes and the Twitch raw-body route**.

- A shared bounded reader enforces byte, nesting, object-entry, array, string,
  content-type, and JSON-object limits before privileged work.
- UUIDs and route-specific strings/lists are capped.
- Twitch keeps raw-body signature verification with a 256 KiB limit.
- Championship artwork now accepts an authorized league ID and season number,
  loads the archived season from the server snapshot, and caps the render data.
  The browser no longer supplies the full authoritative season record.

### DC-SEC-06 — error disclosure

Status: **remediated for the audited API and operational paths**.

- Unexpected responses use stable public wording and a correlation reference.
- Server logs record only a bounded error name/code and a fixed context label.
- Provider bodies, SQL messages, tokens, emails, UUIDs, and query strings are
  redacted or omitted from stored operational diagnostics.
- Migration `246` sanitized existing operational messages and tightened future
  ingestion. A production check returned zero remaining messages requiring that
  redaction.

### DC-SEC-07 — repository hygiene and automated scanning

Status: **remediated**.

- `.gitignore` excludes Vercel metadata, environment variants except the safe
  example, logs, coverage, archives, backups, exports, and task artifacts.
- CI now runs security/regulation tests, a production dependency audit, and a
  full-history Gitleaks scan.
- CodeQL and weekly Dependabot configuration are included.
- The first CodeQL scan reported four findings. Release `b0a755e` corrected the
  fixed-origin Discord request construction and normalized commissioner-provided
  image sources. The follow-up CodeQL run succeeded with **0 open / 4 closed**.
- Full-history secret scanning reports **0 open / 0 closed** findings.
- GitHub dependency graph, Dependabot alerts/security updates/malware alerts,
  grouped security updates, private vulnerability reporting, secret scanning,
  and push protection are enabled.
- GitHub Actions defaults to read-only repository permissions, cannot create or
  approve pull requests, and requires owner approval for every external
  contributor's workflow.
- `SECURITY.md` directs researchers to GitHub private vulnerability reporting
  and prohibits public disclosure or testing against real user data.

### DC-SEC-08 — retention and recovery policy

Status: **technical minimization improved; final policy remains an owner/legal decision**.

- Operational errors are now minimized and sanitized at ingestion.
- Vercel retains canceled deployments for 30 days, errored deployments for 90
  days, previews for 180 days, and production deployments for one year.
- Recently deleted Vercel deployments remain recoverable within the provider's
  stated recovery window.

Exact database/user-data retention promises, deletion evidence, backup custody,
and the recurring restore-test calendar still require an explicit business and
legal policy decision. Code cannot choose those promises on the owner's behalf.

### DC-SEC-09 — live provider configuration

Status: **authenticated review completed; safe configuration changes applied**.

Supabase production:

- 74 public tables were checked and all have RLS enabled.
- No browser-granted table lacks RLS.
- No service-only security-definer function is browser executable.
- Security-definer functions use a fixed `search_path=public`.
- Migration `247` removed two obsolete Discord preference overloads; only the
  current authenticated signatures remain.
- The public avatar bucket is intentionally public, capped at 5 MiB, restricted
  to JPEG/PNG/WebP, and write policies bind authenticated users to their own
  owner ID/folder.
- Auth requires email confirmation, blocks anonymous sign-in, detects leaked
  passwords, requires at least 10 characters with letters and digits, and
  requires recent authentication for password changes.
- Sessions are capped at 30 days and expire after 7 days of inactivity; refresh
  token replay detection is enabled with the recommended 10-second reuse window.
- TOTP is enabled as an application MFA method and enhanced AAL1 session
  limitation is enabled.
- The owner account has an enrolled authenticator factor. The production
  **Draft League** organization requires MFA for access; its sole member was
  confirmed MFA-enabled before enforcement. The unrelated **Rob Lebae** Free
  organization was not changed because organization enforcement is unavailable
  on that plan.
- The redirect allowlist was reduced from 13 entries to the three exact active
  production domains. Manual identity linking was disabled.
- The live database security advisor reports zero errors. Its warnings include
  intentional public security-definer projections and must not be bulk-fixed
  without reviewing each public API contract.

GitHub:

- Dependency/security monitoring, private reporting, secret scanning, and push
  protection are enabled as described above.
- The repository's automated checks are supplied by this release.
- The `Protect main` ruleset is active and verified. It blocks deletion and
  force-pushes and requires linear history, an up-to-date pull request, resolved
  conversations, both security checks, and high-severity CodeQL results. An
  audited repository-admin emergency bypass is retained.
- The repository owner has authenticator-app MFA enabled and stored the recovery
  codes outside GitHub.

Vercel:

- Preview deployments require Vercel team authentication under Standard
  Protection.
- Protected source maps, source/build-log protection, and Git fork protection
  are enabled; Vercel Support code visibility is disabled.
- There are no deploy hooks. Production is connected to `main`.
- Historical deployments and their redeploy/rollback path are retained.
- The owner has authenticator-app MFA enabled and stored the recovery material.
  The **rob-lebae** team enforces 2FA after confirming its sole member is the
  MFA-enabled owner.
- The current notification timeout alert was provider connectivity-related and
  self-resolved.

## Human-only completion items

These steps deliberately remain outside automated account control:

1. Add an independent backup authenticator, passkey, or security key where each
   provider supports one. Primary owner MFA is complete on GitHub, Vercel, and
   Supabase.
2. Optional bot protection for Supabase Auth needs an hCaptcha or Cloudflare
   Turnstile provider key plus client integration. It was not enabled server-side
   without a working client token flow, which would have blocked legitimate
   signups.
3. Complete the already documented second email-client test. The real Twitch
   broadcast passed August 2.
4. Approve the business/legal retention schedule and backup-custody owners.

## Release verification gate

Completed after deployment:

1. GitHub security, CodeQL, and secret-history checks completed successfully;
   CodeQL has zero open findings and secret scanning has no findings.
2. Vercel marked the production deployment healthy and retains the preceding
   deployment for rollback.
3. The production smoke test passed all public and protected-route checks.
4. Enforced CSP/security headers were verified on public pages, and the signed-in
   owner Operations, Explore, and Pokémon pages loaded without browser warnings.
5. Unauthorized notification and owner-route calls return `401` without
   privileged work. Log review found browser dispatch requests were restricted
   to the caller's authorized league and found no evidence requiring credential
   rotation.
