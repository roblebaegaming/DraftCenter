# 2026 Pokémon GO and UNITE prediction readiness

## Status

Pokémon GO and Pokémon UNITE have deployed, fail-closed source-audit routes at
`/worlds/2026/go` and `/worlds/2026/unite`. They shipped through pull request
[#128](https://github.com/roblebaegaming/DraftCenter/pull/128) and production
application commit `e5dca23b9da09d3a557e485443e7dc5a207b4e20`.

The routes intentionally contain no competitor or team names, prediction
controls, saved entries, database events, or enabled results polling. The 2026
Worlds competitor page still says registration is invitation-only and that
competitor information is coming soon. A qualification award is not treated as
proof of final registration or attendance.

Release validation passed the complete application suite, the 37-test focused
Worlds suite, the 1,027-row National Dex check, the production dependency audit,
an optimized 236-page build, the protected checks, and refreshed Vercel Preview
and Production builds. Signed-out review at 1280px and 390px found no horizontal
overflow, browser errors, or warnings. The post-deployment production smoke
sweep passed all 19 public and protected routes. These source-audit pages did
not create GO or UNITE database events or enable any provider integration.

## Shared source-registry boundary

The reviewable registries are:

- `src/data/worlds-2026-go-sources.json`
- `src/data/worlds-2026-unite-sources.json`

`src/lib/worldsSourceRegistry.js` validates them during the application build
and focused tests. It fails when:

- GO changes away from individual entries or UNITE changes away from teams;
- either event is marked roster-ready or open before a reviewed roster exists;
- an unreviewed competitor/team array is inserted;
- a source is not HTTPS or is outside the reviewed official Pokémon hosts;
- the published qualification counts no longer add up; or
- results automation is represented as configured.

This validator is a source-audit safeguard, not proof that an external page has
not changed. The Championship Series qualification page is a rolling season
page. Preserve and review the exact 2026 source snapshot before publishing a
roster migration, especially after the site rolls forward to 2027 information.

## Pokémon GO contract

GO uses individual Trainers. The reviewed 2026 qualification base contains 220
TPCi-managed Championship Point slots:

- USA & Canada: 75
- Europe: 65
- Latin America: 65
- Oceania: 10
- Middle East & South Africa: 5

That is not the complete field. The roster audit must also reconcile Regional
and Special Championship winners, International Championship Top 4 finishers,
the 2025 Worlds Top 4, and the separately managed Japan, South Korea, mainland
China, and Asia-Pacific programs. Direct invites do not pass down and every
path must be deduplicated against the CP standings.

The official GO handbook confirms Great League play, teams of up to six
Pokémon, and three selected per game. It does not provide the final registered
2026 Worlds roster, exact phase size, or pairings. The prediction product is
nevertheless set: choose 10 Trainers and name Your Champion for double
placement points. No names or entries appear until the reviewed field is ready.

GO eligibility is not an adult-only guarantee. Do not collect or infer birth
dates. Store only the published competitor identity and qualification metadata
needed for the prediction game.

## Pokémon UNITE contract

UNITE uses 5-on-5 teams. Individual players are supporting roster attribution,
not separate prediction entries.

The official 2026 circuit describes 15 qualification awards:

- Top 2 from each of the North America, Europe, and Latin America Regional
  Leagues: six teams;
- Aeos Cup champion: one team;
- Final Stretch champion: one team;
- Pokémon UNITE Asia Champions League champion: one team; and
- one Open Last Chance Qualifier winner from each of Brazil, Europe, Latin
  America – North, Latin America – South, North America, and Oceania: six teams.

The 15-award model is not a claim that 15 named teams are registered. Slot
transfers, pass-down rules, withdrawals, organization changes, and final
registration still require review. Team aliases must be explicit; never fuzzy
match an organization or player roster into a live score.

The intended product is a complete team bracket after Pokémon publishes the
Worlds groups, advancing teams, elimination pairings, and deadline. It can
reuse the privacy, complete-tree validation, match dependency, and correction
safeguards from the VGC Top Cut infrastructure, but it must not infer Worlds
seeds from Regional League standings.

## Automation plan

GO may be able to reuse the bounded last-known-good results importer if the
owner confirms an exact structured feed, permission, attribution, and a final
roster alias set. That capability is not assumed merely because PokeData or RK9
can cover other Play! Pokémon events.

UNITE needs a separate team-results adapter unless an exact permitted feed is
confirmed. Organization and roster-name changes make exact reviewed aliases a
required boundary. Both adapters must quarantine unmatched identities, retain
the last accepted snapshot on failures, label live scores provisional, and
require an owner-reviewed official source before finalization.

## Activation sequence

1. Preserve the final official roster source and record its retrieval time.
2. Reconcile GO individuals or UNITE teams and their qualification paths with
   stable slugs and reviewed aliases.
3. Preserve GO's Pick 10 and Your Champion scoring contract, and document the
   UNITE group/bracket contract from the official Worlds structure.
4. Create a new forward-only migration after 373. Do not modify migrations
   369-373.
5. Apply only to an isolated Supabase Preview and test RLS, grants, private
   pre-lock entries, invalid rosters, result corrections, scoring, and fixture
   cleanup.
6. Configure a structured result source only after permission and exact URL
   approval. Scheduling is a separate owner-authorized provider change.
7. Release through a protected pull request, review the Preview at desktop and
   mobile widths, confirm the deployed commit, and run the signed-out
   production smoke sweep after an authorized merge.

## Official references

- 2026 qualification rules: <https://championships.pokemon.com/en-us/about/>
- 2026 Pokémon UNITE Championship Series:
  <https://championships.pokemon.com/en-us/about/pokemon-unite-championship-series>
- Current Play! Pokémon documents:
  <https://play.pokemon.com/en-us/resources/documents/>
- 2026 Worlds competitor information:
  <https://worlds.pokemon.com/en-us/competitors/>
