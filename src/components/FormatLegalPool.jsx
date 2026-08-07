"use client";
import { useMemo, useState } from "react";
import { REGULATION_SETS } from "./PokemonDraftLeague";

export default function FormatLegalPool({ format }) {
  const [query, setQuery] = useState("");
  const regulation = REGULATION_SETS[format.slug === "national-dex" ? "national-gen9" : format.slug];
  const legalNames = regulation?.legalNames;
  const restricted = new Set(regulation?.restrictedNames || []);
  const filteredNames = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return [...(legalNames || [])].sort((a, b) => a.localeCompare(b)).filter((name) => !needle || name.toLocaleLowerCase().includes(needle)); }, [legalNames, query]);
  if (!regulation || legalNames === null) return <section className="format-pool-section"><h2>Legal Pokémon</h2><p>Custom formats do not have a fixed legal pool. The commissioner chooses exactly which Pokémon and forms to include.</p></section>;
  return <section className="format-pool-section">
    <div className="format-pool-heading"><div><h2>Legal Pokémon</h2><p>{legalNames.length.toLocaleString()} Pokémon and forms are included in DraftCenter’s base pool. League-specific bans may reduce this list.</p></div><label>Search this pool<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Garchomp or Mega…" /></label></div>
    <div className="format-rule-facts"><span><strong>{legalNames.length.toLocaleString()}</strong> legal entries</span>{regulation.defaultRestrictedCap != null && <span><strong>{regulation.defaultRestrictedCap}</strong> Restricted per roster</span>}{regulation.defaultMegaCap != null && <span><strong>{regulation.defaultMegaCap}</strong> Mega per roster</span>}<span><strong>{Object.keys(regulation.defaultCosts || {}).length.toLocaleString()}</strong> curated prices</span></div>
    <p className="format-pool-results" aria-live="polite">Showing {filteredNames.length.toLocaleString()} of {legalNames.length.toLocaleString()}</p>
    <ul className="format-pokemon-grid">{filteredNames.map((name) => <li key={name}><span>{name}</span>{restricted.has(name) && <small>Restricted</small>}</li>)}</ul>
    {!filteredNames.length && <p className="format-pool-empty">No legal Pokémon match “{query}”.</p>}
  </section>;
}
