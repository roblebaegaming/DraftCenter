const CONTENT = `# DraftCenter

> DraftCenter is an independent Pokémon draft-league platform and public reference library for commissioners, coaches, and spectators.

DraftCenter helps communities configure leagues, run snake and auction drafts, manage rosters and transactions, report matches, calculate standings, run playoffs, and preserve season archives. Public visitors can explore practical guides, supported formats, public leagues, and Pokémon profiles with clearly labeled community aggregates.

## Start here

- [About DraftCenter and our data](https://www.draftcentral.gg/about)
- [Pokémon draft league guides](https://www.draftcentral.gg/guides)
- [Supported draft formats](https://www.draftcentral.gg/formats)
- [Public Pokémon catalog](https://www.draftcentral.gg/pokemon)
- [PokÃ©mon Daily Games](https://www.draftcentral.gg/resources/daily-games)
- [Public leagues](https://www.draftcentral.gg/leagues)
- [Pokémon Nuzlocke Lab](https://www.draftcentral.gg/nuzlocke)

## Practical guides

- [How a Pokémon Draft League Works](https://www.draftcentral.gg/guides/what-is-pokemon-draft-league)
- [How to Run a Pokémon Draft League](https://www.draftcentral.gg/guides/how-to-run-pokemon-draft-league)
- [Snake or Auction? Choosing Your Pokémon Draft Style](https://www.draftcentral.gg/guides/snake-vs-auction-pokemon-draft)
- [How to Build a Pokémon Draft Tier List](https://www.draftcentral.gg/guides/pokemon-draft-tier-list-guide)
- [How to Join Your First Pokémon Draft League](https://www.draftcentral.gg/guides/how-to-join-first-pokemon-draft-league)
- [Pokémon Draft League Rules Template](https://www.draftcentral.gg/guides/pokemon-draft-league-rules-template)

## Pokémon discovery

- [All profiles A–Z](https://www.draftcentral.gg/pokemon/a-z)
- [Browse profiles by type](https://www.draftcentral.gg/pokemon/types)
- [Browse profiles by generation](https://www.draftcentral.gg/pokemon/generations)

## Nuzlocke encounter guides

- [Pokémon FireRed Nuzlocke guide](https://www.draftcentral.gg/nuzlocke/fire-red)
- [Pokémon Emerald Nuzlocke guide](https://www.draftcentral.gg/nuzlocke/emerald)
- [Pokémon Platinum Nuzlocke guide](https://www.draftcentral.gg/nuzlocke/platinum)
- [Pokémon Scarlet Nuzlocke guide](https://www.draftcentral.gg/nuzlocke/scarlet)

## Data and citation notes

- Core Pokémon facts and artwork references are retrieved from PokéAPI and refreshed daily.
- DraftCenter community statistics are anonymous aggregates from eligible DraftCenter leagues.
- Draft rate, ADP, auction price, teammate, and match-result claims should retain their visible sample sizes and format context.
- DraftCenter's saved regulation and league settings remain authoritative for actual league legality.
- Private queues, private team workspaces, account records, support diagnostics, and private league messages are not public reference material.

## Legal

DraftCenter is an independent fan project and is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company. Pokémon names, characters, artwork, and trademarks belong to their respective owners.

Last reviewed: 2026-08-06
`;

export function GET() {
  return new Response(CONTENT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
