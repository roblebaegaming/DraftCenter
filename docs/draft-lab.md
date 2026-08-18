# Team Lab

Team Lab is DraftCenter's public team builder and optional private preparation
workspace at `/team-lab`. The earlier `/tools/team-builder` address permanently
redirects to the canonical route so existing public links and their query
details remain valid. The product name shown in navigation, metadata,
structured data, social previews, and current documentation is **Team Lab**.

## Public builder contract

Visitors build one six-Pokémon battle team and choose from the same regulation
catalog used by hosted leagues. The selected regulation filters the Pokémon
picker. A PokéPaste can be imported by authenticated URL fetch, local `.txt`
file, or pasted Showdown text; all three fill supported set fields. The analysis
shows:

- shared defensive weaknesses, resistances, immunities, and 4x weaknesses;
- single-type targets that the roster can or cannot hit super effectively with
  one of its own types;
- base-stat averages, physical/special/mixed balance, and raw Speed tiers;
- base regulation legality, duplicate species, Restricted limits, and Mega
  limits; and
- directional prompts for balance or bulky offense, hyper offense, hazard or
  pivot offense, weather or terrain offense, Trick Room or other speed control,
  and stall or control structures.

The team summary deliberately does not assume abilities, held items, moves,
EVs, natures, boosts, field effects, or a league's commissioner overrides. STAB
coverage means only that a roster type is super effective against a single
defending type; it does not claim that the Pokémon learns a suitable move. The
archetype panel follows the same boundary.

## My Teams and league connections

A signed-in coach can load:

- an active, non-Nuzlocke private workspace from My Teams; or
- a current or historical DraftCenter league roster that belongs to the
  signed-in account.

The browser-to-browser handoff from My Teams uses temporary same-tab session
storage. After the receiving page verifies the signed-in account, its private
working address can contain only the owner-scoped My Teams workspace and open
matchup identifiers needed to resume that exact Battle Mode view after a
reload. Team names, league names, rosters, notes, opponent facts, and account
identity never enter the address. **Copy roster link** always constructs a
separate public URL containing only the base format and Pokémon names.

Opening a My Teams workspace connects Team Lab to that private row. An explicit
**Save team & notes** action updates only the account-owned My Teams copy.
Opening a hosted league roster always creates an unlinked planning copy; the
coach must explicitly save it as a new My Teams workspace. Team Lab has no
mutation path for a league, draft, pick, roster, queue, transaction, or
tournament.

My Teams exposes **Open Team Lab** from both private team cards and owned league
team cards. This is the reverse connection back into Team Lab. Nuzlocke Run
Cards keep their dedicated tracker action and are not converted into ordinary
Team Lab rosters.

## Private notes and matchup plans

Team notes are stored in the existing owner-scoped `personal_teams.notes`
field. Opponent matchup plans are stored in `team_lab_matchups`, introduced by
forward-only migration 393. Every matchup belongs to both the authenticated
account and one of that account's personal-team rows. A plan contains:

- an opponent name and optional opponent team name;
- a six-Pokémon opponent team;
- the selected base format; and
- private preparation notes.

The matchup table uses forced RLS, has no browser table grants or client
policies, and is accessible only through authenticated owner-scoped functions
for list, save, delete, export, and recovery. Cross-account reads, updates,
deletes, re-parenting, and recovery are rejected. Account deletion cascades to
the matchup rows. Private account export, My Teams JSON recovery, and the
readable My Teams workbook include the matchup section.

There is no product-count quota in this release. Migration 393 removes the old
10-external-team trigger and count checks from My Teams recovery. A future
site-wide entitlement release may give free accounts five saved items within
each bounded product and paid accounts expanded access. That future policy is
roadmap only: it must define what counts as an item, cover existing data and
grace behavior, preserve exports, and ship with separately reviewed database,
privacy, billing, and interface changes. Team Lab does not mention a quota or
paid plan today.

## Share-link and search boundary

Public share links keep the existing bounded, versioned contract:

```text
/team-lab?v=1&format=reg-mb&team=Garchomp~Rotom-Wash
```

The retired `mode=roster` parameter is accepted only for old-link compatibility
and now opens the first six valid unique names. Unknown names, duplicate names,
unsupported formats, and names beyond six fail closed or fall back to the
current Regulation M-B view.

The public share query contains only Pokémon names and the base format. It
never contains private team IDs, league IDs, team names, account identity,
notes, or opponent plans. A signed-in working address may add validated
`workspace` and `battle` identifiers solely for same-account reload recovery;
those parameters are stripped when the public link is copied and reveal no
data without the existing owner checks. SEO metadata, FAQ and application
structured data, social previews, sitemap entries, and `llms.txt` describe
only product-controlled behavior. User data never enters those surfaces.

## Shared analysis layer

`src/lib/teamAnalysis.js` remains the reusable analysis boundary. It owns the
modern 18-type chart, bounded ability modifiers used on individual Pokémon
cards, defensive and STAB summaries, base-stat summaries, format checks,
archetype signals, and the versioned share-link parser.

The public page consumes `src/data/draft-lab-catalog.json` through the shared
`src/platform/pokemonCatalog.js` boundary. It is a generated, client-sized
snapshot of the hosted-league catalog, regulation data, and reviewed base
stats. `npm run test:draft-lab` fails when the snapshot drifts from
`PokemonDraftLeague.jsx`; regenerate it intentionally with `npm run
draft-lab:build-catalog`.

## Validation

Run the focused checks with:

```powershell
npm run test:draft-lab
npm run test:regulations
npm run test:seo
npm run test:release-integration
```

Migrations 393 and 424 require isolated two-account Preview matrices proving
the owner allow cases, the new six-Pokémon save boundary, every cross-account denial, direct-table denial, complete
export and recovery, removal of the old count trigger, and fixture cleanup.
Before release, run the repository's complete required checks and review Team
Lab and My Teams on desktop, 390px, and 320px widths. Production smoke testing
is post-deployment evidence only.
