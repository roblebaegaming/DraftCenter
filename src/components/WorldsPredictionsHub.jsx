"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { WORLDS_PICK_DISCIPLINES } from "../lib/worldsFutureSetup";
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
  go: ["Pokémon GO leaderboard", "The individual entry unit is verified. Standings stay closed while the 220-slot CP base, direct invites, and separate regional programs are reconciled."],
  unite: ["Pokémon UNITE leaderboard", "The team entry unit and 15 qualification awards are modeled. Standings stay closed until the final registered teams and Worlds groups are published."],
};

export default function WorldsPredictionsHub() {
  const [activeLeaderboard, setActiveLeaderboard] = useState("overall");
  const [disciplineHubs, setDisciplineHubs] = useState({});
  const [overall, setOverall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function load() {
      const disciplineKeys = ["vgc", "tcg", "go"];
      const [disciplineResults, overallResult] = await Promise.all([
        Promise.all(disciplineKeys.map(async (key) => {
          const eventId = WORLDS_PICK_DISCIPLINES[key].eventId;
          const [hub, results] = await Promise.all([
            supabase.rpc("get_worlds_pick_hub", { p_event_id: eventId }),
            supabase.rpc("get_worlds_result_status", { p_event_id: eventId }),
          ]);
          return [key, hub.data ? { ...hub.data, results: results.error ? { status: "waiting", is_stale: false } : results.data } : null];
        })),
        supabase.rpc("get_worlds_overall_leaderboard"),
      ]);
      if (!active) return;
      setDisciplineHubs(Object.fromEntries(disciplineResults));
      setOverall(overallResult.error ? null : overallResult.data);
      setLoading(false);
    }
    load();
    const refresh = setInterval(load, 120_000);
    return () => { active = false; clearInterval(refresh); };
  }, []);

  const activeHub = disciplineHubs[activeLeaderboard];
  const activeConfig = WORLDS_PICK_DISCIPLINES[activeLeaderboard];

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
          <p>Choose 10 VGC Masters invitees and name Your Champion, whose placement points count twice. Entries lock at midnight Pacific when Worlds begins.</p>
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
          <p>Play Pick 10 now, then fill a complete Top Cut bracket once the reviewed official pairings are announced.</p>
          <strong>Make VGC picks →</strong>
        </Link>
        <Link className="worlds-competition-card is-building is-tcg" href="/worlds/2026/tcg">
          <span className="worlds-status-pill">In build</span>
          <small>POKÉMON TRADING CARD GAME</small>
          <h3>TCG Masters</h3>
          <p>Scoring is set. The complete Masters invite roster is being reconciled before picks can open.</p>
          <strong>See TCG progress →</strong>
        </Link>
        <Link className="worlds-competition-card is-building is-go" href="/worlds/2026/go">
          <span className="worlds-status-pill">Source audit</span>
          <small>MOBILE BATTLES</small>
          <h3>Pokémon GO</h3>
          <p>The individual Pick 10 format is set, and 220 Championship Point slots are verified. Direct invites and regional programs still need a complete roster audit.</p>
          <strong>See GO progress →</strong>
        </Link>
        <Link className="worlds-competition-card is-building is-unite" href="/worlds/2026/unite">
          <span className="worlds-status-pill">Source audit</span>
          <small>TEAM COMPETITION</small>
          <h3>Pokémon UNITE</h3>
          <p>Fifteen qualification awards are modeled around 5-on-5 teams. The final roster and official Worlds groups remain unpublished.</p>
          <strong>See UNITE progress →</strong>
        </Link>
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

      {activeLeaderboard === "overall" ? overall?.is_open ? <div className="worlds-discipline-leaderboard worlds-overall-leaderboard" role="tabpanel">
        <header><div><span className="eyebrow">OVERALL WORLDS</span><h3>{overall.standings?.length || 0} competitors</h3></div><strong>{overall.discipline_count} scored disciplines</strong></header>
        {overall.standings?.length ? <ol>{overall.standings.map((entry, index) => <li key={`${entry.display_name}-${index}`} className={entry.is_me ? "is-me" : ""}>
          <span>#{entry.rank}</span><strong>{entry.display_name}</strong><b>{Number(entry.overall_points).toFixed(1)} pts</b>
        </li>)}</ol> : <p className="worlds-empty-state">Official discipline scores are ready, but no combined entries have scored yet.</p>}
      </div> : <div className="worlds-overall-panel" role="tabpanel">
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
      </div> : activeHub && activeHub.event?.status !== "draft" ? <div className="worlds-discipline-leaderboard" role="tabpanel">
        <header><div><span className="eyebrow">{activeConfig.gameLabel.toUpperCase()} {activeConfig.division.toUpperCase()}</span><h3>{activeHub.entry_count || 0} entries</h3></div><Link href={`/worlds/2026/${activeLeaderboard}#pick-ten`}>Make my {activeConfig.gameLabel} picks →</Link></header>
        <div className={`worlds-live-result-status is-${activeHub.results?.status || "waiting"}${activeHub.results?.is_stale ? " is-stale" : ""}`} role="status">
          <div><strong>{activeHub.results?.status === "final" ? "Final" : activeHub.results?.status === "provisional" ? activeHub.results.is_stale ? "Live — provisional · updates delayed" : "Live — provisional" : "Waiting for live results"}</strong><span>{activeHub.results?.status === "provisional" ? "Live standings are unofficial until the owner verifies an official result." : activeHub.results?.status === "final" ? "Official results are verified and locked." : `The ${activeConfig.gameLabel} leaderboard will score from reviewed standings.`}</span></div>
          {activeHub.results?.source_url && <div>{activeHub.results.last_successful_update && <small>Updated {new Date(activeHub.results.last_successful_update).toLocaleString()}</small>}<a href={activeHub.results.source_url} target="_blank" rel="noreferrer">{activeHub.results.source_name || "Results source"} ↗</a></div>}
        </div>
        {loading ? <p className="worlds-empty-state">Loading the {activeConfig.gameLabel} community field…</p> : activeHub.standings?.length ? <ol>
          {activeHub.standings.map((entry, index) => <li key={`${entry.display_name}-${index}`}><span>#{entry.rank}</span><strong>{entry.display_name}</strong><b>{entry.score} pts</b></li>)}
        </ol> : <p className="worlds-empty-state">Be the first DraftCenter member to save a {activeConfig.gameLabel} Pick 10 entry.</p>}
      </div> : <div className="worlds-future-leaderboard" role="tabpanel">
        <span className="eyebrow">{activeHub?.event?.status === "draft" ? "STAGED · ENTRIES CLOSED" : activeLeaderboard === "tcg" ? "IN BUILD" : "PLANNED"}</span>
        <h3>{futureLeaderboardCopy[activeLeaderboard][0]}</h3>
        <p>{futureLeaderboardCopy[activeLeaderboard][1]}</p>
        {activeLeaderboard === "tcg" && <Link className="quiet-button" href="/worlds/2026/tcg">See the TCG source audit</Link>}
        {activeLeaderboard === "go" && <Link className="quiet-button" href="/worlds/2026/go">See the GO source audit</Link>}
        {activeLeaderboard === "unite" && <Link className="quiet-button" href="/worlds/2026/unite">See the UNITE source audit</Link>}
      </div>}
    </section>
  </main>;
}
