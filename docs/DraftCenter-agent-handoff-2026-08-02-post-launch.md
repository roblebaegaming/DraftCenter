# DraftCenter post-launch agent handoff — August 2, 2026

- Production: https://www.draftcentral.gg
- Repository: `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter`
- GitHub: `roblebaegaming/DraftCenter`, branch `main`
- Current production code commit: `d09ce76`
- Current production deployment: `BZqxc8E7ZaoDamGg68kcCjEbuPPr` — Ready
- Production Supabase project: `eukexfqpiuidwygllaye`
- Previous comprehensive launch handoff: `docs/DraftCenter-agent-handoff-2026-08-02-final.md`

## Current outcome

DraftCenter has its first real users. A post-launch investigation reviewed the
Operations dashboard, the active and paused draft sessions, and the failures
reported on August 1–2. No lost picks, damaged rosters, or corrupt active draft
state were found. The confirmed product and database issues were fixed and
deployed. Expected safety rejections remain visible for historical context, but
are separated from system failures.

No real league was changed during the investigation. In particular, the owner
is not responsible for Mushroom Cup, so the league was inspected read-only and
left entirely under its commissioner’s control.

## Production fixes completed

### Collision-safe private draft queues

The queue save failure below was a real database issue:

`duplicate key value violates unique constraint "private_draft_queue_items_league_id_user_id_team_index_posi_key"`

Migration `supabase/241-collision-safe-private-queue-reordering.sql` changed the
queue position uniqueness constraint to `DEFERRABLE INITIALLY DEFERRED`. This
allows a queue reorder to update all positions atomically without transiently
colliding with another row. The migration was applied to production and its
constraint properties were verified.

Commit: `133b722`.

### Timer input normalization

A fractional timer value such as `0.5` had reached an integer database field.
DraftCenter now normalizes the value to a whole number before saving, preventing
`invalid input syntax for type integer: "0.5"`.

### Expected rejection classification

Operations now recognizes these as working safety checks rather than provider
or application failures:

- A stale whole-league save rejected because another session saved a newer revision.
- An insecure team-logo URL rejected because it was not HTTPS.
- Duplicate live-draft provisioning rejected because the league already had a draft.
- An action rejected because no active snake draft remained.
- A pick rejected because the Pokémon was not ready on the authoritative board.

The harmless duplicate scheduled-start warning is also suppressed when the
league already has a healthy live draft.

Commit: `075c1da`.

### Safe stale-save recovery

When a whole-league settings save loses a revision race, DraftCenter now:

1. refreshes the latest authoritative league state;
2. reapplies the user’s functional edit;
3. retries the save once.

Server-authoritative draft actions are not automatically replayed because a
timed-out response does not prove the first action failed; replaying could
duplicate a pick or other mutation.

Commit: `aa69377`.

### Friendlier network and provider-timeout guidance

Queue and team-preference saves now translate connection interruptions and
database/provider timeouts into actionable guidance. Users are told to refresh
first, confirm the current state, and retry once. This replaces raw messages
such as `NetworkError`, `upstream request timeout`, and statement timeout text.

Commit: `947251f`.

## League lifecycle and archive improvements

### Commissioner league archive

Primary commissioners can permanently archive an ended league while preserving
its history. This is distinct from a user hiding a team or league only for
themselves.

- The commissioner action is labeled **Archive league for everyone**.
- Personal cleanup remains labeled **Hide for me**.
- A league with an active draft cannot be archived.
- The archive operation is server-authoritative and audited.
- Migration `supabase/242-commissioner-league-lifecycle-archive.sql` was applied
  to production and verified without modifying an existing league.

Commit: `117a8de`.

### Detailed Owners-page lifecycle

The owner-only Operations page now has:

- an **Active or paused drafts** count;
- a dedicated **Drafts** filter;
- a **Draft lifecycle** panel;
- separate live, manually paused, overnight-paused, scheduled, draft-complete,
  season, completed-season, and archived lifecycle states;
- completed-pick progress, total expected snake picks when available, and the
  last lifecycle activity time.

This information is visible without granting the owner access to a private
league. Entering or modifying a private league still requires normal membership
or commissioner-approved temporary support access.

Commit: `947251f`.

### Long-paused commissioner reminder

A commissioner viewing a draft that has been manually paused for at least six
hours now sees a prominent reminder with:

- the number of hours paused;
- an explanation that the draft will not resume automatically; and
- a direct **Resume Draft** button.

Intentional overnight pauses are excluded. The reminder is informational and
never resumes a draft or contacts league members automatically.

Commit: `e5b6bb6`.

## Real-league findings

### Mushroom Cup Draft League

Read-only production inspection found:

- eight members and eight claimed teams;
- an active snake draft session;
- six completed picks out of 64 expected picks;
- the next team stored on the authoritative session;
- no timer and no paused state at the time inspected;
- no evidence of lost picks, roster corruption, or a broken session.

The observed errors were a mix of the fixed queue collision, transient network
or provider timeouts, and expected validation/concurrency rejections. The
league may simply be waiting for participants. Do not modify it unless its
commissioner explicitly requests support and grants the appropriate access.

### Mushroom Hut Draft League — Zaviden

This is a six-team, one-user draft. It did not crash:

- 39 of 48 picks were completed.
- The commissioner manually paused it.
- The commissioner later resumed it, completed two more picks, and manually
  paused it again.
- The latest pause was therefore an intentional commissioner action.

### Mushroom Hut Draft League — Jadolphgaming

This is a separate eight-team, one-user draft with the same league name. It also
did not crash:

- 51 of 64 picks were completed.
- Its commissioner manually paused it.
- The pause event was not an overnight automatic pause.

The Operations lifecycle panel now makes these reasons and progress visible to
the owner. Only the league commissioner can decide whether either draft should
resume.

### Other observed leagues

Several new one-user leagues remain in setup and never started a draft. That is
not proof of a technical failure. Operations should be monitored for new
post-fix failures, but historical account creation followed by inactivity must
not be treated as data corruption without further evidence.

## Monitoring interpretation

Historical health events remain visible for 30 days. Their continued presence
does not mean they are recurring after the fix.

Treat as expected safety behavior:

- `This league changed in another session. Refresh before saving again.`
- `Team logos must use a secure HTTPS URL.`
- `This league already has a live draft. Do not provision it again.`
- `No active snake draft found.` when a stale client acts after the draft ends.
- Authoritative turn, availability, affordability, and roster-limit rejections.

Investigate as a new system failure if it occurs after the deployed fixes:

- a new private-queue unique-constraint collision;
- repeated statement or upstream timeouts affecting multiple users;
- repeated network failures when the rest of the site is reachable;
- a draft session whose pick count and stored rosters disagree;
- a live draft that cannot be resumed by its commissioner;
- any new failure that coincides with missing picks or roster changes.

## Verification completed

- Production lifecycle data was verified in the authenticated Operations page.
- The page correctly showed Mushroom Cup live at 6/64 and both Mushroom Hut
  drafts manually paused at 39/48 and 51/64.
- Production JavaScript was verified to contain the long-pause reminder from
  commit `e5b6bb6`.
- `npm run test:regulations`: passed, two tests.
- `npm run test:national-dex`: passed, 1,027 Pokémon rows.
- `npm run smoke:production`: passed, 14 public routes returned 200 and five
  protected endpoints returned 401 while signed out.
- `git diff --check`: passed before each commit.
- The local Next.js production compiler and TypeScript pass. Page prerendering
  in the current local shell stops because `.env.local` lacks the public
  Supabase URL/key; production deployment and smoke verification pass.

## Remaining owner-operated checks

The real Twitch broadcast is complete. Two owner-visible checks still require a
normal external client: live Turnstile completion and the second email-client
test. Neither is a known regression.

### Live Turnstile completion

1. Open https://www.draftcentral.gg in a normal signed-out private/incognito
   browser.
2. Confirm the **Security check** completes normally.
3. Only after that pass, set `NEXT_PUBLIC_TURNSTILE_ENFORCED=true` for Vercel
   Production, redeploy, and verify the signed-out form remains reachable.
4. Configure Supabase Auth **Bot and Abuse Protection** for Turnstile using the
   secret kept outside GitHub and Vercel.
5. Immediately smoke-test sign-in, signup, and password reset. If any path
   fails, disable Supabase enforcement and remove or set the Vercel enforcement
   flag to false; the public site key may remain.

### Real Twitch broadcast — completed August 2

- A fresh Mega Test record was registered while the Twitch channel was offline;
  it was `scheduled` with Twitch monitoring `enabled` before the broadcast.
- Twitch's external online callback changed the record to `live`.
- The signed-in member dashboard displayed the **MATCH LIVE NOW** banner and
  watch link. The public Community Live Now page omitted the stream because Mega
  Test is a private league, which is expected.
- Exactly one configured Mega Test league-channel notification and exactly one
  eligible-member personal DM event were accepted by Discord. No duplicate or
  failed delivery record appeared.
- Twitch's external offline callback changed the record to `ended`, and the
  member dashboard banner disappeared.
- Personal quiet hours were restored after the controlled test window.

Important test rule: a stream creator is intentionally excluded from personal
"league stream is live" DMs. The `@roblebae` creator therefore did not receive a
personal DM. The eligible non-creator event was sent to the `@draftcenter`
profile's linked Discord identity, `DraftCenterOfficial`. For a future
human-visible personal-DM check, publish the stream from a different DraftCenter
member than the opted-in recipient and have the recipient inspect the Discord
identity linked to that DraftCenter profile.

### Second email client

1. Add the existing Gmail account to Outlook mobile, Apple Mail, Samsung Email,
   or another major client.
2. Create a temporary DraftCenter account with a Gmail plus alias.
3. Verify the branded confirmation email layout and confirmation link.
4. Sign in, sign out, request a password reset, and verify the reset screen.
5. Delete the temporary account afterward.

Gmail web confirmation and recovery already passed; this checks rendering and
link behavior in a second client.

## Security and provider completion

The independent security audit and its implementable remediation are complete.
The detailed evidence is in `docs/DraftCenter-security-remediation-2026-08-02.md`.

### Application and connected-service controls

- The global notification dispatcher accepts only the exact cron secret.
  Signed-in users and commissioners can request only an explicitly authorized,
  league-scoped dispatch. Anonymous, ordinary-user, commissioner, malformed,
  and oversized-call regression tests prove rejected callers reach no privileged
  database or provider work.
- Production log review found no evidence of unauthorized global dispatch or a
  credential exposure that required rotation.
- Twitch EventSub verifies signatures, expected subscription type and status,
  the configured broadcaster, and durable replay IDs retained for 24 hours.
- Durable rate limits protect notification, Discord, support, Twitch, OAuth,
  and championship-artwork routes. Request bodies and external artwork sources
  are explicitly bounded and validated.
- Public failures use safe messages. Stored operational diagnostics are
  sanitized and retained for 30 days.
- CSP, HSTS, frame, MIME, referrer, permissions, opener, and resource policies
  are active in production.
- Repository CI runs security tests, a production dependency audit, CodeQL,
  and a full-history secret scan. Secret scanning, push protection, dependency
  monitoring, and private vulnerability reporting are enabled.

### Live provider configuration

- The production Supabase security review confirmed RLS on all public tables,
  least-privilege function grants, fixed security-definer search paths, safe
  avatar storage policy and limits, hardened password/session settings, and a
  clean database security-advisor error result.
- GitHub `main` is protected against deletion and force-pushes and requires an
  up-to-date pull request, resolved conversations, both security checks, linear
  history, and high-severity CodeQL results. The owner retains an audited
  emergency bypass.
- Vercel protects preview deployments, build/source output, and fork deployments;
  production remains connected only to `main`. The verified deployment-retention
  policy is 30 days canceled, 90 days errored, 180 days preview, and one year
  production.
- GitHub, Vercel, and the production Supabase organization require MFA for the
  owner. Recovery material is stored outside the corresponding provider.

### Authentication bot protection

- Pull request #10 added Cloudflare Turnstile to signed-out sign-in, signup, and
  password-reset actions and merged as `37fd599` after all checks passed.
- The managed Cloudflare widget allows only `draftcentral.gg`; the root rule also
  covers `www.draftcentral.gg`. The public site key is configured in Vercel for
  Production and Preview. The secret is not in Vercel or GitHub.
- The official always-pass Cloudflare test key validated sign-in, signup,
  password reset, token renewal, expiration, and mode changes locally.
- Production is intentionally staged fail-open: the widget is visible, but
  `NEXT_PUBLIC_TURNSTILE_ENFORCED` is absent and Supabase enforcement remains
  disabled until a normal human browser completes the real widget. This prevents
  an automated rollout from locking out legitimate users.

### Retention, recovery, browser, and Search evidence

- Supabase Pro's seven-day daily-backup window is now verified against the live
  dashboard and current provider documentation. Current physical restore points
  were visible on August 2.
- The DraftCenter owner (Rob Lebae) is the primary backup custodian, sole current
  Supabase restore operator, and production-restore approver. No secondary human
  custodian is appointed; that single-owner dependency is explicit.
- The internal schedule uses quarterly restore drills and encrypted off-account
  archives, 30-day operational and automatic recovery history, guarded account
  and league deletion, and separate password-manager custody for archive and MFA
  recovery material.
- Pull request #11 reduced the shared logo from 1,573,505 bytes to 58,545 bytes,
  uses compact landing-card sprites, and fixed the Turnstile accessibility role.
  It merged as `d09ce76` after all six checks passed.
- The post-release Lighthouse result is 91 performance / 100 accessibility /
  96 best practices / 100 SEO on mobile slow 4G and 99 / 100 / 96 / 100 on
  desktop. The production smoke sweep still passes.
- Search Console reports the sitemap as Success with 1,059 discovered pages,
  no security issues, and no manual actions. Initial indexing and experience
  data are still processing.

## Restore-project cleanup

Cleanup is complete. Project `phvlvcuxulzhrqrmfndz` was already absent from
both accessible Supabase organizations, so no destructive action was needed.
Production and the unrelated older recovery project were not touched.

Evidence commit: `fdf3f4f`.

## Safety rules for the next agent

1. Do not modify Mushroom Cup without a direct commissioner request and valid
   access. The owner is not its commissioner.
2. Do not resume, restart, archive, or delete either Mushroom Hut draft. Their
   commissioners intentionally paused them.
3. Preserve the untracked `.vercel/` directory and never commit it.
4. Never expose Supabase keys, session tokens, Discord/Twitch credentials,
   passwords, recovery fragments, or archive passphrases.
5. Do not replay a timed-out draft mutation automatically. Refresh and verify
   authoritative state first.
6. Use isolated practice leagues for destructive lifecycle testing and verify
   the exact league ID before cleanup.
7. Do not delete any Supabase project based on a name alone. Require an exact
   project-ID check and explicit owner approval.
8. Distinguish historical Operations entries from new post-deployment events.

## Commit sequence for this post-launch pass

- `fdf3f4f` — record restore-project cleanup
- `133b722` — harden draft queue error handling
- `117a8de` — add commissioner league archiving
- `075c1da` — ignore harmless duplicate draft-start warning
- `aa69377` — retry stale league saves safely
- `947251f` — show draft lifecycle and clarify transient failures
- `e5b6bb6` — remind commissioners about long-paused drafts
- `37fd599` — protect signed-out authentication with staged Turnstile
- `d09ce76` — record retention/custody and improve mobile launch performance

## Primary files

- `docs/DraftCenter-agent-handoff-2026-08-02-final.md`
- `docs/launch-stabilization-checklist.md`
- `docs/multi-account-hardening-test-record.md`
- `docs/data-retention-and-recovery.md`
- `docs/DraftCenter-security-remediation-2026-08-02.md`
- `docs/browser-network-and-search-audit-2026-08-02.md`
- `src/lib/ownerOperations.js`
- `src/lib/authCaptcha.js`
- `src/components/OperationsDashboard.jsx`
- `src/components/TurnstileChallenge.jsx`
- `src/components/PokemonDraftLeague.jsx`
- `supabase/241-collision-safe-private-queue-reordering.sql`
- `supabase/242-commissioner-league-lifecycle-archive.sql`
- `scripts/production-smoke.mjs`
- `scripts/verify-national-dex-paging.mjs`
- `test/regulation-catalog.test.js`
