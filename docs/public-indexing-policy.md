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

## Intentionally non-indexed workspaces

The following surfaces remain `noindex` and excluded from the sitemap:

- `/tournaments/[slug]`, including public standalone brackets, connected
  championships, and Draft Tournaments;
- `/organizations` and `/organizations/[slug]`;
- `/my-teams`, saved Nuzlocke Run Cards, and other personal team workspaces;
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
