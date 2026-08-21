"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { pickHomepageAdp, pickHomepageLeague, sampleUnique } from "../lib/homepageDiscovery";
import { trackActivationEvent } from "../lib/activationAnalytics";
import { loadPokemonArtwork, pokemonArtworkCandidates } from "../lib/pokemonArtwork";
import { POKEMON_DIRECTORY } from "./PokemonDraftLeague";
import { HomepageDailyBracket } from "./DailyCommunityGames";

const DEX_POOL = [...new Map(POKEMON_DIRECTORY
  .filter((pokemon) => Number(pokemon.id) >= 1 && Number(pokemon.id) <= 1025 && !pokemon.isMega)
  .map((pokemon) => [pokemon.id, pokemon])).values()];

function Artwork({ name, className = "" }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    loadPokemonArtwork(name).then((url) => { if (active) setImage(url || ""); });
    return () => { active = false; };
  }, [name]);
  return image ? <img className={className} src={image} alt={name} onError={() => setImage("")} /> : <span className={`${className} public-home-art-placeholder`.trim()} aria-hidden="true" />;
}

function PlayoffIllustration() {
  return <div className="public-home-playoff">
    <svg viewBox="0 0 340 160" role="img" aria-labelledby="home-playoff-title home-playoff-desc">
      <title id="home-playoff-title">Eight-team playoff bracket</title>
      <desc id="home-playoff-desc">Eight teams advance through four quarterfinals, two semifinals, and one final to crown a champion.</desc>
      <g aria-hidden="true">
        <path className="public-home-playoff-line" d="M18 10H46V20H73M18 30H46V20M18 50H46V60H73M18 70H46V60M18 90H46V100H73M18 110H46V100M18 130H46V140H73M18 150H46V140M85 20H116V40H151M85 60H116V40M85 100H116V120H151M85 140H116V120M163 40H194V80H229M163 120H194V80M241 80H273" />
        {[10,30,50,70,90,110,130,150].map((cy) => <circle className="public-home-playoff-seed" cx="12" cy={cy} r="5" key={cy} />)}
        {[20,60,100,140].map((cy) => <circle className="public-home-playoff-advance" cx="79" cy={cy} r="6" key={cy} />)}
        <circle className="public-home-playoff-seed" cx="157" cy="40" r="6" /><circle className="public-home-playoff-seed" cx="157" cy="120" r="6" />
        <circle className="public-home-playoff-advance" cx="235" cy="80" r="7" />
        <path className="public-home-playoff-crown" d="M277 83l4-27 13 13 14-20 14 20 13-13 4 27z" />
        <rect className="public-home-playoff-base" x="278" y="87" width="60" height="8" rx="4" />
      </g>
    </svg>
  </div>;
}

function PokedexPicks() {
  const [picks, setPicks] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => {
    let active = true;
    const selected = sampleUnique(DEX_POOL, 3);
    setPicks(selected.map((pokemon) => ({ ...pokemon, dexId: null, entry: "", game: "" })));
    Promise.all(selected.map(async (pokemon) => {
      try {
        const speciesSlug = pokemonArtworkCandidates(pokemon.name)[0];
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(speciesSlug)}`);
        if (!response.ok) return pokemon;
        const species = await response.json();
        const entries = (species.flavor_text_entries || []).filter((entry) => entry.language?.name === "en");
        const entry = entries[Math.floor(Math.random() * entries.length)];
        return { ...pokemon, dexId: species.id || null, entry: entry?.flavor_text?.replace(/[\n\f]/g, " ") || "", game: entry?.version?.name?.replace(/-/g, " ") || "" };
      } catch { return pokemon; }
    })).then((loaded) => { if (active) setPicks(loaded); });
    return () => { active = false; };
  }, []);
  const selected = picks[selectedIndex] || null;
  const profileSlug = selected ? pokemonArtworkCandidates(selected.name)[0] : "";
  return <article className="public-home-card public-home-dex-card">
    <span className="public-home-label">Pokédex Picks</span><h3>Meet someone new</h3>
    <p>Three random Pokémon each visit. Pick one for a quick Pokédex entry.</p>
    <div className="public-home-dex-choices" aria-label="Choose a featured Pokémon">
      {picks.length ? picks.map((pokemon, index) => <button type="button" aria-pressed={selectedIndex === index} onClick={() => setSelectedIndex(index)} key={`${pokemon.id}-${pokemon.name}`}><Artwork name={pokemon.name} /><span>{pokemon.name}</span></button>) : [0,1,2].map((index) => <span className="public-home-dex-choice-loading" aria-hidden="true" key={index} />)}
    </div>
    {selected ? <div className="public-home-dex-entry" aria-live="polite"><Artwork name={selected.name} /><div><strong>{selected.name}</strong><small>{selected.dexId ? `#${String(selected.dexId).padStart(4, "0")}` : "Pokédex entry"}{selected.game ? ` · ${selected.game}` : ""}</small><p>{selected.entry || "Open the full profile for its reviewed Pokédex details, stats, and move pool."}</p></div></div> : <div className="public-home-card-loading">Choosing three Pokémon…</div>}
    <a className="public-home-card-link" href={profileSlug ? `/pokemon/${profileSlug}` : "/pokemon"}>Open the Pokédex →</a>
  </article>;
}

function WorldsCard() {
  return <article className="public-home-card public-home-worlds-card"><span className="public-home-label">Worlds 2026</span><h3>Pick your ten</h3><p>Build your Worlds squad, lock it in, and see how your picks stack up.</p><div className="public-home-worlds-art" aria-label="Featured World Championship Pokémon"><Artwork name="Dragonite" /><Artwork name="Garchomp" /><Artwork name="Incineroar" /></div><a className="public-home-card-link" href="/worlds/2026">Make your Worlds picks →</a></article>;
}

function PublicDiscoveryCards() {
  const [data, setData] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const [adp, setAdp] = useState(null);
  const [league, setLeague] = useState(null);
  useEffect(() => {
    let active = true;
    createClient().rpc("get_public_explore").then(({ data: next, error }) => {
      if (!active) return;
      if (error) { setFailed(true); setData(null); return; }
      setData(next || {});
      setAdp(pickHomepageAdp(next?.adp));
      setLeague(pickHomepageLeague(next?.leagues));
    });
    return () => { active = false; };
  }, []);
  const sample = Number(adp?.eligible_drafts || adp?.drafts || 0);
  return <>
    <article className="public-home-card"><span className="public-home-label">Community Draft Pulse</span><h3>Who’s going early?</h3><p>Real DraftCenter drafts with the eligible sample shown every time.</p>{adp ? <div className="public-home-pulse"><Artwork name={adp.pokemon} /><div><strong>{adp.pokemon}</strong><b>ADP {Number(adp.average_pick).toFixed(1)}</b><span>Selected in {adp.drafts} of at least {sample} eligible draft{sample === 1 ? "" : "s"}</span></div></div> : <div className="public-home-card-loading">{data === undefined ? "Loading real draft data…" : "No eligible completed drafts yet."}</div>}<a className="public-home-card-link" href="/explore">See all draft data →</a></article>
    <article className="public-home-card"><span className="public-home-label">League Spotlight</span><h3>Watch a real season</h3><p>Open the board, standings, replays, and predictions. No roster spot needed.</p>{league ? <div className="public-home-league"><i aria-hidden="true" /><div><strong>{league.name}</strong><span>{league.description || league.season_label || "Public DraftCenter league"}</span></div></div> : <div className="public-home-card-loading">{data === undefined ? "Finding a public league…" : failed ? "Public leagues are temporarily unavailable." : "No public league is featured right now."}</div>}<a className="public-home-card-link" href={league ? `/league/${league.slug}` : "/leagues"}>{league ? "Open this league →" : "Browse public leagues →"}</a></article>
  </>;
}

export default function PublicHomePage({ authState = "loading", memberAccess, onCreateLeague }) {
  const createLeague = () => {
    try { localStorage.setItem("draftcenter:commissioner-intent:v1", "league"); } catch {}
    trackActivationEvent("commissioner_path_started", { properties: { source: "home", practice: "no" } });
    onCreateLeague?.();
  };
  return <main className="public-home">
    <section className="public-home-hero"><div className="public-home-shell public-home-hero-grid"><div className="public-home-copy"><span className="public-home-kicker">Pokémon draft leagues, all in one place</span><h1>Draft Together. <span>Battle Together.</span></h1><p>Set up your league, draft, set schedules, make trades, battle, and become Champion—all in one place.</p><div className="public-home-actions"><button type="button" className="primary-button" onClick={createLeague}>Create a league</button><a className="secondary-button" href="/leagues">Watch a league</a></div><div className="public-home-guest-note"><i aria-hidden="true" /><span>Just looking? Play today’s bracket or browse a public league.</span></div></div><HomepageDailyBracket /></div></section>
    <section className="public-home-discovery"><div className="public-home-shell"><h2 className="sr-only">Explore DraftCenter</h2><div className="public-home-grid"><PokedexPicks /><WorldsCard /><PublicDiscoveryCards /><article className="public-home-card public-home-team-lab"><div><span className="public-home-label">Team Lab</span><h3>Build for your next battle</h3><p>Pick your six, paste a team, and check the matchup before battle night. Great for Closed Team Sheet.</p></div><div className="public-home-team-lab-action"><div aria-hidden="true">{[1,2,3,4,5,6].map((number) => <span key={number}>{number}</span>)}</div><a className="public-home-card-link" href="/my-teams">Open Team Lab →</a></div></article></div></div></section>
    <section className="public-home-season"><div className="public-home-shell"><div className="public-home-section-heading"><div><span className="public-home-label">Your whole season</span><h2>One place from first pick to final.</h2></div><p>No bouncing between spreadsheets, chat, and five different tools.</p></div><div className="public-home-season-steps" role="list" aria-label="DraftCenter season workflow"><div role="listitem"><b>Start the league</b><span>Choose the format, draft style, and rules.</span></div><div role="listitem"><b>Bring in coaches</b><span>Share one link. Everyone claims a team.</span></div><div role="listitem"><b>Make the picks</b><span>Run a Snake or Auction Draft live, queue ahead, or take it slow.</span></div><div role="listitem"><b>Play and trade</b><span>Keep the schedule, results, rosters, and standings together.</span></div><div className="public-home-season-finale" role="listitem"><div><b>Crown the champ</b><span>Run the playoffs and save the season for good.</span></div><PlayoffIllustration /></div></div></div></section>
    <section className="public-home-member"><div className="public-home-shell"><div className="public-home-member-copy"><span className="public-home-label">Keep your season moving</span><h2>{authState === "loading" ? "Your DraftCenter is one sign-in away." : "Come back for the next pick."}</h2><p>Create a free account to run a league, keep private Team Lab plans, save Mega Brackets, and return to your work on any device.</p></div>{memberAccess}</div></section>
  </main>;
}
