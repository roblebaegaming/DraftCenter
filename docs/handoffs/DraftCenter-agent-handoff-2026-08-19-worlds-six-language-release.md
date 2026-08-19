# DraftCenter handoff: six-language Worlds predictions

- Date: August 19, 2026 Pacific
- Production: https://www.draftcentral.gg
- Pull request: [#350](https://github.com/roblebaegaming/DraftCenter/pull/350)
- Production application commit: `fd5a2e48a1d45507608af8839d05657ada9472cb`
- Database migration: none; Production remains on migration 443

## Released outcome

The 2026 VGC Worlds prediction experience is live in six languages:

| Language | Production route |
| --- | --- |
| English | `/worlds/2026/vgc` |
| Italian | `/it/worlds/2026` |
| Spanish | `/es/worlds/2026` |
| German | `/de/worlds/2026` |
| Japanese | `/ja/worlds/2026` |
| Korean | `/ko/worlds/2026` |

All six pages render `WorldsPickSixteen` with `discipline="vgc"`, the same
reviewed `worlds-2026-vgc-masters.json` source, and the existing VGC event
configuration whose Pick 10 event ID is `2026-vgc-masters`. Language changes
presentation only. Pick 10 entries, Meta entries, privacy windows, scoring,
odds, results, standings, and leaderboards remain shared; a visitor cannot
enter a different competition by changing languages.

The VGC page now has an always-visible selector for English, Italian, Spanish,
German, Japanese, and Korean. On the English route, a supported non-English
browser preference can offer the matching localized page without automatically
redirecting. Dismissal is local to the browser.

The hero now says that visitors can pick 10 real VGC players and rank six
Pokémon for the World Champion's team. A second orientation card immediately
below it repeats that these are separate competitions with separate
leaderboards and links directly to `#qualified-players` and `#meta-picks`.
This resolves the long-page ambiguity where the Pokémon area could appear
before visitors noticed the player list lower down.

The global quick bar keeps **Worlds Predictions** as a highlighted yellow
button. At phone width it spans the complete first row instead of competing
for one narrow navigation cell. Existing tools remain on the row below.

German, Japanese, and Korean also include localized event, roster, scoring,
leaderboard, Meta, sharing, odds, discipline-navigation, coach-profile, error,
region, qualification-path, metadata, social-image, sitemap, and `llms.txt`
infrastructure. Every localized page publishes the complete six-route
`hreflang` set and points back to the English source work in structured data.

## Safety and privacy boundary

This was an application-only release. It did not add or run a database
migration and did not change Production data, prediction entries, rosters,
results, RLS policies, grants, provider settings, environment variables, or
secrets. The Supabase pull-request Preview check correctly skipped.

The existing profile/privacy contract from migration 441 remains unchanged:
localized leaderboard profiles expose only their previously approved bounded
public fields, and other users' selections remain private until the existing
lock boundary.

## Validation evidence

- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: all 1,027 rows passed.
- `npm run test:worlds`: 69 of 69 passed.
- `npm run test:seo`: 21 of 21 passed.
- `npm run build`: passed and emitted 335 routes, including all six localized
  pages and the German, Japanese, and Korean Open Graph and Twitter images.
- Pull request security tests, dependency audit, full-history secret scan,
  JavaScript security analysis, CodeQL, and Vercel Preview: passed.
- The hosted Preview returned 200 for all six localized routes.
- Desktop visual review confirmed readable first-screen player-and-Pokémon
  copy, all six language controls, and correctly rendered Japanese text.
- A 390×844 review confirmed the language control is horizontally reachable,
  the opening clarification remains readable, and the Worlds button spans the
  mobile quick bar at 347 of 390 CSS pixels. No browser console errors appeared.
- Vercel reported exact merge commit `fd5a2e48` successfully deployed.
- The complete signed-out Production smoke sweep passed: 17 public routes
  returned 200 and all five protected endpoints returned 401.
- Direct post-deployment checks returned 200 and matched localized release
  copy on English, Italian, Spanish, German, Japanese, and Korean.

## Continuation boundary

The requested infrastructure and deployment are complete. Preserve the shared
VGC event configuration when adding or editing languages. A new language needs
one route, a complete copy object, the language registry entry, localized
metadata/social image, sitemap and discovery entries, and the existing shared
competition regression coverage; it does not need a new competition or
database migration.

The German, Japanese, and Korean text is an initial product translation. A
native-language editorial review is recommended before paid promotion or
formal partnership use, but it is not a release blocker for the current fan
competition.

The original dirty checkout was preserved and was not pushed wholesale. No
unrelated league, draft, provider, or Production database state was modified.
