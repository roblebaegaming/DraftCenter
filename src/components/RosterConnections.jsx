"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPokemonArtwork } from "./LeagueHub";

const CONNECTION_GROUPS = [
  { title: "Pseudo-legendary Pokémon", note: "Three-stage powerhouses with a 600 base-stat total", pokemon: ["Dragonite", "Tyranitar", "Metagross", "Garchomp"] },
  { title: "Prankster utility", note: "Draft support Pokémon known for priority status moves", pokemon: ["Grimmsnarl", "Whimsicott", "Klefki", "Sableye"] },
  { title: "Regenerator pivots", note: "Defensive pivots that heal when switching out", pokemon: ["Slowking", "Tornadus", "Toxapex", "Tangrowth"] },
  { title: "Automatic weather setters", note: "Abilities summon weather when these Pokémon enter battle", pokemon: ["Pelipper", "Torkoal", "Hippowdon", "Politoed"] },
  { title: "Intimidate staples", note: "Common draft picks that lower the opponent’s Attack on entry", pokemon: ["Incineroar", "Landorus-Therian", "Gyarados", "Arcanine"] },
  { title: "Magic Guard users", note: "Ignore indirect damage through Magic Guard", pokemon: ["Clefable", "Reuniclus", "Alakazam", "Sigilyph"] },
  { title: "Rapid Spin users", note: "Can clear entry hazards while boosting Speed", pokemon: ["Great Tusk", "Excadrill", "Iron Treads", "Starmie"] },
  { title: "Unaware walls", note: "Can ignore an opponent’s stat boosts", pokemon: ["Dondozo", "Skeledirge", "Clodsire", "Quagsire"] },
  { title: "Eeveelutions", note: "Evolutions of Eevee", pokemon: ["Vaporeon", "Jolteon", "Flareon", "Umbreon"] },
  { title: "Guardian deities", note: "The four island guardians of Alola", pokemon: ["Tapu Koko", "Tapu Lele", "Tapu Bulu", "Tapu Fini"] },
  { title: "Ultra Beasts", note: "Pokémon that arrived through Ultra Wormholes", pokemon: ["Nihilego", "Buzzwole", "Pheromosa", "Celesteela"] },
  { title: "Trick Room setters", note: "Slow-team staples that commonly establish Trick Room", pokemon: ["Cresselia", "Porygon2", "Hatterene", "Indeedee-Female"] },
];

const GROUP_COLORS = ["yellow", "green", "blue", "purple"];
const GROUP_MARKS = ["🟨", "🟩", "🟦", "🟪"];

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seededShuffle(items, seed) {
  const shuffled = [...items];
  let state = seed || 1;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function rosterConnectionsPuzzle(dateKey = localDateKey()) {
  const groups = seededShuffle(CONNECTION_GROUPS, hash(`groups-${dateKey}`)).slice(0, 4);
  return {
    dateKey,
    groups,
    pokemon: seededShuffle(groups.flatMap((group) => group.pokemon), hash(`pokemon-${dateKey}`)),
  };
}

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

export default function RosterConnections() {
  const puzzle = useMemo(() => rosterConnectionsPuzzle(), []);
  const storageKey = `draftcenter-roster-connections-${puzzle.dateKey}`;
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [order, setOrder] = useState(puzzle.pokemon);
  const [message, setMessage] = useState("Find four Pokémon that share a connection.");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        setSolved(Array.isArray(saved.solved) ? saved.solved : []);
        setMistakes(Number(saved.mistakes) || 0);
        if (Array.isArray(saved.order) && saved.order.length === 16) setOrder(saved.order);
      }
    } catch {}
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify({ solved, mistakes, order }));
  }, [mistakes, order, ready, solved, storageKey]);

  const complete = solved.length === 4;
  const failed = mistakes >= 4 && !complete;
  const finished = complete || failed;
  const solvedPokemon = new Set(solved.flatMap((index) => puzzle.groups[index].pokemon));
  const remaining = order.filter((name) => !solvedPokemon.has(name));
  const displayedGroups = finished ? puzzle.groups.map((_, index) => index) : solved;

  function toggle(name) {
    if (finished) return;
    setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : current.length < 4 ? [...current, name] : current);
  }

  function submit() {
    if (selected.length !== 4) return setMessage("Select exactly four Pokémon before submitting.");
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

  async function share() {
    const rows = displayedGroups.map((_, index) => GROUP_MARKS[index].repeat(4));
    const result = `DraftCenter Roster Connections ${puzzle.dateKey}\n${complete ? `Solved with ${mistakes}/4 mistakes` : "Better luck tomorrow"}\n${rows.join("\n")}\nhttps://www.draftcentral.gg/resources/daily-games`;
    if (navigator.share) await navigator.share({ title: "Roster Connections", text: result });
    else { await navigator.clipboard.writeText(result); setMessage("Result copied to your clipboard."); }
  }

  return <section className="roster-connections" aria-labelledby="roster-connections-title">
    <div className="connections-heading"><div><span className="eyebrow">NEW DAILY GAME</span><h2 id="roster-connections-title">Roster Connections</h2><p>Sort 16 Pokémon into four groups connected by draft roles, abilities, types, or strategies.</p></div><div className="connections-mistakes" aria-label={`${4 - mistakes} mistakes remaining`}><span>Mistakes remaining</span><b>{[0, 1, 2, 3].map((index) => <i className={index < 4 - mistakes ? "available" : ""} key={index} />)}</b></div></div>
    <div className="connections-board">
      {displayedGroups.map((groupIndex, index) => { const group = puzzle.groups[groupIndex]; return <article className={`connection-group ${GROUP_COLORS[index]}`} key={group.title}><strong>{group.title}</strong><span>{group.pokemon.join(", ")}</span><small>{group.note}</small></article>; })}
      {!finished && remaining.map((name) => <PokemonTile key={name} name={name} selected={selected.includes(name)} disabled={false} onClick={() => toggle(name)} />)}
    </div>
    <p className="connections-message" role="status">{message}</p>
    <div className="connections-actions">
      {!finished ? <><button type="button" className="quiet-button" disabled={!selected.length} onClick={() => setSelected([])}>Deselect all</button><button type="button" className="quiet-button" onClick={() => { setOrder((current) => seededShuffle(current, Date.now())); setSelected([]); }}>Shuffle</button><button type="button" className="primary-button" disabled={selected.length !== 4} onClick={submit}>Submit group</button></> : <button type="button" className="primary-button" onClick={share}>Share result</button>}
    </div>
  </section>;
}
