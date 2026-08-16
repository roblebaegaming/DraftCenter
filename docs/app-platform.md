# Focused app platform

DraftCenter currently ships Pokédex Tracker and Team Lab as focused,
installable web apps from the same repository and production deployment. They
reuse the existing account, Pokémon catalog, Supabase project, privacy model,
and export formats. This foundation changes presentation and code ownership;
it does not migrate user data or introduce a new database schema.

## Product routes

| Product | Public home | Private workspace | Install scope |
| --- | --- | --- | --- |
| Pokédex Tracker | `/pokedex-tracker` | authenticated state within the home | `/pokedex-tracker/` |
| Team Lab | `/team-lab` | `/team-lab/teams` | `/team-lab/` |

Team Lab keeps permanent compatibility redirects from `/tools/team-builder`
and `/my-teams`. Next.js preserves query strings through these redirects, so a
legacy public roster-analysis URL retains its version, format, mode, and
Pokémon names. Private handoffs continue using same-tab session storage rather
than adding identifiers or notes to public URLs.

## Shared boundaries

- `src/platform/products.js` owns product names, canonical routes, focused
  navigation, and compatibility route recognition.
- `src/platform/pokemonCatalog.js` exposes the generated, drift-checked Pokémon
  and regulation snapshot used by Team Lab and other focused clients.
- `src/platform/supabase.js` exposes the existing browser client and public
  configuration. Both products continue to use the same authentication users
  and database project.
- `src/platform/usePlatformAccount.js` supplies shared signed-in, profile, owner,
  and sign-out state to product shells.
- `src/platform/useInstallableWebApp.js` owns scoped service-worker registration
  and browser installation prompts.
- `src/platform/exports.js` exposes the existing Collector and Team Lab workbook
  builders without changing file contents.
- `src/platform/pokemonUi.js` is a compatibility seam for reusable Pokémon
  presentation components that still live in the large league component. A
  later behavior-preserving extraction can move their implementation behind
  this boundary without another product-wide import rewrite.

## Deployment boundary

Separate domains or deployments are optional, not required for product
identity. If they are added later, each deployment can select its product shell
while continuing to use the same Supabase project and account IDs. Before any
new hostname goes live, deliberately add and test its exact authentication
redirect URLs, CAPTCHA hostname, analytics classification, canonical metadata,
content-security policy, and PWA scope. That provider/configuration work is a
separate production-authorized change; it is not part of this foundation.

## Packaging boundary

The installable web apps are the first distribution format. App Store or Play
Store packaging should wrap the proven responsive interfaces only after usage
and device testing justify it. Native packages must not fork collection,
account, export, Team Lab, or Battle Room behavior into a separate code path.

## Pokédex Tracker direction

Pokédex Tracker is built around the way people complete dexes in the games:
game-specific numbers, separate regional and DLC sections, fast checklists,
individual collection records, and box layouts in dex order. Its focused
navigation is **Dex, Find, Collection, Boxes, More**.

Checking a Pokémon in any game tracker also fills that species in the same
account's Pokémon HOME National Dex. The National Dex can still be checked
directly. Find shows the Pokémon's numbers across supported game dexes and, for
the open game, known encounter locations from the public game-data tables.

Raw JSON recovery is an owner-only operational tool. Regular users receive CSV
import, readable CSV and workbook downloads, and the installable app. The former
Bank Rescue dashboard, guide, navigation item, classifications, and transfer
planning columns are not part of the current product. Existing hidden database
fields are retained only for backward compatibility with saved records.

Camera-assisted box entry remains a later experiment. Any future availability,
ribbon, form, or acquisition advice must come from dated authoritative sources.
