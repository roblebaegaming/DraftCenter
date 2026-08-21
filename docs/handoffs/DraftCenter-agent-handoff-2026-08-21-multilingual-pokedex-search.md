# DraftCenter multilingual Pokédex search handoff

Date: August 21, 2026 Pacific

Status: application-only release candidate in pull request
[#377](https://github.com/roblebaegaming/DraftCenter/pull/377) on
`codex/multilingual-pokedex-search-20260821`. It is not deployed to Production
and requires no database migration or Production-data change. Protected checks
and hosted Preview review pass for application commit `5ef4383`.

## Candidate behavior

The six non-English Pokédex indexes now add an interactive public browser to
the complete server-rendered generation lists. A visitor can search by any of
the seven supported official species names, National Pokédex number, or stable
profile identifier; filter by localized type, generation, and ability; and
sort by number or the selected-language name. Result links retain the shared
stable profile slug.

Localized core profiles add a searchable move-name list and up to eight
localized Pokédex entries with localized game/version labels. Missing pinned
resource names remain visibly identified English fallbacks. Translation-beta
notices, Support correction links, document-language handling, reciprocal
language controls, canonicals, and stable Pokémon identity remain unchanged.

## Reconciliation with the released Mega catalog

The implementation was isolated from the long-running dirty checkout and
ported onto current `main`. The merged builder retains the first-party Mega
supplement released through pull request #375 while adding pinned PokéAPI type,
ability, move, version, and default-profile resource data. Mega coverage stays
Italian 93/97, Spanish 80/97, French 97/97, German 48/97, Japanese 97/97, and
Korean 0/97. No generated Mega prefix or unreviewed form name was added, and
the multilingual Mega bracket remains blocked.

## Validation

Passed on the isolated candidate tree:

- deterministic localization rebuild with matching SHA-256
  `F7950480E1E97AF782AAB73C5BEF45E1BEC505CBC5A894777A704EC1E750526C`;
- complete application suite, including migration history, security, Worlds,
  localization, SEO, Mega-bracket, and release-integration gates;
- all 1,027 National Dex rows;
- Production dependency audit at the repository high-severity gate;
- optimized Next.js build with all 344 static pages generated; and
- compiled browser interaction checks at 390-pixel phone width: English
  `Charizard` resolves to French `Dracaufeu` and Japanese `リザードン`, English
  move slug `flamethrower` resolves to Japanese `かえんほうしゃ`, eight localized
  entries render, combined filters work, beta disclosures remain visible, no
  page has horizontal overflow, and the browser console is clean.
- protected JavaScript security analysis, dependency/security checks,
  full-history secret scan, and Vercel deployment checks; and
- hosted Preview review at French desktop plus French and Japanese 390-pixel
  phone widths, including stable links, combined filters, move search, eight
  localized entries, correction links, and horizontal-overflow checks.

The build retains the documented nonfatal status-400 response while loading
the decorative dynamic font for `◉✦✓◇✎`; page generation completes.

## Release boundary

1. Pull request #377, protected checks, and hosted Preview review pass for
   application commit `5ef4383`.
2. Keep translation-beta and pending-native-review disclosures visible. Do not
   claim fluent-speaker approval that has not occurred.
3. Merge only after the release decision. Confirm the exact Production commit
   and run the complete signed-out Production smoke sweep after deployment.

No Supabase schema, RLS policy, grant, provider configuration, environment
variable, invitation, tournament, campaign, billing, or spend change belongs
to this candidate.
