"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { WORLDS_2026_EVENT_ID } from "../lib/worlds2026";
import WorldsDisciplineNav from "./WorldsDisciplineNav";

const leaderboardTabs = [
  { id: "overall", label: "Overall" },
  { id: "vgc", label: "VGC" },
  { id: "tcg", label: "TCG" },
  { id: "go", label: "Pokémon GO" },
  { id: "unite", label: "Pokémon UNITE" },
];

const futureLeaderboardCopy = {
  tcg: ["TCG leaderboard", "Standings will appear after the Masters roster audit passes, entries open, and official results are scored."],
  go: ["Pokémon GO leaderboard", "This competition is planned. Its prediction format and safe roster unit still need to be defined."],
  unite: ["Pokémon UNITE leaderboard", "This competition is planned and will use teams rather than forcing players into the individual Pick 16 format."],
};

export default function WorldsPredictionsHub() {
  const [activeLeaderboard, setActiveLeaderboard] = useState("overall");
  const [vgcHub, setVgcHub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.rpc("get_worlds_pick_hub", { p_event_id: WORLDS_2026_EVENT_ID }).then(({ data }) => {
      if (!active) return;
      setVgcHub(data || null);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return <main className="worlds-shell worlds-hub-shell">
    <WorldsDisciplineNav current="overview" />

    <section className="worlds-hub-hero">
      <div>
        <span className="eyebrow">2026 POKÉMON WORLD CHAMPIONSHIPS</span>
        <h1>2026 Pokémon Worlds Predictions</h1>
        <p>Choose a competition, make your picks, and climb its community leaderboard. Play more than one game to compete for the overall Worlds title.</p>
      </div>
      <aside>
        <span>WORLDS WEEKEND</span>
        <strong>Aug 28–30</strong>
        <p>Moscone Center · Championship Sunday at Chase Center</p>
      </aside>
    </section>

    <section className="worlds-search-guide" aria-labelledby="worlds-search-guide-heading">
      <header>
        <span className="eyebrow">2026 WORLDS AT A GLANCE</span>
        <h2 id="worlds-search-guide-heading">Pokémon World Championships 2026: dates, games, and predictions</h2>
        <p>The 2026 Pokémon World Championships take place August 28–30 in San Francisco. DraftCenter&apos;s free community games let fans predict the Masters competitions and compare results on discipline and overall leaderboards.</p>
      </header>
      <div>
        <article>
          <h3>When and where is Pokémon Worlds 2026?</h3>
          <p>Competition begins Friday, August 28, at Moscone Center. All finals move to Chase Center for Championship Sunday on August 30.</p>
          <a href="https://worlds.pokemon.com/en-us" target="_blank" rel="noreferrer">Official Worlds information ↗</a>
        </article>
        <article>
          <h3>Which games are at Pokémon Worlds?</h3>
          <p>The World Championships feature VGC, the Pokémon TCG, Pokémon GO, and Pokémon UNITE. Each DraftCenter competition will keep its own leaderboard.</p>
        </article>
        <article>
          <h3>How do the VGC predictions work?</h3>
          <p>Choose 16 VGC Masters invitees and one Ace Pick worth double placement points. Entries lock at midnight Pacific when Worlds begins.</p>
          <Link href="/worlds/2026/vgc">Browse the VGC invitees →</Link>
        </article>
      </div>
    </section>

    <section className="worlds-competition-section" aria-labelledby="worlds-competition-heading">
      <header>
        <span className="eyebrow">CHOOSE A COMPETITION</span>
        <h2 id="worlds-competition-heading">One Worlds home. A leaderboard for every game.</h2>
      </header>
      <div className="worlds-competition-grid">
        <Link className="worlds-competition-card is-live is-vgc" href="/worlds/2026/vgc">
          <span className="worlds-status-pill">Open now</span>
          <small>VIDEO GAME CHAMPIONSHIPS</small>
          <h3>VGC Masters</h3>
          <p>Pick 16 qualified competitors, choose an Ace Pick, and follow the live community field.</p>
          <strong>Make VGC picks →</strong>
        </Link>
        <Link className="worlds-competition-card is-building is-tcg" href="/worlds/2026/tcg">
          <span className="worlds-status-pill">In build</span>
          <small>POKÉMON TRADING CARD GAME</small>
          <h3>TCG Masters</h3>
          <p>Scoring is set. The complete Masters invite roster is being reconciled before picks can open.</p>
          <strong>See TCG progress →</strong>
        </Link>
        <article className="worlds-competition-card is-planned is-go">
          <span className="worlds-status-pill">Planned</span>
          <small>MOBILE BATTLES</small>
          <h3>Pokémon GO</h3>
          <p>The prediction format and safe competitor pool will be designed after VGC and TCG.</p>
          <strong>Coming later</strong>
        </article>
        <article className="worlds-competition-card is-planned is-unite">
          <span className="worlds-status-pill">Planned</span>
          <small>TEAM COMPETITION</small>
          <h3>Pokémon UNITE</h3>
          <p>A team-based prediction game will be designed around UNITE&apos;s actual tournament structure.</p>
          <strong>Coming later</strong>
        </article>
      </div>
    </section>

    <section className="worlds-leaderboard-hub" aria-labelledby="worlds-leaderboards-heading">
      <header>
        <div><span className="eyebrow">COMMUNITY STANDINGS</span><h2 id="worlds-leaderboards-heading">Worlds leaderboards</h2></div>
        <p>Each game keeps its own raw score. Overall points give every launched competition an equal share.</p>
      </header>
      <div className="worlds-leaderboard-tabs" role="tablist" aria-label="Worlds leaderboard views">
        {leaderboardTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeLeaderboard === tab.id} onClick={() => setActiveLeaderboard(tab.id)}>{tab.label}</button>)}
      </div>

      {activeLeaderboard === "overall" ? <div className="worlds-overall-panel" role="tabpanel">
        <div>
          <span className="eyebrow">OVERALL LEADERBOARD</span>
          <h3>Every competition is worth up to 100 points.</h3>
          <p>A player&apos;s score in each game is divided by that game&apos;s maximum possible score, then converted to 100 Overall points. Missing an entry earns zero for that game.</p>
          <code>Overall points = (your game score ÷ maximum game score) × 100</code>
        </div>
        <aside>
          <strong>Opens after two competitions score</strong>
          <p>VGC will not be labeled an overall contest by itself. The combined table appears when at least two games have official scored results.</p>
        </aside>
      </div> : activeLeaderboard === "vgc" ? <div className="worlds-discipline-leaderboard" role="tabpanel">
        <header><div><span className="eyebrow">VGC MASTERS</span><h3>{vgcHub?.entry_count || 0} entries</h3></div><Link href="/worlds/2026/vgc#pick-sixteen">Make my VGC picks →</Link></header>
        {loading ? <p className="worlds-empty-state">Loading the VGC community field…</p> : vgcHub?.standings?.length ? <ol>
          {vgcHub.standings.map((entry, index) => <li key={`${entry.display_name}-${index}`}><span>#{entry.rank}</span><strong>{entry.display_name}</strong><b>{entry.score} pts</b></li>)}
        </ol> : <p className="worlds-empty-state">Be the first DraftCenter member to save a VGC Pick 16 entry.</p>}
      </div> : <div className="worlds-future-leaderboard" role="tabpanel">
        <span className="eyebrow">{activeLeaderboard === "tcg" ? "IN BUILD" : "PLANNED"}</span>
        <h3>{futureLeaderboardCopy[activeLeaderboard][0]}</h3>
        <p>{futureLeaderboardCopy[activeLeaderboard][1]}</p>
        {activeLeaderboard === "tcg" && <Link className="quiet-button" href="/worlds/2026/tcg">See the TCG source audit</Link>}
      </div>}
    </section>
  </main>;
}
