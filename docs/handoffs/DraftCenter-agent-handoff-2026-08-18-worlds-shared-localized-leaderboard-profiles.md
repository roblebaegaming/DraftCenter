# DraftCenter handoff: shared localized Worlds leaderboard profiles

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Pull request: [#337](https://github.com/roblebaegaming/DraftCenter/pull/337)
- Production application commit: `f8035640ef0a5c1c5ad4c9887b5031cc530a4431`
- Production migration: 441 (`20260819025045_worlds_shared_competition_profiles.sql`)

## Released outcome

English at `/worlds/2026/vgc`, Italian at `/it/worlds/2026`, and Spanish at
`/es/worlds/2026` explicitly select the same VGC configuration and database
event, `2026-vgc-masters`. Localization changes only presentation; entries,
scores, standings, odds, results, and privacy thresholds are shared.

Leaderboard coach names are buttons. Selecting one opens a localized modal
with the coach's public display name and username, profile photo, first six
favorite Pokémon, and every earned badge. The modal is bounded to the viewport,
scrolls internally for long profiles, closes through its labeled control,
backdrop, or Escape key, and leaves the expandable picks row collapsed. The
same reusable component still supports the existing authenticated full coach
profile elsewhere in DraftCenter.

## Privacy and database boundary

Migration 441 replaces only `public.get_worlds_pick_hub(text)`. The function
retains the existing final-result tiebreakers, top-100 standings cap, current
user entry, and pre-lock selection privacy. Each standing adds one `profile`
object with exactly these public fields:

- `username`
- `display_name`
- `avatar_url`
- `favorite_pokemon`, sliced to six
- earned `badges`, where tier is greater than zero

It does not return a profile/account ID, email address, timezone, Discord
identifier, or another user's pre-lock picks. The function is stable,
security-definer, schema-qualified under a fixed empty search path, and grants
execute only to `anon`, `authenticated`, and `service_role`. RLS remains enabled
on entries, profiles, and badge progress. The broader
`get_public_coach_profile` RPC remains authenticated-only and was not widened.

The public security-definer access is intentional because the Worlds
leaderboard was already publicly readable. Supabase advisors report only the
corresponding anonymous and authenticated execution warnings for this function,
with no error-level finding and no migration-specific performance finding.

## Validation evidence

- Focused Worlds tests: 68 of 68 passed.
- Complete application suite: passed.
- National Dex paging: all 1,027 rows passed.
- Production dependency audit: no known vulnerabilities.
- Production build: all 319 generated pages passed.
- Git diff and migration-history checks: passed.
- Protected pull-request security tests, full-history secret scan, CodeQL, and
  Vercel Preview build: passed.
- The automatic Supabase pull-request Preview was canceled because the
  unrelated persistent branch already occupies the one-concurrent-Preview
  integration limit. No provider setting or unrelated branch was changed.

The owner-approved disposable Supabase Preview replayed the migration chain,
applied 441, and passed a rollback-only anonymous regression covering exact
grants, RLS, no anonymous underlying-table policy, one six-Pokémon profile, one
earned badge, forbidden-key absence, and private pre-lock picks. The exact
disposable branch was deleted and confirmed absent immediately afterward, so
its hourly charge stopped.

Production applied canonical version `20260819025045` exactly once. Read-only
postflight covered all 19 current VGC entries and confirmed the event ID,
five-field profile shape, six-favorite cap, grants, RLS, fixed search path, and
anonymous pre-lock lineup privacy. Vercel reported exact merge commit
`f803564` Ready, and the complete 22-check signed-out Production smoke sweep
passed.

Live browser verification found 19 clickable profiles on both the English and
Italian routes. Opening a profile did not expand its picks row. Current public
data included profiles with six favorites and 13 earned badges; three profiles
needed and used internal modal scrolling. The Italian route declared `it`,
used its Italian heading, and localized favorite, badge, and close labels.

## Continuation boundary

This request is complete. Future profile fields require a separate privacy
review and forward-only migration. Do not expose IDs, contact fields, private
settings, or pre-lock selections merely to enrich the modal. Preserve the
shared event ID across every localized route.

The original dirty checkout was preserved and must not be pushed wholesale.
The unrelated persistent Supabase Preview branch was not modified.
