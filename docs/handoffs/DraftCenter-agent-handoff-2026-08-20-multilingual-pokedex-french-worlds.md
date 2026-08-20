# DraftCenter multilingual Pokédex and French Worlds release candidate

Date: 2026-08-20

Status: prepared on an isolated short-lived branch. Nothing in this handoff is
deployed or enabled in Production, and no Production database, data, provider
setting, environment variable, league, prediction, or account was changed.

## Release scope

The first public multilingual Pokédex milestone supports English, Italian,
Spanish, French, German, Japanese, and Korean. It includes:

- official localized names for all 1,025 Pokémon species;
- localized Pokédex entries, genera, types, abilities, statistics, and
  measurements where the reviewed pinned source provides them;
- reciprocal language controls on both the English and localized indexes and
  profiles;
- stable English/PokéAPI profile slugs so language changes cannot change a
  Pokémon identity, selection, or result;
- reciprocal canonicals and `hreflang` alternatives, sitemap coverage,
  structured-data language markers, response language headers, and runtime
  document-language markers; and
- explicit links back to the complete English profile for untranslated move,
  competitive, community, and draft analysis.

The same candidate completes the existing Worlds language set with French copy,
metadata, social images, navigation, odds, profile labels, chat labels, and a
French VGC prediction route. It does not split the shared Worlds event, player
pool, prediction scoring, or leaderboard.

## Pinned Pokémon localization source

The committed catalog is generated from exact PokéAPI commit
`5064f1d72746b3a6a931616dae3fb6445c556d4f`. All seven languages cover 1,025 of
1,025 species names. Mega-form profile names remain incomplete in Italian,
Spanish, German, Japanese, and Korean. The release does not invent those names;
unreviewed forms keep an explicit English fallback. The multilingual Mega
bracket remains blocked until its missing official form names are reviewed.

## Forward database migration

Migration 454 is
`supabase/migrations/20260820180704_add_french_worlds_chat_room.sql`. It only
adds `fr` to the existing Worlds chat-room validation and the two bounded chat
RPC allowlists. It preserves account-only tables, row-level security,
`SECURITY DEFINER` functions with an empty search path, bounded paging and rate
limits, and explicit execute grants for authenticated and service roles only.

The rollback-only isolated regression is
`supabase/tests/454-french-worlds-chat-room-preview-regression.sql`. It proves
French round-tripping, English/French room isolation, rejection of unsupported
rooms, direct-table denial, RLS, function settings, and grants. It must run only
after migration 454 on an isolated Supabase Preview branch.

## Local validation

Passed on the isolated release tree:

- dependency audit at the repository's high-severity gate;
- the complete repository test suite;
- National Dex paging verification;
- migration-history validation through pending migration 454;
- 73 Worlds checks;
- 21 SEO checks;
- 7 multilingual Pokédex checks; and
- a successful optimized Next.js build with 344 static pages generated.

Browser review passed at desktop and 390-pixel phone widths for all seven
Pokédex indexes and representative Charizard profiles. French Worlds also
passed desktop and phone review. The review verified localized titles and
headings, all seven language choices, active-language semantics, runtime
document language, artwork alternatives, core statistic output, visible wrapped
phone controls, and no page-level horizontal overflow.

The build reports a nonfatal 400 response while attempting to download the
existing decorative dynamic font for `◉✦✓◇✎`; Next.js still completes the build.
No localized layout showed a visible missing-font failure during browser review.

## Remaining release gates

- A fluent speaker must approve interface copy and Pokémon terminology for each
  released non-English language. Automated and visual review cannot replace
  this editorial gate.
- The protected pull request, Vercel Preview, and repository checks must pass.
- Migration 454 and its rollback-only regression must pass on an isolated
  Supabase Preview branch.
- Merge, Production migration, deployment, and signed-out Production smoke
  validation require a separate authorized release step after those gates.

The original dirty checkout was not edited, cleaned, reset, or used for a
commit. The release candidate lives in
`codex/multilingual-pokedex-release-20260820`.
