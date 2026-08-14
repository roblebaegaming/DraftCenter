"use client";

const sections = [
  ["Battle and team building", [
    ["Pokémon Showdown", "Build teams and play competitive battles.", "https://play.pokemonshowdown.com/", "/resource-sites/pokemon-showdown.png", "Pokémon Showdown logo"],
    ["Showdown Damage Calculator", "Check damage ranges, speed, abilities, items, and field conditions.", "https://calc.pokemonshowdown.com/", "/resource-sites/damage-calculator.png", "Pokémon Showdown Damage Calculator logo"],
    ["PokéPaste", "Share readable team sheets and importable sets.", "https://pokepast.es/", "/resource-sites/pokepaste.png", "PokéPaste Poké Ball mark"],
    ["PASRS Spreadsheet", "Learn about PASRS 7.0, a community team-planning spreadsheet.", "https://devoncorp.press/resources/the-release-of-pasrs-7-0", "/resource-sites/devoncorp.webp", "DevonCorp logo"],
  ]],
  ["Pokémon information", [
    ["Smogon Strategy Pokédex", "Competitive sets, analyses, tiers, and discussion.", "https://www.smogon.com/dex/", "/resource-sites/smogon.ico", "Smogon logo"],
    ["Serebii", "Pokédex data, mechanics, events, and Pokémon news.", "https://www.serebii.net/", "/resource-sites/serebii.jpg", "Serebii.net banner"],
    ["Bulbapedia", "A broad community encyclopedia for games and mechanics.", "https://bulbapedia.bulbagarden.net/", "/resource-sites/bulbapedia.png", "Bulbapedia logo"],
  ]],
  ["Draft and VGC", [
    ["Smogon Draft League forum", "Draft formats, resources, tournaments, and discussion.", "https://www.smogon.com/forums/forums/draft-league.738/", "/resource-sites/smogon.ico", "Smogon logo"],
    ["Victory Road", "VGC event coverage, teams, results, and resources.", "https://victoryroad.pro/", "/resource-sites/victory-road.png", "Victory Road logo"],
    ["LabMaus", "VGC results, usage data, teams, and player records.", "https://labmaus.net/", "/resource-sites/labmaus.png", "LabMaus logo"],
    ["MunchStats", "Explore Pokémon Showdown usage and moveset statistics.", "https://munchstats.com/", "/resource-sites/munchstats.png", "MunchStats logo"],
  ]],
];

export default function ResourcesPage() {
  return <main className="resources-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/tools/team-builder">Team Lab</a><a className="quiet-button" href="/tools/mega-bracket">Mega Bracket</a><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/pokemon">Pokémon</a></nav>
    <header className="resources-hero"><span className="eyebrow">DRAFTCENTER RESOURCES</span><h1>Competitive Pokémon Resources</h1><p>Explore practical competitive Pokémon resources for draft leagues, battle preparation, team building, VGC, and strategy research.</p></header>
    <a className="draft-guide-feature" href="/guides/what-is-pokemon-draft-league"><div><span className="eyebrow">NEW TO DRAFT?</span><h2>Pokémon Draft League Guide</h2><p>Learn the complete season workflow: formats, unique rosters, snake and auction drafts, weekly preparation, transactions, standings, and playoffs.</p><strong>Read the complete DraftCenter guide →</strong></div></a>
    <div className="resource-sections"><section className="resource-section"><h2>DraftCenter learning library</h2><div className="resource-grid"><a href="/tools/team-builder"><strong>Team Lab builder and matchup planner</strong><p>Build a six-Pokémon team or 10-Pokémon draft roster, connect saved teams, keep private notes, and plan opponent matchups.</p><span>Open Team Lab →</span></a><a href="/tools/mega-bracket"><strong>Mega Bracket Full Dex Challenge</strong><p>Compare all 1,162 supported Pokémon and forms, reveal your Top 64, and save your personal champion.</p><span>Start Mega Bracket →</span></a><a href="/pokedex-tracker"><strong>Pokédex Tracker</strong><p>Create private game-by-game and Pokémon HOME checklists with independent standard and shiny progress.</p><span>Open the Dex Tracker →</span></a><a href="/nuzlocke"><strong>Nuzlocke Run Tracker</strong><p>Build a verified run and track every encounter, with cave floors and subareas sharing their parent location’s slot.</p><span>Open the run tracker →</span></a><a href="/resources/daily-games"><strong>Pokémon Daily Games</strong><p>Play Pokémon Connections, the community poll, bracket, and quiz, then return Sunday for the weekly Super Bracket.</p><span>Open the daily hub →</span></a><a href="/guides"><strong>Commissioner and coach guides</strong><p>Learn league setup, draft methods, tier lists, schedules, transactions, and playoffs.</p><span>Browse guides →</span></a><a href="/formats"><strong>Format library</strong><p>Compare Pokémon Champions, Scarlet and Violet, Sword and Shield, VGC, and custom formats.</p><span>Browse formats →</span></a></div></section></div>
    <div className="resource-sections"><section className="resource-section"><h2>Quick format references</h2><div className="pokemon-tags"><a href="/formats/national-dex">National Dex draft</a><a href="/formats/vgc2020">VGC 2020</a><a href="/formats/custom">Custom draft format</a></div><p>Use these starting points for an unrestricted National Dex pool, a historical doubles regulation, or a commissioner-defined custom league, then compare the complete format library before publishing rules.</p></section></div>
    <div className="resource-sections">{sections.map(([title, resources]) => <section className="resource-section" key={title}><h2>{title}</h2><div className="resource-grid">{resources.map(([name, description, url, image, imageAlt]) => <a className="external-resource-card" key={name} href={url} target="_blank" rel="noreferrer"><div className="resource-site-visual"><img src={image} alt={imageAlt} width="320" height="160" loading="lazy" /></div><div className="resource-site-copy"><strong>{name}</strong><p>{description}</p><span>Open resource →</span></div></a>)}</div></section>)}</div>
    <p className="resource-disclaimer">These are independent external resources. DraftCenter is not affiliated with or responsible for their content or availability.</p>
  </main>;
}
