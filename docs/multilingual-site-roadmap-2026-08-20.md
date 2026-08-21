# DraftCenter multilingual site roadmap

Status: the first Pokédex milestone and French Worlds expansion were released
as an owner-authorized translation beta on 2026-08-20 through pull request
#371 at exact Production commit `aa82ecc`. Protected checks, hosted Preview,
migration 454's isolated and live postflight checks, exact-commit deployment,
and the complete signed-out smoke sweep pass. Native review remains pending
post-launch; the beta release discloses that status and accepts corrections
through Support. A second application-only candidate now adds localized public
search, filters, move names, and game-specific Pokédex entries without changing
stable Pokémon identities. It is not yet deployed.

## Product direction

DraftCenter should let a visitor choose one language and keep that language as
they move between public features. The first language set matches the Worlds
prediction experience: English, Italian, Spanish, French, German, Japanese,
and Korean.

The rollout starts with the Pokédex because it is public, useful without an
account, and gives brackets and other tools one stable multilingual Pokémon
catalog. Draft-league screens come later because they contain mutations,
deadlines, commissioner controls, and more user-generated content.

## First released milestone

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
  community data, results, and detailed move research.

Pokémon identity is shared across every language. DraftCenter must not create a
separate Pokémon catalog, result pool, bracket, or user record per language.
Names of people, organizations, leagues, and other user-provided content are
never machine-translated automatically.

## Pinned catalog coverage

The localization artifact is generated from PokéAPI commit
`5064f1d72746b3a6a931616dae3fb6445c556d4f`. A 2026-08-21 first-party
source audit supplements the pinned artifact without changing stable profile
identifiers. Pull request #381 released the latest source update at exact
Production application commit `58d10e8`; current coverage is:

| Language | Species names | Mega profile names |
| --- | ---: | ---: |
| English | 1,025 / 1,025 | 97 / 97 |
| Italian | 1,025 / 1,025 | 97 / 97 |
| Spanish | 1,025 / 1,025 | 97 / 97 |
| French | 1,025 / 1,025 | 97 / 97 |
| German | 1,025 / 1,025 | 66 / 97 |
| Japanese | 1,025 / 1,025 | 97 / 97 |
| Korean | 1,025 / 1,025 | 0 / 97 |

The missing Mega profile names are a source-data limitation, not permission to
invent or machine-translate official Pokémon form names. The Mega bracket
should not be described as fully localized until DraftCenter has a reviewed,
official source for the missing form names. Temporary English fallback labels
must remain visibly identified wherever they are used.

The exact source records and unresolved profile identifiers are in the
[`2026-08-21 Mega-form source audit`](mega-form-localization-source-audit-2026-08-21.md).

## Second application candidate

The localized Pokédex indexes now have an interactive public browser while the
complete generation lists remain server-rendered and crawlable. Visitors can:

- search by a Pokémon's name in any supported language, National Pokédex
  number, or stable profile identifier;
- filter by localized type, generation, or ability and sort by number or the
  selected-language name;
- search the localized move-name list on a core Pokémon profile; and
- read up to eight localized Pokédex entries with localized game names.

The pinned resource catalog has this coverage. Missing names remain visibly
identified English fallbacks; they are never synthesized or machine
translated.

| Language | Types | Abilities | Moves | Games/versions |
| --- | ---: | ---: | ---: | ---: |
| English | 21 / 21 | 373 / 373 | 937 / 937 | 53 / 53 |
| Italian | 21 / 21 | 311 / 373 | 933 / 937 | 52 / 53 |
| Spanish | 20 / 21 | 311 / 373 | 937 / 937 | 52 / 53 |
| French | 21 / 21 | 311 / 373 | 937 / 937 | 52 / 53 |
| German | 21 / 21 | 311 / 373 | 861 / 937 | 52 / 53 |
| Japanese | 21 / 21 | 311 / 373 | 937 / 937 | 51 / 53 |
| Korean | 21 / 21 | 311 / 373 | 919 / 937 | 48 / 53 |

The type total includes special source types that are not offered as ordinary
battle-type filters. All 18 ordinary battle types have selected-language
labels in every supported language. The candidate preserves the released
first-party Mega supplement and its Italian 97/97, Spanish 97/97, French
97/97, German 66/97, Japanese 97/97, and Korean 0/97 coverage.

## Recommended expansion order

1. Release the core Pokédex as a clearly labeled translation beta after
   keyboard, screen-reader, responsive, database, and protected checks; collect
   corrections and complete fluent-speaker editorial review when practical.
2. Release the interactive Pokédex search, filters, move names, game/version
   labels, fallback disclosures, and responsive layouts after protected and
   hosted Preview review. Standalone type and ability indexes and remaining
   empty/error/loading states can follow separately.
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

- either have a fluent speaker review interface copy and Pokémon terminology,
  or obtain explicit owner acceptance for a visibly labeled beta with a public
  correction route and no claim of native-speaker approval;
- verify every localized route, language switch, canonical, `hreflang`, and
  sitemap entry;
- test long Latin-script names and Japanese/Korean layouts on desktop and
  mobile, including keyboard focus and assistive-language boundaries;
- document all English fallbacks and keep them obvious to visitors;
- keep beta and pending-review disclosures visible until the corresponding
  native-speaker review is approved;
- confirm that changing language cannot change a saved selection, bracket
  result, Pokémon identity, account, or permission; and
- run the repository's required release checks and review a preview before any
  authorized merge or deployment.

No database migration or production-data change is required for the read-only
Pokédex milestone itself. The same release candidate adds French to the existing
language-specific Worlds chat rooms, so that separate change uses forward-only
migration 454. It must pass its rollback-only isolated Preview regression before
merge; it does not create a separate event, prediction pool, or user record.
