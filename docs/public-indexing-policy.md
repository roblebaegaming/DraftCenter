# DraftCenter public indexing policy

This policy separates publicly usable product surfaces from pages that are
eligible for search indexing. A public share link does not automatically make
its destination stable, editorial, or appropriate for search discovery.

## Indexable product landings

The public `/tournaments` landing page is indexable. It may describe the
supported standalone brackets, Draft Tournaments, and connected championships
using product-controlled copy and structured data. It must not publish private
event names, registration codes, entrant details, rosters, or commissioner
controls in metadata, structured data, or server-readable discovery copy.

The public `/resources/daily-games`, `/nuzlocke`, Nuzlocke guide, Pokémon,
format, guide, league-directory, and other routes already listed in
`src/app/sitemap.js` remain eligible under their existing route policies.
Private saved Nuzlocke Run Cards are account data even though the Nuzlocke
generator itself is public.

The public `/pokedex-tracker` landing is indexable as product documentation.
Its server-rendered copy, metadata, structured data, and social preview may
describe supported catalogs and checklist behavior, but must never contain a
tracker identifier, title, caught entry, shiny entry, account identity, or
other member-specific state. Signed-in tracker data remains private RPC-loaded
account data even though the product landing is in the sitemap.

The public `/team-lab` landing is indexable as product documentation and as a
bounded public roster-analysis tool. Public share queries may contain only the
selected format, roster mode, and Pokémon names. `/team-lab/teams` and all
account-owned notes, sets, matchup plans, and Battle Room reports remain
private and non-indexed. The legacy `/tools/team-builder` address redirects to
the canonical public landing without becoming a second sitemap entry.

The public league directory must server-render the same public league-card
RPC used by its interactive filters and expose a direct crawlable link to
every returned league. This does not broaden visibility: the public RPC and
the existing public-league route remain the authority for eligibility.

## Intentionally non-indexed workspaces

The following surfaces remain `noindex` and excluded from the sitemap:

- `/tournaments/[slug]`, including public standalone brackets, connected
  championships, and Draft Tournaments;
- `/organizations` and `/organizations/[slug]`;
- `/team-lab/teams`, its legacy `/my-teams` address, saved Nuzlocke Run Cards,
  and other personal team workspaces;
- individual Pokédex Tracker collections, entries, names, and progress;
- `/trainer-dex`, Operations, support, and authenticated league or account
  state that does not have a separate approved public route.

Tournament and organization detail routes remain non-indexed regardless of
their application visibility until the owner approves a narrower policy and
the application has all of the following: an authoritative visibility check,
stable canonical URLs, useful server-rendered public content, safe dynamic
metadata that cannot inject user content, and sitemap queries limited to
eligible public records.

## Change gate

Any change to this policy requires focused metadata and sitemap regression
coverage. It must also verify that signed-out raw HTML, structured data, public
API responses, and sitemap output contain no private or account-specific data.
