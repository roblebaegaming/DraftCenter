# DraftCenter agent handoff: final launch next steps

- Date: August 15, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Production baseline at handoff creation:
  `2c68e8bdc31140fb20813ccedbd5cb495db43dcf`
- Current Mega Bracket feature commit:
  `619b252dba7a911cc6515918a4ff839ed051c206`
- Latest Production migration: 407
- Application state: released, migrated, deployed, and smoke-tested
- External launch state: authorized but blocked on owner credential entry

## Start here

There is no application release left to build or deploy from this work. Do not
reopen, recreate, or replay pull requests 238-241 or migration 407.

Only two launch gates remain:

1. authenticate the intended DraftCenter Instagram account and publish the
   prepared Team Lab sequence, followed by the Pokédex Tracker sequence;
2. paste the hCaptcha secret directly into the retained isolated Supabase
   Preview configuration, save it, and verify Preview CAPTCHA behavior.

The owner explicitly authorized these launch actions on August 15. That
authorization does not supply a password, session, token, or hCaptcha secret.
Never ask the owner to paste a credential into chat or place one in a command,
screenshot, repository file, log, or handoff.

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

## Next step 1: publish Instagram

### Gate

An authenticated session for the intended DraftCenter Instagram account must
be visible in the controllable browser. The in-app browser and its Facebook
login path were both signed out, and no Instagram connector or connected
desktop browser was available at handoff.

If the account is not signed in, stop and ask the owner to sign in directly in
the browser. Do not request, read, store, or transmit the password. Before
publishing, confirm visibly that the selected account is the intended public
DraftCenter brand account; do not record the account identifier in repository
documentation.

### Publish Team Lab first

Use the images and captions exactly as prepared in
[`../promotion/instagram/team-lab-matchup-planner-2026-08-15/README.md`](../promotion/instagram/team-lab-matchup-planner-2026-08-15/README.md).

Use this exact profile or Story link:

https://www.draftcentral.gg/tools/team-builder?utm_source=instagram&utm_medium=social&utm_campaign=team-lab-battle-mode

Keep `team-lab-battle-mode` unchanged. Publish only the reviewed ten
1080×1080 screenshots. Do not add overlays, private notes, account identifiers,
team names, opponent names, or new claims. The product name remains **Team
Lab**; **matchup planner** and **Battle Mode** describe its features.

### Publish Pokédex Tracker second

Use the images and captions exactly as prepared in
[`../promotion/instagram/pokedex-tracker-2026-08-15/README.md`](../promotion/instagram/pokedex-tracker-2026-08-15/README.md).

Use this exact profile or Story link:

https://www.draftcentral.gg/pokedex-tracker?utm_source=instagram&utm_medium=social&utm_campaign=collector-founding-beta

Keep `collector-founding-beta` unchanged. Publish only the reviewed ten
1080×1080 screenshots. Do not add tracker names, collection details, Pokémon
choices, notes, account identifiers, or claims of Nintendo connectivity.

### Verify and record

After each sequence:

- verify that the intended images, captions, and link destination are public;
- record the public post URLs and actual Pacific publication timestamp without
  recording an account email, phone number, session detail, or credential;
- run the signed-out Production smoke sweep only if a site or tracked-link
  problem is observed; posting alone does not require another deployment;
- start the 3-, 7-, and 30-day aggregate Operations windows from that
  sequence's actual publication date.

Do not send Founding Collector invitations or direct messages as part of the
public post launch. The exact tester audience and destination remain a separate
owner decision.

## Next step 2: restore Preview hCaptcha

This is for the retained isolated Supabase Preview project only. Do not change
Production authentication settings.

1. Open **Authentication → Attack Protection** in the retained Preview.
2. Enable CAPTCHA protection and select **hCaptcha**.
3. Have the owner paste the secret directly into the masked **Captcha secret**
   field. The agent must not read or copy the secret.
4. Save changes.
5. Reopen the page and verify read-only that CAPTCHA is enabled and hCaptcha is
   selected. Do not reveal the secret.
6. Open the signed-out Preview signup flow and confirm the CAPTCHA widget
   loads. Submit a signup only with an owner-controlled disposable Preview
   email; if submitted, delete that exact disposable account and verify no
   Team Lab, Collector, or Mega Bracket fixtures remain.

Stop if the secret is unavailable. Do not retrieve it from a password store,
browser storage, Production provider configuration, logs, commands, or the
repository.

## Measurement after publication

At 3, 7, and 30 days after each actual Instagram launch, review only the
aggregate owner Operations report:

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
