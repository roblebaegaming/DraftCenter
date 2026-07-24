"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { loadPokemonArtwork, pokemonArtworkCandidates } from "./LeagueHub";
import DailyCommunityGames from "./DailyCommunityGames";

function localDateKey(date = new Date()) { const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,"0"); const day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}`; }

function pollRows(poll) {
  if (!poll) return [];
  return poll.answer_type === "pokemon"
    ? Object.entries(poll.counts || {}).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    : (poll.options || []).map((option) => ({ label: option.label, count: poll.counts?.[option.key] || 0 })).sort((a, b) => b.count - a.count);
}

function PollPokemonArtwork({ name }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let alive = true;
    loadPokemonArtwork(name).then((next) => { if (alive) setImage(next); });
    return () => { alive = false; };
  }, [name]);
  return image ? <img className="past-poll-pokemon" src={image} alt={name} /> : null;
}

function PokemonRankingArtwork({ name }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let alive = true;
    loadPokemonArtwork(name).then((next) => { if (alive) setImage(next); });
    return () => { alive = false; };
  }, [name]);
  return image ? <img className="community-ranking-pokemon" src={image} alt="" /> : <span className="community-ranking-image-placeholder" aria-hidden="true" />;
}

function PollResults({ poll, showPodium = false, onSelectPokemon }) {
  const rows = pollRows(poll);
  const placedCounts = [...new Set(rows.map((row) => row.count).filter((count) => count > 0))].slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  return <div className={`public-poll-results ${showPodium ? "past-poll-results" : ""}`}>{rows.map((row) => {
    const percent = poll.total_votes ? Math.round(row.count / poll.total_votes * 100) : 0;
    const place = showPodium && poll.answer_type === "pokemon" ? placedCounts.indexOf(row.count) : -1;
    return <div key={row.label} className={place >= 0 ? `poll-podium-row place-${place + 1}` : ""}>
      <div className="poll-result-heading">
        <button type="button" className="poll-result-contender" disabled={poll.answer_type !== "pokemon"} onClick={() => poll.answer_type === "pokemon" && onSelectPokemon?.(row.label)}>
          {place >= 0 && <PollPokemonArtwork name={row.label} />}
          {place >= 0 && <span className="poll-medal" title={`${place + 1}${place === 0 ? "st" : place === 1 ? "nd" : "rd"} place`}>{medals[place]}</span>}
          <strong>{row.label}</strong>
        </button>
        <span>{percent}%</span>
      </div>
      <i><span style={{ width: `${percent}%` }} /></i>
    </div>;
  })}</div>;
}

function Ranking({ title, items, render, empty, onSelectPokemon }) {
  return <section className="explore-card"><h2>{title}</h2>{items?.length ? <ol className="explore-ranking">{items.slice(0, 10).map((item, index) => <li key={`${item.pokemon}-${index}`}><b>{index + 1}</b><button type="button" className="community-pokemon-link" onClick={() => onSelectPokemon(item.pokemon)}><PokemonRankingArtwork name={item.pokemon} />{render(item)}</button></li>)}</ol> : <p className="muted">{empty}</p>}</section>;
}

function CommunityPokemonPreview({ name, onClose }) {
  const [details, setDetails] = useState(null);
  const [fallbackArtwork, setFallbackArtwork] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    setDetails(null);
    setFallbackArtwork("");
    setMessage("");
    loadPokemonArtwork(name).then((image) => { if (alive) setFallbackArtwork(image); });
    (async () => {
      for (const apiName of pokemonArtworkCandidates(name)) {
        try {
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(apiName)}`);
          if (!response.ok) continue;
          const data = await response.json();
          if (alive) setDetails(data);
          return;
        } catch {}
      }
      if (alive) setMessage("This Pokémon's details are unavailable right now.");
    })();
    return () => { alive = false; };
  }, [name]);
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const artwork = details?.sprites?.other?.["official-artwork"]?.front_default || details?.sprites?.front_default || fallbackArtwork;
  return <div className="community-pokemon-modal" role="dialog" aria-modal="true" aria-label={`${name} Pokédex information`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="community-pokemon-preview">
      <button type="button" className="community-preview-close" onClick={onClose} aria-label="Close Pokémon information">×</button>
      {!details && !message && <p className="muted">Loading {name}…</p>}
      {message && <p className="hub-message">{message}</p>}
      {details && <>
        <header>
          {artwork && <img src={artwork} alt={name} />}
          <div><span className="eyebrow">#{String(details.id).padStart(4, "0")}</span><h2>{name}</h2><div className="community-preview-types">{details.types.map(({ type }) => <span key={type.name}>{type.name}</span>)}</div></div>
        </header>
        <div className="community-preview-measurements"><span>Height <strong>{(details.height / 10).toFixed(1)} m</strong></span><span>Weight <strong>{(details.weight / 10).toFixed(1)} kg</strong></span></div>
        <h3>Base stats</h3>
        <div className="community-preview-stats">{details.stats.map(({ base_stat: value, stat }) => <div key={stat.name}><span>{stat.name.replace("special-", "Sp. ").replace("-", " ")}</span><strong>{value}</strong></div>)}</div>
        <h3>Abilities</h3>
        <div className="community-preview-abilities">{details.abilities.map(({ ability, is_hidden }) => <span key={ability.name}>{ability.name.replace(/-/g, " ")}{is_hidden ? " (hidden)" : ""}</span>)}</div>
      </>}
    </section>
  </div>;
}

export default function PublicExplore() {
  const [data, setData] = useState(null);
  const [pollHistory, setPollHistory] = useState([]);
  const [trends, setTrends] = useState(null);
  const [marketTrends, setMarketTrends] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedPokemon, setSelectedPokemon] = useState("");
  useEffect(() => {
    const supabase = createClient();
    const localDate = localDateKey();
    Promise.all([
      supabase.rpc("get_public_explore"),
      supabase.rpc("get_local_daily_poll", { p_local_date: localDate }),
      supabase.rpc("get_local_poll_history", { p_local_date: localDate, p_limit: 12 }),
      supabase.rpc("get_public_draft_trends"),
      supabase.rpc("get_public_market_trends"),
    ]).then(([exploreResult, pollResult, historyResult, trendResult, marketResult]) => {
      if (exploreResult.error) setMessage(exploreResult.error.message);
      else setData({ ...(exploreResult.data || {}), poll: pollResult.error ? exploreResult.data?.poll : pollResult.data });
      if (!historyResult.error) setPollHistory(historyResult.data || []);
      if (!trendResult.error) setTrends(trendResult.data);
      if (!marketResult.error) setMarketTrends(marketResult.data);
    });
  }, []);
  const signedIn = Boolean(data?.signed_in);
  return <main className="explore-shell">
    {selectedPokemon && <CommunityPokemonPreview name={selectedPokemon} onClose={() => setSelectedPokemon("")} />}
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button community-home-link" href="/"><img src="/draftcenter-logo.png" alt="" />DraftCenter Home</a><a className="quiet-button" href="/leagues">Public Leagues</a><a className="quiet-button" href="/pokemon">Pokémon</a></div>
      <span className="eyebrow">EXPLORE DRAFTCENTER</span>
      <h1>Pokémon, leagues, and community trends.</h1>
      <p>{signedIn ? "See what DraftCenter coaches are voting for, favoriting, and drafting." : "Explore public leagues and completed community polls. Create an account to vote, comment, and reveal today's results."}</p>
      <div className="explore-actions"><a className="primary-button" href="/pokemon">Explore Pokémon</a><a className="secondary-button" href="/">{signedIn ? "Your DraftCenter Home" : "Create an account"}</a></div>
    </header>
    {message && <p className="hub-message">{message}</p>}
    {!data && !message && <p className="muted">Loading public DraftCenter data...</p>}
    {data && <div className="explore-grid">
      <section className="explore-card explore-poll">
        <span className="eyebrow">POLL OF THE DAY</span>
        <h2>{data.poll?.question || "Today's poll is on its way."}</h2>
        {data.poll && signedIn && <><p className="muted">{data.poll.total_votes || 0} community vote{data.poll.total_votes === 1 ? "" : "s"}.{data.poll.selected_key ? " Your vote is included." : " Vote from your DraftCenter home."}</p><PollResults poll={data.poll} onSelectPokemon={setSelectedPokemon} /></>}
        {data.poll && !signedIn && <div className="locked-current-poll"><div className="locked-poll-preview" aria-hidden="true"><span /><span /><span /></div><strong>Create an account to reveal today’s answers and percentages.</strong><a className="secondary-button" href="/">Create an account</a></div>}
      </section>
      <DailyCommunityGames signedIn={signedIn} />
      <section className="explore-card">
        <span className="eyebrow">PUBLIC LEAGUES</span><h2>Watch or join a league</h2>
        {data.leagues?.length ? <><div className="public-explore-leagues">{data.leagues.slice(0, 4).map((league) => <article key={league.id}>{league.image_url && <img src={league.image_url} alt="" />}<div><strong>{league.name}</strong><p>{league.description || league.season_label || "Public DraftCenter league"}</p><span>{league.league_visibility === "open" ? "Open to managers" : "Public to watch"}</span><a className="public-league-link" href={`/league/${league.slug}`}>View league →</a></div></article>)}</div><a className="secondary-button public-league-directory-link" href="/leagues">Browse all Public Leagues →</a></> : <p className="muted">No public leagues have been listed yet.</p>}
      </section>
      {pollHistory.length > 0 && <section className="explore-card completed-polls-card"><span className="eyebrow">PAST POLLS</span><h2>Completed community results</h2><div className="completed-poll-list">{pollHistory.map((poll) => <details key={poll.id}><summary><span>{new Date(`${poll.poll_date}T12:00:00`).toLocaleDateString()}</span><strong>{poll.question}</strong></summary><p className="muted">{poll.total_votes} final vote{poll.total_votes === 1 ? "" : "s"}</p><PollResults poll={poll} showPodium onSelectPokemon={setSelectedPokemon} /></details>)}</div></section>}
      <Ranking onSelectPokemon={setSelectedPokemon} title="Most drafted this week" items={trends?.weekly_drafted} empty="Weekly rankings will appear after public non-practice drafts make picks." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.drafts} draft{item.drafts === 1 ? "" : "s"} in the last 7 days</small></span>} />
      <Ranking onSelectPokemon={setSelectedPokemon} title="Biggest risers" items={marketTrends?.risers} empty="Risers appear after two full weeks of public draft activity." render={(item) => <span><strong>{item.pokemon}</strong><small>+{item.change} drafts · {item.current_drafts} this week</small></span>} />
      <Ranking onSelectPokemon={setSelectedPokemon} title="Biggest fallers" items={marketTrends?.fallers} empty="Fallers appear after two full weeks of public draft activity." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.change} drafts · {item.current_drafts} this week</small></span>} />
      <Ranking onSelectPokemon={setSelectedPokemon} title="Highest league win rates" items={trends?.win_rates} empty="Win rates appear after Pokémon teams complete at least two confirmed matches in non-practice leagues." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.win_rate}% · {item.wins}-{item.games - item.wins} across {item.games} matches · anonymous league aggregate</small></span>} />
      <Ranking onSelectPokemon={setSelectedPokemon} title="Community Pokémon popularity" items={data.popularity} empty="Favorite-six rankings will appear as coaches build profile teams." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.favorites} favorite team{item.favorites === 1 ? "" : "s"}</small></span>} />
      <Ranking onSelectPokemon={setSelectedPokemon} title="Community ADP" items={data.adp} empty="ADP begins to form after a snake draft is completed and saved. Archived seasons continue contributing after a draft restart." render={(item) => <span><strong>{item.pokemon}</strong><small>ADP {item.average_pick} · selected in {item.drafts} of at least {item.eligible_drafts || item.drafts} eligible draft{(item.eligible_drafts || item.drafts) === 1 ? "" : "s"}</small></span>} />
    </div>}
  </main>;
}
