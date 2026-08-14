# DraftCenter Mega Bracket Top 64 experience handoff

- Date: August 14, 2026
- Branch: `codex/mega-bracket-top64-experience-2026-08-14`
- Base: `06d9fa42b720ad524aab8179fc1df6bb0d16934d`
- Status: implemented and validated locally; not merged or deployed
- Database: no change; production migration 389 remains the Mega Bracket data contract

## Product result

The Full Dex Mega Bracket keeps its frozen 1,162-entry catalogue, 1,161-choice
path, private account saving, local recovery, undo behavior, and completed
history. The release changes the experience after choice 1,098:

- The Top 64 is now a four-region visual bracket instead of four name lists.
  Each region preserves completed matchups and shows the Top 64, Top 32, Sweet
  16, and Elite Eight path. The active matchup is selected directly inside the
  bracket.
- A dedicated illustrated Final Four board appears once all four regional
  winners are known, followed by the championship and champion.
- Dismissible round celebrations appear at the Top 1,024, 512, 256, 128, 64,
  32, Sweet 16, Elite Eight, Final Four, championship match, and champion.
  The Top 64 celebration opens the bracket directly. The dialog supports
  keyboard focus, Escape, a focus trap, and backdrop dismissal.
- Completed attempts show a private recap: most-picked winning type, leading
  Top 64 generation, lowest-BST Top 64 qualifier, the champion's six-match
  closing path, and an illustrated Final Four. Copying the short result remains
  an explicit user action.
- The 3,200 by 2,050 Top 64 export includes Final Four and champion artwork when
  those results exist. The 1,080 by 1,350 champion card includes the champion
  and all four regional winners.

No attempt, winner history, recap, or artwork result became public. Recap data
is derived in the browser from the existing private attempt and frozen public
catalogue. Operations still receives only the deployed aggregate completion
totals described by migration 390.

## Artwork repair

Pokemon artwork resolution moved from `LeagueHub.jsx` to the shared
`src/lib/pokemonArtwork.js` helper so Mega Bracket, hub features, and other
existing consumers use one reviewed path. It adds Unicode-safe slugs, cached
resolution, exact aliases for the seven known failures, and official
default-variety or base-species fallbacks.

The repaired exact names are Calyrex-Ice Rider, Calyrex-Shadow Rider, Flabebe,
Paldean Tauros (Fire), Paldean Tauros (Water), Primal Groudon, and Primal
Kyogre. A live end-to-end check resolved artwork for all 1,162 frozen catalogue
entries. Thirty-four generic or not-yet-published form names used an intentional
PokeAPI default-variety or base-species fallback; zero entries remained blank.

## Mobile and visual verification

The signed-out release build and an isolated, subsequently removed Top 64
fixture were reviewed at desktop, 390px, and 320px widths in the in-app browser.

- The real page had no horizontal overflow and no browser warnings or errors.
- At 320px the document width was 305px within a 320px viewport.
- The bracket scrolls horizontally inside its own panel; a swipe moved it from
  the Top 64 columns to the Sweet 16 and Elite Eight without moving the page.
- The active illustrated matchup measured about 102px inside a 108px grid cell,
  so its artwork and choices did not overlap neighboring matches.
- The smallest button target measured 44px.
- The 320px milestone dialog fit completely inside a 700px-tall viewport, put
  focus on its action, and retained a 46px action target.
- The narrow-phone recap stat grid was reduced to one column so long generation
  and Pokemon names do not wrap awkwardly.

The temporary visual fixture was deleted before the final build and is not part
of the release.

## SEO and documentation

The canonical route remains `/tools/mega-bracket`. Its description, Open Graph
copy, Twitter copy, and `WebApplication.featureList` now describe the visual
Top 64, round celebrations, illustrated downloads, and recap. Sitemap placement
and indexability are unchanged. `docs/mega-bracket.md` records the stable UI,
artwork, privacy, export, and validation contracts.

## Validation evidence

- `npm run test:mega-bracket`: 11 passed
- Full `npm run test:all`: passed
- `npm run test:national-dex`: 1,027 rows verified
- `pnpm audit --prod --audit-level high`: no known vulnerabilities
- Full artwork audit: 1,162 checked, zero missing
- `npm run build`: 255 pages generated
- `git diff --check`: passed
- Local desktop, 390px, and 320px browser review: passed

The production smoke sweep was not run because this branch is not deployed.

## Release continuation

1. Push the branch and open a protected pull request.
2. Require repository checks and review the exact hosted Preview, including a
   signed-in disposable or owner-approved existing completed bracket. Do not
   create or alter a production attempt just for testing.
3. Merge only after approval and confirm the exact `main` commit reaches Ready
   in Production.
4. Run the signed-out production smoke sweep and a read-only signed-in Mega
   Bracket review. Do not claim production success from local or Preview
   evidence.

No migration, production database row, real account attempt, provider setting,
environment variable, or secret was changed by this implementation.
