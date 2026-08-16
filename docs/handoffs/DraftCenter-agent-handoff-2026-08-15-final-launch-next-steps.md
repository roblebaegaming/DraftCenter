# DraftCenter agent handoff: final launch completion and next steps

- Date: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Production baseline at handoff creation:
  `2c68e8bdc31140fb20813ccedbd5cb495db43dcf`
- Current Mega Bracket feature commit:
  `619b252dba7a911cc6515918a4ff839ed051c206`
- Latest Production migration: 407
- Application state: released, migrated, deployed, and smoke-tested
- External launch state: completed and verified

## Start here

There is no application, database, provider, or deployment work left from this
launch. Do not reopen, recreate, or replay pull requests 238-243 or migration
407.

The intended public brand account published Team Lab first and Pokédex Tracker
second. The retained isolated Supabase Preview now uses the Cloudflare Turnstile
provider the application actually implements, and the signed-out Preview widget
was verified without submitting credentials or creating an account.

The remaining work is measurement and product judgment: review aggregate
attribution at 3, 7, and 30 days, identify Founding Collector tester candidates,
decide the exact audience before sending invitations, and evaluate the ordered
product candidates only after feedback. The Collector profile-link title is
corrected to **Pokédex Tracker**, and its first position, destination, and
campaign parameters were publicly verified.

## What is already complete

- Pull request [#239](https://github.com/roblebaegaming/DraftCenter/pull/239)
  deployed the ten-image Team Lab/Battle Mode Instagram set at Production
  commit `3e0ee1016faebcbf6647c68c487bd92ab55d88c3`.
- Pull request [#238](https://github.com/roblebaegaming/DraftCenter/pull/238)
  deployed the ten-image Pokédex Tracker set at Production commit
  `e1a4c7630140cdf0e450c7b9bc6962561e9b3f1f`.
- Pull request [#241](https://github.com/roblebaegaming/DraftCenter/pull/241)
  and migration 407 released Mega Brackets by Full Dex, type, generation, or
  Mega Evolution; full field or randomized Quick 64; and favorite or worst
  voting.
- Migration 407 passed the retained Preview regression and Production
  postflight. It preserved all 22 existing private attempts, retained RLS and
  direct browser-read denial, and installed the intended owner-scoped RPC.
- Pull request [#240](https://github.com/roblebaegaming/DraftCenter/pull/240)
  deployed the consolidated release record.
- Protected checks passed. The final signed-out Production smoke sweep passed
  all 20 checks. The live Mega Bracket route and social image return 200, and a
  non-mutating Water-type, Quick 64, worst-pick setup review passed.

## Instagram launch evidence

The intended public brand account was visibly authenticated before publishing.
Team Lab was published first, followed by Pokédex Tracker. All 20 reviewed
1080×1080 images used the exact prepared captions. Each caption was verified on
its public post after sharing. AI labeling and Facebook cross-posting remained
off, and no location or collaborator was added.

The Team Lab campaign link remained available with the unchanged
`team-lab-battle-mode` value. Its sequence began at **03:14:06 Pacific on
August 16, 2026**:

1. https://www.instagram.com/draftcenter.gg/p/DcGOS7sm2VA/ — 03:14:06
2. https://www.instagram.com/draftcenter.gg/p/DcGSS_6m65C/ — 03:49:04
3. https://www.instagram.com/draftcenter.gg/p/DcGSd07G6Ev/ — 03:50:37
4. https://www.instagram.com/draftcenter.gg/p/DcGShkYm12P/ — 03:51:08
5. https://www.instagram.com/draftcenter.gg/p/DcGSlnlmxcv/ — 03:51:39
6. https://www.instagram.com/draftcenter.gg/p/DcGSpYPGzNq/ — 03:52:11
7. https://www.instagram.com/draftcenter.gg/p/DcGStOCmzGb/ — 03:52:42
8. https://www.instagram.com/draftcenter.gg/p/DcGSw9AG2ad/ — 03:53:13
9. https://www.instagram.com/draftcenter.gg/p/DcGS00am0od/ — 03:53:44
10. https://www.instagram.com/draftcenter.gg/p/DcGS4IEG7rv/ — 03:54:13

Before the Collector sequence, its tracked link was moved to the first profile-
link position with the unchanged `collector-founding-beta` value. Its sequence
began at **04:03:58 Pacific on August 16, 2026**:

1. https://www.instagram.com/draftcenter.gg/p/DcGUARim14l/ — 04:03:58
2. https://www.instagram.com/draftcenter.gg/p/DcGULNqG6I7/ — 04:05:28
3. https://www.instagram.com/draftcenter.gg/p/DcGUNVOGy4t/ — 04:05:45
4. https://www.instagram.com/draftcenter.gg/p/DcGUQOjm_TP/ — 04:06:09
5. https://www.instagram.com/draftcenter.gg/p/DcGUSsLm5V8/ — 04:06:29
6. https://www.instagram.com/draftcenter.gg/p/DcGUVg7m1sL/ — 04:06:52
7. https://www.instagram.com/draftcenter.gg/p/DcGUXkFGysp/ — 04:07:09
8. https://www.instagram.com/draftcenter.gg/p/DcGUafpG58M/ — 04:07:33
9. https://www.instagram.com/draftcenter.gg/p/DcGUc1VG-O3/ — 04:07:52
10. https://www.instagram.com/draftcenter.gg/p/DcGUfl9m_JE/ — 04:08:15

The Collector profile-link title was corrected to **Pokédex Tracker** after
publication. The public profile was then verified with that exact title, first
position, destination, and campaign parameters intact.

No Founding Collector tester candidates have been identified. No invitations,
direct messages, account credentials, or private audience identifiers were
sent or recorded.

## Preview Turnstile evidence

The original handoff incorrectly named hCaptcha. DraftCenter uses **Cloudflare
Turnstile**. Only the retained isolated Supabase Preview was changed:

1. the existing Production hostname remained on the current Turnstile widget;
2. the retained hosted Preview hostname was added;
3. the owner entered the secret directly into Supabase Preview without placing
   it in chat, commands, logs, screenshots, or repository files;
4. after reload, Supabase showed CAPTCHA enabled, Turnstile selected, the
   secret masked, and no unsaved changes;
5. signed-out Preview sign-in and signup both rendered a successful Turnstile
   widget without submitting credentials or creating an account.

Production authentication settings, application environment variables, and
provider secrets were not changed.

## Measurement after publication

One aggregate-only follow-up is scheduled in this task at **09:00 Pacific** on
each milestone date for both campaigns:

- August 19, 2026: 3-day review;
- August 23, 2026: 7-day review;
- September 15, 2026: 30-day review.

At each run, review only the aggregate owner Operations report and report the
`team-lab-battle-mode` and `collector-founding-beta` campaigns separately:

1. attributed confirmed account creations;
2. signup starts;
3. Team Lab or Collector feature journeys.

Keep the existing coarse campaign dimensions. Do not add usernames, emails,
account IDs, raw paths, tracker names, team names, Pokémon choices, notes, IP
addresses, or full referrers to analytics.

After the first feedback and measurement read, evaluate these candidates in
order rather than starting them automatically:

1. a privacy-safe Collector progress card;
2. reusable or rematch Team Lab opponent plans;
3. Collector goals and milestones;
4. a compact owner-entered post-battle review.

Mega Bracket variety is complete. Collect replay and feedback evidence before
adding another scope, objective, or bracket size.

## Boundaries for the next agent

- Start from fresh `origin/main`; preserve the original dirty workspace.
- Use a protected pull request for any new repository change.
- Never replay or rewrite migrations 389 or 401-407.
- Do not mutate a real league, draft, pick, roster, queue, matchup, tracker,
  battle report, or Mega Bracket attempt to test monitoring.
- Do not modify Mushroom Cup or resume, restart, archive, or delete the paused
  historical Mushroom Hut drafts.
- Continue unrelated Worlds, SEO, tournament, and Operations monitoring from
  [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md); none of it blocks this launch.

For deeper release evidence, use the preceding
[`DraftCenter-agent-handoff-2026-08-15-promotion-and-signup-attribution.md`](DraftCenter-agent-handoff-2026-08-15-promotion-and-signup-attribution.md),
the stable [`../mega-bracket.md`](../mega-bracket.md),
[`../team-lab.md`](../team-lab.md), and
[`../pokedex-trackers.md`](../pokedex-trackers.md) contracts, and permanent
[`../../AGENTS.md`](../../AGENTS.md) policy.
