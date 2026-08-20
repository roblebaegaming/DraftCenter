# DraftCenter fluent-speaker localization review

Date: 2026-08-20

Status: technical and model-assisted editorial QA is complete. Native-speaker
approval is not complete. On 2026-08-20, the owner explicitly accepted that
editorial risk and authorized a clearly labeled translation-beta release of
pull request #371, with corrections collected through DraftCenter Support.

## Review scope

The first public milestone introduces Italian, Spanish, French, German,
Japanese, and Korean Pokédex interface copy. It also adds French to the existing
Worlds experience. Official Pokémon names, genera, entries, types, abilities,
and statistics come from the pinned PokéAPI localization catalog; reviewers
should focus on DraftCenter-authored interface text, tone, grammar, and fallback
disclosures rather than re-translating Pokémon names.

Technical and model-assisted review verified:

- complete interface-key coverage in all six non-English Pokédex locales;
- official localized names for all 1,025 species in every locale;
- official stat labels and Pokémon vocabulary against localized Pokémon
  Pokédex pages, including Spanish `Puntos de base` and French `Stats de base`;
- localized titles, descriptions, language markers, controls, alternative text,
  and responsive layouts on the hosted Preview;
- explicit English fallback disclosure for unreviewed form names; and
- French Worlds copy with English `team sheet` carryovers removed and literal
  owner/pool wording clarified without changing scoring or privacy semantics.

The released non-English Pokédex pages and French Worlds page must visibly say
that the translation is in beta, that native-speaker review is pending, and
link to `/support` for corrections. The beta label must not be removed until a
real native reviewer approves the corresponding language row below.

## Native-speaker sign-off matrix

Each reviewer should open the listed Preview routes, check desktop and phone
copy, and record either **approved** or **changes requested**. A model-assisted
review must not be entered as native-speaker approval.

| Language | Required routes | Technical QA | Native reviewer | Decision | Date |
| --- | --- | --- | --- | --- | --- |
| Italian | `/it/pokemon`, `/it/pokemon/charizard`, `/it/pokemon/charizard-mega-x` | Passed | Pending | Pending | — |
| Spanish | `/es/pokemon`, `/es/pokemon/charizard`, `/es/pokemon/charizard-mega-x` | Passed | Pending | Pending | — |
| French | `/fr/pokemon`, `/fr/pokemon/charizard`, `/fr/pokemon/charizard-mega-x`, `/fr/worlds/2026` | Passed | Pending | Pending | — |
| German | `/de/pokemon`, `/de/pokemon/charizard`, `/de/pokemon/charizard-mega-x` | Passed | Pending | Pending | — |
| Japanese | `/ja/pokemon`, `/ja/pokemon/charizard`, `/ja/pokemon/charizard-mega-x` | Passed | Pending | Pending | — |
| Korean | `/ko/pokemon`, `/ko/pokemon/charizard`, `/ko/pokemon/charizard-mega-x` | Passed | Pending | Pending | — |

Preview origin:
`https://draftcenter-git-codex-multilingual-pokedex-rel-034758-rob-lebae.vercel.app`

## Reviewer checklist

1. Confirm that titles, calls to action, labels, and explanatory paragraphs read
   naturally to a native speaker and use consistent formality.
2. Confirm Pokémon-specific terms such as Pokédex, type, ability/talent,
   hidden ability, base stats, height, weight, form, and National Pokédex.
3. Confirm dynamic phrases with 1, 2, 6, 10, and 1,025 items, including French
   Worlds selection and leaderboard copy.
4. Confirm that the English-profile link and temporary English form-name
   disclosure are clear rather than appearing to be accidental untranslated
   text.
5. Confirm that names of people, organizations, products, and competitions stay
   unchanged where appropriate.
6. Record every requested change verbatim with its route and surrounding label.

## Approval rule

Native-speaker approval remains required before DraftCenter describes a
language as fully reviewed. It is not a blocker for this owner-authorized beta
launch because the release visibly discloses the pending review, keeps English
fallbacks, provides a correction route, and has passed the automated, database,
security, accessibility, responsive, and Preview gates. Keep every pending row
truthful and treat corrections and eventual native review as post-launch
editorial work.
