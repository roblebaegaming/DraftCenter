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

Connections puzzles before August 14, 2026 retain their original deterministic
boards so browser saves and shared results continue to match. Starting that
date, the deterministic scheduler enforces all of these rules:

- an exact theme cannot reappear during the previous seven calendar days;
- a category cannot appear on consecutive days;
- the four themes in one puzzle use four different categories; and
- all 16 Pokémon remain unique within the board.

The curated theme catalog contains enough strategy, ability, move, family,
shape, Egg Group, color, generation, type, evolution, height, and weight groups
to enforce the cooldown without changing a puzzle based on request order.
