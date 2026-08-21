# Mega-form localization source audit

Date: 2026-08-21

Status: first-party source coverage has improved substantially, but the
multilingual Mega bracket remains blocked. English fallbacks stay visible for
every unresolved form, and no missing official name was inferred,
transliterated, or machine-translated.

## Verified Production coverage

| Language | Official Mega profile names | Change | First-party source |
| --- | ---: | ---: | --- |
| English | 97 / 97 | — | Pinned PokéAPI catalog |
| Italian | 97 / 97 | +4 | Pokémon.com Italian Pokédex and Italian Mega Evolution index |
| Spanish | 97 / 97 | +17 | Pokémon.com Spanish Pokédex and Spanish Mega Evolution index |
| French | 97 / 97 | — | Pinned PokéAPI catalog |
| German | 66 / 97 | +18 | German Mega Evolution index and official Legends: Z-A pages |
| Japanese | 97 / 97 | +97 | Official Japanese Pokémon Pokédex |
| Korean | 0 / 97 | — | No reproducible complete first-party source available from this environment |

The checked source snapshot retains the exact visible name, locale, profile,
source identifier, and source record. The generator verifies the expected
counts and refuses unknown profiles, duplicate locale records, unsupported
languages, or a source snapshot tied to another pinned PokéAPI profile commit.

Primary sources:

- Italian Mega Evolution index: <https://mega.pokemon.com/it-it/>
- Spanish Mega Evolution index: <https://mega.pokemon.com/es-es/>
- German Mega Evolution index: <https://mega.pokemon.com/de-de/>
- German Legends: Z-A Pokémon: <https://legends.pokemon.com/de-de/story-world/pokemon>
- German Legends: Z-A Mega-Dimension: <https://legends.pokemon.com/de-de/dlc>
- Italian Pokédex: <https://www.pokemon.com/it/pokedex>
- Spanish Pokédex: <https://www.pokemon.com/es/pokedex>
- Japanese Pokédex: <https://zukan.pokemon.co.jp/>

## Remaining exact gaps

Italian and Spanish have no remaining official-name gaps.

German has 31 unresolved profiles:

- `clefable-mega`
- `starmie-mega`
- `skarmory-mega`
- `froslass-mega`
- `excadrill-mega`
- `scolipede-mega`
- `scrafty-mega`
- `chandelure-mega`
- `pyroar-mega`
- `floette-mega`
- `barbaracle-mega`
- `dragalge-mega`
- `zygarde-mega`
- `drampa-mega`
- `falinks-mega`
- `absol-mega-z`
- `staraptor-mega`
- `heatran-mega`
- `darkrai-mega`
- `golurk-mega`
- `meowstic-male-mega`
- `meowstic-female-mega`
- `crabominable-mega`
- `golisopod-mega`
- `magearna-mega`
- `magearna-original-mega`
- `scovillain-mega`
- `glimmora-mega`
- `tatsugiri-curly-mega`
- `tatsugiri-droopy-mega`
- `tatsugiri-stretchy-mega`

Korean is missing all 97 Mega profiles. The official Korean Pokédex is
indexed publicly and exposes exact form pages, but its origin returned
`410 Gone` to the reproducible builder during this audit. Search snippets were
therefore not promoted to the product catalog.

## Release boundary

Pull request [#381](https://github.com/roblebaegaming/DraftCenter/pull/381)
released this source refresh at exact Production application commit
`58d10e85809c679f8cc09e042f4005a81cb780e3`, building on the original #375
supplement. Unresolved German and Korean forms keep the existing explicit
English-fallback disclosure. This release does not authorize the multilingual
Mega bracket. That bracket remains closed until every supported language has
reviewed official display names and the bracket interface itself passes
native-language, responsive, identity-stability, and release checks.
