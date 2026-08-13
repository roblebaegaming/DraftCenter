"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import DailyCommunityGames from "./DailyCommunityGames";
import { PollOfTheDay } from "./LeagueHub";
import RosterConnections from "./RosterConnections";
import { ShareButton } from "./SocialSharing";

const groups = [
  ["Grid and guessing games", [
    ["PokéDoku", "Fill a daily three-by-three Pokémon trivia grid.", "https://pokedoku.io/", "https://pokedoku.io/data/image/options/pokedoku-favicon1.png"],
    ["Pokédle", "Identify the daily Pokémon through several visual and trivia modes.", "https://pokedle.io/", "https://pokedle.io/upload/imgs/options/pokedle-logo.png"],
    ["Squirdle Daily", "Narrow down a Pokémon using generation, type, height, and weight clues.", "https://squirdle.fireblend.com/daily.html", "https://squirdle.fireblend.com/favicon.ico"],
  ]],
  ["Daily game collections", [
    ["Pokédoodle", "Choose from a collection of daily Pokémon drawing, sound, fusion, and trivia games.", "https://pokedoodle.com/", "https://pokedoodle.com/og-image.png"],
    ["Pokequizz", "Play a collection of daily silhouette, cry, statistics, word, and battle quizzes.", "https://pokequizz.com/en/", "https://pokequizz.com/pokequizz-og-256.jpg"],
  ]],
  ["Type matchup practice", [
    ["PokéTypeQuiz", "Practice Pokémon type strengths, weaknesses, resistances, and immunities.", "https://www.poketypequiz.com/", "https://www.poketypequiz.com/static/assets/logos/logo-1-full.png"],
    ["Pokyfriends Type Chart Quiz", "Test yourself by filling in the complete Pokémon type chart.", "https://pokyfriends.com/game/pokemon-type-chart-quiz/", "https://pokyfriends.com/static/og_image/pokemon-type-quiz.png"],
  ]],
  ["Pokémon TCG games", [
    ["TCGdle", "Guess a daily Pokémon card, Pokémon, or Trainer from trading-card clues.", "https://tcgdle.com/", "https://tcgdle.com/favicon.ico"],
  ]],
];

export default function DailyGamesResourcesPage() {
  const [supabase] = useState(() => createClient());
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);
  return <main className="resources-shell daily-resources-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/resources">← Resources</a><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/pokemon">Pokédex</a></nav>
    <header className="resources-hero"><span className="eyebrow">NEW POKÉMON GAMES EVERY DAY</span><h1>Pokémon Daily Games</h1><p>Play Pokémon Connections, vote in the community poll, crown a bracket champion, and solve the daily Pokémon quiz. On Sundays, the week’s bracket winners meet in the Sunday Super Bracket.</p><div className="explore-actions"><a className="primary-button" href="#daily-games">Play today’s games</a><ShareButton title="Pokémon Daily Games" text="Play four fresh Pokémon Daily Games on DraftCenter." /></div></header>
    <section id="daily-games" className="daily-games-play"><div className="daily-games-heading"><div><span className="eyebrow">TODAY’S DAILY GAMES</span><h2>Four fresh Pokémon challenges</h2></div><p>Complete all four to grow your streak and earn Daily Games badges. Eligible choices also add discoveries to your Trainer Dex.</p></div><div className="daily-trio-grid"><DailyCommunityGames signedIn={signedIn} standalone betweenGames={<><RosterConnections signedIn={signedIn} /><PollOfTheDay supabase={supabase}/></>} /></div></section>
    <div className="resource-section-heading"><span className="eyebrow">MORE DAILY GAMES</span><h2>Keep playing around the Pokémon community</h2></div>
    <div className="resource-sections daily-game-resource-sections">{groups.map(([title, games]) => <section className="resource-section" key={title}><h2>{title}</h2><div className="resource-grid">{games.map(([name, description, url, image]) => <a key={name} href={url} target="_blank" rel="noreferrer"><span className="daily-resource-image"><img src={image} alt={`${name} preview`} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /></span><strong>{name}</strong><p>{description}</p><span>Play on the creator’s site ↗</span></a>)}</div></section>)}</div>
    <section className="daily-games-seo-content"><span className="eyebrow">PLAY, COMPARE, RETURN TOMORROW</span><h2>Free daily Pokémon games for fans and draft-league players</h2><p>DraftCenter’s four Pokémon Daily Games combine a Connections puzzle with a community poll, a head-to-head Pokémon bracket, and a daily Pokémon quiz. A fresh set appears each day using your local calendar date.</p><div><article><h3>Pokémon Connections</h3><p>Sort 16 Pokémon into groups using strategy, measurements, shape, Egg Group, and other shared facts. Exact themes stay out of rotation for at least seven days.</p></article><article><h3>Daily Pokémon poll</h3><p>Choose your answer before seeing how the community voted.</p></article><article><h3>Daily and Super Brackets</h3><p>Advance eight Pokémon through seven matchups. Sunday features six daily winners plus the best two non-winners from Monday through Saturday.</p></article><article><h3>Daily Pokémon quiz</h3><p>Identify a Pokémon from a rotating clue and check the community results.</p></article></div><h2>Pokémon dailies FAQ</h2><details><summary>Are the Pokémon daily games free?</summary><p>Yes. Pokémon Connections is playable without an account and saves progress in this browser. A free DraftCenter account is required to submit the community games, join discussions, and earn completion badges.</p></details><details><summary>When do the daily Pokémon games reset?</summary><p>Pokémon Connections, the poll, bracket, and quiz use your local calendar date. The Sunday Super Bracket lineup locks after Saturday closes at midnight Pacific.</p></details><details><summary>How does the Sunday Super Bracket work?</summary><p>Monday through Saturday’s six community bracket champions qualify. The two best-performing non-winners fill the remaining places, ranked by final wins, semifinal rate, then quarterfinal rate. If one Pokémon wins more than one day, it takes one place and the next non-winner fills the opening.</p></details><details><summary>What are DraftCenter’s Pokémon Daily Games?</summary><p>They are Pokémon Connections, one community poll, one eight-Pokémon draft bracket, and one Pokémon quiz released each day.</p></details><details><summary>When can I join a Daily Games discussion?</summary><p>Sign in and complete that day’s game first. Its discussion then opens without revealing answers before you finish.</p></details></section>
    <p className="resource-disclaimer">These games are independent fan-made resources. DraftCenter is not affiliated with their creators and does not control their content, privacy practices, availability, or daily schedules. Pokémon and Pokémon character names are trademarks of Nintendo, Creatures, and GAME FREAK.</p>
  </main>;
}
