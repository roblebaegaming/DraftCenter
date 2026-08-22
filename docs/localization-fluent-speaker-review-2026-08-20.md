# DraftCenter fluent-speaker localization review

Date: 2026-08-20

Last refreshed: 2026-08-21

Status: technical and model-assisted editorial QA is complete. Native-speaker
approval is not complete. On 2026-08-20, the owner explicitly accepted that
editorial risk and authorized a clearly labeled translation-beta release of
pull request #371, with corrections collected through DraftCenter Support. The
beta is live at exact Production application commit `aa82ecc`; every native-
speaker matrix row remains pending. The latest first-party Mega-form refresh is
live through pull request #381: Italian, Spanish, French, and Japanese have
97/97 reviewed official Mega profile names, German has 66/97, and Korean has
0/97. Those source counts do not change any native-review decision.

## Review scope

The first public milestone introduces Italian, Spanish, French, German,
Japanese, and Korean Pokédex interface copy. It also adds French to the existing
Worlds experience. Official Pokémon names, genera, entries, types, abilities,
and statistics come from the pinned PokéAPI localization catalog plus checked
first-party Pokémon form-name records; reviewers
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

Each reviewer should open the listed routes, check desktop and phone
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

Production origin: `https://www.draftcentral.gg`

When reviewing a correction pull request, use that pull request's exact hosted
Preview for the changed strings and repeat the same Production routes after an
authorized release. Do not reuse a superseded Preview URL.

## Ready-to-send reviewer packet

Assign one language per fluent reviewer and replace only the bracketed fields:

> DraftCenter has released a clearly labeled translation beta and is looking
> for a fluent **[language]** review. Please open the required routes in the
> matrix above on both a phone and a desktop. Focus on natural wording,
> Pokémon terminology, consistent formality, English-fallback explanations,
> and any clipped or confusing controls. Please do not retranslate official
> Pokémon names. Reply with either **approved** or **changes requested**, the
> date, and each requested change in the format below. The public correction
> route is <https://www.draftcentral.gg/support>.

Reviewer response template:

```text
Language:
Decision: approved | changes requested
Review date:
Routes and device sizes checked:

Changes (repeat for each item):
- Route:
- Current text:
- Requested text:
- Reason or terminology source:
```

Keep reviewer contact information outside the repository. Record only the
language, decision, date, and approved wording here unless the reviewer has
separately agreed to public attribution.

## Language-specific outreach messages

Use only the message for the reviewer's fluent language. Confirm the reviewer,
destination, and reply route before sending.

### Italian

> DraftCenter is looking for a fluent Italian review of its clearly labeled
> translation beta. Please check <https://www.draftcentral.gg/it/pokemon>,
> <https://www.draftcentral.gg/it/pokemon/charizard>, and
> <https://www.draftcentral.gg/it/pokemon/charizard-mega-x> on both a phone and
> a desktop. Focus on natural interface wording, Pokémon terminology,
> consistent formality, and clipped or confusing controls. Official Pokémon
> names are already sourced and should not be retranslated. Please reply with
> **approved** or **changes requested**, the review date, devices checked, and
> each requested replacement with its route and reason.

### Spanish

> DraftCenter is looking for a fluent Spanish review of its clearly labeled
> translation beta. Please check <https://www.draftcentral.gg/es/pokemon>,
> <https://www.draftcentral.gg/es/pokemon/charizard>, and
> <https://www.draftcentral.gg/es/pokemon/charizard-mega-x> on both a phone and
> a desktop. Focus on natural interface wording, Pokémon terminology,
> consistent formality, and clipped or confusing controls. Official Pokémon
> names are already sourced and should not be retranslated. Please reply with
> **approved** or **changes requested**, the review date, devices checked, and
> each requested replacement with its route and reason.

### French

> DraftCenter is looking for a fluent French review of its clearly labeled
> translation beta. Please check <https://www.draftcentral.gg/fr/pokemon>,
> <https://www.draftcentral.gg/fr/pokemon/charizard>,
> <https://www.draftcentral.gg/fr/pokemon/charizard-mega-x>, and
> <https://www.draftcentral.gg/fr/worlds/2026> on both a phone and a desktop.
> Focus on natural interface wording, Pokémon terminology, consistent
> formality, Worlds selection and leaderboard copy, and clipped or confusing
> controls. Official Pokémon names are already sourced and should not be
> retranslated. Please reply with **approved** or **changes requested**, the
> review date, devices checked, and each requested replacement with its route
> and reason.

### German

> DraftCenter is looking for a fluent German review of its clearly labeled
> translation beta. Please check <https://www.draftcentral.gg/de/pokemon>,
> <https://www.draftcentral.gg/de/pokemon/charizard>, and
> <https://www.draftcentral.gg/de/pokemon/charizard-mega-x> plus the unresolved
> <https://www.draftcentral.gg/de/pokemon/clefable-mega> profile on both a
> phone and a desktop. Focus on natural interface wording, Pokémon terminology,
> consistent formality, clipped controls, and whether the temporary English-
> name disclosure is clear on the unresolved profile. Please do not infer or
> translate missing official form names. Reply with **approved** or **changes
> requested**, the review date, devices checked, and each requested replacement
> with its route and reason.

### Japanese

> DraftCenter is looking for a fluent Japanese review of its clearly labeled
> translation beta. Please check <https://www.draftcentral.gg/ja/pokemon>,
> <https://www.draftcentral.gg/ja/pokemon/charizard>, and
> <https://www.draftcentral.gg/ja/pokemon/charizard-mega-x> on both a phone and
> a desktop. Focus on natural interface wording, Pokémon terminology,
> consistent formality, and clipped or confusing controls. Official Pokémon
> names are already sourced and should not be retranslated. Please reply with
> **approved** or **changes requested**, the review date, devices checked, and
> each requested replacement with its route and reason.

### Korean

> DraftCenter is looking for a fluent Korean review of its clearly labeled
> translation beta. Please check <https://www.draftcentral.gg/ko/pokemon>,
> <https://www.draftcentral.gg/ko/pokemon/charizard>, and
> <https://www.draftcentral.gg/ko/pokemon/charizard-mega-x> on both a phone and
> a desktop. Focus on natural interface wording, Pokémon terminology,
> consistent formality, clipped controls, and whether the temporary English-
> name disclosure is clear. Please do not infer or translate missing official
> Mega form names. Reply with **approved** or **changes requested**, the review
> date, devices checked, and each requested replacement with its route and
> reason.

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
