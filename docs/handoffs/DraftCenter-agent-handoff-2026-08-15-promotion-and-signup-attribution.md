# DraftCenter agent handoff: promotion and signup attribution

- Date: August 15, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Current Production documentation commit: `cd861f85a5b2f6bde367418b85b0891e90669365`
- Verified signup-attribution feature commit: `0d4ce5c9fe2f70b8c9d2dd784d9f142c1500c305`
- Latest Production migration: 406
- Handoff pull request: pending
- Application release state: migrated, merged, deployed, documented, and smoke-tested
- Promotion state: two screenshot PRs open and intentionally unmerged

## Current outcome

Privacy-safe signup attribution is live. DraftCenter remembers only coarse,
allowlisted feature and campaign dimensions before signup, then reports
aggregate signup starts and confirmed account creations in owner Operations.
The last signed-in owner verification on August 15 showed the authoritative
account totals, one post-release signup start, zero attributed account
creations before the first post-release completion, current empty source and
journey lists, and no analytics-outage warning. No email, account ID, username,
IP address, Pokémon choice, note, raw path, full referrer URL, or browsing
history enters the report.

The feature implementation is exact Production commit `0d4ce5c9`. The later
documentation-only verification commit `cd861f8` is the current Production
deployment on `www.draftcentral.gg`. Protected checks, the full repository
suite, dependency audit, 1,027-row National Dex verification, 258-page build,
exact deployment confirmation, responsive hosted review, and all 20 signed-out
production smoke checks passed for the completed release chain.

## Instagram screenshot pull requests

Two independent promotion-only pull requests are open. Do not merge them as a
single runtime release; each can be reviewed and merged on its own.

### Pokédex Tracker

- Pull request: [#238](https://github.com/roblebaegaming/DraftCenter/pull/238)
- Head: `272b9daa40bea0cd4baede0ce67a7b4a29c57b5e`
- Branch: `codex/instagram-pokedex-tracker-screenshots-2026-08-15`
- Assets:
  `docs/promotion/instagram/pokedex-tracker-2026-08-15/`
- Campaign:
  `collector-founding-beta`
- Instagram link:
  https://www.draftcentral.gg/pokedex-tracker?utm_source=instagram&utm_medium=social&utm_campaign=collector-founding-beta

The PR contains ten 1080×1080 JPEGs and a per-image caption guide. Every image
is a direct Production-site screenshot crop with no AI artwork, invented UI,
text overlay, account identifier, or private collection detail. Capture stayed
read-only: only tabs, search, filters, and read-only views were used.

### Team Lab matchup planner and Battle Mode

- Pull request: [#239](https://github.com/roblebaegaming/DraftCenter/pull/239)
- Head: `c9c496c210e75d9a2bad2daf6d00f85e402c116f`
- Branch: `codex/instagram-team-lab-screenshots-2026-08-15`
- Assets:
  `docs/promotion/instagram/team-lab-matchup-planner-2026-08-15/`
- Campaign:
  `team-lab-battle-mode`
- Instagram link:
  https://www.draftcentral.gg/tools/team-builder?utm_source=instagram&utm_medium=social&utm_campaign=team-lab-battle-mode

The PR contains ten 1080×1080 JPEGs and a per-image caption guide. Images 1-6
are read-only Production captures using a public share-link roster. Images 7-10
are direct hosted released-site QA captures with fictional matchup data. No AI
artwork, text overlay, real opponent note, account identifier, or private
league data appears. The published product name remains **Team Lab**; use
**matchup planner** and **Battle Mode** in promotion rather than renaming the
product to Match Lab.

## Screenshot verification

- Ten JPEGs exist in each PR; all 20 are exactly 1080×1080.
- Both staged diff checks passed.
- Both contact-sheet reviews passed for composition, legibility, and absence of
  account identifiers.
- Production data remained read-only. No tracker catch, detail, individual,
  location, team, set, matchup, battle report, league, provider setting,
  environment variable, or secret changed.
- The PRs contain documentation and promotion assets only. They do not alter
  application behavior, migrations, or production configuration.

## Recommended publishing order

1. Review and merge PR #239, then launch the Team Lab/Battle Mode sequence.
2. Review and merge PR #238, then launch the Founding Collector sequence.
3. Use the exact Instagram campaign link from each manifest in the profile or
   Story link sticker; captions should say “link in bio” rather than include an
   unclickable URL.
4. Keep one stable campaign name for the entire sequence. Do not add usernames,
   emails, team names, tracker names, Pokémon choices, or notes to campaign
   parameters.
5. Review aggregate Operations results after 3, 7, and 30 days. Prioritize
   attributed account creations, then signup starts and feature journeys.

Publishing to Instagram remains an owner action. No post, message, beta
invitation, or external audience contact was sent during this work.

## Remaining owner action

The retained isolated Supabase Preview still needs its hCaptcha secret pasted
into the visible Preview configuration field. The secret must never be put in
chat, a command, a screenshot, a repository file, or a handoff. This is the
only known provider-secret step left from the Team Lab release work.

The Founding Collector tester workflow still requires the owner to approve the
exact audience and destination before any invitation is sent. Keep real names,
handles, emails, collection contents, and response transcripts out of the
repository.

## Evidence-led product follow-up

Do not expand Team Lab or Collector automation before the first promotion and
feedback read. The highest-value candidates to evaluate next are:

1. a privacy-safe shareable Collector progress card that never includes notes,
   locations, specimens, account identity, or unpublished tracker names;
2. explicit Collector goals and milestone reminders without implying Nintendo
   connectivity or an automated transfer;
3. reusable or clonable Team Lab opponent plans for rematches and recurring
   opponents, with owner-scoped data and a new forward-only migration if the
   stored contract changes;
4. a compact post-battle review that turns the existing timeline, game plans,
   and structured state into coach-entered lessons without automated claims;
5. aggregate-only funnel comparison between Team Lab and Collector after the
   3-, 7-, and 30-day measurement windows.

Every database change must use a new forward-only migration, focused
two-account regression, and RLS/grant verification. Never rewrite or replay
migrations 401-406.

## Preserved boundaries

- The original dirty DraftCenter workspace remains untouched.
- The screenshot branches were created from fresh `origin/main` at `cd861f8`.
- Main remains protected; no direct push or protection bypass occurred.
- Private Team Lab fields and Collector details must not enter public links,
  metadata, Operations analytics, logs, or promotion assets.
- Historical Operations events remain history. Verify timestamps and current
  authoritative state before declaring a recurring incident.
- Do not modify Mushroom Cup or resume, restart, archive, or delete the paused
  historical Mushroom Hut drafts without direct commissioner authorization.

Use [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md) for the canonical deployed
status, [`../pokedex-trackers.md`](../pokedex-trackers.md) for the Collector
contract, [`../team-lab.md`](../team-lab.md) for the Team Lab contract, and
[`../../AGENTS.md`](../../AGENTS.md) for permanent repository policy.

