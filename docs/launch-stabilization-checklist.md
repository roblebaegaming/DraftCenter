# DraftCenter launch and stabilization checklist

Use this before each beta release. Record the date, commit, tester accounts, devices, and pass/fail result. A failed data-integrity, privacy, permission, draft, playoff, or archive check blocks release.

## Release record

- Date: August 2, 2026
- Commit before final documentation: `205672b` (`main` and `origin/main`)
- Vercel production deployment: Ready (`dpl_CFuyFAZhgfuhZFHRsUTGepzMFEAg`), aliased to `https://www.draftcentral.gg`
- Supabase migrations confirmed: through 240 in production
- Testers and roles: Existing `@roblebae` owner/commissioner session, the earlier two temporary managers and spectator, plus two final disposable manager sessions
- Desktop browsers and mobile devices: Codex in-app browser; 390 × 844 responsive viewport

### August 1–2 evidence

- Production smoke checks passed for `/`, `/explore`, `/operations`, `/operations/daily-three`, `/manuals/commissioner`, and `/manuals/manager`.
- The tested public/operations/manual pages had no document-level horizontal overflow at 390 px.
- Mega Test visibly preserved its Season 1 archive and now presents Season 2.
- **Season lifecycle passed:** Mega Test is correctly `DRAFTING`: Season 2 is locked, its hosted snake draft is complete, and Season 1 remains archived. The initial mismatch finding was a false positive.
- **Mobile retest passed:** Mega Test Setup and My Team both match the 382 px content viewport without horizontal overflow at a 390 × 844 browser viewport.
- **Operations recovery retest passed:** Mega Test's July 31 automatic recovery point appears under “Last recovery.”
- **Signed-out production smoke passed:** 14 public pages/discovery files returned 200, and five private operations/account APIs returned 401 when called without a session.
- **Privacy surface review passed:** public league database functions require `open` or `watch` visibility and return a deliberately limited projection; My Teams public attachments remain individually opt-in; Discord bot and OAuth secrets are referenced only by server code.
- **Multi-account production pass:** manager and spectator invitations, concurrent claims and picks, private queues, add/drop, trade, FAAB, result correction, immediate membership revocation, reconnect, and role boundaries behaved authoritatively.
- **Full season lifecycle passed:** 15 regular-season matches, a four-team playoff, champion persistence, archive/finalization, and clean Season 2 rollover completed without losing Regulation M-B or the Season 1 champion.
- **Portability and recovery passed:** private account JSON, a 12-sheet league workbook, league recovery JSON, and owner-isolated My Teams restore were downloaded, inspected, and exercised.
- **Latest-pick correction passed:** the production commissioner UI and guarded server function restored roster, pool, budget, turn, and completed-draft state; unauthorized and stale concurrent requests were rejected.
- **Cleanup passed:** the temporary league and all three temporary Auth accounts were deleted only after zero-ownership guards; all targets verified absent afterward.
- **Authentication passed in Gmail:** production signup confirmation, recovery email delivery, recovery landing, password replacement, sign out, and sign in with the new password all passed. The recovery flow exposed and fixed a production redirect-session bug; Supabase tokens are now restored and removed from the URL after use.
- **Discord delivery passed:** personal DM, league-channel test, and the real Daily Three league preview all returned successful delivery. Mega Test keeps Daily Three announcements enabled.
- **Twitch integration passed:** broadcaster lookup and EventSub registration succeeded; a real August 2 broadcast transitioned a fresh offline-registered stream from scheduled to live to ended; the member dashboard banner appeared and cleared; exactly one league-channel event and one eligible non-creator personal DM event were accepted by Discord; and no duplicate or failed delivery record appeared. Stream creators are intentionally excluded from personal live-stream DMs.
- **Final draft edge cases passed:** an isolated two-manager budgeted snake draft enforced minimum-slot affordability and completed below the roster maximum; an isolated two-manager auction enforced nomination ownership, bid ownership, budgets, roster limits, timed resolution, and final accounting.
- **External operations passed:** the encrypted recovery archive was uploaded to Google Drive and verified by exact filename, and Google Search Console domain ownership was verified through the production DNS TXT record.
- **Final cleanup passed:** the final disposable practice league was deleted after exact ID/name/slug/owner checks, and its two managers plus the separate Auth test account now return no matching Auth users.

## Accounts, permissions, and privacy

- [x] Sign up, confirmation, sign in, password reset, and sign out work. (production Gmail flow and recovered-session retest, August 2)
- [x] Commissioner, co-commissioner, manager, and spectator see only permitted controls. (production multi-account checks, August 2)
- [x] Public/watch pages do not reveal private league details or identities. (signed-out production/API and database-function review, August 1)
- [x] League notebooks and My Teams workspaces are visible only to their owner. (access-policy and public-projection review, August 1)
- [ ] Public coach profiles expose only intended public fields.
- [x] Discord secrets and private settings never appear in browser-visible data. (server/client boundary review, August 1)

## League lifecycle and drafts

- [ ] Create private, open-to-join, and open-to-watch leagues.
- [ ] Claim every team with separate accounts; availability changes only after claim.
- [x] Invite, promote, remove, and restore managers safely. (production live-session checks, August 2)
- [ ] Draft-time edits do not start or complete the draft.
- [x] Complete a multi-account snake draft. (36 authoritative picks across six teams, August 2)
- [x] Complete a multi-account auction draft. (isolated two-manager production auction with invalid-bid, budget, timer, roster, and accounting checks, August 2)
- [x] Complete a hosted budgeted snake draft; server rejects unaffordable picks and preserves remaining budgets. (isolated two-manager production pass with minimum-slot affordability and below-maximum completion, August 2)
- [ ] Waiting room, scheduled start, timer, turn ownership, queues, sorting, and recap work.
- [x] A manager queue survives reload and cannot modify another manager's queue. (two-manager isolation check, August 2)
- [ ] Rapid roster-range slider changes persist the final selected values.
- [x] One general manager invite link admits multiple managers until expiry. (two temporary managers, August 2)
- [ ] A targeted email invite remains restricted to its recipient and safely reopens for them.
- [x] Refresh, leave/rejoin, and use multiple tabs during a draft. (fresh-client reconnect check, August 2)
- [x] Draft state remains consistent across browsers and accounts. (authoritative pick, turn, roster, and pool comparison, August 2)

## Season, results, and playoffs

- [ ] Process free agents, waivers, trades, cancellations, and eligible reversals.
- [ ] Human results are never overwritten by bot simulation.
- [x] Managers and commissioners report and correct regular-season results. (role-scoped production checks, August 2)
- [x] Standings, records, schedules, and series results persist after reload. (full lifecycle pass, August 2)
- [ ] Two semifinals are reported independently by different accounts.
- [ ] Commissioner correction recalculates playoff advancement atomically.
- [ ] Finalists, final result, and champion persist after reloads and competing saves.
- [ ] Reporting overlays remain usable on desktop and mobile.

## Archive and recovery

- [x] Archive a completed season. (Season 1 finalized and archived, August 2)
- [x] Champion, standings, rosters, draft log, transactions, and bracket persist. (archive comparison, August 2)
- [ ] Eligible archived snake drafts contribute to community ADP; auctions do not.
- [ ] Reset/restart remains scoped and preserves archived seasons.
- [x] Start a clean second season, then recheck the first archive. (Season 2 rollover, August 2)
- [x] League spreadsheet export includes current and archived teams, rosters, standings, results, transactions, playoffs, and draft history. (12-sheet rendered review, August 2)
- [x] League recovery JSON restores into a test league without altering archived history or protected live-draft authority. (meaningful-state comparison, August 2)
- [x] Automated database backup ownership, frequency, visible history, restore access, and the seven-day Supabase Pro retention window are documented. (Reverified August 2; public contractual wording still requires legal/privacy review.)
- [x] A database restore drill is completed in a safe non-production environment and recorded. (Passed August 2, 2026 in isolated project `phvlvcuxulzhrqrmfndz`.)
- [x] Recovery artifacts are stored outside the production database and deployment account. (AES-256 recovery archive uploaded to Google Drive and exact-name verified, August 2)
- [x] Account and My Teams data portability is tested without exposing another user's private data. (signed-out rejection and cross-owner restore isolation, August 2)

## Community and account features

- [ ] Complete all Daily Three activities; results, comments, replies, avatars, and profile links work.
- [ ] Badges, Favorite Six, and regular-season career record update correctly.
- [ ] Resources links open their intended external destinations.
- [ ] Create, edit, archive, reopen, and delete a private My Teams workspace.
- [ ] Full personal roster, Pokémon stats, types, and defensive coverage display correctly.
- [ ] Current and archived DraftCenter league teams appear read-only in My Teams.
- [ ] External team creation stops at 10 while league teams do not count toward the limit.
- [ ] PokéPaste, PASRS helper, and saved spreadsheet links work.

## Layout, resilience, and release

- [ ] Test navigation, drafts, tables, playoffs, Daily Three, and modals at phone widths.
- [ ] Test current major desktop browsers where available.
- [ ] Missing artwork uses a safe fallback.
- [x] Reloads and reconnects recover the authoritative league state. (two fresh clients, August 2; expired-session breadth remains a future check)
- [x] Production build passes with every expected route. (63 routes, August 2)
- [x] Exact changed files are reviewed. (August 2 release candidate)
- [x] Required Supabase SQL reports success. (migrations 239–240 and production validation queries, August 2)
- [x] GitHub push completes with the intended release commit. (`4c7ef17`, August 2)
- [x] Vercel production deployment reports **Ready**.
- [x] Production smoke test passes. (`npm run smoke:production`, 14 public routes and 5 protected APIs)
- [x] Production dependency audit reports no known vulnerabilities. (Next.js 16.2.12, Sharp 0.35.3, PostCSS 8.5.25, and SheetJS 0.20.3; August 2)

## Release decision

- Blocking failures: None found in the validated release scope.
- Non-blocking follow-ups: a second major email client; Firefox/Safari breadth; the intentionally unchecked bot, reset/rebuild race, claim-race, transaction-reversal, Daily Three interaction, public-profile, and My Teams breadth items above. Google PageSpeed completed mobile slow-4G and desktop throttled audits on August 2 with healthy launch results; see `docs/browser-network-and-search-audit-2026-08-02.md`. The real Twitch online/offline EventSub broadcast passed August 2. The isolated August 2 restore project was verified absent after explicit owner deletion approval.
- Approved by:
- Decision: Ready for owner ship decision; remaining items are coverage gaps, not known regressions.
