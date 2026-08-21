# DraftCenter official Mega localization sources handoff

Date: 2026-08-21 Pacific

## Production outcome

Pull request [#375](https://github.com/roblebaegaming/DraftCenter/pull/375)
released at exact Production application commit
`a37d59cdc2e8acdc1d534433a35aa863f7a3789d`.

The localized Pokémon catalog now supplements the pinned PokéAPI base with
checked first-party Pokémon form-name records. Stable profile identifiers,
URLs, saved selections, and bracket identity did not change. Coverage is:

| Language | Official Mega names |
| --- | ---: |
| English | 97 / 97 |
| Italian | 93 / 97 |
| Spanish | 80 / 97 |
| French | 97 / 97 |
| German | 48 / 97 |
| Japanese | 97 / 97 |
| Korean | 0 / 97 |

Every unresolved form keeps the visible English-fallback notice. No missing
name was inferred, transliterated, or machine-generated, so the multilingual
Mega bracket remains blocked. The exact unresolved Italian and Spanish profile
identifiers, the German and Korean boundaries, and all primary sources are in
the [`Mega-form source audit`](../mega-form-localization-source-audit-2026-08-21.md).

## Verification

- `pnpm audit --prod --audit-level high` passed with no known vulnerabilities.
- The official-source builder produced the same SHA-256 on consecutive runs.
- `npm run test:all` passed after the final interface/source wording change.
- `npm run test:national-dex` verified all 1,027 rows.
- `npm run build` generated all 344 pages. The inherited nonfatal dynamic-
  symbol font status-400 warning remained; the build exited successfully.
- All protected checks passed, including CodeQL, the dependency/security job,
  and the full-history secret scan.
- Hosted Preview checks at 390 x 844 covered localized Italian, Spanish, and
  Japanese newer forms plus intentional Italian and Spanish fallbacks, with no
  horizontal overflow or console finding.
- Vercel reported the exact merge commit Ready in Production.
- The complete 22-check signed-out Production smoke sweep passed.
- Live 390 px checks confirmed `MegaTatsugiri Forma Arcuata`,
  `Mega-Magearna Color Vetusto`, and `メガシャリタツ（そったすがた）`, while
  unresolved Italian Mega Eelektross retained its fallback notice. There was
  no horizontal overflow or console finding.

This release added no database migration, Production-data write, RLS or grant
change, provider setting, secret, environment variable, invitation,
tournament, campaign, billing, or spend change. Migration 454 remains the
latest applied Production migration.

## Remaining work and exact gates

1. Pull request [#373](https://github.com/roblebaegaming/DraftCenter/pull/373)
   remains open, mergeable, and green. It still needs one signed-in 390 x 844
   hosted Preview check with both matchup rosters: select six on both sides,
   open Battle Mode, confirm both teams transfer, refresh once, and confirm the
   saved battle still has both teams. The available agent browser was signed
   out, so this private gate was not claimed as passed.
2. Native-speaker review remains pending for Italian, Spanish, French, German,
   Japanese, and Korean. The ready-to-send packet and truthful matrix are in
   [`localization-fluent-speaker-review-2026-08-20.md`](../localization-fluent-speaker-review-2026-08-20.md).
3. The Mega bracket still needs four Italian, 17 Spanish, 49 German, and 97
   Korean official profile names plus localized-interface and native-review
   gates.
4. Four-pod invitations require outside commissioner approval and the staged
   controlled-account sequence. No broader invitation was sent.
5. Worlds feed permission, exact provider terms/configuration, a reviewed
   Preview import, and the official Top Cut field remain external live-window
   gates. Polling stays disabled and Top Cut stays waiting.
6. A new private Tournament Operator rehearsal and any campaign publication,
   billing, or spend still require exact owner authorization.

The consolidated decision points are in the
[`2026-08-21 owner action queue`](../owner-action-queue-2026-08-21.md).
PokeEarth, Mushroom Cup, and the intentionally paused Mushroom Hut drafts were
not changed.
