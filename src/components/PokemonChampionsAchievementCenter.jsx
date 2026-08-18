"use client";

import { useEffect, useMemo, useState } from "react";
import { pokedexArtworkUrl } from "../lib/pokedexTracker";
import {
  championsAchievementState,
  championsAchievementSummary,
  championsPokemonState,
  normalizeChampionsProgress,
  POKEMON_CHAMPIONS_ACHIEVEMENT_SOURCE,
  POKEMON_CHAMPIONS_POKEMON,
  POKEMON_CHAMPIONS_TRAINER_ACHIEVEMENTS,
} from "../lib/pokemonChampionsAchievements";

function ProgressBar({ percentage }) {
  return <span className="dex-champions-progress" aria-hidden="true"><i style={{ width: `${percentage}%` }} /></span>;
}

function RewardList({ rewards }) {
  if (!rewards.length) return <small>VP and item rewards may also apply in-game.</small>;
  return <ul>{rewards.map((reward) => <li key={reward}>{/badge$/i.test(reward) ? "◉" : "★"} {reward}</li>)}</ul>;
}

function TrainerAchievementCard({ definition, value, busy, onSave }) {
  const [draft, setDraft] = useState(String(value || 0));
  useEffect(() => setDraft(String(value || 0)), [value]);
  const state = championsAchievementState(definition, value);
  const earned = state.completed.flatMap((entry) => entry.rewards);
  return <article className="dex-champions-achievement">
    <header><div><span>{definition.category}</span><h4>{definition.name}</h4><p>{definition.description}</p></div><label>Current<input type="number" min="0" max="10000000" inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { const next = Math.max(0, Math.trunc(Number(draft) || 0)); setDraft(String(next)); if (next !== state.progress) void onSave(next); }} disabled={busy} /></label></header>
    <ProgressBar percentage={state.percentage} />
    <div className="dex-champions-milestones">{definition.milestones.map((entry) => <span key={entry.value} className={state.progress >= entry.value ? "is-earned" : ""}><b>{entry.value.toLocaleString()}</b>{state.progress >= entry.value ? " ✓" : ""}</span>)}</div>
    <RewardList rewards={earned} />
    {state.next && <p className="dex-champions-next"><b>{Math.max(0, state.next.value - state.progress).toLocaleString()}</b> to the next milestone{state.next.rewards.length ? `: ${state.next.rewards.join(" · ")}` : ""}.</p>}
  </article>;
}

function PokemonMasteryCard({ pokemon, value, busy, onSave }) {
  const [draft, setDraft] = useState(String(value || 0));
  useEffect(() => setDraft(String(value || 0)), [value]);
  const state = championsPokemonState(pokemon, value);
  return <article className={`dex-champions-pokemon ${state.progress >= 100 ? "is-mastered" : ""}`}>
    <img src={pokedexArtworkUrl(pokemon.pokemonId)} alt="" loading="lazy" />
    <div><span>#{String(pokemon.pokemonId).padStart(3, "0")}</span><h4>{pokemon.name}</h4><small>{state.progress >= 100 ? "Professor + Gold Badge" : state.progress >= 50 ? "Tamer + Silver Badge" : state.progress >= 10 ? "Admirer title earned" : "No title earned yet"}</small></div>
    <label>Wins<input type="number" min="0" max="100000" inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { const next = Math.max(0, Math.trunc(Number(draft) || 0)); setDraft(String(next)); if (next !== state.progress) void onSave(next); }} disabled={busy} /></label>
    <ProgressBar percentage={state.percentage} />
    <div className="dex-champions-pokemon-rewards">{[10,50,100].map((threshold) => <span key={threshold} className={state.progress >= threshold ? "is-earned" : ""}>{threshold}{state.progress >= threshold ? " ✓" : ""}</span>)}</div>
  </article>;
}

export default function PokemonChampionsAchievementCenter({ supabase }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(() => normalizeChampionsProgress(null));
  const [tab, setTab] = useState("trainer");
  const [query, setQuery] = useState("");
  const [pokemonFilter, setPokemonFilter] = useState("all");
  const summary = useMemo(() => championsAchievementSummary(progress), [progress]);
  const visiblePokemon = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return POKEMON_CHAMPIONS_POKEMON.filter((pokemon) => {
      const wins = Number(progress.pokemonWins[pokemon.pokemonId] || 0);
      if (pokemonFilter === "started" && wins <= 0) return false;
      if (pokemonFilter === "mastered" && wins < 100) return false;
      return !needle || pokemon.name.toLocaleLowerCase().includes(needle) || String(pokemon.pokemonId).includes(needle);
    });
  }, [pokemonFilter, progress.pokemonWins, query]);

  async function openCenter() {
    setOpen(true);
    if (loaded || loading) return;
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.rpc("get_my_pokedex_champions_progress");
    setLoading(false);
    if (loadError) { setError(loadError.message || "Your Champions achievements could not be loaded."); return; }
    setProgress(normalizeChampionsProgress(data));
    setLoaded(true);
  }

  async function saveAchievement(key, value) {
    const previous = progress.achievementProgress[key] || 0;
    setProgress((current) => ({ ...current, achievementProgress: { ...current.achievementProgress, [key]: value } }));
    setBusyKey(`achievement:${key}`);
    setError("");
    const { data, error: saveError } = await supabase.rpc("set_my_pokedex_champions_achievement_progress", { p_achievement_key: key, p_progress: value });
    setBusyKey("");
    if (saveError) {
      setProgress((current) => ({ ...current, achievementProgress: { ...current.achievementProgress, [key]: previous } }));
      setError(saveError.message || "That achievement progress could not be saved.");
    } else setProgress(normalizeChampionsProgress(data));
  }

  async function savePokemon(pokemonId, wins) {
    const previous = progress.pokemonWins[pokemonId] || 0;
    setProgress((current) => ({ ...current, pokemonWins: { ...current.pokemonWins, [pokemonId]: wins } }));
    setBusyKey(`pokemon:${pokemonId}`);
    setError("");
    const { data, error: saveError } = await supabase.rpc("set_my_pokedex_champions_pokemon_wins", { p_pokemon_id: pokemonId, p_wins: wins });
    setBusyKey("");
    if (saveError) {
      setProgress((current) => ({ ...current, pokemonWins: { ...current.pokemonWins, [pokemonId]: previous } }));
      setError(saveError.message || "That Pokémon mastery progress could not be saved.");
    } else setProgress(normalizeChampionsProgress(data));
  }

  return <section className={`dex-champions-center ${open ? "is-open" : ""}`} id="pokemon-champions-achievements" aria-labelledby="dex-champions-title">
    <header className="dex-champions-launch">
      <div><span className="dex-kicker">POKÉMON CHAMPIONS</span><h2 id="dex-champions-title">Trainer achievements and Pokémon mastery</h2><p>Track every Trainer Achievement plus the Admirer, Tamer, Professor, Silver Badge, and Gold Badge milestones for all 208 eligible Pokémon.</p></div>
      <button type="button" className="dex-primary-button" onClick={() => open ? setOpen(false) : void openCenter()}>{open ? "Close Champions" : "Open Champions tracker"}</button>
    </header>
    {open && <div className="dex-champions-body">
      {loading ? <p className="dex-champions-loading">Loading your private Champions progress…</p> : <>
        <div className="dex-champions-summary" aria-label="Pokémon Champions achievement summary">
          <article><strong>{summary.trainerMilestones}</strong><span>trainer milestones</span></article><article><strong>{summary.titles}</strong><span>titles earned</span></article><article><strong>{summary.badges}</strong><span>badges earned</span></article><article><strong>{summary.pokemonStarted}</strong><span>Pokémon started</span></article><article><strong>{summary.pokemonMastered}</strong><span>Pokémon mastered</span></article>
        </div>
        <nav className="dex-champions-tabs" role="tablist" aria-label="Pokémon Champions tracker sections"><button type="button" role="tab" aria-selected={tab === "trainer"} onClick={() => setTab("trainer")}>Trainer achievements</button><button type="button" role="tab" aria-selected={tab === "pokemon"} onClick={() => setTab("pokemon")}>Pokémon titles & badges</button></nav>
        {error && <p className="dex-collector-error" role="alert">{error}</p>}
        {tab === "trainer" && <section className="dex-champions-trainer-grid" aria-label="Trainer achievements">{POKEMON_CHAMPIONS_TRAINER_ACHIEVEMENTS.map((definition) => <TrainerAchievementCard key={definition.key} definition={definition} value={progress.achievementProgress[definition.key] || 0} busy={Boolean(busyKey)} onSave={(value) => saveAchievement(definition.key, value)} />)}</section>}
        {tab === "pokemon" && <section className="dex-champions-pokemon-section">
          <div className="dex-champions-controls"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 208 eligible Pokémon…" /></label><div>{["all","started","mastered"].map((value) => <button type="button" key={value} className={pokemonFilter === value ? "is-active" : ""} onClick={() => setPokemonFilter(value)}>{value === "all" ? "All" : value === "started" ? "Started" : "Mastered"}</button>)}</div><span>{visiblePokemon.length} shown</span></div>
          <div className="dex-champions-pokemon-grid">{visiblePokemon.map((pokemon) => <PokemonMasteryCard key={pokemon.pokemonId} pokemon={pokemon} value={progress.pokemonWins[pokemon.pokemonId] || 0} busy={Boolean(busyKey)} onSave={(wins) => savePokemon(pokemon.pokemonId, wins)} />)}</div>
        </section>}
        <footer className="dex-champions-source"><p>Progress is private to your DraftCenter account. Numbers are a reviewed snapshot from {POKEMON_CHAMPIONS_ACHIEVEMENT_SOURCE.reviewedAt}; titles and badges unlock automatically from the achievement totals you enter.</p><div><a href={POKEMON_CHAMPIONS_ACHIEVEMENT_SOURCE.achievements} target="_blank" rel="noreferrer">Achievement reference</a><a href={POKEMON_CHAMPIONS_ACHIEVEMENT_SOURCE.roster} target="_blank" rel="noreferrer">Eligible Pokémon reference</a></div></footer>
      </>}
    </div>}
  </section>;
}
