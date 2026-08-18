# Daily Games

DraftCenter publishes Pokémon Connections, a community poll, a draft bracket,
and a Pokémon quiz each day. Ordinary games follow the player's local calendar
date. The Sunday Super Bracket qualification window uses Pacific time so every
week has one authoritative close.

## Sunday Super Bracket

The six community champions from Monday through Saturday qualify for Sunday's
eight-Pokémon bracket. The remaining places go to the best-performing Pokémon
that did not win a daily bracket. Performance is ranked by:

1. final wins;
2. semifinal win percentage;
3. quarterfinal win percentage; and
4. Pokémon name as a deterministic final tie-break.

Each Pokémon may occupy only one place. If the same Pokémon is community
champion on multiple days, its extra place becomes another performance
wildcard. Seeds use the same weekly performance order and the bracket is laid
out as 1 vs. 8, 4 vs. 5, 2 vs. 7, and 3 vs. 6.

The lineup locks after Saturday closes at midnight Pacific. The existing
hourly notification dispatch finalizes it automatically and safely retries if
one of the six source champions is not ready. Until finalization, the generic
pre-seeded Sunday candidates stay hidden and submissions are rejected. The
finalized qualifier list and source dates are stored with the Sunday bracket so
the result is auditable and cannot drift later.

## Pokémon Connections rotation

Connections puzzles already made available through August 18, 2026 retain
their original deterministic boards so browser saves and shared results
continue to match. Starting August 19, the stronger deterministic scheduler
enforces all of these rules:

- an exact theme cannot reappear during the previous ten calendar days;
- a category cannot appear on consecutive days;
- the four themes in one puzzle use four different categories; and
- all 16 Pokémon are different base species, so alternate forms do not occupy
  two places in the same board;
- a Pokémon cannot appear on consecutive days; and
- the scheduler prefers a two-day Pokémon cooldown and weighs the previous
  seven days when choosing among otherwise valid groups.

The curated theme catalog contains enough strategy, ability, move, family,
shape, Egg Group, color, generation, type, evolution, height, and weight groups
to enforce the cooldown without changing a puzzle based on request order.

## Daily Draft Bracket form variety

Ordinary Daily Draft Brackets use only one form of each base Pokémon species.
For example, Audino and Mega Audino cannot both occupy places in one ordinary
eight-Pokémon field. The Sunday Super Bracket is exempt because its entrants
are earned from the six completed daily brackets and distinct qualified forms
must remain eligible.

The database applies this rule whenever an ordinary bracket is created or
edited. The release repairs only untouched future ordinary brackets. It never
rewrites the current day, historical results, Sunday qualifiers, or a future
bracket that already has submissions.
