# Open Team Sheet printing

My Teams can turn any private Team Lab workspace into a two-page open-team-sheet packet:

1. A broadcast page with official Pokémon artwork, team identity, Tera Types,
   held items, abilities, and four moves.
2. A compact letter-sized table with English, French, Italian, German,
   Spanish, Japanese, and Korean names for the same open information.

The print studio can print the complete packet or either page by itself. It
uses the browser print dialog, so a coach can print on paper or choose the
browser's **Save as PDF** destination.

## Data and privacy

- Team Lab set details remain private and are rendered in the signed-in
  browser. Opening the studio does not publish a team or create a public URL.
- Hosted league rosters remain read-only. A coach can print the saved roster
  with blank set details or open a separate private Team Lab planning copy to
  complete the sheet.
- Tera Type is stored in the existing private `team_sets` value. It is already
  included in PokéPaste imports, recovery files, and readable spreadsheet
  exports.
- Localized Pokémon, type, ability, item, and move names are loaded directly
  from PokéAPI. If a localized name is unavailable, the saved English text is
  used and the studio reports the fallback before printing.

The multilingual page is a planning and opponent-information aid. Coaches
should verify every in-game name before submitting an official event team
list.
