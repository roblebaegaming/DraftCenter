export const GUIDES = {
  "what-is-pokemon-draft-league": {
    title: "What Is a Pokémon Draft League?",
    description: "Learn how Pokémon draft leagues work, from unique rosters and weekly matchups to standings, playoffs, and championships.",
    intro: "A Pokémon draft league is a season-long competition where every coach builds a unique roster from a shared pool. Instead of bringing any legal Pokémon each week, coaches draft a limited group and must solve every matchup with that roster.",
    sections: [
      ["The draft", "Before the season, commissioners publish the format, legal pool, prices or tiers, roster size, and draft order. In a snake draft, the order reverses each round. In an auction, coaches spend from a fixed budget. Once one coach drafts a Pokémon, it is normally unavailable to everyone else."],
      ["The regular season", "Coaches receive a schedule and prepare for a different opponent each week. They study the opposing roster, build a legal team from their own drafted Pokémon, play the agreed battle format, and report the result. Standings usually use match wins, game differential, or Pokémon differential as tiebreakers."],
      ["Transactions and adaptation", "Free-agent claims and trades let coaches respond to weaknesses, injuries to a strategy, or changes in the metagame. Good rules specify transaction deadlines, priority, budgets, roster minimums, and whether dropped Pokémon can be reclaimed."],
      ["Playoffs and champions", "The best regular-season records advance to a playoff bracket. Draft leagues reward long-term planning: a roster must handle many opponents, survive changing matchups, and still have enough flexibility for elimination rounds."],
    ],
  },
  "how-to-run-pokemon-draft-league": {
    title: "How to Run a Pokémon Draft League",
    description: "A practical commissioner checklist for formats, rules, drafts, schedules, standings, transactions, playoffs, and communication.",
    intro: "A reliable league starts with clear decisions before the first pick. Commissioners do not need complicated rules, but every coach should understand the format, calendar, roster limits, reporting process, and what happens when something goes wrong.",
    sections: [
      ["Choose the competitive format", "Define the game, generation, battle style, legal Pokémon pool, team-sheet rules, and any special mechanics. If the format allows Restricted Pokémon, Mega Evolution, Terastallization, Dynamax, or other mechanics, state roster and battle limits explicitly."],
      ["Publish roster and draft rules", "Choose snake, linear, or auction drafting; set roster size, points or budget, pick timers, missed-pick procedure, and whether coaches can trade draft positions. Test the pool before launch so the number and distribution of viable Pokémon support the league size."],
      ["Build the season calendar", "Set the draft date, weekly matchup deadline, result-reporting method, free-agent processing day, playoff qualification, and expected season length. Include a process for extensions, substitutions, and inactive coaches."],
      ["Keep one source of truth", "Use one public location for rules, schedule, standings, rosters, transactions, and rulings. DraftCenter keeps these connected so coaches and spectators do not need to reconcile several spreadsheets and message threads."],
      ["Communicate rulings consistently", "Record decisions, avoid changing competitive rules midseason unless necessary, and use the same remedy for equivalent situations. A short appeals or co-commissioner review process builds trust."],
    ],
  },
  "snake-vs-auction-pokemon-draft": {
    title: "Snake Draft vs. Auction Draft in Pokémon",
    description: "Compare snake and auction Pokémon drafts, including fairness, strategy, pacing, budgets, and commissioner workload.",
    intro: "Snake and auction drafts create different roster-building games. Neither is automatically better; the right choice depends on how much complexity, pricing strategy, and draft-day time your league wants.",
    sections: [
      ["Snake drafts", "Coaches pick in a fixed order that reverses each round. Snake drafts are easy to understand, quick to operate, and naturally distribute early selections. Tier or point rules can still control roster strength, but availability and turn position drive much of the strategy."],
      ["Auction drafts", "Every Pokémon has a price determined by bidding or a posted cost, and every coach manages the same budget. Auctions give coaches access to any Pokémon they can afford and reward valuation skill, but they need clear nomination, timer, minimum-bid, and over-budget safeguards."],
      ["Strategic differences", "Snake coaches plan around pick gaps, turn order, and likely availability. Auction coaches plan around opportunity cost: spending heavily on one star reduces depth elsewhere. Auctions often produce more varied roster structures, while snake drafts are easier for first-time players to follow."],
      ["Commissioner recommendation", "Use snake for a faster, lower-friction league or a group with many new drafters. Use auction when the group enjoys valuation, live bidding, and asymmetric roster construction. Test either format with the actual pool and league size before committing."],
    ],
  },
  "pokemon-draft-tier-list-guide": {
    title: "How to Build a Pokémon Draft Tier List",
    description: "Create a balanced Pokémon draft tier list using role compression, matchup value, speed, consistency, and real league data.",
    intro: "A draft tier list is not a standard singles or VGC viability ranking. Draft value depends on how consistently a Pokémon contributes across many opponents, what roles it compresses, and how scarce those roles are in the legal pool.",
    sections: [
      ["Start with the exact format", "Build from the legal pool, mechanics, battle size, and clauses the league will actually use. A Pokémon can change dramatically between generations, VGC regulations, singles and doubles, or formats with different transformation mechanics."],
      ["Price repeatable value", "Prioritize reliable speed control, defensive utility, positioning, strong neutral damage, role compression, and enough set variety to avoid becoming predictable. One spectacular matchup should not outweigh weeks where a Pokémon struggles to contribute."],
      ["Consider scarcity and combinations", "A common role can be priced lower even when the Pokémon is individually strong. A rare typing, ability, speed tier, redirection option, weather setter, or restricted answer may deserve a premium because few alternatives exist."],
      ["Use league evidence", "Compare draft rate, eligibility-aware ADP, auction price, teammate patterns, and match results. Always show sample sizes: early data should inform commissioner judgment rather than replace it."],
      ["Review after the season", "Look for Pokémon consistently drafted too early, left undrafted, producing extreme auction values, or overperforming across several rosters. Adjust gradually and preserve historical versions so returning coaches understand what changed."],
    ],
  },
};

export const FORMATS = [
  ["national-dex", "National Dex", "All supported generations, forms, and Mega Evolutions", "A complete DraftCenter pool for cross-generation draft leagues, with commissioner-controlled bans, costs, Restricted Pokémon limits, and Mega limits."],
  ["reg-mb", "Regulation M-B", "Pokémon Champions VGC · June 17–September 2, 2026", "The current Pokémon Champions regulation with Mega Evolution available and a curated DraftCenter legal pool."],
  ["reg-ma", "Regulation M-A", "Pokémon Champions VGC · April 8–June 17, 2026", "The opening Pokémon Champions regulation and its original competitive legal pool."],
  ["reg-a", "Regulation A", "Scarlet & Violet VGC · January 2023", "The initial Paldea format, excluding Paradox Pokémon, Treasures of Ruin, and box legends."],
  ["reg-b", "Regulation B", "Scarlet & Violet VGC · February–March 2023", "Expanded Regulation A with Paradox Pokémon joining the legal pool."],
  ["reg-c", "Regulation C", "Scarlet & Violet VGC · April–June 2023", "Added the Treasures of Ruin while keeping box legends unavailable."],
  ["reg-d", "Regulation D", "Scarlet & Violet VGC · July–September 2023", "Opened the format to many Pokémon transferred through Pokémon HOME."],
  ["reg-e", "Regulation E", "Scarlet & Violet VGC · October 2023–January 2024", "Added the Kitakami Pokédex and Teal Mask options."],
  ["reg-f", "Regulation F", "Scarlet & Violet VGC · January–April 2024", "Added the Indigo Disk and Blueberry Pokédex pool without Restricted legends."],
  ["reg-g", "Regulation G", "Scarlet & Violet VGC · May–August 2024", "Introduced one Restricted Pokémon per team."],
  ["reg-h", "Regulation H", "Scarlet & Violet VGC · September 2024–January 2025", "A lower-power format excluding most Legendary and Paradox Pokémon."],
  ["reg-i", "Regulation I", "Scarlet & Violet VGC · May–August 2025", "Allowed up to two Restricted Pokémon per team."],
  ["reg-j", "Regulation J", "Scarlet & Violet VGC · September 2025–January 2026", "Expanded the two-slot Restricted category to include Mythical Pokémon."],
  ["swsh-series9", "Sword & Shield Series 9", "Sword & Shield VGC · May–July 2021", "A broad Generation 8 pool without Restricted or Mythical Pokémon."],
  ["swsh-series13", "Sword & Shield Series 13", "Sword & Shield VGC · September–October 2022", "The final Generation 8 ruleset with unrestricted Legendary and Mythical access."],
  ["sm-vgc2018", "VGC 2018", "Ultra Sun & Ultra Moon VGC", "A Generation 7 National Pokédex-style pool without Restricted or Mythical Pokémon."],
  ["custom", "Custom Draft Format", "Commissioner-defined legality and pricing", "Build a legal pool, bans, costs, mechanics, and roster restrictions for a bespoke league."],
].map(([slug, name, subtitle, summary]) => ({ slug, name, subtitle, summary }));

export function formatBySlug(slug) {
  return FORMATS.find((format) => format.slug === slug);
}
