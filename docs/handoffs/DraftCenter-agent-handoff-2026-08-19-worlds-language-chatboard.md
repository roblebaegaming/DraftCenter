# DraftCenter agent handoff: Worlds language chatboard

- Date: August 19, 2026 Pacific
- Production: <https://www.draftcentral.gg>
- Worktree: `DraftCenter-worlds-multilingual-release-20260819`
- Branch: `codex/worlds-language-chatboard`
- Pull request: [#359](https://github.com/roblebaegaming/DraftCenter/pull/359)
- Base commit: `5504811730c080921d527a9ba51cae3dcf8d9061`
- Production status: not deployed
- Latest applied Production migration before this candidate: 450
- Candidate migration: `20260820004814_worlds_language_chatboard.sql` (migration 451)

## Outcome built

The shared VGC Worlds page now mounts one compact chatboard immediately below
the existing “pick the players and Pokémon below” guide. The room follows the
page locale, so English, Italian, Spanish, German, Japanese, and Korean each
have their own conversation. The page copy explicitly states that these are
language rooms only: every member still enters the same shared Worlds
prediction competition and leaderboards.

The member experience includes:

- a signed-out privacy gate that does not expose messages;
- the latest 30 messages in a bounded, scrollable panel;
- keyset paging for older messages and a manual refresh action;
- automatic refresh every 20 seconds without touching Supabase Realtime;
- localized composer, status, community-rule, removal, and report copy;
- plain-text messages capped at 500 characters;
- existing bounded coach-profile buttons on message authors;
- author-only soft removal; and
- one private moderation report per member and message.

No new public route was added. Existing canonicals, language alternates,
localized social metadata, sitemap entries, and `llms.txt` links stay intact.
The localized chat heading and description add truthful on-page context without
creating duplicate index targets or exposing member content to signed-out
crawlers.

## Database and security contract

Forward migration `20260820004814_worlds_language_chatboard.sql` creates:

- `public.worlds_chat_messages`, partitioned logically by `event_id` and the
  bounded language code set `en`, `it`, `es`, `de`, `ja`, `ko`;
- `public.worlds_chat_reports`, with a unique member/message report pair;
- partial room pagination and member rate-limit indexes; and
- four `SECURITY DEFINER` functions with empty fixed search paths and explicit
  `auth.uid()` checks.

Both tables have RLS enabled and no browser-facing policies. Direct table and
sequence privileges are revoked from `public`, `anon`, and `authenticated`.
Only `service_role` retains direct moderation access. The browser receives
only message ID, body, timestamp, `is_mine`, bounded public profile fields, and
the current member's report flag. User IDs, email addresses, time zones,
Discord identifiers, removal actors, and report counts are not returned.

Posting is serialized with a per-member transaction advisory lock. A member
may post at most five messages per rolling minute and 100 per rolling day.
Authors can soft-remove only their own visible messages. Members cannot report
their own messages, and duplicate reports collapse at the database constraint.

The initial release intentionally uses polling instead of adding objects to the
locked-down Realtime schema or changing the Realtime publication. This keeps
the first release small and reversible while leaving room for a reviewed
Broadcast implementation later if traffic justifies it.

## Files changed

- `src/components/WorldsChatBoard.jsx`
- `src/components/WorldsPickSixteen.jsx`
- `src/lib/worldsChatI18n.js`
- `src/app/globals.css`
- `supabase/migrations/20260820004814_worlds_language_chatboard.sql`
- `supabase/tests/451-worlds-language-chatboard-preview-regression.sql`
- `test/worlds-language-chatboard.test.js`
- `package.json`
- `docs/CURRENT-STATUS.md`
- this handoff

## Validation completed

- Focused chatboard tests: 3/3 passed.
- Complete Worlds suite: 72/72 passed.
- Production dependency audit: no known vulnerabilities.
- Complete `npm run test:all`: passed, including migration-history, security,
  SEO, tournament, and release-integration gates.
- National Dex paging: all 1,027 rows passed.
- `git diff --check`: passed.
- Configured Next.js production build: passed across all 335 generated pages.
- The inherited dynamic-font status-400 warning appeared once and remained
  nonfatal; every page generated and optimization completed.
- Signed-out local browser review passed at desktop width and 390 x 844.
- The chat appears below the start guide, remains compact, and has no horizontal
  overflow at the phone breakpoint.
- The Japanese localized room rendered its translated same-competition copy.
- Browser console error count during the localized check: zero.
- Vercel Preview is Ready. Hosted signed-out English and Korean room checks
  rendered the localized chat and privacy gate with zero browser errors.

The Supabase CLI was pinned to current version `2.115.0` to create the forward
migration. Local migration-list execution could not connect because Docker is
not installed in this environment. Supabase then ignored the automatic pull-
request Preview because the connected project reported that its concurrent
Preview-branch limit had been reached. The current branch inventory exposed by
Supabase contains only `main`, so no stale development branch was deleted or
reset automatically. A manual isolated branch is available at the quoted
Supabase cost of $0.01344 per hour, but none was created without explicit cost
confirmation. The database fixture has therefore not yet executed against
Postgres and must run on an isolated Preview branch before merge.

## Required release gates

1. Run the full repository audit and application checks if they are not already
   recorded after the final diff.
2. Push the short-lived branch and open a pull request; do not push to `main`.
3. Allow Supabase Preview to apply migration 451 on an isolated branch.
4. Execute
   `supabase/tests/451-worlds-language-chatboard-preview-regression.sql` and
   confirm it rolls back cleanly.
5. Review the Preview database advisors for new error-level security or
   performance findings and verify the exact grants and RLS state.
6. Review the Vercel Preview signed out at desktop and 390 x 844. If a safe test
   account is available in Preview, verify read, post, refresh, report, and
   author removal in two different language rooms.
7. Merge only after protected checks and review pass.
8. Confirm the exact deployed commit before applying or declaring migration
   451 in Production.
9. Run the complete signed-out Production smoke sweep after deployment, then
   perform a narrowly scoped signed-in chat check without changing any real
   prediction, league, draft, roster, or tournament state.
10. Update `docs/CURRENT-STATUS.md` with the exact pull request, merge commit,
    deployed commit, applied migration, Preview regression result, and
    post-deployment evidence.

## Safety boundaries

- Nothing in this branch has changed Production data, provider settings,
  secrets, authentication settings, Worlds entries, brackets, league data, or
  tournament state.
- Do not apply the migration directly to Production merely to test it.
- Do not expose chat tables with broad RLS policies or direct authenticated
  grants; keep the RPC-only boundary.
- Do not display private report counts or reporter identities to members.
- Do not automatically hide a message based only on a report count; owner
  review remains authoritative.
- Do not use Mushroom Cup, Mushroom Hut, a real league, or a real tournament as
  a test fixture.
