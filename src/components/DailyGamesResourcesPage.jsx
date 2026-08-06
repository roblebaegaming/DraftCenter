"use client";

const groups = [
  ["Grid and guessing games", [
    ["PokéDoku", "Fill a daily three-by-three Pokémon trivia grid.", "https://pokedoku.io/"],
    ["Pokédle", "Identify the daily Pokémon through several visual and trivia modes.", "https://pokedle.io/"],
    ["Squirdle Daily", "Narrow down a Pokémon using generation, type, height, and weight clues.", "https://squirdle.fireblend.com/daily.html"],
  ]],
  ["Daily game collections", [
    ["Pokédoodle", "Choose from a collection of daily Pokémon drawing, sound, fusion, and trivia games.", "https://pokedoodle.com/"],
    ["Pokequizz", "Play a collection of daily silhouette, cry, statistics, word, and battle quizzes.", "https://pokequizz.com/en/"],
  ]],
  ["Type matchup practice", [
    ["PokéTypeQuiz", "Practice Pokémon type strengths, weaknesses, resistances, and immunities.", "https://www.poketypequiz.com/"],
    ["Pokyfriends Type Chart Quiz", "Test yourself by filling in the complete Pokémon type chart.", "https://pokyfriends.com/game/pokemon-type-chart-quiz/"],
  ]],
];

export default function DailyGamesResourcesPage() {
  return <main className="resources-shell daily-resources-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/resources">← Resources</a><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/pokemon">Pokédex</a></nav>
    <header className="resources-hero"><span className="eyebrow">POKÉMON DAILY GAMES</span><h1>A little Pokémon every day.</h1><p>Start with DraftCenter’s community Daily Three, then keep playing with independent grids, guessing games, and type-matchup practice from around the Pokémon community.</p></header>
    <a className="daily-games-feature" href="/explore"><div><span className="eyebrow">PLAY ON DRAFTCENTER</span><h2>The Daily Three</h2><p>Vote in the daily poll, crown a champion in the eight-Pokémon Draft Bracket, and answer the Pokémon Quiz. Complete all three to grow your streak and earn account badges.</p><strong>Play today’s Daily Three →</strong></div><span className="daily-games-feature-mark" aria-hidden="true">3</span></a>
    <div className="resource-sections">{groups.map(([title, games]) => <section className="resource-section" key={title}><h2>{title}</h2><div className="resource-grid">{games.map(([name, description, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><p>{description}</p><span>Play on the creator’s site ↗</span></a>)}</div></section>)}</div>
    <p className="resource-disclaimer">These games are independent fan-made resources. DraftCenter is not affiliated with their creators and does not control their content, privacy practices, availability, or daily schedules. Pokémon and Pokémon character names are trademarks of Nintendo, Creatures, and GAME FREAK.</p>
  </main>;
}
