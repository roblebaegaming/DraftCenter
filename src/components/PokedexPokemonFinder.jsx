"use client";

import { useEffect, useMemo, useState } from "react";
import {
  pokedexArtworkUrl,
  pokedexSectionLabel,
  uniquePokedexEntries,
} from "../lib/pokedexTracker";

function plainLabel(value) {
  return String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function levelLabel(encounter) {
  const minimum = Number(encounter.min_level);
  const maximum = Number(encounter.max_level);
  if (!minimum && !maximum) return "";
  if (minimum === maximum || !maximum) return `Lv. ${minimum}`;
  return `Lv. ${minimum}–${maximum}`;
}

function groupedMemberships(rows, games) {
  const order = new Map((games || []).map((game, index) => [game.key, index]));
  const gameNames = new Map((games || []).map((game) => [game.key, game.name]));
  const grouped = new Map();
  for (const row of rows || []) {
    if (!grouped.has(row.game_key)) grouped.set(row.game_key, new Map());
    const sections = grouped.get(row.game_key);
    if (!sections.has(row.pokedex_key)) sections.set(row.pokedex_key, new Set());
    sections.get(row.pokedex_key).add(Number(row.entry_number));
  }
  return [...grouped.entries()].map(([gameKey, sections]) => ({
    gameKey,
    gameName: gameNames.get(gameKey) || plainLabel(gameKey),
    order: order.get(gameKey) ?? 999,
    sections: [...sections.entries()].map(([key, numbers]) => ({
      key,
      label: pokedexSectionLabel(key),
      numbers: [...numbers].sort((left, right) => left - right),
    })),
  })).sort((left, right) => left.order - right.order || left.gameName.localeCompare(right.gameName));
}

function groupedEncounters(encounters, locations) {
  const locationNames = new Map((locations || []).map((location) => [location.area_key, location.display_name]));
  const unique = new Map();
  for (const encounter of encounters || []) {
    const key = [encounter.area_key, encounter.method, encounter.min_level, encounter.max_level].join(":");
    if (!unique.has(key)) unique.set(key, {
      ...encounter,
      location_name: locationNames.get(encounter.area_key) || plainLabel(encounter.area_key),
    });
  }
  return [...unique.values()].sort((left, right) => left.location_name.localeCompare(right.location_name)
    || String(left.method).localeCompare(String(right.method)));
}

export default function PokedexPokemonFinder({
  activeCatalogKey,
  entries,
  games,
  onOpenTracker,
  selectedPokemonId,
  supabase,
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(Number(selectedPokemonId) || null);
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllGames, setShowAllGames] = useState(false);
  const pokemon = useMemo(() => uniquePokedexEntries(entries).sort((left, right) => Number(left.pokemon_id) - Number(right.pokemon_id)), [entries]);
  const selected = pokemon.find((entry) => Number(entry.pokemon_id) === selectedId) || null;
  const needle = query.trim().toLocaleLowerCase();
  const matches = pokemon.filter((entry) => !needle
    || String(entry.pokemon).toLocaleLowerCase().includes(needle)
    || String(entry.pokemon_id).includes(needle.replace(/^#/, ""))
    || String(entry.dex_number).includes(needle.replace(/^#/, ""))).slice(0, 24);

  useEffect(() => {
    const nextId = Number(selectedPokemonId);
    if (Number.isInteger(nextId) && nextId > 0) setSelectedId(nextId);
  }, [selectedPokemonId]);

  useEffect(() => {
    if (!selectedId) {
      setLookup(null);
      return undefined;
    }
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setShowAllGames(false);
      const membershipResult = await supabase
        .from("pokemon_game_pokedex_entries")
        .select("game_key,pokedex_key,entry_number,pokemon_id,pokemon_name")
        .eq("pokemon_id", selectedId)
        .order("game_key", { ascending: true })
        .order("entry_number", { ascending: true })
        .limit(200);
      if (!active) return;
      if (membershipResult.error) {
        setLoading(false);
        setError("This Pokémon's game list could not be loaded.");
        return;
      }

      let encounters = [];
      let locations = [];
      if (activeCatalogKey && activeCatalogKey !== "home") {
        const [encounterResult, locationResult] = await Promise.all([
          supabase
            .from("pokemon_game_encounters")
            .select("area_key,method,min_level,max_level,chance,conditions,form_name")
            .eq("game_key", activeCatalogKey)
            .eq("pokemon_id", selectedId)
            .limit(500),
          supabase
            .from("pokemon_game_locations")
            .select("area_key,display_name,sort_order")
            .eq("game_key", activeCatalogKey)
            .order("sort_order", { ascending: true })
            .limit(500),
        ]);
        if (!active) return;
        if (encounterResult.error || locationResult.error) {
          setLoading(false);
          setError("This game's location list could not be loaded.");
          return;
        }
        encounters = encounterResult.data || [];
        locations = locationResult.data || [];
      }

      setLookup({
        memberships: groupedMemberships(membershipResult.data, games),
        encounters: groupedEncounters(encounters, locations),
      });
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [activeCatalogKey, games, selectedId, supabase]);

  const gameMemberships = lookup?.memberships || [];
  const visibleGames = showAllGames ? gameMemberships : gameMemberships.slice(0, 12);
  const gameName = games?.find((game) => game.key === activeCatalogKey)?.name || "this game";

  return <section className="dex-finder" id="pokemon-finder" aria-labelledby="dex-finder-title">
    <header>
      <div><span className="dex-kicker">FIND A POKÉMON</span><h2 id="dex-finder-title">Where can I get it?</h2><p>Search for a Pokémon to see its number in each game and where it can be found in the game you have open.</p></div>
    </header>

    <label className="dex-finder-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Pikachu or #25" /></label>
    {query && <div className="dex-finder-results" role="listbox" aria-label="Pokémon search results">
      {matches.map((entry) => <button type="button" role="option" aria-selected={Number(entry.pokemon_id) === selectedId} key={entry.pokemon_id} onClick={() => { setSelectedId(Number(entry.pokemon_id)); setQuery(""); }}>
        <img src={pokedexArtworkUrl(entry.pokemon_id)} alt="" loading="lazy" />
        <span><strong>{entry.pokemon}</strong><small>National #{String(entry.pokemon_id).padStart(4, "0")}</small></span>
      </button>)}
      {!matches.length && <p>No Pokémon in this dex match that search.</p>}
    </div>}

    {selected && <article className="dex-finder-answer">
      <div className="dex-finder-pokemon">
        <img src={pokedexArtworkUrl(selected.pokemon_id)} alt="" />
        <div><span>National #{String(selected.pokemon_id).padStart(4, "0")}</span><h3>{selected.pokemon}</h3><p>#{String(selected.dex_number).padStart(3, "0")} in {pokedexSectionLabel(selected.pokedex_key)}</p></div>
      </div>

      {loading && <p className="dex-finder-message">Checking the game lists…</p>}
      {error && <p className="dex-finder-error" role="alert">{error}</p>}
      {!loading && !error && lookup && <div className="dex-finder-answer-grid">
        <section>
          <h4>{activeCatalogKey === "home" ? "Game dexes" : `Where to find it in ${gameName}`}</h4>
          {activeCatalogKey === "home" ? <>
            <p className="dex-finder-note">Open one of your game trackers to see locations. The numbers below come from each game's own Pokédex.</p>
            <div className="dex-finder-games">
              {visibleGames.map((game) => <article key={game.gameKey}>
                <div><strong>{game.gameName}</strong>{game.sections.map((section) => <small key={section.key}>{section.label} #{section.numbers.map((number) => String(number).padStart(3, "0")).join(", #")}</small>)}</div>
                {onOpenTracker?.available?.(game.gameKey) && <button type="button" onClick={() => onOpenTracker.open(game.gameKey)}>Open tracker</button>}
              </article>)}
            </div>
            {gameMemberships.length > visibleGames.length && <button type="button" className="dex-secondary-button" onClick={() => setShowAllGames(true)}>Show {gameMemberships.length - visibleGames.length} more games</button>}
          </> : lookup.encounters.length ? <div className="dex-finder-locations">
            {lookup.encounters.slice(0, 24).map((encounter, index) => <article key={`${encounter.area_key}:${encounter.method}:${index}`}>
              <strong>{encounter.location_name}</strong>
              <span>{plainLabel(encounter.method)}{levelLabel(encounter) ? ` · ${levelLabel(encounter)}` : ""}</span>
              {encounter.form_name && <small>{encounter.form_name} form</small>}
            </article>)}
            {lookup.encounters.length > 24 && <p>{lookup.encounters.length - 24} more ways to find this Pokémon are listed for the game.</p>}
          </div> : <p className="dex-finder-note">We do not have a direct location listed for this version. It may come from evolution, breeding, a gift, a trade, a transfer, or another version.</p>}
        </section>

        {activeCatalogKey !== "home" && <section>
          <h4>Other supported games</h4>
          <div className="dex-finder-games is-compact">
            {visibleGames.filter((game) => game.gameKey !== activeCatalogKey).map((game) => <article key={game.gameKey}><div><strong>{game.gameName}</strong>{game.sections.map((section) => <small key={section.key}>{section.label} #{section.numbers.map((number) => String(number).padStart(3, "0")).join(", #")}</small>)}</div>{onOpenTracker?.available?.(game.gameKey) && <button type="button" onClick={() => onOpenTracker.open(game.gameKey)}>Open</button>}</article>)}
          </div>
          {gameMemberships.length > visibleGames.length && <button type="button" className="dex-secondary-button" onClick={() => setShowAllGames(true)}>Show every game</button>}
        </section>}
      </div>}
    </article>}
  </section>;
}
