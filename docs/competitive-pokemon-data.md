# Competitive Pokémon data

DraftCenter keeps external competitive observations separate from regulation
legality, commissioner prices, and first-party league statistics. A usage rate
describes one source, format, month, and rating cutoff; it is not a universal
Pokémon score.

## Initial reviewed snapshot

Migration 344 creates the private-by-default competitive catalog and a bounded
public profile function. Migration 345 imports pinned June 2026 Pokémon
Showdown ladder snapshots published by Smogon University:

- Scarlet/Violet OU at the 1825 rating cutoff;
- National Dex OU at the 1760 rating cutoff;
- Scarlet/Violet Doubles OU at the 1825 rating cutoff; and
- Pokémon Champions VGC 2026 Regulation M-B at the 1760 rating cutoff.

The four artifacts cover 2,719,877 source battles. Each artifact records its
source URL, SHA-256 digest, period, cutoff, methodology, raw uses, weighted
usage, real uses, and normalized battle-form key. DraftCenter displays those
facts and links the original source beside every observation.

These are ladder observations, including the VGC-rules ladder. They are not
official Play! Pokémon tournament results. Tournament placements, top-cut
conversion, and event win rates are never inferred from ladder usage.

## Team Lab competitive suggestions

Team Lab keeps saved, published, and already revealed facts first, then uses a
source that matches the battle type for Regulation M-B:

- **Ladder** uses the current Pokémon Champions Doubles move, item, and ability
  order from the
  [Pokémon Champions Battle Data API](https://championsbattledata.com/api_guide).
  The API permits commercial use and reasonable caching with clear attribution;
  DraftCenter returns only the bounded suggestions needed by Battle Room and
  links the provider beside them.
- **Online tournament** uses a compact anonymous derivative of the same 10
  reviewed Limitless events imported for public tournament profiles: 737
  complete open team sheets from August 1–6, 2026. It ranks up to 12 moves,
  items, and non-Mega base abilities per Pokémon. Mega Stone holders are mapped
  to their battle form, but their pre-Mega sheet ability is deliberately not
  presented as the Mega form's revealed ability.
- If a tournament Pokémon is outside that cohort, Battle Room labels the
  current Champions ranked order as a fallback. Non-Champions formats continue
  to use exact regulation move pools, exact Pokémon abilities where available,
  and the broad item catalog without claiming measured usage.

The public route exposes suggestion names and source context only. It does not
redistribute raw API responses, percentages, player identities, team records,
or a bulk competitive-data feed. Responses are cached for six hours for live
Champions data and one day for the pinned tournament derivative.

[MunchStats](https://munchstats.com/) and
[Pikalytics](https://www.pikalytics.com/) remain useful comparison interfaces.
They are not silently blended into DraftCenter's rankings: MunchStats documents
that its Champions pages cache the same Pokémon Champions Battle Data API and
its tournament pages draw from Limitless, while Pikalytics' tournament pages
also expose Limitless cohorts. DraftCenter uses the reviewed underlying sources
directly so each suggestion can retain one clear evidence type, date range,
sample, and attribution.

## Initial tournament cohort

Migration 346 adds private event, anonymous team, and team-member tables plus a
bounded Pokédex aggregate. Migration 347 imports 10 completed Regulation M-B
online community events from the documented Limitless Tournament Platform API.
Migration 348 explicitly refreshes the PostgREST schema cache so both bounded
profile functions are available to the deployed application immediately.
The cohort contains 737 teams and 4,422 roster slots with 100% team-sheet
coverage. Every event has complete, unique placements and a verifiable
single-elimination top cut.

The importer rejects incomplete standings, partial team-sheet coverage,
duplicate placements, malformed rosters, unknown Mega Stones, and events below
the explicit field-size floor. Player names, handles, countries, and account
identifiers are removed before the artifact is written. These results are
identified as online community tournaments and must not be presented as
official Pokémon Championship Series results. Pokédex profiles show field
usage, combined match record and win rate, top-cut conversion, finals, event
wins, recent top finishes, and common teammates with visible cohort sizes.

Source API documentation:
<https://docs.limitlesstcg.com/developer/tournaments>

## Refreshing a format

Run the importer with an explicit month, source format, DraftCenter format ID,
label, battle style, rating cutoff, and output path. Review the resulting JSON,
particularly form normalization and the recorded sample. Then generate a new
forward-only migration from the reviewed artifacts. Never rewrite migrations
344 through 348 after they may have run.

```powershell
npm run competitive:import:smogon -- --month 2026-07 --source-format gen9ou --format-id sv-ou --format-name "Scarlet/Violet OU" --battle-style singles --cutoff 1825 --output data/competitive/smogon-2026-07-gen9ou-1825.json
npm run competitive:build:migration -- data/competitive/smogon-2026-07-gen9ou-1825.json --output supabase/349-import-smogon-competitive-snapshots-2026-07.sql
```

Before release, run `npm run test:competitive-data`, the applicable full
repository checks, migration/RLS/grant verification, and visual review of an
ordinary species plus several form-sensitive profiles.

To rebuild the pinned Battle Room tournament derivative, re-fetch and verify
the exact source hashes already recorded in the reviewed cohort:

```powershell
npm run competitive:build:team-lab-suggestions
npm run competitive:check:team-lab-suggestions
```

The builder fails if any source event, complete-team count, or SHA-256 digest no
longer matches the reviewed cohort. Review and replace the source cohort through
the existing import process instead of accepting a changed event silently.
