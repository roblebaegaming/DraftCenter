# Mega-form localization source audit

Date: 2026-08-21

Status: first-party source coverage has improved substantially, but the
multilingual Mega bracket remains blocked. English fallbacks stay visible for
every unresolved form, and no missing official name was inferred,
transliterated, or machine-translated.

## Verified coverage in this change

| Language | Official Mega profile names | Change | First-party source |
| --- | ---: | ---: | --- |
| English | 97 / 97 | — | Pinned PokéAPI catalog |
| Italian | 93 / 97 | +93 | Pokémon.com Italian Pokédex and Italian Mega Evolution index |
| Spanish | 80 / 97 | +80 | Pokémon.com Spanish Pokédex and Spanish Mega Evolution index |
| French | 97 / 97 | — | Pinned PokéAPI catalog |
| German | 48 / 97 | source evidence added | German Mega Evolution index |
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
- Italian Pokédex: <https://www.pokemon.com/it/pokedex>
- Spanish Pokédex: <https://www.pokemon.com/es/pokedex>
- Japanese Pokédex: <https://zukan.pokemon.co.jp/>

## Remaining exact gaps

Italian has four unresolved profiles:

- `eelektross-mega`
- `hawlucha-mega`
- `magearna-mega`
- `magearna-original-mega`

Spanish has 17 unresolved profiles:

- `victreebel-mega`
- `dragonite-mega`
- `excadrill-mega`
- `scolipede-mega`
- `chesnaught-mega`
- `delphox-mega`
- `malamar-mega`
- `zygarde-mega`
- `raichu-mega-x`
- `raichu-mega-y`
- `staraptor-mega`
- `garchomp-mega-z`
- `darkrai-mega`
- `meowstic-male-mega`
- `meowstic-female-mega`
- `zeraora-mega`
- `baxcalibur-mega`

German is missing all 49 newer Mega profiles. Korean is missing all 97 Mega
profiles. The Korean official Pokédex is indexed publicly, but its origin
returned `410 Gone` during this audit, so search snippets were not promoted to
the product catalog.

## Release boundary

This source improvement may ship independently because unresolved forms keep
the existing explicit English-fallback disclosure. It does not authorize the
multilingual Mega bracket. That bracket remains closed until every supported
language has reviewed official display names and the bracket interface itself
passes native-language, responsive, identity-stability, and release checks.
