# Pro League Championship Studio

## First release

The Championship Studio is the first DraftCenter Pro League experiment. It turns an archived season's final record into reproducible championship artwork without changing official league data.

Commissioners and league members can open **Past Seasons**, select a completed season, and use the studio when that season has a recorded champion.

The first release includes:

- Championship Night, Legacy Gold, and Electric Teal designs
- Editable artwork title, season line, and coach name
- An 8-by-10-inch PNG at 300 DPI (`2400 × 3000`)
- A square social PNG (`1080 × 1080`)
- Final standings, championship record, roster, playoff summary, and saved season awards
- A safe colored-initial team mark that remains exportable when an external logo host does not allow canvas use

The editable fields are presentation-only. They are not written back to the archived season or treated as official results.

## Data source

Artwork is generated entirely in the browser from the immutable season snapshot created during season rollover:

- `champion`
- `standings`
- `teams`
- `rosters`
- `playoffs`
- `playoffMVP`
- `regularSeasonChampions`
- `dynasty`

No payment, shipping address, shirt size, or fulfillment data is collected in this release.

## Verification

Before release:

1. Open at least two archived leagues with different league sizes.
2. Verify the recorded champion and coach match the selected season.
3. Download both formats from each of the three themes.
4. Open every PNG and check for clipped long team or Pokémon names.
5. Confirm the print PNG is exactly `2400 × 3000`.
6. Confirm the social PNG is exactly `1080 × 1080`.
7. Confirm editing presentation fields does not create a league save or audit-log entry.
8. Print one 8-by-10 test copy before promising physical fulfillment.

## Next phase

The next safe increment is a commissioner approval record stored separately from the official season snapshot. It should capture the selected design and approved display copy, followed later by a private fulfillment claim and production queue. Payment entitlements and shipping data should not be added until pricing, retention, refund, and access rules are decided.
