"use client";

import { useState } from "react";
import { encountersForArea, levelLabel, methodLabel, POKEAPI_ARTWORK_BASE, profileSlugForEncounter } from "../lib/nuzlockeGuidePresentation";

export default function NuzlockeGuideAreaBrowser({ gameSlug, areas }) {
  const [expandedArea, setExpandedArea] = useState("");
  const [areaDetails, setAreaDetails] = useState({});
  const [loadingArea, setLoadingArea] = useState("");
  const [areaErrors, setAreaErrors] = useState({});

  async function toggleArea(areaKey) {
    if (expandedArea === areaKey) {
      setExpandedArea("");
      return;
    }
    setExpandedArea(areaKey);
    setAreaErrors((current) => ({ ...current, [areaKey]: "" }));
    if (areaDetails[areaKey]) return;
    setLoadingArea(areaKey);
    try {
      const response = await fetch(`/api/nuzlocke/guide-area?game=${encodeURIComponent(gameSlug)}&area=${encodeURIComponent(areaKey)}`);
      const payload = await response.json();
      if (!response.ok || !payload?.area) throw new Error(payload?.error || "Encounter details are unavailable.");
      setAreaDetails((current) => ({ ...current, [areaKey]: payload.area }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Encounter details are unavailable.";
      setAreaErrors((current) => ({ ...current, [areaKey]: message }));
    } finally {
      setLoadingArea((current) => current === areaKey ? "" : current);
    }
  }

  return <div className="nuzlocke-guide-areas">
    {areas.map((area) => {
      const isExpanded = expandedArea === area.areaKey;
      const details = areaDetails[area.areaKey];
      const areaError = areaErrors[area.areaKey];
      const encounters = details ? encountersForArea(details) : [];
      const panelId = `nuzlocke-area-${area.areaKey}`;
      return <section className="nuzlocke-guide-area-card" key={area.areaKey}>
        <button type="button" className="nuzlocke-guide-area-toggle" aria-expanded={isExpanded} aria-controls={panelId} onClick={() => toggleArea(area.areaKey)}>
          <span><strong>{area.label}</strong><small>{area.methodLabels.join(" · ")}</small></span>
          <span>{area.encounterCount} {area.encounterCount === 1 ? "encounter" : "encounters"}</span>
        </button>
        <div className="nuzlocke-guide-area-preview" aria-label={`Example Pokémon in ${area.label}`}>
          {area.previewPokemon.map((pokemon) => <a key={`${pokemon.pokemonId}-${pokemon.name}`} href={`/pokemon/${pokemon.profileSlug}`}>{pokemon.name}</a>)}
        </div>
        {isExpanded && <div id={panelId} className="nuzlocke-guide-area-panel">
          {loadingArea === area.areaKey && <p className="muted">Loading the complete reviewed encounter pool…</p>}
          {areaError && !details && <p className="hub-message">{areaError}</p>}
          {details && <div className="nuzlocke-guide-pokemon-list">{encounters.map((pokemon, index) => <div key={`${pokemon.method}-${pokemon.pokemonId}-${pokemon.name}-${index}`}>
            <img src={`${POKEAPI_ARTWORK_BASE}/${pokemon.pokemonId}.png`} alt={`${pokemon.name} artwork`} width="52" height="52" loading="lazy" />
            <span className="nuzlocke-guide-method-label">{methodLabel(pokemon.method)}</span>
            <strong><a href={`/pokemon/${profileSlugForEncounter(pokemon)}`}>{pokemon.name}</a></strong>
            {levelLabel(pokemon) && <small>{levelLabel(pokemon)}</small>}
          </div>)}</div>}
        </div>}
      </section>;
    })}
  </div>;
}
