"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeTeamLabTeamSets } from "../lib/teamLabSets";
import {
  localizedNamesFromPokeApi,
  mergeLocalizedNames,
  pokeApiResourceSlug,
  pokemonApiSlugsForTeamSheet,
  TEAM_SHEET_LANGUAGES,
  teamSheetTranslationKey,
  teamSheetTranslationTargets,
} from "../lib/teamSheet";
import { SHARED_REGULATION_SETS as REGULATION_SETS } from "../platform/pokemonCatalog";

const POKEAPI_ROOT = "https://pokeapi.co/api/v2/";
const RESOURCE_ENDPOINTS = Object.freeze({ ability: "ability", item: "item", move: "move", type: "type" });
const translationCache = new Map();
const artworkCache = new Map();

function fallbackLocalizedNames(value) {
  return Object.fromEntries(TEAM_SHEET_LANGUAGES.map(({ code }) => [code, String(value || "").trim()]));
}

async function fetchPokeApiJson(url) {
  const parsed = new URL(url, POKEAPI_ROOT);
  if (parsed.protocol !== "https:" || parsed.hostname !== "pokeapi.co" || !parsed.pathname.startsWith("/api/v2/")) {
    throw new Error("Unsupported translation source.");
  }
  const response = await fetch(parsed.toString(), { cache: "force-cache" });
  if (!response.ok) throw new Error("A translated name was not found.");
  return response.json();
}

async function loadPokemonNames(value) {
  for (const slug of pokemonApiSlugsForTeamSheet(value)) {
    try {
      const pokemon = await fetchPokeApiJson(`${POKEAPI_ROOT}pokemon/${encodeURIComponent(slug)}`);
      const [form, species] = await Promise.all([
        pokemon?.forms?.[0]?.url ? fetchPokeApiJson(pokemon.forms[0].url).catch(() => null) : null,
        pokemon?.species?.url ? fetchPokeApiJson(pokemon.species.url).catch(() => null) : null,
      ]);
      return mergeLocalizedNames(localizedNamesFromPokeApi(form, ""), localizedNamesFromPokeApi(species, value), value);
    } catch {
      // Known form names can have more than one candidate; try the next one.
    }
  }
  throw new Error("Pokemon translations are unavailable.");
}

async function loadTargetNames(target) {
  if (translationCache.has(target.key)) return translationCache.get(target.key);
  const request = (async () => {
    if (target.kind === "pokemon") return loadPokemonNames(target.value);
    const endpoint = RESOURCE_ENDPOINTS[target.kind];
    if (!endpoint) throw new Error("Unsupported translation target.");
    const slug = pokeApiResourceSlug(target.value);
    if (!slug) throw new Error("The translated name is blank.");
    return localizedNamesFromPokeApi(await fetchPokeApiJson(`${POKEAPI_ROOT}${endpoint}/${encodeURIComponent(slug)}`), target.value);
  })();
  translationCache.set(target.key, request);
  return request;
}

function translatedValue(translations, kind, value, languageCode) {
  const fallback = String(value || "").trim();
  if (!fallback) return "-";
  if (languageCode === "en") return fallback;
  return translations[teamSheetTranslationKey(kind, fallback)]?.[languageCode] || fallback;
}

function multilingualRows(set, index) {
  return [
    { label: `Pokémon ${index + 1}`, kind: "pokemon", value: set.name },
    { label: "Tera Type", kind: "type", value: set.tera_type },
    { label: "Ability", kind: "ability", value: set.ability },
    { label: "Held Item", kind: "item", value: set.item },
    ...set.moves.map((move, moveIndex) => ({ label: `Move ${moveIndex + 1}`, kind: "move", value: move })),
  ];
}

async function loadTeamSheetArtwork(pokemon) {
  if (artworkCache.has(pokemon)) return artworkCache.get(pokemon);
  const request = (async () => {
    for (const slug of pokemonApiSlugsForTeamSheet(pokemon)) {
      try {
        const data = await fetchPokeApiJson(`${POKEAPI_ROOT}pokemon/${encodeURIComponent(slug)}`);
        const artwork = data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;
        if (artwork) return artwork;
      } catch {
        // Try the next known form slug.
      }
    }
    return "";
  })();
  artworkCache.set(pokemon, request);
  return request;
}

function TeamSheetArtwork({ pokemon }) {
  const [artwork, setArtwork] = useState("");
  useEffect(() => {
    let active = true;
    loadTeamSheetArtwork(pokemon).then((url) => { if (active) setArtwork(url); });
    return () => { active = false; };
  }, [pokemon]);
  if (!artwork) return <div className="team-sheet-artwork-fallback" aria-label={`${pokemon} artwork unavailable`}>{pokemon.replace(/^Mega /, "").charAt(0)}</div>;
  return <img src={artwork} alt={pokemon}/>;
}

function BroadcastTeamSheet({ team, sets, formatLabel }) {
  return <section className="team-sheet-page team-sheet-broadcast-page">
    <header className="team-sheet-broadcast-header">
      <div className="team-sheet-brand-lockup"><img src="/draftcenter-logo.png" alt=""/><div><span>DraftCenter Broadcast</span><strong>Open Team Sheet</strong></div></div>
      <div className="team-sheet-broadcast-title"><span>{team.league_name || "Featured Team"}</span><h1>{team.team_name || "Untitled Team"}</h1><p>{formatLabel}</p></div>
    </header>
    <div className="team-sheet-broadcast-grid">
      {sets.map((set, index) => <article className="team-sheet-broadcast-card" key={`${set.name}-${index}`}>
        <div className="team-sheet-broadcast-number">{String(index + 1).padStart(2, "0")}</div>
        <div className="team-sheet-broadcast-art"><TeamSheetArtwork pokemon={set.name}/></div>
        <div className="team-sheet-broadcast-copy">
          <div className="team-sheet-broadcast-name"><h2>{set.name}</h2>{set.tera_type&&<span>{set.tera_type} Tera</span>}</div>
          <dl><div><dt>Item</dt><dd>{set.item || "Not listed"}</dd></div><div><dt>Ability</dt><dd>{set.ability || "Not listed"}</dd></div></dl>
          <ul>{set.moves.map((move, moveIndex)=><li key={moveIndex}>{move || "-"}</li>)}</ul>
        </div>
      </article>)}
    </div>
    <footer><span>draftcentral.gg</span><strong>{sets.length} Pokémon · Open information</strong></footer>
  </section>;
}

function MultilingualTeamSheet({ team, sets, formatLabel, translations }) {
  return <section className="team-sheet-page team-sheet-multilingual-page">
    <header className="team-sheet-language-header"><div><span>DraftCenter Team Lab</span><h1>Multilingual Open Team Sheet</h1></div><img src="/draftcenter-logo.png" alt=""/></header>
    <div className="team-sheet-language-meta"><strong>{team.team_name || "Untitled Team"}</strong><span>{team.league_name || "Independent team"}</span><span>{formatLabel}</span></div>
    <table className="team-sheet-language-table">
      <colgroup><col className="team-sheet-row-label"/>{TEAM_SHEET_LANGUAGES.map(({ code })=><col key={code}/>)}</colgroup>
      <thead><tr><th aria-label="Field"></th>{TEAM_SHEET_LANGUAGES.map(({ code, label })=><th key={code}>{label}</th>)}</tr></thead>
      <tbody>{sets.flatMap((set,index)=>multilingualRows(set,index).map((row,rowIndex)=><tr className={rowIndex===0?"team-sheet-pokemon-row":""} key={`${index}-${row.label}`}><th scope="row">{row.label}</th>{TEAM_SHEET_LANGUAGES.map(({code})=><td lang={code === "ja-hrkt" ? "ja" : code} key={code}>{translatedValue(translations,row.kind,row.value,code)}</td>)}</tr>))}</tbody>
    </table>
    <footer><span>Translations are planning aids. Verify in-game names before official event submission.</span><strong>EN · FR · IT · DE · ES · JP · KO</strong></footer>
  </section>;
}

async function waitForPrintableImages() {
  const images = [...document.querySelectorAll(".team-sheet-print-root img")];
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => resolve();
      image.addEventListener("load", finish, { once:true });
      image.addEventListener("error", finish, { once:true });
      window.setTimeout(finish, 2500);
    });
  }));
}

export default function TeamSheetPrintStudio({ team, onClose }) {
  const sets = useMemo(() => normalizeTeamLabTeamSets(team?.team_sets, team?.pokemon, team?.pokemon).pokemon.map((set) => ({
    ...set,
    moves: Array.from({ length:4 }, (_, index) => set.moves[index] || ""),
  })), [team]);
  const targets = useMemo(() => teamSheetTranslationTargets(sets), [sets]);
  const [translations, setTranslations] = useState({});
  const [translationStatus, setTranslationStatus] = useState("loading");
  const [translationFailures, setTranslationFailures] = useState(0);
  const [printMode, setPrintMode] = useState("both");
  const [printBusy, setPrintBusy] = useState(false);
  const sourceRosterCount = Array.isArray(team?.pokemon) ? team.pokemon.length : 0;
  const rosterWasTrimmed = sourceRosterCount > sets.length;
  const formatLabel = REGULATION_SETS[team?.regulation_id]?.name || team?.format_name || "Open format";

  useEffect(() => {
    let active = true;
    setTranslationStatus("loading");
    setTranslationFailures(0);
    Promise.all(targets.map(async (target) => {
      try {
        return { key:target.key, names:await loadTargetNames(target), failed:false };
      } catch {
        return { key:target.key, names:fallbackLocalizedNames(target.value), failed:true };
      }
    })).then((results) => {
      if (!active) return;
      setTranslations(Object.fromEntries(results.map((result) => [result.key, result.names])));
      const failed = results.filter((result) => result.failed).length;
      setTranslationFailures(failed);
      setTranslationStatus(failed ? "partial" : "ready");
    });
    return () => { active = false; };
  }, [targets]);

  async function printSheets(mode) {
    setPrintBusy(true);
    setPrintMode(mode);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await waitForPrintableImages();
    window.print();
    setPrintBusy(false);
  }

  return <div className="modal-backdrop team-sheet-studio-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!printBusy)onClose();}}>
    <section className="tools-modal team-sheet-studio" aria-labelledby="team-sheet-studio-title">
      <button className="modal-close" disabled={printBusy} onClick={onClose} aria-label="Close print studio">×</button>
      <div className="team-sheet-studio-heading"><div><span className="eyebrow">PRINT STUDIO</span><h2 id="team-sheet-studio-title">Open team sheets</h2><p>Print the two-page packet, the broadcast graphic, or the multilingual details page by itself. Choose Save as PDF in your browser to make a PDF.</p></div><div className="team-sheet-studio-actions"><button className="primary-button" disabled={printBusy||translationStatus==="loading"||!sets.length} onClick={()=>printSheets("both")}>{printBusy?"Preparing...":"Print both pages"}</button><button className="secondary-button" disabled={printBusy||!sets.length} onClick={()=>printSheets("broadcast")}>Broadcast page</button><button className="quiet-button" disabled={printBusy||translationStatus==="loading"||!sets.length} onClick={()=>printSheets("multilingual")}>Language page</button></div></div>
      {rosterWasTrimmed&&<p className="team-sheet-roster-warning">This roster has {sourceRosterCount} Pokémon. The sheet shows the first six; prepare a private Team Lab copy first if you need a different six.</p>}
      <p className={`team-sheet-translation-status is-${translationStatus}`}>{translationStatus==="loading"?"Loading official names in seven languages...":translationStatus==="partial"?`${translationFailures} name${translationFailures===1?"":"s"} could not be translated and will use the saved English text.`:"Seven-language names are ready."}</p>
      <div className="team-sheet-preview-help"><span>Page 1 · Broadcast graphic</span><span>Page 2 · EN / FR / IT / DE / ES / JP / KO</span></div>
      <div className="team-sheet-preview-scroll"><div className={`team-sheet-print-root print-mode-${printMode}`}><BroadcastTeamSheet team={team} sets={sets} formatLabel={formatLabel}/><MultilingualTeamSheet team={team} sets={sets} formatLabel={formatLabel} translations={translations}/></div></div>
    </section>
  </div>;
}
