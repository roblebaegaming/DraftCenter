# DraftCenter agent handoff — outside-user operations, support, analytics, and launch validation

**Handoff date:** August 1, 2026  
**Public launch target:** Friday, September 4, 2026  
**Production:** https://www.draftcentral.gg  
**Repository:** `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter`  
**GitHub:** `roblebaegaming/DraftCenter`, branch `main`  
**Production code at the start of this handoff:** `0993261 Use commissioner role for pricing approvals`

## Executive outcome

The outside-user support infrastructure requested during the July 31–August 1 work is implemented and deployed. DraftCenter now gives the owner a private operational view, gives commissioners and managers public manuals, warns the owner about new and unhealthy leagues, exposes privacy-limited Daily Three participation, supports commissioner-created help requests, and provides audited temporary support access without silently admitting the owner to a private league.

Commissioners can download, complete, preview, and import a Pokémon pricing spreadsheet themselves. If they prefer owner assistance, the primary commissioner can approve an expiring pricing-only support session. That session can change only Pokémon prices and the top price tier through a guarded importer; it cannot alter members, drafts, rosters, messages, results, or unrelated settings.

The implementation portion of the request is complete. The release should not yet be described as fully validated: the formal multi-account/mobile checklist, final Twitch-to-Discord live test, Daily Three channel test, season-rollover UI retest, production email-client test, and an isolated database restore drill remain hands-on launch gates.

## Where the owner sees everything

| Need | Owner location | What it shows |
| --- | --- | --- |
| Website traffic | Vercel dashboard → **DraftCenter** project → **Analytics** | Visitors, page views, top pages, referrers, countries, devices, operating systems, and browsers |
| New leagues and league health | https://www.draftcentral.gg/operations | Real and practice leagues, new-league timing, commissioner, draft timing, claims, backups, attention signals, support access, support requests, and recent operational errors |
| Daily Three participation | https://www.draftcentral.gg/operations/daily-three | Last activity, last full completion, today's three completion flags, 30-day completion days, and lifetime completion days; not answers or correctness |
| Help for a specific league | The league card on **League Operations** | Whether support access is required, its scope and expiration, commissioner instructions, and the approved support view |
| Commissioner and manager help | https://www.draftcentral.gg/manuals | Public Commissioner and Manager manuals, also linked in the site footer |
| Confirmation email template | Supabase → Authentication → Email Templates → Confirm signup | Production Auth email content; the version-controlled source is `supabase/email-templates/confirm-signup.html` |
| League recovery and support approval | League → **League Tools** while signed in as league staff | Automatic recovery history, contextual support request, and temporary support approval/revocation |
| Commissioner pricing import | League → **Setup** → **Legality & Values** | Download pricing template, upload `.xlsx`/`.xls`/`.csv`, preview changes, and confirm import |

Only emails listed in the server-only `DRAFTCENTER_OWNER_EMAILS` setting can open owner Operations endpoints. Platform ownership alone does not grant private-league access.

## Analytics recommendation and current state

### Use Vercel Web Analytics now

This is the best immediate traffic view because it is already installed:

- `@vercel/analytics` is present in `package.json`.
- `src/app/layout.js` loads `<Analytics />` on every page.
- The Legal page discloses anonymized, cookie-free Vercel Web Analytics.
- The Vercel project is named `draftcenter`.

Open the Vercel project and select **Analytics**. If Vercel displays an enable prompt rather than charts, enable Web Analytics for the production project and visit the live site again. Use 7-day and 30-day comparisons, then watch:

1. unique visitors and page views;
2. top landing pages and referrers;
3. `/manuals/commissioner`, `/manuals/manager`, `/support`, `/leagues`, and `/explore` traffic;
4. country and device mix, especially mobile;
5. traffic changes after league announcements or social posts.

Vercel traffic and DraftCenter Operations answer different questions. Vercel answers “how many people visited and where did they go?” Operations answers “did they create and operate healthy leagues?”

### Add Google Search Console next, without replacing Vercel

Search Console is the right second dashboard for Google discovery: impressions, clicks, click-through rate, search queries, and pages appearing in search results. Verify `draftcentral.gg` as a domain property using the DNS provider. This is a manual owner setup task and is not represented in the repository.

### Defer a larger product-analytics platform until there is a concrete funnel

No custom product-conversion events are currently implemented. Vercel page analytics plus `/operations` is sufficient for early outside-user support. If more detail becomes useful, define privacy-safe events before adding PostHog or another product tool. A sensible first funnel would be:

`sign up → league created → first team claimed → draft started → draft completed`

Possible later events include Daily Three completion, commissioner manual visits, pricing import completion, support request submission, and recovery restore. Never include emails, private league notes, messages, Pokémon choices, Discord identifiers, or uploaded pricing contents in analytics event properties.

## Outside-user support features now implemented

### Public help and commissioner onboarding

- `/manuals`, `/manuals/commissioner`, and `/manuals/manager` are public and linked in the global footer.
- The Commissioner Manual covers setup, rules, teams, pricing imports, support access, drafts, season operation, recovery, and ownership transfer.
- The Manager Manual covers joining, claiming, drafting, results, transactions, notifications, and season completion.
- A saved commissioner launch checklist summarizes setup readiness inside the league.
- Creating a real league sends the commissioner a welcome email with a direct league link, launch checklist, manual link, and support link.
- A professional Supabase confirmation-email template is stored at `supabase/email-templates/confirm-signup.html`, with installation and test instructions in `docs/supabase-registration-email.md`.

The repository cannot prove that the Auth template currently shown in the Supabase dashboard matches the saved file or renders correctly in Gmail and a second email client. Treat that production email check as pending unless separately recorded.

### Owner Operations

- `/operations` is private to the server-side owner allowlist.
- Every non-practice league triggers one deduplicated new-league email per configured owner address.
- Practice leagues appear in Operations but skip the immediate owner email.
- A daily 14:30 UTC digest reports leagues needing attention and operational errors from the previous 24 hours.
- Attention checks include unclaimed teams, imminent drafts without ready automation, failed scheduled-draft automation, failed notifications, ten days without activity in a live season phase, and old/missing commissioner backups.
- Support requests include only the commissioner's description and optional safe diagnostics. They exclude messages, notebooks, rosters, Discord data, notification preferences, and private personal notes.

### Daily Three owner visibility

- `/operations/daily-three` shows whether users completed Poll, Bracket, and Quiz today.
- It shows the last Daily Three activity, last full completion date, completed days in the last 30 days, and completed days all time.
- It intentionally does not expose poll choices, bracket selections, quiz answers, or quiz correctness.

### Commissioner pricing template and import

- Commissioners download an Excel template prefilled with the league's legal Pokémon and current prices.
- They may enter either **New Price** or **Rank** and upload `.xlsx`, `.xls`, or `.csv`.
- The UI validates the workbook, previews every proposed change, and requires confirmation before saving.
- Rank imports map ranks across the league's configured price range.
- The same file format is accepted in an approved owner pricing-support session.

### Temporary support access

- Operations says **Support access required** instead of pretending the owner can open any league.
- Commissioners receive copyable approval instructions.
- Staff can grant review-only access for 24 hours, 3 days, or 7 days.
- Only the primary commissioner can approve **Review and edit tiers/pricing**.
- Access expires automatically and can be revoked immediately.
- Approval, views, pricing updates, and revocation are audited.
- The pricing update uses the exact league name and snapshot revision, creates a private `pre_support_edit` recovery point, changes pricing, and records every changed Pokémon in one database transaction.

No support grant or live pricing change was created during final verification. The security path was verified without altering a user's league.

### Recovery and account lifecycle

- Automatic private league recovery points are retained for 30 days, with at most one automatic point per six-hour window when league state changes.
- Restoring first preserves the current version and rejects stale restore screens.
- Commissioners can still download readable spreadsheets and restorable JSON recovery files.
- Users can download a private account export.
- Primary commissioners can transfer ownership to an existing manager or co-commissioner.
- Account deletion has a seven-day cooling-off period and can be cancelled during that period.
- Deletion is blocked while the account remains primary commissioner of a league.
- The daily server job completes eligible deletions and writes a de-identified audit record.

## Database migrations applied during this support batch

| Migration | Purpose |
| --- | --- |
| `232-owner-league-operations.sql` | Owner allowlist operations data, new-league delivery records, Daily Three participation summary, and operations signals |
| `233-temporary-support-access.sql` | Expiring commissioner-approved support grants and audit log |
| `234-contextual-league-support-requests.sql` | League-linked support requests with optional safe diagnostics |
| `235-automatic-league-recovery-history.sql` | Private automatic recovery points and guarded restores |
| `236-commissioner-onboarding-email.sql` | Deduplicated commissioner onboarding delivery support |
| `237-commissioner-transfer-and-account-deletion.sql` | Ownership transfer, deletion cooling-off records, and de-identified completion audit |
| `238-scoped-pricing-support-access.sql` | `read_only`/`pricing_edit` scopes, guarded atomic pricing update, pre-edit recovery point, and pricing audit |

Migration 238 received explicit live verification: the function exists, authenticated callers cannot execute it directly, the service role can execute it, and the new permission/audit/recovery constraints are present. Do not rerun these migrations reflexively; verify a specific absence before changing production.

## Verification state at handoff

### Verified

- Local `main` and `origin/main` both point to `0993261` before this document commit.
- Production `/` and `/operations` returned HTTP 200 on August 1.
- A fresh local production build on August 1 compiled successfully and generated all 62 routes; the preceding production deployment also passed its build.
- Owner-only APIs reject unauthenticated/non-owner access even though the Operations page shell is publicly routable.
- Migration 238 permissions and constraints were live-verified.
- Production deployment and aliasing to `https://www.draftcentral.gg` succeeded.
- The tracked worktree was clean before this document; only the pre-existing untracked `.vercel/` directory was present.

### Still pending — do not mark these complete

1. Confirm the Vercel Analytics dashboard is receiving production data and record a baseline 7-day/30-day snapshot.
2. Confirm the production Supabase confirmation template matches the saved HTML; test a new registration in Gmail and another major email client.
3. Complete the final Mega Test flow: Twitch EventSub → league Live display → dashboard Live banner → exactly one personal Discord DM each to `DraftCenterOfficial` and `Rob Lebae` → stream-offline cleanup.
4. Test the Daily Three Discord announcement end to end in a connected, noise-safe league channel.
5. Exercise season finalization and next-season rollover once more through the UI after migration 230.
6. Complete and record the formal commissioner/manager/spectator multi-account lifecycle matrix in `docs/multi-account-hardening-test-record.md`.
7. Complete phone-width and major-browser launch checks in `docs/launch-stabilization-checklist.md`.
8. Verify and record the Supabase plan, backup frequency, retention, point-in-time recovery status, restore access, and off-account encrypted backup location in `docs/data-retention-and-recovery.md`.
9. Complete a real restore drill in an isolated non-production Supabase project. Never restore over production.
10. Improve operations error triage so expected permission/validation rejections are visually separated from genuine system failures.
11. Decide whether and when to verify Google Search Console for the domain.

YouTube automatic live detection remains intentionally deferred. Manual YouTube stream sharing is supported.

## Important commits

- `65226d9` — Add commissioner pricing spreadsheet import
- `2fc97f5` — Add commissioner launch and support workflows
- `86b26e5` — Add operational monitoring and league recovery history
- `6335ad4` — Add onboarding and account lifecycle safeguards
- `37fc006` — Add scoped pricing support access
- `0993261` — Use commissioner role for pricing approvals

Earlier Twitch, Discord, season rollover, public Live Now, and Daily Three automation work is documented in `docs/DraftCenter-agent-handoff-2026-07-31.md` and remains relevant.

## Main files for this batch

- `src/app/layout.js`
- `src/app/operations/`
- `src/app/api/operations/`
- `src/app/api/support-access/route.js`
- `src/app/api/support/league-request/route.js`
- `src/app/api/league-recovery/route.js`
- `src/app/api/account-deletion/route.js`
- `src/components/OperationsDashboard.jsx`
- `src/components/DailyThreeOperations.jsx`
- `src/components/SupportAccessPanel.jsx`
- `src/components/SupportLeagueView.jsx`
- `src/components/LeagueSupportRequestPanel.jsx`
- `src/components/LeagueRecoveryPanel.jsx`
- `src/components/PokemonDraftLeague.jsx`
- `src/lib/manualContent.js`
- `src/lib/ownerOperations.js`
- `supabase/email-templates/confirm-signup.html`
- `supabase/232-owner-league-operations.sql` through `supabase/238-scoped-pricing-support-access.sql`
- `docs/owner-league-operations.md`
- `docs/data-retention-and-recovery.md`
- `docs/supabase-registration-email.md`

## Safety rules

1. Never expose Supabase service-role keys, Twitch/Discord credentials, Resend keys, cron secrets, payment records, user emails, or private league contents.
2. Keep `DRAFTCENTER_OWNER_EMAILS` and all integration credentials server-only; never use a `NEXT_PUBLIC_*` name.
3. Do not turn the owner allowlist into universal private-league access. Require an active commissioner-approved support grant.
4. Do not broaden `pricing_edit`; keep it limited to `settings.costOverrides` and `settings.priceTierMax` through the guarded server importer.
5. Never run a destructive restore or deletion test against production.
6. Preserve the untracked `.vercel/` directory and do not commit it.
7. A passing build does not prove RLS, multi-account concurrency, email delivery, Discord delivery, or mobile behavior.

## Build and deploy

From the repository root:

```powershell
$env:NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL='https://example.supabase.co'
$env:NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY='test-key'
& .\node_modules\.bin\next.cmd build
```

Inspect the exact diff and `git status`, commit only intended files, push `main`, and deploy using the established Vercel project. Confirm the deployment is Ready and aliased to `https://www.draftcentral.gg`.

## Next-agent start procedure

1. Read this document, `docs/DraftCenter-agent-handoff-2026-07-31.md`, and the three launch/recovery checklists named above.
2. Inspect `git status`, `git log`, and the current production deployment before making changes.
3. Do not rebuild already-deployed owner/support infrastructure unless a concrete defect is reproduced.
4. Help the owner establish the Vercel Analytics baseline first; add Search Console only if the owner wants organic-search reporting.
5. Work through the pending hands-on validation list and record evidence rather than converting untested items to “done.”
6. Prioritize privacy, permissions, recovery, and multi-account lifecycle correctness over new broad features.
7. Keep YouTube automation and a larger product-analytics platform deferred unless the owner explicitly reprioritizes them.
