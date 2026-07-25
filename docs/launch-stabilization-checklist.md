# DraftCenter launch and stabilization checklist

Use this before each beta release. Record the date, commit, tester accounts, devices, and pass/fail result. A failed data-integrity, privacy, permission, draft, playoff, or archive check blocks release.

## Release record

- Date:
- Commit:
- Vercel production deployment: Ready / Not ready
- Supabase migrations confirmed:
- Testers and roles:
- Desktop browsers and mobile devices:

## Accounts, permissions, and privacy

- [ ] Sign up, confirmation, sign in, password reset, and sign out work.
- [ ] Commissioner, co-commissioner, manager, and spectator see only permitted controls.
- [ ] Public/watch pages do not reveal private league details or identities.
- [ ] League notebooks and My Teams workspaces are visible only to their owner.
- [ ] Public coach profiles expose only intended public fields.
- [ ] Discord secrets and private settings never appear in browser-visible data.

## League lifecycle and drafts

- [ ] Create private, open-to-join, and open-to-watch leagues.
- [ ] Claim every team with separate accounts; availability changes only after claim.
- [ ] Invite, promote, remove, and replace managers safely.
- [ ] Draft-time edits do not start or complete the draft.
- [ ] Complete multi-account snake and auction drafts.
- [ ] Complete a hosted budgeted snake draft; server rejects unaffordable picks and preserves remaining budgets.
- [ ] Waiting room, scheduled start, timer, turn ownership, queues, sorting, and recap work.
- [ ] A manager queue survives reload and cannot modify another manager's queue.
- [ ] Rapid roster-range slider changes persist the final selected values.
- [ ] One general manager invite link admits multiple managers until expiry.
- [ ] A targeted email invite remains restricted to its recipient and safely reopens for them.
- [ ] Refresh, leave/rejoin, and use multiple tabs during a draft.
- [ ] Draft state remains consistent across browsers and accounts.

## Season, results, and playoffs

- [ ] Process free agents, waivers, trades, cancellations, and eligible reversals.
- [ ] Human results are never overwritten by bot simulation.
- [ ] Managers and commissioners report and correct regular-season results.
- [ ] Standings, records, schedules, and series results persist after reload.
- [ ] Two semifinals are reported independently by different accounts.
- [ ] Commissioner correction recalculates playoff advancement atomically.
- [ ] Finalists, final result, and champion persist after reloads and competing saves.
- [ ] Reporting overlays remain usable on desktop and mobile.

## Archive and recovery

- [ ] Archive a completed season.
- [ ] Champion, standings, rosters, draft log, transactions, and bracket persist.
- [ ] Eligible archived snake drafts contribute to community ADP; auctions do not.
- [ ] Reset/restart remains scoped and preserves archived seasons.
- [ ] Complete a second season, then recheck the first archive.
- [ ] League spreadsheet export includes current and archived teams, rosters, standings, results, transactions, playoffs, and draft history.
- [ ] League recovery JSON restores into a test league without altering archived history or protected live-draft authority.
- [ ] Automated database backup ownership, frequency, retention, and restore access are documented.
- [ ] A database restore drill is completed in a safe non-production environment and recorded.
- [ ] Backup files are stored somewhere other than the production database and primary deployment account.
- [ ] Account and My Teams data portability is tested without exposing another user's private data.

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
- [ ] Slow loading, reloads, reconnects, and expired sessions recover clearly.
- [ ] Production build passes with every expected route.
- [ ] Exact changed files are reviewed.
- [ ] Required Supabase SQL reports success.
- [ ] GitHub push completes with the intended commit.
- [ ] Vercel production deployment reports **Ready**.
- [ ] Production smoke test passes.

## Release decision

- Blocking failures:
- Non-blocking follow-ups:
- Approved by:
- Decision: Ship / Hold
