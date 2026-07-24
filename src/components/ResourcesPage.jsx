"use client";

const sections = [
  ["Battle and team building", [
    ["Pokémon Showdown", "Build teams and play competitive battles.", "https://play.pokemonshowdown.com/"],
    ["Showdown Damage Calculator", "Check damage ranges, speed, abilities, items, and field conditions.", "https://calc.pokemonshowdown.com/"],
    ["PokéPaste", "Share readable team sheets and importable sets.", "https://pokepast.es/"],
    ["PASRS Spreadsheet", "Learn about PASRS 7.0, a community team-planning spreadsheet.", "https://devoncorp.press/resources/the-release-of-pasrs-7-0"],
  ]],
  ["Pokémon information", [
    ["Smogon Strategy Pokédex", "Competitive sets, analyses, tiers, and discussion.", "https://www.smogon.com/dex/"],
    ["Serebii", "Pokédex data, mechanics, events, and Pokémon news.", "https://www.serebii.net/"],
    ["Bulbapedia", "A broad community encyclopedia for games and mechanics.", "https://bulbapedia.bulbagarden.net/"],
  ]],
  ["Draft and VGC", [
    ["Smogon Draft League forum", "Draft formats, resources, tournaments, and discussion.", "https://www.smogon.com/forums/forums/draft-league.738/"],
    ["Victory Road", "VGC event coverage, teams, results, and resources.", "https://victoryroad.pro/"],
    ["LabMaus", "VGC results, usage data, teams, and player records.", "https://labmaus.net/"],
    ["MunchStats", "Explore Pokémon Showdown usage and moveset statistics.", "https://munchstats.com/"],
  ]],
];

export default function ResourcesPage() {
  return <main className="resources-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/pokemon">Pokémon</a><a className="quiet-button" href="/leagues">Public Leagues</a></nav>
    <header className="resources-hero"><span className="eyebrow">DRAFTCENTER RESOURCES</span><h1>Learn, build, and prepare.</h1><p>A practical starting point for Pokémon draft leagues, battle preparation, team building, and competitive research.</p></header>
    <a className="draft-guide-feature" href="https://www.smogon.com/articles/beginners-guide-draft" target="_blank" rel="noreferrer"><div><span className="eyebrow">NEW TO DRAFT?</span><h2>What is Pokémon Draft League?</h2><p>Coaches draft unique rosters, prepare for a different opponent each week, and compete across a season. Smogon’s beginner guide is an excellent introduction while DraftCenter develops its own guide.</p><strong>Read the external beginner’s guide →</strong></div></a>
    <div className="resource-sections">{sections.map(([title, resources]) => <section className="resource-section" key={title}><h2>{title}</h2><div className="resource-grid">{resources.map(([name, description, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><p>{description}</p><span>Open resource →</span></a>)}</div></section>)}</div>
    <p className="resource-disclaimer">These are independent external resources. DraftCenter is not affiliated with or responsible for their content or availability.</p>
  </main>;
}
