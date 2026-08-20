# DraftCenter multilingual site roadmap

Status: the first Pokédex milestone and French Worlds expansion are prepared as
a protected release candidate on 2026-08-20. They are not enabled in
Production. Pull request #371, its protected executable checks, and hosted
Vercel Preview review pass. Migration 454 passed its rollback-only isolated
Preview regression, and the paid disposable branch was deleted immediately
afterward. Fluent-speaker approval remains the release gate.

## Product direction

DraftCenter should let a visitor choose one language and keep that language as
they move between public features. The first language set matches the Worlds
prediction experience: English, Italian, Spanish, French, German, Japanese,
and Korean.

The rollout starts with the Pokédex because it is public, useful without an
account, and gives brackets and other tools one stable multilingual Pokémon
catalog. Draft-league screens come later because they contain mutations,
deadlines, commissioner controls, and more user-generated content.

## First release candidate

The release candidate has localized Pokédex indexes and core Pokémon profiles at
`/{language}/pokemon` and `/{language}/pokemon/{profile}` for the six
non-English languages. This milestone includes:

- official localized names for all 1,025 species;
- localized Pokédex genera and entries where the pinned source provides them;
- localized type, ability, stat, measurement, and page-interface labels;
- one shared language switcher and language registry;
- reciprocal language alternatives, canonical URLs, sitemap entries, and
  structured-data language markers;
- stable English/PokéAPI identifiers in URLs and saved bracket data, with only
  the visible labels translated; and
- an explicit link to the existing English profile for draft analysis,
  community data, results, and move details that are not localized yet.

Pokémon identity is shared across every language. DraftCenter must not create a
separate Pokémon catalog, result pool, bracket, or user record per language.
Names of people, organizations, leagues, and other user-provided content are
never machine-translated automatically.

## Pinned catalog coverage

The localization artifact is generated from PokéAPI commit
`5064f1d72746b3a6a931616dae3fb6445c556d4f`. The current audit is:

| Language | Species names | Mega profile names |
| --- | ---: | ---: |
| English | 1,025 / 1,025 | 97 / 97 |
| Italian | 1,025 / 1,025 | 0 / 97 |
| Spanish | 1,025 / 1,025 | 0 / 97 |
| French | 1,025 / 1,025 | 97 / 97 |
| German | 1,025 / 1,025 | 48 / 97 |
| Japanese | 1,025 / 1,025 | 0 / 97 |
| Korean | 1,025 / 1,025 | 0 / 97 |

The missing Mega profile names are a source-data limitation, not permission to
invent or machine-translate official Pokémon form names. The Mega bracket
should not be described as fully localized until DraftCenter has a reviewed,
official source for the missing form names. Temporary English fallback labels
must remain visibly identified wherever they are used.

## Recommended expansion order

1. Complete the core Pokédex milestone with fluent-speaker editorial review,
   keyboard and screen-reader checks, and responsive testing in every language.
2. Localize the interactive Pokédex directory, filters, type and ability
   indexes, move names, game/version labels, and empty/error/loading states.
3. Add a reviewed official Mega-form name source, then localize the Mega
   bracket interface while keeping Pokémon IDs and bracket outcomes shared.
4. Localize general public navigation and high-value public pages such as
   resources, daily games, tournaments, and public profiles.
5. Add a persistent language preference and a clear fallback policy for pages
   or fields that have not been translated.
6. Treat draft-league localization as a separate later program, starting with
   read-only discovery before translating draft mutations, clocks,
   commissioner controls, notifications, or transactional messages.

## Release gates

Before any localized site expansion is proposed for release:

- have a fluent speaker review interface copy and Pokémon terminology for each
  language being released;
- verify every localized route, language switch, canonical, `hreflang`, and
  sitemap entry;
- test long Latin-script names and Japanese/Korean layouts on desktop and
  mobile, including keyboard focus and assistive-language boundaries;
- document all English fallbacks and keep them obvious to visitors;
- confirm that changing language cannot change a saved selection, bracket
  result, Pokémon identity, account, or permission; and
- run the repository's required release checks and review a preview before any
  authorized merge or deployment.

No database migration or production-data change is required for the read-only
Pokédex milestone itself. The same release candidate adds French to the existing
language-specific Worlds chat rooms, so that separate change uses forward-only
migration 454. It must pass its rollback-only isolated Preview regression before
merge; it does not create a separate event, prediction pool, or user record.
