# DraftCenter agent handoff: promotion and signup attribution

- Date: August 15, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Current Production feature commit: `619b252dba7a911cc6515918a4ff839ed051c206`
- Verified signup-attribution feature commit: `0d4ce5c9fe2f70b8c9d2dd784d9f142c1500c305`
- Team Lab promotion commit: `3e0ee1016faebcbf6647c68c487bd92ab55d88c3`
- Pokédex Tracker promotion commit: `e1a4c7630140cdf0e450c7b9bc6962561e9b3f1f`
- Latest Production migration: 407
- Handoff pull request: [#240](https://github.com/roblebaegaming/DraftCenter/pull/240)
- Application release state: migrated, merged, deployed, documented, and smoke-tested
- Promotion state: both screenshot PRs merged and deployed; Instagram publishing
  is waiting for an authenticated owner session

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

The release follow-through is also complete. Pull request
[#239](https://github.com/roblebaegaming/DraftCenter/pull/239) merged first for
Team Lab/Battle Mode promotion, followed by pull request
[#238](https://github.com/roblebaegaming/DraftCenter/pull/238) for the Pokédex
Tracker. Vercel attached successful Production deployments to exact commits
`3e0ee10` and `e1a4c76`; the 20-check signed-out Production smoke sweep passed
after each merge.

Pull request [#241](https://github.com/roblebaegaming/DraftCenter/pull/241)
then shipped replayable Mega Brackets by Full Dex, type, generation, or Mega
Evolution, with full-field or randomized Quick 64 pacing and favorite or worst
voting. Migration 407 passed the retained Preview replayability/privacy
regression before Production. Production preflight found 22 private attempts
(17 active and five completed), RLS enabled, and browser table reads denied.
The forward-only migration preserved all 22 attempts with their original Full
Dex/favorite behavior, installed the five new fields and new owner-scoped RPC,
removed the obsolete RPC signature, and retained browser table denial.
Vercel reports exact `main` commit `619b252` deployed successfully. All 20
signed-out Production checks, the live Mega Bracket route, its social image,
and a non-mutating Water-type/Quick 64/worst-mode setup review passed.

The signup-attribution implementation is exact Production commit `0d4ce5c9`.
The later documentation-only verification commit `cd861f8` was deployed and
verified before the promotion and Mega Bracket follow-through above. Protected
checks, the full repository suite, dependency audit, 1,027-row National Dex
verification, 258-page build, exact deployment confirmation, responsive hosted
review, and all 20 signed-out Production smoke checks passed for that release
chain.

## Deployed Instagram screenshot sets

The two independent promotion-only pull requests are merged. They contain only
documentation and promotion assets and did not alter application behavior.

### Pokédex Tracker

- Pull request: [#238](https://github.com/roblebaegaming/DraftCenter/pull/238)
- Production commit: `e1a4c7630140cdf0e450c7b9bc6962561e9b3f1f`
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
- Production commit: `3e0ee1016faebcbf6647c68c487bd92ab55d88c3`
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

## Publishing package and current gate

1. PR #239 is merged; launch the Team Lab/Battle Mode sequence first.
2. PR #238 is merged; launch the Founding Collector sequence second.
3. Use the exact Instagram campaign link from each guide in the profile or
   Story link sticker; captions should say “link in bio” rather than include an
   unclickable URL.
4. Keep one stable campaign name for the entire sequence. Do not add usernames,
   emails, team names, tracker names, Pokémon choices, or notes to campaign
   parameters.
5. Review aggregate Operations results after 3, 7, and 30 days. Prioritize
   attributed account creations, then signup starts and feature journeys.

The available browser reached Instagram's login screen but had no authenticated
owner session, and no Instagram connector or alternate signed-in browser was
available. No password was requested or handled. No post, message, beta
invitation, or external audience contact was sent. After the owner signs in
directly, publish Team Lab first and Pokédex Tracker second using the exact
guides above; start the 3-, 7-, and 30-day Operations windows from each actual
publication date.

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
migrations 401-407.

## Preserved boundaries

- The original dirty DraftCenter workspace remains untouched.
- The screenshot branches were rebased onto current `main` before their
  protected merges.
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
