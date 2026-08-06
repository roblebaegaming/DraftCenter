# Generation VI Nuzlocke schema investigation

Date: August 5, 2026

## Decision

Generation VI fits the existing versioned catalog schema. No database schema change is required for X, Y, Omega Ruby, or Alpha Sapphire.

The existing `method`, numeric level/chance fields, `conditions text[]`, data-driven condition groups, form label, and one-area-per-catch-location contract represent the reviewed mechanics without flattening them:

- X/Y keep flowers, rough terrain, ambushes, hordes, and Friend Safari as distinct methods. All Friend Safari types resolve to one catch location because the game records one Friend Safari met location.
- The three uncapturable X/Y roaming-bird sightings are excluded. The final Sea Spirit's Den catch is retained, marked postgame, and matched to the included Kalos starter.
- Omega Ruby/Alpha Sapphire keep ordinary grass, tall grass, DexNav-only National Pokédex species, Surf, Rock Smash, three rods, hordes, Mirage Spots, and soaring separate.
- Repeated internal ORAS map tables resolve to one game met location. A cave, route, or Mirage category therefore does not gain extra catches merely because it has several internal maps.
- Friend Safari, National Pokédex DexNav species, rotating Mirage Spots, and soaring are bounded opt-in controls. Their defaults preserve an ordinary main-story run.
- Weekday, time-of-day, and minute windows remain selectable for scheduled legendary encounters. Party and item requirements remain source conditions because they are not mutually exclusive global states.

## Source boundary

PokeAPI at `5064f1d72746b3a6a931616dae3fb6445c556d4f` is complete for X/Y and the ORAS special encounter layer, but it does not contain the ordinary ORAS route, Surf, or fishing tables. The ORAS wild layer therefore comes from the exact PKHeX Gen VI binary artifacts at `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`. The table order and slot odds are checked against pk3DS at `6daaca934ca2284a73ab743bf89c848c57cd9de1`; Veekun at `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b` remains the licensed independent comparison.

No migration in 304–311 has been applied to Preview or production. Imports remain pending-first and each verification is forward-only.
