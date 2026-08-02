# DraftCenter security-audit agent handoff — August 2, 2026

## Mission

Perform an independent, evidence-based security review of DraftCenter now that
external users are creating accounts and operating real leagues. Begin
read-only. Identify credible risks to user accounts, private league data,
production availability, connected services, and administrative control.

Do not assume that previous functional validation proves security. Do not claim
the application is “secure” merely because no vulnerability is immediately
found. Rank findings by realistic impact and exploitability, then propose the
smallest safe remediation and verification plan.

## Production and repository

- Production: https://www.draftcentral.gg
- GitHub repository: `roblebaegaming/DraftCenter`
- Branch: `main`
- Local repository: `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter`
- Hosting: Vercel project `draftcenter`
- Production Supabase project ID: `eukexfqpiuidwygllaye`
- Security-handoff baseline commit: `12828c7`
- Post-launch operational handoff:
  `docs/DraftCenter-agent-handoff-2026-08-02-post-launch.md`
- Earlier comprehensive launch handoff:
  `docs/DraftCenter-agent-handoff-2026-08-02-final.md`

Never place secret values, access tokens, cookies, passwords, webhook secrets,
private recovery URLs, or archive passphrases in findings, logs, screenshots,
commits, or chat output.

## Architecture summary

DraftCenter is a Next.js 16 / React 19 application deployed on Vercel. Supabase
provides authentication, Postgres, row-level security, RPC functions, realtime
state, and storage. Server routes use a Supabase service-role client when
privileged access is necessary. The application also integrates with Discord,
Twitch EventSub, Resend email, Vercel scheduled jobs, and Google-facing public
SEO routes.

Important trust boundaries:

1. Public unauthenticated browser to Next.js public pages and APIs.
2. Authenticated browser to Supabase RLS-protected tables and RPC functions.
3. Authenticated browser to Vercel API routes carrying a Supabase access token.
4. Vercel server routes to Supabase using the service role.
5. Twitch and Discord callbacks or OAuth redirects into Vercel routes.
6. Cron/scheduled requests authenticated with a shared server secret.
7. Owner-only Operations routes authorized by verified Supabase identity plus an
   environment-configured owner email allowlist.
8. Commissioner-approved temporary support grants consumed only by server routes.
9. User-controlled league content, URLs, images, messages, imports, and profile data.

## Existing safeguards that must be verified, not merely trusted

- Server-authoritative snake draft, auction, result, transaction, rollover,
  queue, team-preference, claim, restart, and archive operations.
- Supabase row-level security and least-privilege function grants.
- Owner API routes call `requireOwner`, which validates the bearer token through
  Supabase Auth and checks an environment owner-email allowlist.
- Support access is separate, scoped, expiring, revocable, and audited.
- Twitch EventSub requests use signature verification.
- Cron routes require a configured secret bearer token.
- Stale revision saves are rejected or safely refreshed and retried once.
- Team-logo URLs require HTTPS.
- Draft queues are private and use collision-safe atomic reordering.
- Account deletion blocks deletion while the user remains primary commissioner.
- Operational health events distinguish safety rejections from system failures.
- Production recovery documentation and encrypted backups exist.

These are starting claims. Verify their implementation, coverage, and failure
modes. Look for routes or functions that bypass the intended helper.

## Non-destructive rules

1. Start with source review, configuration metadata, migration analysis, and
   safe unauthenticated requests.
2. Do not run denial-of-service, load, credential-stuffing, brute-force,
   fuzzing, port-scanning, or broad automated attack tools against production.
3. Do not modify, pause, resume, restart, archive, delete, invite into, or draft
   within a real user league.
4. Mushroom Cup and both Mushroom Hut leagues are explicitly out of bounds for
   mutations. See the post-launch handoff for their current state.
5. Do not create users, send Discord/Twitch/email messages, trigger OAuth,
   upload files, or change provider configuration without explicit owner approval.
6. Do not rotate secrets, enable paid services, alter DNS, change Supabase Auth,
   change Vercel environment variables, or modify GitHub settings during the
   read-only audit.
7. If exploit confirmation requires a write, use an isolated practice league
   and disposable accounts only after obtaining approval and documenting exact
   cleanup guards.
8. Never retrieve or display secret values. It is acceptable to verify that a
   variable exists, is scoped correctly, and is not exposed to the browser.
9. Preserve the untracked `.vercel/` directory and do not commit it.
10. Do not delete any Supabase project. The old restore project
    `phvlvcuxulzhrqrmfndz` is already absent.

## Required audit areas

### 1. Repository and supply-chain security

- Search the current tree and complete Git history for committed credentials,
  access tokens, passwords, private URLs, `.env` files, database connection
  strings, OAuth secrets, service-role keys, and webhook secrets.
- Report only secret type, file/commit location, exposure status, and rotation
  recommendation. Redact every value.
- Confirm `.gitignore` covers local environment files, Vercel metadata,
  recovery archives, exported data, logs, and temporary artifacts.
- Review package-lock integrity, dependency provenance, lifecycle scripts, and
  known production vulnerabilities.
- Check GitHub branch protection, required reviews/checks, secret scanning,
  push protection, Dependabot, code scanning, Actions permissions, and deploy
  integration. No `.github` directory was present in the initial local scan;
  verify whether protections exist in repository settings instead.
- Identify whether production deploys every direct push to `main` and recommend
  an appropriate review/rollback gate for a small project with real users.

### 2. Authentication and session security

- Review signup, email confirmation, sign-in, magic links, password recovery,
  password replacement, sign-out, session hydration, and account deletion.
- Confirm recovery tokens and access fragments are removed from URLs and never
  logged or forwarded.
- Review Supabase Auth redirect allowlists, Site URL, password policy, email
  enumeration behavior, refresh-token handling, session lifetime, and MFA
  options for the owner account.
- Verify bearer-token extraction rejects malformed or ambiguous authorization
  headers and that privileged routes call Supabase `getUser`, not merely trust
  decoded client claims.
- Check whether state-changing cookie-authenticated routes need CSRF protection.
  Document the actual auth transport before declaring a CSRF issue.
- Verify user deletion cannot orphan leagues, retain sensitive profile data, or
  be triggered for another account.

### 3. Authorization and multi-tenant isolation

- Build a role/action matrix for anonymous users, coaches, commissioners,
  co-commissioners, spectators, support users, and owners.
- Review every `src/app/api/**/route.js` handler for authentication,
  authorization, object-level access checks, method constraints, input limits,
  safe errors, and service-role usage.
- Review direct client Supabase reads/writes and RPC calls against RLS and
  function permissions.
- Verify a user cannot change a league ID, team index, user ID, session ID,
  support grant ID, request ID, or recovery snapshot ID to access another
  tenant’s data.
- Confirm owner access does not silently bypass private-league membership except
  through the explicit owner/support routes.
- Confirm temporary support grants enforce support user, league, permission,
  expiry, revocation, and primary-commissioner restrictions server-side.
- Check commissioner transfer, co-commissioner limits, league archive, personal
  hide/archive, and owner deletion for confused-deputy or privilege-escalation paths.

### 4. Supabase database security

- Inventory all tables, views, storage buckets, RLS status, policies, grants,
  functions, triggers, and exposed schemas from the final production state.
- Do not review only the newest migration; historical migrations may leave
  obsolete functions, overloads, grants, or policies behind.
- Flag tables exposed to `anon` or `authenticated` without RLS or with policies
  using permissive ownership assumptions.
- Review all `SECURITY DEFINER` functions for a fixed safe `search_path`, fully
  qualified objects, caller authorization, parameter validation, and minimum
  execution grants.
- Enumerate function overloads and verify obsolete signatures cannot bypass the
  current secure implementation.
- Verify service-role-only functions are not executable by `anon`,
  `authenticated`, or `public`.
- Confirm private queues, notebooks, support diagnostics, recovery snapshots,
  OAuth connections, Discord identifiers, notification events, account-deletion
  data, and operational-health context cannot leak cross-user.
- Review public league, profile, statistics, poll, and stream views for fields
  that should remain private.
- Review storage bucket upload MIME/type/size/path ownership and public-read rules.

Relevant migrations include, but are not limited to:

- `supabase/035-least-privilege-function-execution.sql`
- `supabase/055-security-definer-least-privilege.sql`
- `supabase/066-restrict-internal-security-definer-functions.sql`
- `supabase/077-private-league-team-notebooks.sql`
- `supabase/084-reliable-settings-queues-and-invite-reopen.sql`
- `supabase/089-live-snake-lifecycle-safety.sql`
- `supabase/091-server-authoritative-member-transactions.sql`
- `supabase/093-atomic-team-owner-preferences.sql`
- `supabase/094-private-server-authoritative-claims.sql`
- `supabase/102-private-durable-draft-queues.sql`
- `supabase/209-personal-league-archive-and-owner-delete.sql`
- `supabase/232-owner-league-operations.sql`
- `supabase/233-temporary-support-access.sql`
- `supabase/237-commissioner-transfer-and-account-deletion.sql`
- `supabase/238-scoped-pricing-support-access.sql`
- `supabase/241-collision-safe-private-queue-reordering.sql`
- `supabase/242-commissioner-league-lifecycle-archive.sql`

### 5. Server routes and privileged credentials

- Inventory every use of `createAdminClient()` and justify why the service role
  is required.
- Ensure authorization happens before privileged reads or writes and that all
  queries are scoped to the authorized user/league/resource.
- Confirm no server-only environment variable is referenced through a
  `NEXT_PUBLIC_` name or serialized into client props, logs, errors, or source maps.
- Review JSON body limits, string lengths, list sizes, numeric ranges, UUID
  validation, URL parsing, and failure behavior.
- Check errors for leakage of SQL details, table/constraint names, provider
  responses, tokens, email addresses, or private identifiers.
- Review `src/lib/supabase/admin.js`, `src/lib/supportAccess.js`, and
  `src/lib/ownerOperations.js` as high-value authorization helpers.

High-priority route groups:

- `src/app/api/operations/**`
- `src/app/api/support-access/route.js`
- `src/app/api/support/league-request/route.js`
- `src/app/api/account-deletion/route.js`
- `src/app/api/league-recovery/route.js`
- `src/app/api/discord/**`
- `src/app/api/twitch/**`
- `src/app/api/notifications/dispatch/route.js`
- `src/app/api/championship-artwork/route.js`

### 6. Connected-service and webhook security

- Twitch EventSub: validate HMAC construction, raw-body handling, timestamp
  freshness, message-ID replay protection, challenge handling, subscription
  type/version checks, broadcaster matching, and constant-time comparison.
- Discord OAuth: validate unpredictable state, one-time use, expiry, binding to
  the initiating user, exact redirect URI, safe error redirects, minimal scopes,
  and token storage/access.
- Discord routes: verify commissioner/member authorization, destination-channel
  ownership, mention suppression, content limits, retry/idempotency behavior,
  and that provider errors do not leak tokens.
- Notification dispatch: verify cron authentication, event claiming,
  idempotency, retry caps, outbound URL restrictions, and denial-of-wallet risks.
- Resend/email: verify recipient authorization, template escaping, link origins,
  abuse/rate limits, and protection from arbitrary-email relay behavior.

### 7. Input, output, and browser security

- Search for `dangerouslySetInnerHTML`, raw HTML construction, unescaped email
  templates, dynamic URLs, user-controlled CSS, markdown rendering, and unsafe
  DOM APIs.
- Test stored and reflected XSS risk in league names, team names, descriptions,
  usernames, messages, polls, stream titles, URLs, and imported spreadsheet data.
- Review SSRF risk wherever the server fetches user-supplied URLs or image URLs.
  HTTPS alone does not prevent requests to internal/private addresses.
- Review file/spreadsheet/image inputs for size limits, decompression bombs,
  formula injection, unsafe filenames, MIME confusion, and public exposure.
- Verify redirects cannot be made open redirects through query parameters,
  callback state, or error-return paths.
- Review CORS behavior for API routes and Supabase endpoints used by the browser.
- Verify production security headers: CSP, HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, permissions policy, frame protection, and caching rules for
  authenticated/private responses.
- Confirm sensitive pages and APIs are not cached publicly by Vercel or browsers.

### 8. Abuse resistance and availability

- Identify unauthenticated or low-cost endpoints that trigger expensive
  database queries, external API calls, email, Discord, Twitch, image work, or
  large response generation.
- Review per-user, per-IP, per-league, and global rate limiting. Do not assume
  provider defaults are adequate.
- Check idempotency and replay protection for draft actions, invitations,
  notifications, support requests, OAuth callbacks, webhooks, account deletion,
  and recovery actions.
- Review maximum league size, roster size, queue size, message length, poll
  volume, image size, and request-body limits for resource exhaustion.
- Assess whether operational-health logging itself can be spammed into a cost or
  storage incident.
- Propose practical controls that do not block normal draft-night bursts.

### 9. Privacy, logging, backup, and incident response

- Inventory personally identifiable and connected-account data stored by the app.
- Verify public views expose only intentionally public fields.
- Review logs, operational events, support diagnostics, provider errors, and
  audit tables for tokens, emails, private messages, recovery data, and excessive
  retention.
- Confirm encrypted backup handling, separation of passphrase, access control,
  restoration testing, and deletion/retention policies.
- Review `docs/data-retention-and-recovery.md` and verify it matches production.
- Produce an incident-response checklist for account takeover, leaked service
  key, malicious commissioner, webhook-secret leak, database policy bypass,
  dependency compromise, and abusive traffic.
- Recommend owner-account MFA and least-privilege provider access where supported.

## Safe verification baseline

Existing commands:

- `npm run test:regulations`
- `npm run test:national-dex`
- `npm run smoke:production`
- `npm run build`

Known local limitation: the current `.env.local` contains Vercel metadata but
lacks the public Supabase URL/key. The local build compiles and passes TypeScript
but currently stops during page prerender for that missing local configuration.
Do not copy production secret values into committed files to work around this.

Add focused automated security tests where they materially prove authorization,
validation, webhook verification, or header behavior. Tests must not call real
user leagues or send real external messages.

## Required deliverables

### A. Executive summary

State what was reviewed, what was not reviewed, the overall risk posture, and
the three most important actions. Avoid absolute assurances.

### B. Findings table

For every finding include:

- ID and concise title
- Severity: Critical, High, Medium, Low, or Informational
- Confidence: Confirmed, High, Medium, or Needs validation
- Affected component and exact file/function/policy/route
- Threat actor and prerequisites
- User/business impact
- Evidence with secrets redacted
- Safe reproduction or reasoning
- Recommended remediation
- Verification test
- Whether production configuration or credential rotation is required

Do not inflate theoretical issues. A Critical or High finding must describe a
credible path to account compromise, cross-tenant data access, privileged
mutation, secret exposure, arbitrary server action, or serious availability loss.

### C. Authorization matrix

Document access for anonymous, authenticated coach, commissioner,
co-commissioner, spectator, temporary support, and owner roles across the main
resources and mutations.

### D. Supabase exposure inventory

Provide RLS/grant/function/storage results for the production final state, with
particular attention to `SECURITY DEFINER` functions and obsolete overloads.

### E. Remediation plan

Group fixes into:

1. Immediate containment before more promotion
2. Near-term hardening
3. Defense-in-depth improvements
4. Monitoring and incident readiness

Estimate regression risk and identify which fixes require owner approval or
provider configuration changes.

## Stop and escalate conditions

Stop active verification and notify the owner immediately if any of these are
found:

- a live credential or secret in Git history, client bundles, logs, or public output;
- anonymous or cross-user access to private league/account data;
- a path to owner, commissioner, or support privilege escalation;
- unauthenticated service-role actions;
- a reproducible way to alter a real league without authorization;
- unsafe webhook acceptance or replay that triggers external notifications;
- evidence of current exploitation or unexplained privileged activity.

Report the minimum necessary evidence with all sensitive values redacted. Do not
continue exploitation, enumerate unrelated users, or modify production to prove
additional impact.

## Current operational context

- Queue collision, stale-save recovery, transient error guidance, lifecycle
  visibility, commissioner archive, and long-paused draft reminders are deployed.
- Operations active totals now exclude archived leagues. Archived leagues have a
  separate count and filter.
- Historical failure events remain visible for 30 days and must not be mistaken
  for new exploitation without timestamps and corroborating evidence.
- Repository state should remain clean except for the existing untracked
  `.vercel/` directory.

The audit should end with a written report before any material production or
provider change is made.
