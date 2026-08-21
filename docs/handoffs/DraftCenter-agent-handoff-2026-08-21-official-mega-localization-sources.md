# DraftCenter official Mega localization sources handoff

Date: 2026-08-21 Pacific

## Production outcome

Pull request [#381](https://github.com/roblebaegaming/DraftCenter/pull/381)
released the latest source refresh at exact Production application commit
`58d10e85809c679f8cc09e042f4005a81cb780e3`, building on the original #375
supplement.

The localized Pokémon catalog now supplements the pinned PokéAPI base with
checked first-party Pokémon form-name records. Stable profile identifiers,
URLs, saved selections, and bracket identity did not change. Coverage is:

| Language | Official Mega names |
| --- | ---: |
| English | 97 / 97 |
| Italian | 97 / 97 |
| Spanish | 97 / 97 |
| French | 97 / 97 |
| German | 66 / 97 |
| Japanese | 97 / 97 |
| Korean | 0 / 97 |

Every unresolved form keeps the visible English-fallback notice. No missing
name was inferred, transliterated, or machine-generated, so the multilingual
Mega bracket remains blocked. Italian and Spanish are complete; the exact
German and Korean boundaries and all primary sources are in
the [`Mega-form source audit`](../mega-form-localization-source-audit-2026-08-21.md).

## Verification

- `pnpm audit --prod --audit-level high` passed with no known vulnerabilities.
- The official-source builder produced SHA-256
  `0D408273199FE9EA34E8C43CDA8788D911E204EECFE86E1C113CD85CCE6E1A56`
  on consecutive runs and re-fetched both official German Legends pages,
  failing closed if a checked display name disappears.
- `npm run test:all` passed.
- `npm run test:national-dex` verified all 1,027 rows.
- `npm run build` generated all 344 pages. The inherited nonfatal dynamic-
  symbol font status-400 warning remained; the build exited successfully.
- All protected checks passed, including CodeQL, the dependency/security job,
  and the full-history secret scan.
- Hosted Preview checks covered `MegaEelektross`,
  `MegaMagearna Colore Antico`, `Mega-Victreebel`,
  `Mega-Magearna Color Vetusto`, `Mega-Dragoran`, and `Mega-Espinodon`, with
  no horizontal overflow or console finding. The available browser was
  1265 px wide and could not emulate 390 px, so this refresh makes no new
  phone-width visual claim; responsive components did not change.
- Vercel reported the exact merge commit Ready in Production.
- Production deployed the exact merge commit and the complete 22-check
  signed-out smoke sweep exited successfully.

This release added no database migration, Production-data write, RLS or grant
change, provider setting, secret, environment variable, invitation,
tournament, campaign, billing, or spend change. Migration 454 remains the
latest applied Production migration.

## Remaining work and exact gates

1. Native-speaker review remains pending for Italian, Spanish, French, German,
   Japanese, and Korean. The ready-to-send packet and truthful matrix are in
   [`localization-fluent-speaker-review-2026-08-20.md`](../localization-fluent-speaker-review-2026-08-20.md).
2. The Mega bracket still needs 31 German and 97 Korean official profile names
   plus localized-interface and native-review gates.
3. Four-pod invitations require outside commissioner approval and the staged
   controlled-account sequence. No broader invitation was sent.
4. AdSense pull request #374 is validated and fail-closed but remains a
   separate owner decision. Production verification settings, site review,
   consent, ads, billing, and spend are not authorized by this work.
5. Worlds feed permission, exact provider terms/configuration, a reviewed
   Preview import, and the official Top Cut field remain external live-window
   gates. Polling stays disabled and Top Cut stays waiting.
6. A new private Tournament Operator rehearsal and any campaign publication,
   billing, or spend still require exact owner authorization.

The consolidated decision points are in the
[`2026-08-21 owner action queue`](../owner-action-queue-2026-08-21.md).
PokeEarth, Mushroom Cup, and the intentionally paused Mushroom Hut drafts were
not changed.
