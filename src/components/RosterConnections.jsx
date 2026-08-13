"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPokemonArtwork } from "./LeagueHub";
import { CONNECTIONS_URL, normalizeRosterConnectionsSave, pokemonConnectionsShareText, rosterConnectionsPuzzle, seededConnectionsShuffle } from "../lib/rosterConnections";
import { createClient } from "../lib/supabase/client";
import { DailyGameDiscussion } from "./DailyCommunityGames";
import { ShareButton } from "./SocialSharing";

const GROUP_COLORS = ["yellow", "green", "blue", "purple"];

function PokemonTile({ name, selected, disabled, onClick }) {
  const [artwork, setArtwork] = useState("");
  useEffect(() => {
    let alive = true;
    loadPokemonArtwork(name).then((image) => { if (alive) setArtwork(image); }).catch(() => {});
    return () => { alive = false; };
  }, [name]);
  return <button type="button" className={selected ? "connection-tile selected" : "connection-tile"} aria-pressed={selected} disabled={disabled} onClick={onClick}>
    {artwork ? <img src={artwork} alt="" onError={() => setArtwork("")} /> : <span className="connection-art-placeholder" />}
    <strong>{name}</strong>
  </button>;
}

export default function RosterConnections({ signedIn = false }) {
  const puzzle = useMemo(() => rosterConnectionsPuzzle(), []);
  const storageKey = `draftcenter-roster-connections-${puzzle.dateKey}`;
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [order, setOrder] = useState(puzzle.pokemon);
  const [message, setMessage] = useState("Find four Pokémon that share a connection.");
  const [ready, setReady] = useState(false);
  const [discussionGameId, setDiscussionGameId] = useState("");

  const complete = solved.length === 4;
  const failed = mistakes >= 4 && !complete;
  const finished = complete || failed;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        const normalized = normalizeRosterConnectionsSave(saved, puzzle);
        setSolved(normalized.solved);
        setMistakes(normalized.mistakes);
        setGuesses(normalized.guesses);
        setOrder(normalized.order);
      }
    } catch {}
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ solved, mistakes, guesses, order }));
    } catch {}
  }, [guesses, mistakes, order, ready, solved, storageKey]);

  useEffect(() => {
    if (!ready || !finished || !signedIn) {
      if (!signedIn) setDiscussionGameId("");
      return;
    }
    let alive = true;
    const supabase = createClient();
    supabase.rpc("complete_pokemon_connections", {
      p_local_date: puzzle.dateKey,
      p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }).then(({ data, error }) => {
      if (!alive) return;
      if (error) setMessage(error.message);
      else {
        setDiscussionGameId(data?.game_id || "");
        window.dispatchEvent(new CustomEvent("draftcenter:badge-events", { detail: data?.badge_profile?.events || [] }));
      }
    });
    return () => { alive = false; };
  }, [finished, puzzle.dateKey, ready, signedIn]);

  const solvedPokemon = new Set(solved.flatMap((index) => puzzle.groups[index].pokemon));
  const remaining = order.filter((name) => !solvedPokemon.has(name));
  const displayedGroups = finished ? puzzle.groups.map((_, index) => index) : solved;

  function toggle(name) {
    if (finished) return;
    setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : current.length < 4 ? [...current, name] : current);
  }

  function submit() {
    if (selected.length !== 4) return setMessage("Select exactly four Pokémon before submitting.");
    setGuesses((current) => [...current, [...selected]].slice(-8));
    const match = puzzle.groups.findIndex((group) => group.pokemon.every((name) => selected.includes(name)));
    if (match >= 0 && !solved.includes(match)) {
      const next = [...solved, match];
      setSolved(next);
      setSelected([]);
      setMessage(next.length === 4 ? "Perfect roster read—you found every connection!" : "Connection found. Keep building the board.");
      return;
    }
    const closest = Math.max(...puzzle.groups.filter((_, index) => !solved.includes(index)).map((group) => group.pokemon.filter((name) => selected.includes(name)).length));
    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    setMessage(nextMistakes >= 4 ? "That was the final mistake. Here are today’s connections." : closest === 3 ? "One away! Three of these Pokémon belong together." : "Not a group—try a different roster combination.");
  }

  const shareText = pokemonConnectionsShareText({ puzzle, guesses, complete, mistakes });

  return <section className="roster-connections" aria-labelledby="roster-connections-title">
    <div className="connections-heading"><div><span className="eyebrow">DAILY CONNECTIONS GAME</span><h2 id="roster-connections-title">Pokémon Connections</h2><p>Sort 16 Pokémon into four groups connected by strategy, measurements, Pokédex shape, Egg Group, and more.</p></div><div className="connections-mistakes" aria-label={`${4 - mistakes} mistakes remaining`}><span>Mistakes remaining</span><b>{[0, 1, 2, 3].map((index) => <i className={index < 4 - mistakes ? "available" : ""} key={index} />)}</b></div></div>
    <div className="connections-board">
      {displayedGroups.map((groupIndex) => { const group = puzzle.groups[groupIndex]; return <article className={`connection-group ${GROUP_COLORS[groupIndex]}`} key={group.title}><strong>{group.title}</strong><span>{group.pokemon.join(", ")}</span><small>{group.note}</small></article>; })}
      {!finished && remaining.map((name) => <PokemonTile key={name} name={name} selected={selected.includes(name)} disabled={false} onClick={() => toggle(name)} />)}
    </div>
    <p className="connections-message" role="status">{message}</p>
    <div className="connections-actions">
      {!finished ? <><button type="button" className="quiet-button" disabled={!selected.length} onClick={() => setSelected([])}>Deselect all</button><button type="button" className="quiet-button" onClick={() => { setOrder((current) => seededConnectionsShuffle(current, Date.now())); setSelected([]); }}>Shuffle</button><button type="button" className="primary-button" disabled={selected.length !== 4} onClick={submit}>Submit group</button></> : <ShareButton className="primary-button" label="Share result" copiedLabel="Result copied!" title="Pokémon Connections" text={shareText} url={CONNECTIONS_URL} />}
    </div>
    <DailyGameDiscussion type="connections" gameId={discussionGameId} signedIn={signedIn} unlocked={finished} />
  </section>;
}
