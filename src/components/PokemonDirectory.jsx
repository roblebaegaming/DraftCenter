"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { POKEMON_DATA, POKEMON_DIRECTORY, regulationPokemonStatus } from "./PokemonDraftLeague";
import { createClient } from "../lib/supabase/client";

const TYPES = ["bug","dark","dragon","electric","fairy","fighting","fire","flying","ghost","grass","ground","ice","normal","poison","psychic","rock","steel","water"];

// This is deliberately a catalogue, not one blended list. A newer game's
// move data never replaces an older game's record.
const GAME_SOURCES = [
  { key: "pokemon-champions", label: "Pokemon Champions", versionGroups: ["pokemon-champions"], note: "Competitive battle reference", curated: true },
  { key: "legends-za", label: "Pokemon Legends: Z-A", versionGroups: ["legends-za"], note: "Real-time battle rules", curated: true },
  { key: "scarlet-violet", label: "Pokemon Scarlet/Violet", versionGroups: ["scarlet-violet"], note: "Main-series turn-based rules", curated: false },
  { key: "sword-shield", label: "Pokemon Sword/Shield", versionGroups: ["sword-shield"], note: "Main-series turn-based rules", curated: false },
  { key: "brilliant-diamond-shining-pearl", label: "Brilliant Diamond/Shining Pearl", versionGroups: ["brilliant-diamond-and-shining-pearl"], note: "Main-series turn-based rules", curated: false },
  { key: "legends-arceus", label: "Pokemon Legends: Arceus", versionGroups: ["legends-arceus"], note: "Game-specific battle rules", curated: false },
  { key: "sun-moon", label: "Sun/Moon", versionGroups: ["ultra-sun-ultra-moon", "sun-moon"], note: "Main-series turn-based rules", curated: false },
];

const METHOD_LABELS = { "level-up": "Level up", machine: "TM / Machine", egg: "Egg", tutor: "Tutor", "form-change": "Form change", stadium: "Special" };
const MOVE_CATEGORY_LABELS = { physical: "Physical attacks", special: "Special attacks", status: "Status moves", unknown: "Category loading" };
function slug(name) { return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function displayName(value) { return String(value || "").replace(/-/g, " "); }
function formatHeight(decimetres) {
  const metres = Number(decimetres || 0) / 10;
  const inches = metres * 39.3701;
  return `${metres.toFixed(metres < 10 ? 1 : 0)} m (${Math.floor(inches / 12)}′ ${Math.round(inches % 12)}″)`;
}
function formatWeight(hectograms) {
  const kilograms = Number(hectograms || 0) / 10;
  return `${kilograms.toFixed(kilograms < 100 ? 1 : 0)} kg (${(kilograms * 2.20462).toFixed(1)} lb)`;
}

// DraftCenter uses reader-friendly form names, while PokeAPI puts the form
// after the species name (for example, "articuno-galar").  Keep the form's
// own stats, but use the base species for its National Dex number and entries.
const FORM_REFERENCE_OVERRIDES = {
  "basculegion": { apiName: "basculegion-male", speciesName: "basculegion", dexName: "basculegion" },
  "paldean-tauros": { apiName: "tauros-paldea-combat", speciesName: "tauros", dexName: "tauros" },
  "paldean-tauros-water": { apiName: "tauros-paldea-aqua", speciesName: "tauros", dexName: "tauros" },
  "paldean-tauros-fire": { apiName: "tauros-paldea-blaze", speciesName: "tauros", dexName: "tauros" },
  "white-striped-basculin": { apiName: "basculin-white-striped", speciesName: "basculin", dexName: "basculin" },
  "basculegion-female": { apiName: "basculegion-female", speciesName: "basculegion", dexName: "basculegion" },
  "floette-eternal": { apiName: "floette-eternal", speciesName: "floette", dexName: "floette" },
  "calyrex-shadow-rider": { apiName: "calyrex-shadow", speciesName: "calyrex", dexName: "calyrex" },
  "calyrex-ice-rider": { apiName: "calyrex-ice", speciesName: "calyrex", dexName: "calyrex" },
  "primal-groudon": { apiName: "groudon-primal", speciesName: "groudon", dexName: "groudon" },
  "primal-kyogre": { apiName: "kyogre-primal", speciesName: "kyogre", dexName: "kyogre" },
  "meowstic-female": { apiName: "meowstic-female", speciesName: "meowstic", dexName: "meowstic" },
  "indeedee-female": { apiName: "indeedee-female", speciesName: "indeedee", dexName: "indeedee" },
  "ursaluna-bloodmoon": { apiName: "ursaluna-bloodmoon", speciesName: "ursaluna", dexName: "ursaluna" },
  "lycanroc-dusk": { apiName: "lycanroc-dusk", speciesName: "lycanroc", dexName: "lycanroc" },
  "lycanroc-midday": { apiName: "lycanroc-midday", speciesName: "lycanroc", dexName: "lycanroc" },
  "lycanroc-midnight": { apiName: "lycanroc-midnight", speciesName: "lycanroc", dexName: "lycanroc" },
  "rotom-heat": { apiName: "rotom-heat", speciesName: "rotom", dexName: "rotom" },
  "rotom-wash": { apiName: "rotom-wash", speciesName: "rotom", dexName: "rotom" },
  "rotom-frost": { apiName: "rotom-frost", speciesName: "rotom", dexName: "rotom" },
  "rotom-fan": { apiName: "rotom-fan", speciesName: "rotom", dexName: "rotom" },
  "rotom-mow": { apiName: "rotom-mow", speciesName: "rotom", dexName: "rotom" },
};

function pokemonReference(name) {
  const key = slug(name);
  if (FORM_REFERENCE_OVERRIDES[key]) return { ...FORM_REFERENCE_OVERRIDES[key], fallbackApiName: FORM_REFERENCE_OVERRIDES[key].speciesName };
  const regional = key.match(/^(alolan|galarian|hisuian|paldean)-(.+)$/);
  if (regional) {
    const suffix = { alolan: "alola", galarian: "galar", hisuian: "hisui", paldean: "paldea" }[regional[1]];
    return { apiName: `${regional[2]}-${suffix}`, speciesName: regional[2], dexName: regional[2], fallbackApiName: regional[2] };
  }
  const mega = key.match(/^mega-(.+?)(?:-(x|y))?$/);
  if (mega) return { apiName: `${mega[1]}-mega${mega[2] ? `-${mega[2]}` : ""}`, speciesName: mega[1], dexName: mega[1], fallbackApiName: mega[1] };
  return { apiName: key, speciesName: key, dexName: key, fallbackApiName: key };
}

function builtInStatLookup() {
  return Object.fromEntries(POKEMON_DIRECTORY.flatMap((pokemon) => {
    const stats = POKEMON_DATA[pokemon.name]?.stats;
    if (!stats) return [];
    const reference = pokemonReference(pokemon.name);
    return [[reference.apiName, {
      hp: stats.hp,
      attack: stats.atk,
      defense: stats.def,
      "special-attack": stats.spa,
      "special-defense": stats.spd,
      speed: stats.spe,
      bst: stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe,
    }]];
  }));
}

async function fetchPokemonForm(reference) {
  const load = (name) => fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`);
  let response = await load(reference.apiName);
  // The directory asks for several rows at once. PokeAPI occasionally
  // rate-limits a browser burst; retry once so a temporary response does not
  // permanently turn a Pokémon's stat row into an ellipsis.
  if (!response.ok && response.status !== 404) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    response = await load(reference.apiName);
  }
  if (!response.ok && reference.fallbackApiName && reference.fallbackApiName !== reference.apiName) {
    response = await load(reference.fallbackApiName);
  }
  return response;
}

function sourceMoves(details, source, importedMoves) {
  const imported = (importedMoves || []).filter((row) => row.game_key === source.key).map((row) => ({
    name: row.move_name,
    method: row.learn_method || "special",
    level: row.level_learned_at || 0,
    dataVersion: row.data_version,
  }));
  if (imported.length) return imported;
  if (source.curated) return [];
  const byName = new Map();
  (details?.moves || []).forEach(({ move, version_group_details: versionDetails }) => {
    const detail = (versionDetails || []).find((item) => source.versionGroups.includes(item.version_group?.name));
    if (!detail) return;
    byName.set(move.name, { name: move.name, method: detail.move_learn_method?.name || "special", level: detail.level_learned_at || 0 });
  });
  return [...byName.values()].sort((a, b) => a.method.localeCompare(b.method) || a.level - b.level || a.name.localeCompare(b.name));
}

function PokemonPollPlacements({ placements }) {
  const podium = [["first", "1st-place finishes"], ["second", "2nd-place finishes"], ["third", "3rd-place finishes"]];
  if (!placements) return <p className="muted">Loading poll placements…</p>;
  return <div className="pokemon-poll-placements">{podium.map(([key, label]) => <details key={key}><summary><strong>{placements[key]?.count || 0}</strong><span>{label}</span></summary>{placements[key]?.polls?.length ? <ul>{placements[key].polls.map((poll) => <li key={poll.id}><strong>{poll.question}</strong><small>{new Date(`${poll.date}T12:00:00`).toLocaleDateString()} · {poll.votes} vote{poll.votes === 1 ? "" : "s"}</small></li>)}</ul> : <p className="muted">No {label} yet.</p>}</details>)}</div>;
}

function PokemonDailyThreeProfile({ profile }) {
  if (!profile) return <p className="muted">Loading Daily Three highlights…</p>;
  return <div className="pokemon-daily-three-profile">
    <div className="pokemon-daily-three-metrics">
      <article><strong>{profile.bracket_wins || 0}</strong><span>Bracket matchup wins</span><small>{profile.bracket_losses || 0} matchup losses</small></article>
      <article><strong>{profile.bracket_championships || 0}</strong><span>Bracket championships</span><small>Chosen as the final winner</small></article>
      <article><strong>{profile.quiz_popular_finishes || 0}</strong><span>Most-popular quiz answers</span><small>Closed quiz days finishing first</small></article>
    </div>
    {profile.most_defeated?.length > 0 && <details><summary>Most defeated bracket opponents</summary><ol>{profile.most_defeated.map((item)=><li key={item.pokemon}><span>{item.pokemon}</span><b>{item.wins} win{item.wins===1?"":"s"}</b></li>)}</ol></details>}
    {profile.quiz_popular_days?.length > 0 && <details><summary>Most-popular quiz finishes</summary><ul>{profile.quiz_popular_days.map((quiz)=><li key={quiz.id}><strong>{quiz.prompt}</strong><small>{new Date(`${quiz.date}T12:00:00`).toLocaleDateString()} · {quiz.votes} answer{quiz.votes===1?"":"s"}</small></li>)}</ul></details>}
  </div>;
}

function PokemonDraftProfile({ profile }) {
  if (!profile) return <p className="muted">Loading public draft statistics…</p>;
  const hasDrafts = Number(profile.eligible_drafts) > 0;
  const maxUsage = Math.max(1, ...(profile.usage || []).map((item) => item.picks));
  return <div className="pokemon-draft-profile">
    <div className="pokemon-draft-metrics">
      <article><strong>{hasDrafts ? `${profile.draft_rate || 0}%` : "—"}</strong><span>Draft rate</span><small>{profile.drafted_in || 0} of {profile.eligible_drafts || 0} public drafts</small></article>
      <article><strong>{profile.average_pick != null ? `#${profile.average_pick}` : "—"}</strong><span>Eligibility-aware ADP</span><small>Picked in {profile.drafted_in || 0} of {profile.eligible_drafts || 0} legal snake drafts</small></article>
      <article><strong>{profile.average_auction_price ?? "—"}</strong><span>Average auction price</span><small>{profile.auction_samples || 0} auction sample</small></article>
      <article><strong>{profile.games ? `${profile.win_rate || 0}%` : "—"}</strong><span>Team win rate</span><small>{profile.games ? `${profile.wins}-${profile.games - profile.wins} across ${profile.games} matches` : "No confirmed matches yet"}</small></article>
    </div>
    <h4>ADP by legal format</h4>
    {profile.adp_by_format?.length ? <ol className="pokemon-partner-list">{profile.adp_by_format.map((item) => <li key={item.regulation_id}><strong>{displayName(item.regulation_id || "custom")}</strong><span>{item.average_pick != null ? `ADP #${item.average_pick}` : "Not drafted"} · {item.drafted_in || 0} of {item.eligible_drafts || 0} eligible drafts</span></li>)}</ol> : <p className="muted">Format-specific ADP will appear after this Pokémon is included in a completed public snake draft pool.</p>}
    <h4>Most common teammates</h4>
    {profile.partners?.length ? <ol className="pokemon-partner-list">{profile.partners.slice(0, 5).map((item) => <li key={item.pokemon}><strong>{item.pokemon}</strong><span>{item.teams} team{item.teams === 1 ? "" : "s"}</span></li>)}</ol> : <p className="muted">Partner data will appear as public rosters fill.</p>}
    <h4>Draft usage · last 12 weeks</h4>
    {profile.usage?.length ? <div className="pokemon-usage-chart">{profile.usage.map((item) => <div key={item.week} title={`${item.week}: ${item.picks} picks`}><i style={{ height: `${Math.max(8, item.picks / maxUsage * 100)}%` }} /><small>{new Date(`${item.week}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}</small></div>)}</div> : <p className="muted">No public draft picks in the last 12 weeks.</p>}
  </div>;
}

function WidePokemonDirectory(props) {
  const statColumns = [["hp", "HP"], ["attack", "Atk"], ["defense", "Def"], ["special-attack", "SpA"], ["special-defense", "SpD"], ["speed", "Spe"], ["bst", "BST"]];
  const sortLabel = (key, label) => <button type="button" className={props.sortBy === key ? "active" : ""} onClick={() => props.toggleSort(key)}>{label}{props.sortBy === key ? (props.sortDirection === "asc" ? " ↑" : " ↓") : ""}</button>;
  return <main className="pokemon-directory pokemon-directory-wide">
    <header className="pokemon-directory-header"><a href="/?view=dashboard" className="quiet-button pokemon-home-link"><span>← DraftCenter home</span><img src="/draftcenter-logo.png" alt="" /></a><div><span className="eyebrow">POKEMON</span><h1>Explore the Pokedex</h1><p className="muted">A stat-first Pokémon browser. Sort any column, select a Pokémon, and study its full game information on the right.</p></div></header>
    <section className="pokemon-directory-layout">
      <aside className="pokemon-search-card pokemon-browser-card">
        <div className="pokemon-browser-controls"><form className="pokemon-main-search" onSubmit={props.searchPokemon}><label>Search Pokemon or Dex #<input value={props.query} onChange={(event) => props.handlePokemonQueryChange(event.target.value)} placeholder="Pikachu, Garchomp, 681..." autoFocus /></label><button className="quiet-button" type="submit">Search</button></form><label>Type<select value={props.type} onChange={(event) => props.setType(event.target.value)}><option value="">All types</option>{TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Generation<select value={props.generation} onChange={(event) => props.setGeneration(event.target.value)}><option value="">All generations</option>{[1,2,3,4,5,6,7,8,9].map((item) => <option key={item} value={item}>Gen {item}</option>)}</select></label><label>Show<select value={props.resultLimit} onChange={(event) => props.setResultLimit(event.target.value === "all" ? "all" : Number(event.target.value))}><option value={100}>100</option><option value={200}>200</option><option value="all">All</option></select></label><div className="pokemon-size-sort"><span>Sort by size</span><div><button type="button" className={props.sortBy === "height" ? "active" : ""} onClick={() => props.toggleSort("height")}>Height {props.sortBy === "height" ? (props.sortDirection === "asc" ? "↑" : "↓") : "↕"}</button><button type="button" className={props.sortBy === "weight" ? "active" : ""} onClick={() => props.toggleSort("weight")}>Weight {props.sortBy === "weight" ? (props.sortDirection === "asc" ? "↑" : "↓") : "↕"}</button></div><small>{props.dimensionLoadedCount < props.filteredCount ? `Loading measurements ${props.dimensionLoadedCount}/${props.filteredCount}` : "All measurements ready"}</small></div></div>
        <form className="ability-search" onSubmit={props.findAbility}><label>Ability<input value={props.ability} onChange={(event) => props.setAbility(event.target.value)} placeholder="Levitate, Intimidate..." /></label><button className="quiet-button">Filter</button></form>
        <div className="pokemon-browser-summary"><span>{props.results.length} Pokémon shown</span><button className="text-button" onClick={props.clearFilters}>Clear filters</button></div>
        <div className="pokemon-result-list pokemon-stat-browser">
          <div className="pokemon-stat-head">{sortLabel("dex", "Dex")}{sortLabel("name", "Pokemon")}{statColumns.map(([key, label]) => <span key={key}>{sortLabel(key, label)}</span>)}</div>
          {props.results.map((pokemon) => { const reference = pokemonReference(pokemon.name); const stats = props.statLookup[reference.apiName]; const dex = props.dexNumbers[reference.dexName] || props.dexNumbers[reference.apiName]; return <button key={pokemon.name} className={`pokemon-result pokemon-stat-row ${props.selected === pokemon.name ? "selected" : ""}`} onClick={() => props.choose(pokemon.name)}><span>{dex ? `#${String(dex).padStart(4, "0")}` : `G${pokemon.gen || "?"}`}</span><span className="pokemon-row-name"><strong>{pokemon.name}</strong><small>{pokemon.t1}{pokemon.t2 ? ` / ${pokemon.t2}` : ""}</small></span>{statColumns.map(([key]) => <span key={key}>{stats?.[key] ?? (key === "bst" ? pokemon.bst : "…")}</span>)}</button>; })}
        </div>
      </aside>
      <section className="pokemon-detail-card pokemon-detail-wide">
        {!props.selected && <div className="pokemon-empty"><span className="eyebrow">DRAFTCENTER POKEDEX</span><h2>Choose a Pokémon to begin</h2><p>The wider browser on the left can be sorted by every base stat. Select any row to see details, history, and game-specific moves.</p></div>}
        {props.loading && <p className="muted">Loading {props.selected}...</p>}{props.message && <p className="hub-message">{props.message}</p>}
        {props.details && props.species && <>
          <div className="pokemon-title"><img src={props.details.sprites?.other?.["official-artwork"]?.front_default || props.details.sprites?.front_default} alt={props.selected} /><div><span className="eyebrow">#{String(props.species.id || props.details.id).padStart(4, "0")}</span><h2>{props.selected}</h2><p className="muted">{props.species.genera?.find((item) => item.language.name === "en")?.genus || "Pokemon"}</p><p className="muted">Height: {formatHeight(props.details.height)} · Weight: {formatWeight(props.details.weight)}</p><div className="pokemon-types">{props.details.types.map(({ type }) => <span key={type.name}>{type.name}</span>)}</div></div></div>
          {props.regulationStatus && <div className={`pokemon-legality ${props.regulationStatus.legal === true ? "is-legal" : props.regulationStatus.legal === false ? "is-not-legal" : ""}`}><strong>{props.regulationStatus.legal === true ? "Legal in this league's regulation" : props.regulationStatus.legal === false ? "Not eligible in this league's regulation" : "Custom regulation"}</strong><span>{props.regulationStatus.regulation.name}</span><small>League-specific bans and move clauses can still change final legality.</small></div>}
          <div className="pokemon-detail-grid"><section><h3>All base stats</h3><div className="pokemon-stats">{props.details.stats.map((stat) => <div key={stat.stat.name}><span>{displayName(stat.stat.name).replace("special", "Sp.")}</span><strong>{stat.base_stat}</strong></div>)}<div className="pokemon-bst-total"><span>BST</span><strong>{props.details.stats.reduce((sum, stat) => sum + stat.base_stat, 0)}</strong></div></div></section><section><h3>Abilities</h3><div className="pokemon-tags">{props.details.abilities.map(({ ability, is_hidden }) => <span key={ability.name}>{displayName(ability.name)}{is_hidden ? " (hidden)" : ""}</span>)}</div><h3>DraftCenter poll podiums</h3><PokemonPollPlacements placements={props.pollPlacements} /><h3>Daily Three highlights</h3><PokemonDailyThreeProfile profile={props.dailyThreeProfile} /></section></div>
          <section className="pokemon-community-stats"><h3>DraftCenter community statistics</h3><p className="muted">Aggregated from public, non-practice leagues. Percentages always include their current sample size.</p><PokemonDraftProfile profile={props.draftProfile} /></section>
          <section className="pokedex-history"><h3>Pokedex entries</h3>{props.uniqueEntries.length ? <div className="pokedex-entry-list">{props.uniqueEntries.map((entry) => <article key={entry.version.name}><strong>{displayName(entry.version.name)}</strong><p>{entry.flavor_text.replace(/[\n\f]/g, " ")}</p></article>)}</div> : <p className="muted">No English entries are available.</p>}</section>
          <section className="pokemon-moves"><div className="moves-heading"><div><h3>Versioned move pools</h3><p className="muted">The newest verified compatible game is selected first. Switch sources without blending their move data.</p></div>{props.recommendedSource && <span className="move-source-badge">Latest: {props.recommendedSource.label}</span>}</div><div className="move-source-tabs">{props.sourceData.map((source) => <button type="button" key={source.key} className={props.activeSource?.key === source.key ? "active" : ""} disabled={!source.moves.length} onClick={() => { props.setMoveSource(source.key); props.setMoveCategory("all"); props.setSelectedMove(null); }} title={source.moves.length ? source.note : `${source.label} move data has not been imported yet`}>{source.label}{!source.moves.length && " (data not imported yet)"}</button>)}</div>{props.activeSource && <><div className="move-source-note"><strong>{props.activeSource.label}</strong><span>{props.activeSource.note}</span>{props.activeSource.key === "legends-za" && <small>This pool is not automatically legal in a standard turn-based league.</small>}</div><div className="move-controls"><input value={props.moveQuery} onChange={(event) => props.setMoveQuery(event.target.value)} placeholder="Search moves..."/><select value={props.moveCategory} onChange={(event) => props.setMoveCategory(event.target.value)}><option value="all">All move categories</option><option value="physical">Physical attacks</option><option value="special">Special attacks</option><option value="status">Status moves</option></select></div>{props.loadingMoveCategories && <p className="muted">Organizing moves into physical, special, and status categories…</p>}{props.visibleMoves.length ? <div className="move-groups">{Object.entries(props.groupedMoves).map(([category, moves]) => <section key={category}><h4>{MOVE_CATEGORY_LABELS[category] || displayName(category)} <small>{moves.length}</small></h4><div className="move-list">{moves.map((move) => <button type="button" key={`${props.activeSource.key}-${move.name}`} className={props.selectedMove === move.name ? "selected" : ""} onClick={() => props.inspectMove(move.name)}>{displayName(move.name)}<small>{METHOD_LABELS[move.method] || displayName(move.method)}{move.method === "level-up" && move.level ? ` · Lv. ${move.level}` : ""}</small></button>)}</div></section>)}</div> : <p className="muted">No moves in that category are available for this Pokémon in {props.activeSource.label}.</p>}</>}
          {props.selectedMove && <aside className="move-detail"><button className="text-button" onClick={() => props.setSelectedMove(null)}>Close move details</button>{props.loadingMove && <p className="muted">Loading {displayName(props.selectedMove)}...</p>}{props.inspectedMove && <><h4>{displayName(props.selectedMove)}</h4><div><span>Type <b>{props.inspectedMove.type?.name}</b></span><span>Class <b>{props.inspectedMove.damage_class?.name}</b></span><span>Power <b>{props.inspectedMove.power ?? "—"}</b></span><span>Accuracy <b>{props.inspectedMove.accuracy ?? "—"}</b></span><span>PP <b>{props.inspectedMove.pp ?? "—"}</b></span></div><p>{props.inspectedMove.flavor_text_entries?.find((entry) => entry.language.name === "en")?.flavor_text?.replace(/[\n\f]/g, " ") || "No English move description is available."}</p></>}</aside>}
          </section>
        </>}
      </section>
    </section>
  </main>;
}

export default function PokemonDirectory() {
  return <Suspense fallback={<main className="pokemon-directory"><p className="muted">Loading the Pokedex...</p></main>}><PokemonDirectoryContent /></Suspense>;
}

function PokemonDirectoryContent() {
  const searchParams = useSearchParams();
  const regulationId = searchParams.get("regulation") || "";
  const requestedPokemon = searchParams.get("pokemon") || "";
  const [query, setQuery] = useState(""); const [type, setType] = useState(""); const [generation, setGeneration] = useState(""); const [resultLimit, setResultLimit] = useState(100); const [sortBy, setSortBy] = useState("name"); const [sortDirection, setSortDirection] = useState("asc"); const [ability, setAbility] = useState(""); const [abilityMatches, setAbilityMatches] = useState(null); const [dexNumbers, setDexNumbers] = useState({}); const [dexSearchName, setDexSearchName] = useState(""); const [statLookup, setStatLookup] = useState(builtInStatLookup); const [selected, setSelected] = useState(null); const [details, setDetails] = useState(null); const [species, setSpecies] = useState(null); const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  const [importedMoves, setImportedMoves] = useState([]); const [moveSource, setMoveSource] = useState(""); const [moveCategory, setMoveCategory] = useState("all"); const [moveQuery, setMoveQuery] = useState(""); const [selectedMove, setSelectedMove] = useState(null); const [moveDetails, setMoveDetails] = useState({}); const [moveCategories, setMoveCategories] = useState({}); const [loadingMove, setLoadingMove] = useState(false); const [loadingMoveCategories, setLoadingMoveCategories] = useState(false); const [pollPlacements, setPollPlacements] = useState(null); const [dailyThreeProfile, setDailyThreeProfile] = useState(null); const [draftProfile, setDraftProfile] = useState(null);

  useEffect(() => { fetch("https://pokeapi.co/api/v2/pokemon-species?limit=2000").then((response) => response.ok ? response.json() : null).then((data) => { const lookup = {}; (data?.results || []).forEach((item) => { const id = Number(item.url.match(/pokemon-species\/(\d+)\//)?.[1]); if (id) lookup[item.name] = id; }); setDexNumbers(lookup); }).catch(() => {}); }, []);
  useEffect(() => { const term = query.trim().replace(/^#/, ""); if (!/^\d+$/.test(term)) { setDexSearchName(""); return undefined; } let cancelled = false; const timer = window.setTimeout(() => { fetch(`https://pokeapi.co/api/v2/pokemon-species/${Number(term)}`).then((response) => response.ok ? response.json() : null).then((data) => { if (!cancelled) setDexSearchName(data?.name || ""); }).catch(() => { if (!cancelled) setDexSearchName(""); }); }, 150); return () => { cancelled = true; window.clearTimeout(timer); }; }, [query]);
  const filteredPokemon = useMemo(() => POKEMON_DIRECTORY.filter((pokemon) => { const term = query.trim().toLowerCase().replace(/^#/, ""); const reference = pokemonReference(pokemon.name); const dex = dexNumbers[reference.dexName] || dexNumbers[reference.apiName]; const numericMatch = /^\d+$/.test(term) && (String(dex || "").includes(term) || reference.dexName === dexSearchName); const matchName = !term || pokemon.name.toLowerCase().includes(term) || numericMatch; const matchType = !type || pokemon.t1 === type || pokemon.t2 === type; const matchGen = !generation || String(pokemon.gen) === generation; const matchAbility = !abilityMatches || abilityMatches.has(slug(pokemon.name)); return matchName && matchType && matchGen && matchAbility; }), [query, type, generation, abilityMatches, dexNumbers, dexSearchName]);
  useEffect(() => { let cancelled = false; const targets = filteredPokemon.filter((pokemon) => { const cached = statLookup[pokemonReference(pokemon.name).apiName]; return cached === undefined || cached.height === undefined || cached.weight === undefined; }).slice(0, 200); if (!targets.length) return undefined; async function loadOne(pokemon) { const reference = pokemonReference(pokemon.name); const key = reference.apiName; for (let attempt = 0; attempt < 3; attempt += 1) { try { const response = await fetchPokemonForm(reference); if (response.ok) { const data = await response.json(); const stats = Object.fromEntries((data.stats || []).map((entry) => [entry.stat.name, entry.base_stat])); return [key, { hp: stats.hp, attack: stats.attack, defense: stats.defense, "special-attack": stats["special-attack"], "special-defense": stats["special-defense"], speed: stats.speed, bst: Object.values(stats).reduce((sum, value) => sum + value, 0), height: data.height, weight: data.weight }]; } } catch {} if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1))); } return [key, null]; }
    async function loadStats() { const additions = {}; for (let index = 0; index < targets.length; index += 4) { const rows = await Promise.all(targets.slice(index, index + 4).map(loadOne)); rows.forEach(([key, value]) => { if (value) additions[key] = value; }); if (index + 4 < targets.length) await new Promise((resolve) => setTimeout(resolve, 120)); }
      if (!cancelled && Object.keys(additions).length) setStatLookup((current) => ({ ...current, ...additions })); }
    loadStats(); return () => { cancelled = true; }; }, [filteredPokemon, statLookup]);
  const results = useMemo(() => [...filteredPokemon].sort((a, b) => {
    const aReference = pokemonReference(a.name); const bReference = pokemonReference(b.name);
    const aStats = statLookup[aReference.apiName] || {}; const bStats = statLookup[bReference.apiName] || {};
    if (sortBy === "height" || sortBy === "weight") {
      const aValue = aStats[sortBy]; const bValue = bStats[sortBy];
      if (aValue == null && bValue == null) return a.name.localeCompare(b.name);
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return (sortDirection === "asc" ? 1 : -1) * (aValue - bValue) || a.name.localeCompare(b.name);
    }
    let comparison = 0;
    if (sortBy === "dex") comparison = (dexNumbers[aReference.dexName] || dexNumbers[aReference.apiName] || 99999) - (dexNumbers[bReference.dexName] || dexNumbers[bReference.apiName] || 99999);
    else if (sortBy === "generation") comparison = (a.gen || 99) - (b.gen || 99);
    else if (sortBy === "name") comparison = a.name.localeCompare(b.name);
    else comparison = (aStats[sortBy] ?? a.bst ?? -1) - (bStats[sortBy] ?? b.bst ?? -1);
    return (sortDirection === "asc" ? 1 : -1) * comparison || a.name.localeCompare(b.name);
  }).slice(0, resultLimit === "all" ? undefined : resultLimit), [filteredPokemon, statLookup, sortBy, sortDirection, dexNumbers, resultLimit]);
  function toggleSort(column) { if (sortBy === column) setSortDirection((direction) => direction === "asc" ? "desc" : "asc"); else { setSortBy(column); setSortDirection(column === "name" || column === "dex" || column === "generation" || column === "height" || column === "weight" ? "asc" : "desc"); } }
  const dimensionLoadedCount = useMemo(() => filteredPokemon.filter((pokemon) => { const stats = statLookup[pokemonReference(pokemon.name).apiName]; return stats?.height != null && stats?.weight != null; }).length, [filteredPokemon, statLookup]);

  async function findAbility(event) { event.preventDefault(); const value = ability.trim(); if (!value) return setAbilityMatches(null); setMessage("Finding Pokemon with that ability..."); try { const response = await fetch(`https://pokeapi.co/api/v2/ability/${encodeURIComponent(slug(value))}`); if (!response.ok) throw new Error("That ability was not found."); const data = await response.json(); setAbilityMatches(new Set((data.pokemon || []).map((item) => item.pokemon.name))); setMessage(""); } catch (error) { setAbilityMatches(new Set()); setMessage(error.message); } }
  function handlePokemonQueryChange(value) {
    setQuery(value);
    if (message === "That ability was not found.") {
      setAbility("");
      setAbilityMatches(null);
      setMessage("");
    }
  }
  function searchPokemon(event) {
    event.preventDefault();
    setAbility("");
    setAbilityMatches(null);
    setMessage("");
    const term = query.trim().toLowerCase().replace(/^#/, "");
    if (!term) return;
    const match = POKEMON_DIRECTORY.find((pokemon) => {
      const reference = pokemonReference(pokemon.name);
      const dex = dexNumbers[reference.dexName] || dexNumbers[reference.apiName];
      return pokemon.name.toLowerCase() === term || String(dex || "") === term;
    }) || POKEMON_DIRECTORY.find((pokemon) => pokemon.name.toLowerCase().includes(term));
    if (match) choose(match.name);
    else setMessage("That Pokemon was not found.");
  }
  function clearFilters() { setQuery(""); setType(""); setGeneration(""); setSortBy("name"); setAbility(""); setAbilityMatches(null); setMessage(""); }

  async function choose(name) {
    setSelected(name); setDetails(null); setSpecies(null); setImportedMoves([]); setPollPlacements(null); setDailyThreeProfile(null); setDraftProfile(null); setMessage(""); setMoveSource(""); setMoveCategory("all"); setMoveQuery(""); setSelectedMove(null); setLoading(true);
    try {
      const reference = pokemonReference(name);
      const [pokemonResponse, speciesResponse, importedResponse, placementsResponse, dailyThreeResponse, draftProfileResponse] = await Promise.all([
        fetchPokemonForm(reference),
        fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(reference.speciesName)}`),
        createClient().from("pokemon_move_learnsets").select("game_key, move_name, learn_method, level_learned_at, data_version").eq("pokemon_name", name),
        createClient().rpc("get_pokemon_poll_placements", { p_pokemon: name }),
        createClient().rpc("get_pokemon_daily_three_profile", { p_pokemon: name }),
        createClient().rpc("get_public_pokemon_draft_profile", { p_pokemon: name }),
      ]);
      if (!pokemonResponse.ok || !speciesResponse.ok) throw new Error("This Pokemon's details are unavailable right now.");
      const [pokemon, speciesData] = await Promise.all([pokemonResponse.json(), speciesResponse.json()]);
      setDetails(pokemon); setSpecies(speciesData); setImportedMoves(importedResponse.data || []); setPollPlacements(placementsResponse.data || { first: { count: 0, polls: [] }, second: { count: 0, polls: [] }, third: { count: 0, polls: [] } }); setDailyThreeProfile(dailyThreeResponse.data || {}); setDraftProfile(draftProfileResponse.data || {});
    } catch (error) { setMessage(error.message || "Could not load that Pokemon."); }
    setLoading(false);
  }
  useEffect(() => {
    if (!requestedPokemon) return;
    const match = POKEMON_DIRECTORY.find((pokemon) => pokemon.name.toLowerCase() === requestedPokemon.toLowerCase());
    if (match) {
      setQuery(match.name);
      choose(match.name);
    }
  }, [requestedPokemon]);

  const sourceData = useMemo(() => GAME_SOURCES.map((source) => ({ ...source, moves: sourceMoves(details, source, importedMoves) })), [details, importedMoves]);
  const recommendedSource = sourceData.find((source) => source.moves.length > 0) || null;
  const activeSource = sourceData.find((source) => source.key === moveSource) || recommendedSource;
  useEffect(() => { if (recommendedSource && !moveSource) setMoveSource(recommendedSource.key); }, [recommendedSource, moveSource]);
  useEffect(() => {
    const missing = (activeSource?.moves || []).map((move) => move.name).filter((name) => !moveCategories[name]);
    if (!missing.length) { setLoadingMoveCategories(false); return undefined; }
    let cancelled = false;
    setLoadingMoveCategories(true);
    async function loadCategories() {
      const additions = {};
      const detailAdditions = {};
      for (let index = 0; index < missing.length; index += 8) {
        const rows = await Promise.all(missing.slice(index, index + 8).map(async (name) => {
          try {
            const response = await fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`);
            if (!response.ok) return [name, "unknown", null];
            const data = await response.json();
            return [name, data.damage_class?.name || "unknown", data];
          } catch { return [name, "unknown", null]; }
        }));
        rows.forEach(([name, category, data]) => { additions[name] = category; if (data) detailAdditions[name] = data; });
      }
      if (!cancelled) {
        setMoveCategories((current) => ({ ...current, ...additions }));
        setMoveDetails((current) => ({ ...current, ...detailAdditions }));
        setLoadingMoveCategories(false);
      }
    }
    loadCategories();
    return () => { cancelled = true; };
  }, [activeSource?.key]);
  const visibleMoves = useMemo(() => (activeSource?.moves || []).filter((move) => (moveCategory === "all" || moveCategories[move.name] === moveCategory) && displayName(move.name).toLowerCase().includes(moveQuery.trim().toLowerCase())), [activeSource, moveCategory, moveCategories, moveQuery]);
  const groupedMoves = useMemo(() => visibleMoves.reduce((groups, move) => { const key = moveCategories[move.name] || "unknown"; (groups[key] ||= []).push(move); return groups; }, {}), [visibleMoves, moveCategories]);
  const entries = species?.flavor_text_entries?.filter((entry) => entry.language.name === "en") || []; const uniqueEntries = entries.filter((entry, index) => entries.findIndex((item) => item.version.name === entry.version.name) === index).slice(-16).reverse();
  const regulationStatus = selected && regulationId ? regulationPokemonStatus(regulationId, selected) : null;

  async function inspectMove(name) { setSelectedMove(name); if (moveDetails[name]) return; setLoadingMove(true); try { const response = await fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`); if (!response.ok) throw new Error("Move details are not available."); const data = await response.json(); setMoveDetails((current) => ({ ...current, [name]: data })); } catch (error) { setMessage(error.message); } setLoadingMove(false); }
  const inspectedMove = selectedMove ? moveDetails[selectedMove] : null;
  return <WidePokemonDirectory {...{ query, setQuery, handlePokemonQueryChange, searchPokemon, type, setType, generation, setGeneration, resultLimit, setResultLimit, ability, setAbility, findAbility, clearFilters, results, filteredCount: filteredPokemon.length, dimensionLoadedCount, selected, choose, dexNumbers, statLookup, sortBy, sortDirection, toggleSort, loading, message, details, species, uniqueEntries, regulationStatus, sourceData, activeSource, recommendedSource, moveCategory, setMoveCategory, moveQuery, setMoveQuery, setMoveSource, visibleMoves, groupedMoves, selectedMove, inspectMove, setSelectedMove, loadingMove, loadingMoveCategories, inspectedMove, pollPlacements, dailyThreeProfile, draftProfile }} />;

  return <main className="pokemon-directory"><header className="pokemon-directory-header"><a href="/?view=dashboard" className="quiet-button">← DraftCenter home</a><div><span className="eyebrow">POKEMON</span><h1>Explore the Pokedex</h1><p className="muted">Search, filter, and sort DraftCenter's Pokemon catalogue. Move pools are kept separate for every game and regulation.</p></div></header><section className="pokemon-directory-layout"><aside className="pokemon-search-card"><label>Search Pokemon<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pikachu, Garchomp..." autoFocus /></label><div className="pokemon-filter-grid"><label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option>{TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Generation<select value={generation} onChange={(event) => setGeneration(event.target.value)}><option value="">All generations</option>{[1,2,3,4,5,6,7,8,9].map((item) => <option key={item} value={item}>Generation {item}</option>)}</select></label><label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="name">Name</option><option value="dex">Pokedex number</option><option value="generation">Generation</option><option value="bst-high">Base stat total: high to low</option><option value="bst-low">Base stat total: low to high</option></select></label></div><form className="ability-search" onSubmit={findAbility}><label>Ability<input value={ability} onChange={(event) => setAbility(event.target.value)} placeholder="Levitate, Intimidate..." /></label><button className="quiet-button">Filter</button></form><button className="text-button filter-reset" onClick={clearFilters}>Clear filters</button><p className="muted">{results.length}{results.length === 100 ? "+" : ""} Pokemon shown</p><div className="pokemon-result-list">{results.map((pokemon) => <button key={pokemon.name} className={`pokemon-result ${selected === pokemon.name ? "selected" : ""}`} onClick={() => choose(pokemon.name)}><span>{dexNumbers[slug(pokemon.name)] ? `#${String(dexNumbers[slug(pokemon.name)]).padStart(4, "0")}` : `Gen ${pokemon.gen || "?"}`}</span><strong>{pokemon.name}</strong><small>{pokemon.t1}{pokemon.t2 ? ` / ${pokemon.t2}` : ""} · BST {pokemon.bst}</small></button>)}</div></aside><section className="pokemon-detail-card">{!selected && <div className="pokemon-empty"><span className="eyebrow">DRAFTCENTER POKEDEX</span><h2>Choose a Pokemon to begin</h2><p>Use the filters to study typings, generations, base-stat totals, Pokedex order, abilities, and versioned move pools.</p></div>}{loading && <p className="muted">Loading {selected}...</p>}{message && <p className="hub-message">{message}</p>}{details && species && <><div className="pokemon-title"><img src={details.sprites?.other?.["official-artwork"]?.front_default || details.sprites?.front_default} alt={selected} /><div><span className="eyebrow">#{String(details.id).padStart(4, "0")}</span><h2>{selected}</h2><p className="muted">{species.genera?.find((item) => item.language.name === "en")?.genus || "Pokemon"}</p><div className="pokemon-types">{details.types.map(({ type }) => <span key={type.name}>{type.name}</span>)}</div></div></div>{regulationStatus && <div className={`pokemon-legality ${regulationStatus.legal === true ? "is-legal" : regulationStatus.legal === false ? "is-not-legal" : ""}`}><strong>{regulationStatus.legal === true ? "Legal in this league's regulation" : regulationStatus.legal === false ? "Not eligible in this league's regulation" : "Custom regulation"}</strong><span>{regulationStatus.regulation.name} · {regulationStatus.regulation.subtitle}</span><small>League-specific bans and move clauses can still change final legality.</small></div>}<div className="pokemon-detail-grid"><section><h3>Base stats</h3><div className="pokemon-stats">{details.stats.map((stat) => <div key={stat.stat.name}><span>{stat.stat.name.replace("special-", "Sp. ").replace("-", " ")}</span><strong>{stat.base_stat}</strong></div>)}</div></section><section><h3>Abilities</h3><div className="pokemon-tags">{details.abilities.map(({ ability, is_hidden }) => <span key={ability.name}>{displayName(ability.name)}{is_hidden ? " (hidden)" : ""}</span>)}</div><h3>DraftCenter stats</h3><p className="muted">Poll wins, favorite-six popularity, draft rate, and ADP will appear here as DraftCenter data builds.</p></section></div><section className="pokedex-history"><h3>Pokedex entries</h3>{uniqueEntries.length ? <div className="pokedex-entry-list">{uniqueEntries.map((entry) => <article key={entry.version.name}><strong>{displayName(entry.version.name)}</strong><p>{entry.flavor_text.replace(/[\n\f]/g, " ")}</p></article>)}</div> : <p className="muted">No English entries are available.</p>}</section><section className="pokemon-moves"><div className="moves-heading"><div><h3>Versioned move pools</h3><p className="muted">The default is this Pokemon's newest available compatible game. Switch games to compare without mixing their move data.</p></div>{recommendedSource && <span className="move-source-badge">Latest available: {recommendedSource.label}</span>}</div><div className="move-source-tabs">{sourceData.map((source) => <button type="button" key={source.key} className={activeSource?.key === source.key ? "active" : ""} disabled={!source.moves.length} onClick={() => { setMoveSource(source.key); setMoveMethod("all"); setSelectedMove(null); }} title={source.moves.length ? source.note : `${source.label} data has not been imported yet`}>{source.label}{!source.moves.length && " (coming soon)"}</button>)}</div>{activeSource ? <><div className="move-source-note"><strong>{activeSource.label}</strong><span>{activeSource.note}</span>{activeSource.key === "legends-za" && <small>This source is not automatically treated as legal in a standard turn-based league.</small>}</div><div className="move-controls"><input value={moveQuery} onChange={(event) => setMoveQuery(event.target.value)} placeholder="Search moves..." /><select value={moveMethod} onChange={(event) => setMoveMethod(event.target.value)}><option value="all">All learn methods</option>{[...new Set((activeSource.moves || []).map((move) => move.method))].map((method) => <option key={method} value={method}>{METHOD_LABELS[method] || displayName(method)}</option>)}</select></div>{visibleMoves.length ? <div className="move-groups">{Object.entries(groupedMoves).map(([method, moves]) => <section key={method}><h4>{METHOD_LABELS[method] || displayName(method)} <small>{moves.length}</small></h4><div className="move-list">{moves.map((move) => <button type="button" key={`${activeSource.key}-${move.name}`} className={selectedMove === move.name ? "selected" : ""} onClick={() => inspectMove(move.name)}>{displayName(move.name)}{method === "level-up" && move.level ? <small>Lv. {move.level}</small> : null}</button>)}</div></section>)}</div> : <p className="muted">No move data is currently available for this Pokemon in {activeSource.label}.</p>}{selectedMove && <aside className="move-detail"><button className="text-button" onClick={() => setSelectedMove(null)}>Close move details</button>{loadingMove && <p className="muted">Loading {displayName(selectedMove)}...</p>}{inspectedMove && <><h4>{displayName(selectedMove)}</h4><div><span>Type <b>{inspectedMove.type?.name}</b></span><span>Class <b>{inspectedMove.damage_class?.name}</b></span><span>Power <b>{inspectedMove.power ?? "—"}</b></span><span>Accuracy <b>{inspectedMove.accuracy ?? "—"}</b></span><span>PP <b>{inspectedMove.pp ?? "—"}</b></span></div><p>{inspectedMove.flavor_text_entries?.find((entry) => entry.language.name === "en")?.flavor_text?.replace(/[\n\f]/g, " ") || "No English move description is available."}</p></>}</aside>}</> : <p className="muted">Move data has not loaded yet.</p>}</section></>}</section></section></main>;
}
