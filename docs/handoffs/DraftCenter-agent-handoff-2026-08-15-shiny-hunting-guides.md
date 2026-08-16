# DraftCenter shiny hunting guide handoff

Date: August 15, 2026
Branch: `codex/shiny-hunting-guides-2026-08-15`
Base: `cd861f8` (`origin/main`)
Status: implemented and locally verified; not committed, pushed, deployed, or released

## Outcome

DraftCenter now has a reviewed shiny hunting library for the exact 37 games in
the verified Nuzlocke and Pokédex game catalog:

- collection: `/guides/shiny-hunting`
- game pages: `/guides/shiny-hunting/[game]`
- coverage: Red, Blue, and Yellow through Scarlet and Violet
- Generation I pages explicitly explain that those games have no native shiny
  mechanic instead of inventing a hunting method
- Pokémon Legends: Z-A is not included because it is not in the current
  verified game catalog

Each page includes the best supported method, odds with their required
conditions, setup, a repeatable hunt loop, useful locations, game-specific
targets, alternatives, warnings, primary mechanics sources, a matching
encounter-guide link, Pokémon profile links, and the private shiny Pokédex
Tracker.

## Implementation

- `src/lib/shinyHuntingGuides.js` is the shared reviewed content model.
- `src/app/guides/shiny-hunting/page.js` groups all 37 guides by generation.
- `src/app/guides/shiny-hunting/[game]/page.js` statically generates every
  game guide with Article, HowTo, and breadcrumb structured data.
- `src/components/ShinyGuideGameSelect.jsx` provides direct game switching.
- The main Guides page, Resources page, sitemap, and `llms.txt` now expose the
  collection.
- `test/shiny-hunting-guides.test.js` compares guide identity directly with
  `nuzlockeGameGuides.json`, checks canonical Pokémon target links, enforces
  content completeness, and protects important mechanics caveats.

## Mechanics review highlights

- Generation I: no native visible or tracked shiny state.
- Crystal: language-dependent Odd Egg rates and Generation II breeding.
- Emerald: predictable initial RNG and repeated-reset timing warning.
- X and Y: chain fishing, Friend Safari, and post-3DS-online limitations.
- Ultra Sun and Ultra Moon: wormhole boosts apply to eligible
  non-legendaries; reloading the same arrival does not reroll shininess.
- Let's Go: the best Catch Combo bonus applies to the next same-species spawn
  after each successful catch.
- Sword and Shield: Dynamax Adventure end-screen checks and Brilliant Aura-only
  battle-count boosts.
- Brilliant Diamond and Shining Pearl: the Shiny Charm boosts eggs, not wild
  encounters.
- Legends: Arceus: current outbreak behavior rather than the patched
  save-reload loop.
- Scarlet and Violet: 60-plus outbreak clears, Sparkling Power conditions,
  missing overworld shiny audio, and Area Zero isolation hunts.

Sources are linked on each guide and come from Bulbapedia, Serebii, and Smogon's
Let's Go in-game guide.

## Validation

Passed:

- `npm run test:shiny-guides` — 4/4
- `npm run test:seo` — 18/18
- `npm run build` — 296/296 pages generated, including all 37 shiny guides
- `git diff --check`
- rendered desktop collection review at 1280×720
- rendered Pokémon Scarlet and Pokémon Red guide review
- rendered 390×844 mobile review with no horizontal overflow
- game selector navigation from Scarlet to Red

The build used only the existing local `NEXT_PUBLIC_SUPABASE_URL` and
publishable browser key. No secret value was printed or copied into the
worktree.

Not run because this is not a release:

- `pnpm audit --prod --audit-level high`
- `npm run test:all`
- `npm run test:national-dex`
- `npm run smoke:production`

The production smoke test must remain post-deployment evidence and should not
be used to validate this undeployed branch.

## Release boundary

No production data, Supabase schema, provider setting, environment variable,
league, roster, draft, tracker, or user record was changed. Follow the normal
protected-`main` pull request, preview review, merge, deployed-commit
verification, and signed-out production smoke workflow before calling this
released.
