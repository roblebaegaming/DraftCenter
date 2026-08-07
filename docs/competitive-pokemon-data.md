# Competitive Pokémon data

DraftCenter keeps external competitive observations separate from regulation
legality, commissioner prices, and first-party league statistics. A usage rate
describes one source, format, month, and rating cutoff; it is not a universal
Pokémon score.

## Initial reviewed snapshot

Migration 343 creates the private-by-default competitive catalog and a bounded
public profile function. Migration 344 imports pinned June 2026 Pokémon
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

## Initial tournament cohort

Migration 345 adds private event, anonymous team, and team-member tables plus a
bounded Pokédex aggregate. Migration 346 imports 10 completed Regulation M-B
online community events from the documented Limitless Tournament Platform API.
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
343 or 344 after they may have run.

```powershell
npm run competitive:import:smogon -- --month 2026-07 --source-format gen9ou --format-id sv-ou --format-name "Scarlet/Violet OU" --battle-style singles --cutoff 1825 --output data/competitive/smogon-2026-07-gen9ou-1825.json
npm run competitive:build:migration -- data/competitive/smogon-2026-07-gen9ou-1825.json --output supabase/348-import-smogon-competitive-snapshots-2026-07.sql
```

Before release, run `npm run test:competitive-data`, the applicable full
repository checks, migration/RLS/grant verification, and visual review of an
ordinary species plus several form-sensitive profiles.
