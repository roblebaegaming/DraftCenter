"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import DailyCommunityGames from "./DailyCommunityGames";
import { PollOfTheDay } from "./LeagueHub";
import { ShareButton } from "./SocialSharing";

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
  const [supabase] = useState(() => createClient());
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);
  return <main className="resources-shell daily-resources-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/resources">← Resources</a><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/pokemon">Pokédex</a></nav>
    <header className="resources-hero"><span className="eyebrow">NEW POKÉMON GAMES EVERY DAY</span><h1>Pokémon Daily Games</h1><p>Complete DraftCenter’s community Daily Three right here: vote in today’s poll, crown a bracket champion, and solve the daily Pokémon quiz.</p><div className="explore-actions"><a className="primary-button" href="#daily-three">Play today’s games</a><ShareButton title="Pokémon Daily Games" text="Play today’s Pokémon Daily Three on DraftCenter." /></div></header>
    <section id="daily-three" className="daily-games-play"><div className="daily-games-heading"><div><span className="eyebrow">TODAY’S DAILY THREE</span><h2>Three fresh Pokémon challenges</h2></div><p>Complete all three to grow your streak, earn badges, and discover entries in your Trainer Dex.</p></div><div className="daily-trio-grid"><PollOfTheDay supabase={supabase}/><DailyCommunityGames signedIn={signedIn} standalone/></div></section>
    <section className="daily-games-seo-content"><span className="eyebrow">PLAY, COMPARE, RETURN TOMORROW</span><h2>Free daily Pokémon games for fans and draft-league players</h2><p>DraftCenter’s Pokémon dailies combine a community question, a head-to-head Pokémon bracket, and a daily Pokémon quiz. A new set appears each day using your local calendar date.</p><div><article><h3>Daily Pokémon poll</h3><p>Choose your answer before seeing how the community voted.</p></article><article><h3>Daily draft bracket</h3><p>Advance eight Pokémon through seven matchups and compare your champion.</p></article><article><h3>Daily Pokémon quiz</h3><p>Identify a Pokémon from a rotating clue and check the community results.</p></article></div><h2>Pokémon dailies FAQ</h2><details><summary>Are the Pokémon daily games free?</summary><p>Yes. The page is free to visit; a DraftCenter account is required to submit answers and save progress.</p></details><details><summary>When do the daily Pokémon games reset?</summary><p>The poll, bracket, and quiz use your local calendar date, so a fresh Daily Three appears each day.</p></details><details><summary>What is the Pokémon Daily Three?</summary><p>It is one community poll, one eight-Pokémon draft bracket, and one Pokémon quiz released each day.</p></details></section>
    <div className="resource-section-heading"><span className="eyebrow">MORE DAILY GAMES</span><h2>Keep playing around the Pokémon community</h2></div>
    <div className="resource-sections">{groups.map(([title, games]) => <section className="resource-section" key={title}><h2>{title}</h2><div className="resource-grid">{games.map(([name, description, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><p>{description}</p><span>Play on the creator’s site ↗</span></a>)}</div></section>)}</div>
    <p className="resource-disclaimer">These games are independent fan-made resources. DraftCenter is not affiliated with their creators and does not control their content, privacy practices, availability, or daily schedules. Pokémon and Pokémon character names are trademarks of Nintendo, Creatures, and GAME FREAK.</p>
  </main>;
}
