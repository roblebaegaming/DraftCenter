# Pokémon profile classification and canonical policy

DraftCenter uses `/pokemon` as the canonical interactive Pokédex and
`/pokemon/<resolved-pokeapi-name>` as the canonical route for an indexable
Pokémon battle profile. A URL fragment such as `/pokemon#miraidon` may restore
interactive selection without creating another server URL. The legacy
`?pokemon=` parameter is accepted for visitors and replaced in the browser,
but it is not used in internal links or as a canonical route.

## Classification boundary

| Record | DraftCenter behavior | Canonical behavior |
| --- | --- | --- |
| Ordinary species or default battle profile | One public profile | Self-canonical resolved PokéAPI Pokémon route |
| Regional, Mega, Gigantamax, or other materially distinct variety | Separate profile when PokéAPI exposes a distinct Pokémon record | Self-canonical resolved PokéAPI Pokémon route |
| Form with different typing, stats, abilities, or competitive identity | Separate profile | Self-canonical resolved PokéAPI Pokémon route |
| Cosmetic appearances attached to one Pokémon record | Grouped on the owning profile as non-link labels | Owning battle profile |
| Reader-friendly alias | Permanently redirected after successful resolution | Resolved PokéAPI Pokémon route |
| Distinct records with the same English form label | Keep separate and add a route-specific qualifier such as sex or ability | Each resolved PokéAPI Pokémon route remains self-canonical |

`is_default: false` is not enough evidence to collapse a profile. DraftCenter
must preserve a form when it has a materially distinct battle identity. A
future consolidation must compare typing, base stats, abilities, and supported
competitive identity against the species default and add representative
regression cases before changing redirects, canonicals, or sitemap inclusion.
Public metadata must also distinguish separate records when PokéAPI gives
them the same English display name. The qualifier must describe an
authoritative difference already present in the record; it must not invent a
form, rating, or competitive claim.

## Regression matrix

The SEO test suite covers an ordinary species, a regional form, a Mega form, a
materially distinct form, a mode-only duplicate candidate that intentionally
remains self-canonical under the conservative policy, a punctuation-sensitive
name, a reader-friendly alias, and fragment/legacy interactive-directory URLs.
