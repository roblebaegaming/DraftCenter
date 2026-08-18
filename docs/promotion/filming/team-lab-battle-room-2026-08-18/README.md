# Team Lab and Battle Room filming package

Prepared August 17, 2026 Pacific. The dated folder name follows the August 18
UTC release and capture window.

This package replaces the older pre-analytics Team Lab workbook QA and four
standalone Battle Mode screenshots. Every name, result, set, rating, replay
URL, and note in these assets is synthetic. No DraftCenter account, league,
opponent, or private Team Lab record was opened or copied.

The captures use the released components at Production commit
`b49ccf44dc3dda5908adfcbb5a5509e6e54f0a0b`, including the Battle analytics
released in [pull request #301](https://github.com/roblebaegaming/DraftCenter/pull/301).
The temporary local capture fixture was removed after the images were made and
is not part of this package.

## Screenshots

Use the images in this order for a feature walkthrough:

1. [`screenshots/battle-room-result-and-set.png`](screenshots/battle-room-result-and-set.png)
   shows Win/Loss/Tie, best-of-three planning, replay and rating fields, and
   the phone-friendly **Save & start next match** action.
2. [`screenshots/battle-room-turn-recorder.png`](screenshots/battle-room-turn-recorder.png)
   shows quick move, ability, item, switch, faint, damage, and note capture
   with the editable private timeline.
3. [`screenshots/battle-room-timeline-and-state.png`](screenshots/battle-room-timeline-and-state.png)
   shows HP, status, weather, terrain, hazards, screens, and Tera state.
4. [`screenshots/team-performance-analytics.png`](screenshots/team-performance-analytics.png)
   shows record, win rate, streak, last-five form, open/closed sheet splits,
   usage, lead records, opposing-Pokémon records, move usage, rating movement,
   and private replay history.

These are direct application captures, not AI mockups. The small fictional
rating and replay examples are visual test data. Do not publish or visit the
synthetic `replay.pokemonshowdown.com/synthetic-*` URLs as if they were real
matches.

## Workbook

[`team-lab-battle-room-sample.xlsx`](team-lab-battle-room-sample.xlsx) is a
current Excel and Google Sheets-ready export generated through the same
10-sheet application contract used by Team Lab:

1. Overview
2. Performance
3. Game Results
4. Matchup Stats
5. Move Usage
6. My Team
7. Matchup Plans
8. Opponent Sets
9. Turn Log
10. Game Plans

Rendered QA images for every sheet are in [`workbook-previews/`](workbook-previews/).
The workbook was checked for the expected sheet list, the 3–2 synthetic record,
five replay rows, rating movement, populated opponent sets, and formula errors.

## Filming sequence

For a 60–75 second feature video:

1. Open with the result buttons and **Save & start next match**.
2. Pan across the set tracker, replay link, and rating fields.
3. Show the fast turn recorder and one-tap opponent/move choices.
4. Open structured battle state for field and Tera tracking.
5. Finish on team performance analytics and the 10-sheet workbook.

Keep the privacy explanation visible or spoken: Battle Room is a private
notebook, does not read the game client, and shares nothing unless the user
chooses a copy or download action.
