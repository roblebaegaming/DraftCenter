# DraftCenter multilingual Pokédex and French Worlds Production release

Date: 2026-08-20

Status: pull request [#371](https://github.com/roblebaegaming/DraftCenter/pull/371)
is released at exact Production application commit
`aa82ecc12d0eadd3dd75b34c9e8c95ce17d2fb50`. Forward migration 454 is applied
as canonical ledger version `20260820180704`. The exact Vercel deployment,
post-merge security checks, live localized-page review, and complete 22-check
signed-out Production smoke sweep pass.

The owner explicitly authorized this scope for release as a translation beta
on 2026-08-20. Native-speaker review remains pending and is not represented as
complete. The non-English Pokédex pages and French Worlds page now carry a
visible beta disclosure and a link to DraftCenter Support for corrections.

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
- 10 multilingual Pokédex checks; and
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

The hosted Vercel Preview at
`https://draftcenter-git-codex-multilingual-pokedex-rel-034758-rob-lebae.vercel.app`
also passed phone review for the French Pokédex, Japanese Charizard profile,
and French Worlds, plus desktop review for Japanese Charizard and French
Worlds. The hosted pages had no page-level horizontal overflow and produced no
browser console warnings or errors during the final pass.

## Pull request and Preview evidence

Pull request #371 was mergeable and squash-merged after CodeQL, JavaScript
security analysis, the full-history secret scan, security tests and dependency
audit, Vercel, and Vercel Preview Comments all passed on exact release head
`9a61b0a`. The refreshed hosted Preview showed the beta disclosure and Support
link on the French Pokédex, Japanese Charizard profile, and French Worlds with
the intended page copy, no horizontal overflow, and no console findings.

The automatic Supabase Preview check was skipped because the configured single
concurrent Preview slot was already occupied. This was an infrastructure-capacity
skip, not a migration failure. The owner then approved one temporary paid,
data-less Preview branch. Its authoritative ledger matched Production through
migration 453 before migration 454's exact SQL was applied.

The first rollback-only regression run exposed a test-only catalog assertion:
PostgreSQL stores an empty function search path as `search_path=""`, while the
fixture expected `search_path=`. Direct inspection confirmed that RLS, grants,
anonymous denial, authenticated RPC execution, security-definer settings, and
the empty search paths were all correct. The fixture was corrected and rerun.
It passed French message round-tripping, English/French isolation, unsupported
language rejection, direct-table denial, RLS, grants, function settings, and
rollback cleanup. The temporary event, profile, user, and message counts were
all zero afterward.

Advisor comparison found no new security notice and no warning- or error-level
performance delta. The empty Preview produced only expected informational
unused-index notices. The exact temporary branch was deleted after validation;
the final branch inventory contains only `main`, so its hourly charge stopped.

## Editorial review evidence

Technical and model-assisted editorial QA now covers all six non-English
Pokédex locales and French Worlds. Spanish and French Pokédex terminology was
aligned with the official localized Pokémon vocabulary, and literal English or
owner/pool phrasing in the new French Worlds copy was corrected without changing
the scoring or privacy contract. The expanded focused tests pass.

The native-review matrix and exact Preview routes are recorded in
[`docs/localization-fluent-speaker-review-2026-08-20.md`](../localization-fluent-speaker-review-2026-08-20.md).
Its six native-review rows remain pending; technical or model-assisted QA is not
represented as human fluent-speaker approval.

The owner accepted the remaining editorial risk for a beta launch. This does
not convert any pending reviewer row to approved, and it does not authorize the
blocked multilingual Mega bracket. English fallbacks remain visible.

## Production verification

- Supabase's connected main flow applied exact repository migration 454. The
  authoritative ledger ends at `20260820180704_add_french_worlds_chat_room`.
- Read-only live catalog inspection confirmed the chat constraint allows only
  English, Italian, Spanish, French, German, Japanese, and Korean. RLS remains
  enabled; anonymous and authenticated direct table reads remain denied.
- Anonymous execution of both changed RPCs remains denied. Authenticated
  execution remains intentional, both functions remain security-definer with
  fixed empty search paths, and both exact allowlists include French.
- Production advisors have no error-level finding. The existing account-only
  chat RPC warnings and no-policy informational notices remain intentional and
  bounded by the verified internal account checks; there is no chat-specific
  warning-level performance finding.
- Vercel reported exact squash commit `aa82ecc` Ready in Production. Both
  post-merge security workflows passed.
- The complete signed-out Production smoke sweep passed all 17 public routes
  and five protected endpoints. Live French Pokédex, Japanese Charizard, and
  French Worlds checks showed the beta disclosure, correction link, English
  profile fallback, hydrated document language, no horizontal overflow, and no
  console warning or error.

## Remaining editorial work

- Keep all six native-speaker review rows pending until real reviewers approve
  them; do not describe the translations as fully reviewed.
- Triage correction reports through DraftCenter Support and keep the visible
  beta disclosure until the corresponding language is approved.
- Keep the multilingual Mega bracket blocked until reviewed official form-name
  coverage exists. Do not invent or machine-translate missing official names.

The original dirty checkout was not edited, cleaned, reset, or used for a
commit. Release implementation used
`codex/multilingual-pokedex-release-20260820`; this final record is published
separately through the protected documentation flow.
