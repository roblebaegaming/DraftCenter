# Draft Lab

Draft Lab is DraftCenter's public, read-only team builder and type-coverage
workspace at `/tools/team-builder`. The initial implementation is on
`codex/draft-lab-foundation-2026-08-13`; this document does not claim that the
route is deployed.

## Initial contract

Visitors can build either a six-PokÃ©mon battle team or a 24-PokÃ©mon draft
roster and choose from the same regulation catalog used by hosted leagues. The
analysis shows:

- shared defensive weaknesses, resistances, immunities, and 4x weaknesses;
- single-type targets that the roster can or cannot hit super effectively with
  one of its own types;
- base-stat averages, physical/special/mixed balance, and raw Speed tiers; and
- base regulation legality, duplicate species, Restricted limits, and Mega
  limits.

The team summary deliberately does not assume abilities, held items, moves,
EVs, natures, boosts, field effects, or a league's commissioner overrides. STAB
coverage means only that a roster type is super effective against a single
defending type; it does not claim that the PokÃ©mon learns a suitable move.

## Shared analysis layer

`src/lib/teamAnalysis.js` is the reusable product boundary. It owns the modern
18-type chart, the bounded ability modifiers used on individual PokÃ©mon cards,
team defensive and STAB summaries, base-stat summaries, format checks, and the
versioned share-link parser. The existing hosted-league and My Teams defensive
views consume this same layer instead of keeping a second type chart in the
large league component.

Share links use a bounded, versioned query contract:

```text
/tools/team-builder?v=1&format=reg-mb&team=Garchomp~Rotom-Wash
```

`mode=roster` opts into the 24-member view. Unknown names, duplicate names,
unsupported formats, and names beyond the mode limit fail closed or fall back
to the current Regulation M-B view. Query state is public by design and must
never include team notes, private league identifiers, user details, or hidden
draft information.

## Persistence and production boundaries

The foundation performs no Supabase reads or writes and cannot change a league,
draft, roster, queue, tournament, or My Teams record. **Open My Teams** is a
normal navigation link, not an implied save. A future save action must require
an authenticated user, an explicit confirmation, the existing personal-team
ownership boundary, and focused RLS/grant tests.

A future queue import must remain a separate, explicit manager action. It must
refresh the authoritative league and draft state first and must never replay a
timed-out draft mutation.

## Next implementation increments

1. Add an explicit authenticated **Save to My Teams** conversion that preserves
   the source share URL and never edits an existing team silently.
2. Add sufficiently sampled DraftCenter and reviewed competitive overlays with
   the format, period, source, and sample size beside every observation.
3. Add an explicit private draft-queue import after the authoritative league
   and regulation are refreshed.
4. Add a branded image export generated from the same analysis result.
5. Reuse the catalog, legality, comparison, and share-state contracts for the
   planned PokÃ©mon comparison and tier-list tools.

Do not begin a damage calculator by treating this type engine as a complete
battle engine. Damage requires a separately reviewed contract for moves,
abilities, items, stats, field state, generation mechanics, and regulation
updates.

## Validation

Run the focused foundation checks with:

```powershell
npm run test:draft-lab
npm run test:regulations
npm run test:seo
npm run test:release-integration
```

Before proposing a release, also run the repository's complete required checks
and review the page on desktop and approximately 390px mobile. The production
smoke sweep is post-deployment evidence only.
