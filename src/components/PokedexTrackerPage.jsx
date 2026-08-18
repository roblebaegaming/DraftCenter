"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPlatformBrowserClient } from "../platform/supabase";
import PokedexCollectorLaunchPanel from "./PokedexCollectorLaunchPanel";
import PokedexPokemonFinder from "./PokedexPokemonFinder";
import PokemonChampionsAchievementCenter from "./PokemonChampionsAchievementCenter";
import {
  buildPokedexBoxPlan,
  filterPokedexEntries,
  filterPokedexSpecimens,
  groupPokedexCatalogs,
  groupPokedexSections,
  pokedexBallOptions,
  pokedexBoxLayout,
  pokedexEntryDetails,
  pokedexHasEntryDetails,
  pokedexArtworkUrl,
  pokedexInventoryCsv,
  pokedexFormOptions,
  pokedexMarkGroups,
  pokedexPokemonTypes,
  pokedexRibbonGroups,
  pokedexSpecimenDisplayName,
  pokedexTrackerProgress,
  uniquePokedexEntries,
  POKEDEX_ENTRY_NOTE_MAX_LENGTH,
  POKEDEX_INVENTORY_NOTE_MAX_LENGTH,
  POKEDEX_LOCATION_NOTE_MAX_LENGTH,
  POKEDEX_LOCATION_OPTIONS,
  POKEDEX_MARK_OPTIONS,
  POKEDEX_BALL_OPTIONS,
  POKEDEX_RIBBON_OPTIONS,
  POKEDEX_TRACKER_PAGE_SIZE,
} from "../lib/pokedexTracker";
import { trackPokedexCollectorEvent } from "../lib/pokedexAnalytics";

function ProgressRing({ progress, label, shiny = false, alpha = false }) {
  return <div className={`dex-tracker-ring ${shiny ? "is-shiny" : ""} ${alpha ? "is-alpha" : ""}`} style={{ "--dex-progress": `${progress.percentage * 3.6}deg` }}>
    <div><strong>{progress.percentage}%</strong><span>{label}</span></div>
  </div>;
}

function BallBadge({ option, compact = false }) {
  if (!option) return null;
  return <span
    className={`dex-ball-badge ${compact ? "is-compact" : ""}`}
    style={{ "--ball-top": option.colors[0], "--ball-bottom": option.colors[1] }}
    role="img"
    aria-label={option.label}
  />;
}

function PokemonCard({ entry, mode, pending, onToggle, onDetails, onInventory, onWanted, onFind, sectionLabel, ballOptions = [] }) {
  const isShiny = mode === "shiny";
  const isAlpha = mode === "alpha";
  const caught = isShiny ? entry.shiny_caught : isAlpha ? entry.alpha_caught : entry.caught;
  const wanted = isShiny ? entry.shiny_wanted : entry.wanted;
  const details = pokedexEntryDetails(entry, mode);
  const hasDetails = pokedexHasEntryDetails(entry, mode);
  const ball = ballOptions.find(({ key }) => key === details.pokeball);
  const regularArtwork = pokedexArtworkUrl(entry.pokemon_id);
  const artwork = pokedexArtworkUrl(entry.pokemon_id, isShiny);
  function handleImageError(event) {
    if (isShiny && event.currentTarget.src !== regularArtwork) {
      event.currentTarget.src = regularArtwork;
      return;
    }
    event.currentTarget.hidden = true;
  }
  return <article className={`dex-tracker-pokemon ${caught ? "is-caught" : ""} ${isShiny ? "is-shiny" : ""} ${isAlpha ? "is-alpha" : ""} ${hasDetails && !isAlpha ? "has-details" : ""}`}>
    <button
      type="button"
      className="dex-entry-catch"
      aria-pressed={caught}
      aria-label={`${caught ? "Remove" : "Mark"} ${isShiny ? "shiny " : isAlpha ? "Alpha " : ""}${entry.pokemon} ${caught ? "from" : "in"} this Pokédex`}
      disabled={pending}
      onClick={() => onToggle(entry)}
    >
      <span className="dex-tracker-check" aria-hidden="true">{pending ? "···" : caught ? "✓" : "+"}</span>
      <span className="dex-tracker-number">#{String(entry.dex_number).padStart(3, "0")}</span>
      <span className="dex-tracker-art">
        <img src={artwork} alt="" loading="lazy" onError={handleImageError} />
        {isShiny && <i aria-hidden="true">✦</i>}
        {isAlpha && <i aria-hidden="true">α</i>}
      </span>
      <strong>{entry.pokemon}</strong>
      <small>{sectionLabel}</small>
    </button>
    <div className="dex-entry-actions">
      <button type="button" className="dex-entry-find-trigger" onClick={() => onFind(entry)} aria-label={`Find ${entry.pokemon} in supported games`}>⌕ Find</button>
      {!isAlpha && <button type="button" className="dex-entry-details-trigger" onClick={() => onDetails(entry)} aria-label={`Edit ${isShiny ? "shiny " : ""}${entry.pokemon} collection details`}>
        {hasDetails ? <>
          {ball && <BallBadge option={ball} compact />}
          {details.ribbons.length > 0 && <span title={`${details.ribbons.length} saved ribbon${details.ribbons.length === 1 ? "" : "s"}`}>◇ {details.ribbons.length}</span>}
          {details.marks.length > 0 && <span title={`${details.marks.length} saved mark${details.marks.length === 1 ? "" : "s"}`}>◆ {details.marks.length}</span>}
          {details.notes.trim() && <span title="A private note is saved">✎</span>}
        </> : <span>＋ Details</span>}
      </button>}
      {!isAlpha && <button type="button" className="dex-entry-inventory-trigger" onClick={() => onInventory(entry)} aria-label={`Record an individual ${isShiny ? "shiny " : ""}${entry.pokemon}`}>＋ Individual</button>}
      {!isAlpha && <button type="button" className={`dex-entry-wanted-trigger ${wanted ? "is-wanted" : ""}`} onClick={() => onWanted(entry)} aria-label={`${wanted ? "Edit" : "Add"} ${isShiny ? "shiny " : ""}${entry.pokemon} hunt target`}>{wanted ? "◎ Looking for" : "◎ Want"}</button>}
    </div>
  </article>;
}

function PokedexBoxPlanner({ entries, layout, mode, pending, onToggle, sectionKey, sectionLabel, trackerId }) {
  const [boxNumber, setBoxNumber] = useState(1);
  const plannedEntries = mode === "alpha" ? entries.filter((entry) => entry.alpha_eligible) : entries;
  const boxes = useMemo(() => buildPokedexBoxPlan(plannedEntries, layout), [plannedEntries, layout]);
  useEffect(() => { setBoxNumber(1); }, [sectionKey]);
  const current = boxes[Math.min(boxNumber, boxes.length) - 1] || boxes[0];
  if (!current) return null;
  const isShiny = mode === "shiny";
  const isAlpha = mode === "alpha";
  return <section className="dex-box-planner" id="game-box-planner" aria-labelledby="dex-box-planner-title">
    <header>
      <div><span className="dex-kicker">BOX LAYOUT</span><h3 id="dex-box-planner-title">{sectionLabel} in Pokédex order</h3><p>{layout.note}</p></div>
      <label>{layout.label}<select value={current.number} onChange={(event) => setBoxNumber(Number(event.target.value))}>{boxes.map((box) => <option key={box.number} value={box.number}>{layout.label} {box.number}{box.firstDexNumber != null ? ` · #${String(box.firstDexNumber).padStart(3, "0")}–#${String(box.lastDexNumber).padStart(3, "0")}` : ""}</option>)}</select></label>
    </header>
    <div className="dex-box-grid" style={{ "--dex-box-columns": layout.columns }}>
      {current.entries.map((entry, index) => entry ? <button
        type="button"
        key={`${entry.pokedex_key}:${entry.pokemon_id}`}
        className={(isShiny ? entry.shiny_caught : isAlpha ? entry.alpha_caught : entry.caught) ? "is-caught" : ""}
        disabled={pending.has(`${trackerId}:${entry.pokemon_id}:${mode}`)}
        onClick={() => onToggle(entry)}
        title={`${entry.pokemon} · ${sectionLabel} #${entry.dex_number}`}
      ><span>#{String(entry.dex_number).padStart(3, "0")}</span><img src={pokedexArtworkUrl(entry.pokemon_id, isShiny)} alt="" loading="lazy" /><strong>{entry.pokemon}</strong></button> : <span className="is-empty" key={`empty:${index}`} aria-hidden="true" />)}
    </div>
    <footer><button type="button" className="dex-secondary-button" disabled={current.number <= 1} onClick={() => setBoxNumber((number) => number - 1)}>Previous</button><span>{layout.label} {current.number} of {boxes.length}</span><button type="button" className="dex-secondary-button" disabled={current.number >= boxes.length} onClick={() => setBoxNumber((number) => number + 1)}>Next</button></footer>
  </section>;
}

function EntryDetailsDialog({ entry, mode, ballOptions, ribbonGroups, markGroups, busy, error, onSave, onClose }) {
  const initial = pokedexEntryDetails(entry, mode);
  const [pokeball, setPokeball] = useState(initial.pokeball);
  const [ribbons, setRibbons] = useState(initial.ribbons);
  const [marks, setMarks] = useState(initial.marks);
  const [notes, setNotes] = useState(initial.notes);
  const [ribbonQuery, setRibbonQuery] = useState("");
  const isShiny = mode === "shiny";
  const artwork = pokedexArtworkUrl(entry.pokemon_id, isShiny);
  const selectedBall = ballOptions.find(({ key }) => key === pokeball);
  const needle = ribbonQuery.trim().toLocaleLowerCase();
  const visibleRibbonGroups = ribbonGroups.map((group) => ({
    ...group,
    options: group.options.filter(({ label }) => !needle || label.toLocaleLowerCase().includes(needle)),
  })).filter(({ options }) => options.length);

  function toggleRibbon(key) {
    setRibbons((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }
  function toggleMark(key) {
    setMarks((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  return <div className="dex-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="dex-details-dialog" role="dialog" aria-modal="true" aria-labelledby="dex-entry-details-title">
      <header>
        <div className="dex-details-pokemon">
          <img src={artwork} alt="" />
          <div><span className="dex-kicker">{isShiny ? "SHINY COLLECTION DETAILS" : "COLLECTION DETAILS"}</span><h2 id="dex-entry-details-title">{entry.pokemon}</h2><small>#{String(entry.dex_number).padStart(3, "0")} · Private to this tracker</small></div>
        </div>
        <button type="button" className="dex-icon-button" onClick={onClose} disabled={busy} aria-label="Close Pokémon details">×</button>
      </header>

      <div className="dex-details-scroll">
        <section className="dex-details-section">
          <div><span className="dex-details-icon" aria-hidden="true">◓</span><div><h3>Poké Ball</h3><p>Optional—record the ball this Pokémon is in.</p></div></div>
          <label className="dex-ball-select">
            {selectedBall ? <BallBadge option={selectedBall} /> : <span className="dex-ball-empty" aria-hidden="true">—</span>}
            <select value={pokeball} onChange={(event) => setPokeball(event.target.value)}>
              <option value="">Not tracked</option>
              {ballOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
        </section>

        {markGroups.length > 0 && <section className="dex-details-section">
          <div><span className="dex-details-icon is-mark" aria-hidden="true">◆</span><div><h3>Marks</h3><p>Record marks attached to this Pokémon. The game-origin symbol remains a separate field.</p></div><strong className="dex-ribbon-count">{marks.length} selected</strong></div>
          <div className="dex-ribbon-groups">{markGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.key} aria-pressed={marks.includes(option.key)} onClick={() => toggleMark(option.key)}><span aria-hidden="true">◆</span>{option.label}</button>)}</div></fieldset>)}</div>
        </section>}

        <section className="dex-details-section">
          <div><span className="dex-details-icon is-ribbon" aria-hidden="true">◇</span><div><h3>Ribbons</h3><p>Choose any ribbons earned in this game{ribbonGroups.length > 5 ? " or across HOME" : ""}.</p></div><strong className="dex-ribbon-count">{ribbons.length} selected</strong></div>
          {ribbonGroups.length ? <>
            {ribbonGroups.reduce((count, group) => count + group.options.length, 0) > 14 && <label className="dex-ribbon-search"><span aria-hidden="true">⌕</span><input value={ribbonQuery} onChange={(event) => setRibbonQuery(event.target.value)} placeholder="Find a ribbon…" /></label>}
            <div className="dex-ribbon-groups">
              {visibleRibbonGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.key} aria-pressed={ribbons.includes(option.key)} onClick={() => toggleRibbon(option.key)}><span aria-hidden="true">◇</span>{option.label}</button>)}</div></fieldset>)}
            </div>
          </> : <p className="dex-no-ribbons">This game does not award ribbons, so there is nothing extra to manage here.</p>}
        </section>

        <section className="dex-details-section">
          <div><span className="dex-details-icon is-note" aria-hidden="true">✎</span><div><h3>Private note</h3><p>Save a reminder, hunt plan, trade detail, or anything else you need.</p></div></div>
          <label className="dex-notes-field"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={POKEDEX_ENTRY_NOTE_MAX_LENGTH} rows={5} placeholder="Example: Breed for a Timid nature, then move into HOME Box 12…" /><span>{notes.length.toLocaleString()} / {POKEDEX_ENTRY_NOTE_MAX_LENGTH.toLocaleString()}</span></label>
        </section>
      </div>

      <footer>
        {error && <p role="alert">{error}</p>}
        <button type="button" className="dex-secondary-button" onClick={() => { setPokeball(""); setRibbons([]); setMarks([]); setNotes(""); }} disabled={busy}>Clear fields</button>
        <button type="button" className="dex-primary-button" onClick={() => onSave({ pokeball, ribbons, marks, notes })} disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
      </footer>
    </section>
  </div>;
}

function WantedDialog({ entry, mode, markGroups, busy, error, onSave, onClose }) {
  const isShiny = mode === "shiny";
  const prefix = isShiny ? "shiny_wanted_" : "wanted_";
  const alreadyWanted = isShiny ? entry.shiny_wanted : entry.wanted;
  const [formLabel, setFormLabel] = useState(entry[`${prefix}form`] || "");
  const [marks, setMarks] = useState(Array.isArray(entry[`${prefix}marks`]) ? entry[`${prefix}marks`] : []);
  const [wantsAlpha, setWantsAlpha] = useState(Boolean(entry[`${prefix}alpha`]));
  const [notes, setNotes] = useState(entry[`${prefix}notes`] || "");
  const forms = pokedexFormOptions(entry.pokemon_id);
  const toggleMark = (key) => setMarks((current) => current.includes(key)
    ? current.filter((value) => value !== key) : [...current, key]);
  return <div className="dex-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="dex-details-dialog" role="dialog" aria-modal="true" aria-labelledby="dex-wanted-title">
      <header><div className="dex-details-pokemon"><img src={pokedexArtworkUrl(entry.pokemon_id, isShiny)} alt="" /><div><span className="dex-kicker">LOOKING FOR</span><h2 id="dex-wanted-title">{isShiny ? "Shiny " : ""}{entry.pokemon}</h2><small>Private hunt target · does not change owned progress</small></div></div><button type="button" className="dex-icon-button" onClick={onClose} disabled={busy} aria-label="Close hunt target">×</button></header>
      <div className="dex-details-scroll">
        <section className="dex-details-section"><div><span className="dex-details-icon" aria-hidden="true">◎</span><div><h3>What are you looking for?</h3><p>Leave every field blank to search for any {entry.pokemon}, or narrow it to a form, pattern, trim, mark, or Alpha.</p></div></div><label className="dex-wanted-form">Form, pattern, or style<input list="dex-wanted-form-options" value={formLabel} onChange={(event) => setFormLabel(event.target.value)} maxLength={80} placeholder={forms.length ? "Search forms" : "Any form"} /><datalist id="dex-wanted-form-options">{forms.map((form) => <option key={form} value={form} />)}</datalist></label>{entry.alpha_available && <label className="dex-shiny-choice dex-alpha-choice"><input type="checkbox" checked={wantsAlpha} onChange={(event) => setWantsAlpha(event.target.checked)} /><span><b>Must be an Alpha</b><small>Only species legitimately available as Alpha can be saved.</small></span><i aria-hidden="true">α</i></label>}</section>
        <section className="dex-details-section"><div><span className="dex-details-icon is-mark" aria-hidden="true">◆</span><div><h3>Specific marks</h3><p>Choose one or more marks you want this Pokémon to have.</p></div><strong className="dex-ribbon-count">{marks.length} selected</strong></div><div className="dex-ribbon-groups">{markGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.key} aria-pressed={marks.includes(option.key)} onClick={() => toggleMark(option.key)}><span aria-hidden="true">◆</span>{option.label}</button>)}</div></fieldset>)}</div></section>
        <section className="dex-details-section"><div><span className="dex-details-icon is-note" aria-hidden="true">✎</span><div><h3>Private hunt note</h3><p>Add trade terms, preferred game, location, or anything else you want to remember.</p></div></div><label className="dex-notes-field"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={4} placeholder="Optional hunt note…" /><span>{notes.length} / 500</span></label></section>
      </div>
      <footer>{error && <p role="alert">{error}</p>}{alreadyWanted && <button type="button" className="dex-danger-button" disabled={busy} onClick={() => onSave(false, {})}>Remove target</button>}<button type="button" className="dex-primary-button" disabled={busy} onClick={() => onSave(true, { form_label: formLabel, marks, wants_alpha: wantsAlpha, notes })}>{busy ? "Saving…" : alreadyWanted ? "Save target" : "Start looking"}</button></footer>
    </section>
  </div>;
}

function LocationForm({ location, busy, onSave, onCancel }) {
  const [kind, setKind] = useState(location?.kind || "game_save");
  const [name, setName] = useState(location?.name || "");
  const [platform, setPlatform] = useState(location?.platform || "");
  const [notes, setNotes] = useState(location?.notes || "");
  return <form className="dex-inventory-location-form" onSubmit={(event) => {
    event.preventDefault();
    onSave(location?.id || null, { kind, name, platform, notes });
  }}>
    <label>Location type<select value={kind} onChange={(event) => setKind(event.target.value)}>{POKEDEX_LOCATION_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    <label>Location name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Example: Violet save" /></label>
    <label>Console or platform <span>optional</span><input value={platform} onChange={(event) => setPlatform(event.target.value)} maxLength={80} placeholder="Example: Blue 3DS" /></label>
    <label className="dex-location-notes">Private note <span>optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={POKEDEX_LOCATION_NOTE_MAX_LENGTH} rows={2} /></label>
    <div><button type="button" className="dex-secondary-button" onClick={onCancel} disabled={busy}>Cancel</button><button className="dex-primary-button" disabled={busy || !name.trim()}>{busy ? "Saving…" : location?.id ? "Save location" : "Add location"}</button></div>
  </form>;
}

function SpecimenDialog({ specimen, entries, locations, ballOptions, ribbonGroups, markGroups, busy, error, onSave, onDelete, onClose }) {
  const [pokemonId, setPokemonId] = useState(String(specimen?.pokemon_id || entries[0]?.pokemon_id || ""));
  const [formLabel, setFormLabel] = useState(specimen?.form_label || "");
  const [nickname, setNickname] = useState(specimen?.nickname || "");
  const [isShiny, setIsShiny] = useState(Boolean(specimen?.is_shiny));
  const [isAlpha, setIsAlpha] = useState(Boolean(specimen?.is_alpha));
  const [gender, setGender] = useState(specimen?.gender || "unknown");
  const [level, setLevel] = useState(specimen?.level || "");
  const [originalTrainer, setOriginalTrainer] = useState(specimen?.original_trainer || "");
  const [originGame, setOriginGame] = useState(specimen?.origin_game || "");
  const [originMark, setOriginMark] = useState(specimen?.origin_mark || "");
  const [locationId, setLocationId] = useState(specimen?.location_id || "");
  const [boxLabel, setBoxLabel] = useState(specimen?.box_label || "");
  const [boxPosition, setBoxPosition] = useState(specimen?.box_position || "");
  const [pokeball, setPokeball] = useState(specimen?.pokeball || "");
  const [ribbons, setRibbons] = useState(Array.isArray(specimen?.ribbons) ? specimen.ribbons : []);
  const [marks, setMarks] = useState(Array.isArray(specimen?.marks) ? specimen.marks : []);
  const [isEvent, setIsEvent] = useState(Boolean(specimen?.is_event));
  const [notes, setNotes] = useState(specimen?.notes || "");
  const [ribbonQuery, setRibbonQuery] = useState("");
  const selectedEntry = entries.find((entry) => String(entry.pokemon_id) === pokemonId);
  const formOptions = pokedexFormOptions(pokemonId);
  const selectedBall = ballOptions.find((option) => option.key === pokeball);
  const ribbonNeedle = ribbonQuery.trim().toLocaleLowerCase();
  const visibleRibbonGroups = ribbonGroups.map((group) => ({
    ...group,
    options: group.options.filter((option) => !ribbonNeedle || option.label.toLocaleLowerCase().includes(ribbonNeedle)),
  })).filter((group) => group.options.length);

  function toggleRibbon(key) {
    setRibbons((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }
  function toggleMark(key) {
    setMarks((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  function submit(event) {
    event.preventDefault();
    onSave(specimen?.id || null, {
      pokemon_id: Number(pokemonId), form_label: formLabel, nickname, is_shiny: isShiny, is_alpha: isAlpha,
      gender, level: level || null, original_trainer: originalTrainer, origin_game: originGame, origin_mark: originMark,
      location_id: locationId || null, box_label: boxLabel, box_position: boxPosition || null,
      pokeball: pokeball || null, ribbons, marks, is_event: isEvent,
      importance: specimen?.importance || "standard",
      intended_destination: specimen?.intended_destination || "",
      transfer_state: specimen?.transfer_state || "not_planned",
      transferred_on: specimen?.transferred_on || null,
      notes,
    });
  }

  return <div className="dex-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form className="dex-details-dialog dex-specimen-dialog" role="dialog" aria-modal="true" aria-labelledby="dex-specimen-title" onSubmit={submit}>
      <header>
        <div className="dex-details-pokemon">
          {selectedEntry && <img src={pokedexArtworkUrl(selectedEntry.pokemon_id, isShiny)} alt="" />}
          <div><span className="dex-kicker">INDIVIDUAL COLLECTION RECORD</span><h2 id="dex-specimen-title">{specimen?.id ? pokedexSpecimenDisplayName({ ...specimen, pokemon: selectedEntry?.pokemon }) : "Record a Pokémon"}</h2><small>Private inventory · separate from the caught checkbox</small></div>
        </div>
        <button type="button" className="dex-icon-button" onClick={onClose} disabled={busy} aria-label="Close individual Pokémon record">×</button>
      </header>
      <div className="dex-details-scroll dex-specimen-fields">
        <section className="dex-details-section">
          <div><span className="dex-details-icon" aria-hidden="true">◉</span><div><h3>Identity</h3><p>Add a nickname or form label if you use one for this Pokémon.</p></div></div>
          <div className="dex-specimen-grid">
            <label className="is-wide">Species<select value={pokemonId} onChange={(event) => setPokemonId(event.target.value)} required>{entries.map((entry) => <option key={entry.pokemon_id} value={entry.pokemon_id}>#{String(entry.dex_number).padStart(4, "0")} · {entry.pokemon}</option>)}</select></label>
            <label>Nickname<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={50} /></label>
            <label>Form, pattern, or style<input list="dex-collectible-form-options" value={formLabel} onChange={(event) => setFormLabel(event.target.value)} maxLength={80} placeholder={formOptions.length ? "Search available forms" : "Optional"} /><datalist id="dex-collectible-form-options">{formOptions.map((option) => <option key={option} value={option} />)}</datalist></label>
            <label>Gender<select value={gender} onChange={(event) => setGender(event.target.value)}><option value="unknown">Not recorded</option><option value="male">Male</option><option value="female">Female</option><option value="genderless">Genderless</option></select></label>
            <label>Level<input type="number" min="1" max="100" value={level} onChange={(event) => setLevel(event.target.value)} /></label>
            <label>Original Trainer<input value={originalTrainer} onChange={(event) => setOriginalTrainer(event.target.value)} maxLength={50} /></label>
            <label>Origin game<input value={originGame} onChange={(event) => setOriginGame(event.target.value)} maxLength={80} /></label>
            <label>Game-origin symbol<input value={originMark} onChange={(event) => setOriginMark(event.target.value)} maxLength={80} placeholder="Optional" /></label>
          </div>
          <div className="dex-specimen-checks"><label><input type="checkbox" checked={isShiny} onChange={(event) => setIsShiny(event.target.checked)} /> Shiny</label><label><input type="checkbox" checked={isAlpha} onChange={(event) => setIsAlpha(event.target.checked)} /> Alpha from a Legends game</label><label><input type="checkbox" checked={isEvent} onChange={(event) => setIsEvent(event.target.checked)} /> Event Pokémon</label></div>
        </section>

        <section className="dex-details-section">
          <div><span className="dex-details-icon is-note" aria-hidden="true">⌂</span><div><h3>Where it lives</h3><p>Choose one of this tracker’s private storage locations, then record the box and slot.</p></div></div>
          <div className="dex-specimen-grid">
            <label className="is-wide">Storage location<select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Location not recorded</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.platform ? ` · ${location.platform}` : ""}</option>)}</select></label>
            <label>Box or group<input value={boxLabel} onChange={(event) => setBoxLabel(event.target.value)} maxLength={80} /></label>
            <label>Slot 1–30<input type="number" min="1" max="30" value={boxPosition} onChange={(event) => setBoxPosition(event.target.value)} /></label>
          </div>
          {!locations.length && <p className="dex-inventory-hint">Add a storage location in Collection inventory before assigning this Pokémon.</p>}
        </section>

        <section className="dex-details-section">
          <div><span className="dex-details-icon is-mark" aria-hidden="true">◆</span><div><h3>Marks</h3><p>Choose every mark this individual has earned or carried into HOME.</p></div><strong className="dex-ribbon-count">{marks.length} selected</strong></div>
          <div className="dex-ribbon-groups">{markGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.key} aria-pressed={marks.includes(option.key)} onClick={() => toggleMark(option.key)}><span aria-hidden="true">◆</span>{option.label}</button>)}</div></fieldset>)}</div>
        </section>

        <section className="dex-details-section">
          <div><span className="dex-details-icon" aria-hidden="true">◓</span><div><h3>Ball and ribbons</h3><p>These belong to this individual record and can differ from the quick checklist details.</p></div></div>
          <label className="dex-ball-select">{selectedBall ? <BallBadge option={selectedBall} /> : <span className="dex-ball-empty" aria-hidden="true">—</span>}<select value={pokeball} onChange={(event) => setPokeball(event.target.value)}><option value="">Not recorded</option>{ballOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          {ribbonGroups.length > 0 && <><label className="dex-ribbon-search"><span aria-hidden="true">⌕</span><input value={ribbonQuery} onChange={(event) => setRibbonQuery(event.target.value)} placeholder="Find a ribbon…" /></label><div className="dex-ribbon-groups">{visibleRibbonGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.key} aria-pressed={ribbons.includes(option.key)} onClick={() => toggleRibbon(option.key)}><span aria-hidden="true">◇</span>{option.label}</button>)}</div></fieldset>)}</div></>}
        </section>

        <section className="dex-details-section">
          <div><span className="dex-details-icon is-note" aria-hidden="true">✎</span><div><h3>Private notes</h3><p>Add a memory, trade detail, hunt note, or anything else you want to remember.</p></div></div>
          <label className="dex-notes-field"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={POKEDEX_INVENTORY_NOTE_MAX_LENGTH} rows={4} placeholder="Add a private note…" /><span>{notes.length.toLocaleString()} / {POKEDEX_INVENTORY_NOTE_MAX_LENGTH.toLocaleString()}</span></label>
        </section>
      </div>
      <footer>
        {error && <p role="alert">{error}</p>}
        {specimen?.id ? <button type="button" className="dex-danger-button" onClick={() => onDelete(specimen)} disabled={busy}>Delete record</button> : <button type="button" className="dex-secondary-button" onClick={onClose} disabled={busy}>Cancel</button>}
        <button className="dex-primary-button" disabled={busy || !pokemonId}>{busy ? "Saving…" : "Save individual"}</button>
      </footer>
    </form>
  </div>;
}

function CollectionInventoryPanel({ inventory, loading, busy, error, onReload, onSaveLocation, onDeleteLocation, onAddSpecimen, onEditSpecimen, onDownload, onClose }) {
  const [locationDraft, setLocationDraft] = useState(null);
  const [query, setQuery] = useState("");
  const specimens = filterPokedexSpecimens(inventory?.specimens || [], query);
  const kindLabel = (key) => POKEDEX_LOCATION_OPTIONS.find((option) => option.key === key)?.label || key;
  return <section className="dex-inventory-panel" aria-labelledby="dex-inventory-title">
    <header><div><span className="dex-kicker">YOUR POKÉMON</span><h3 id="dex-inventory-title">Collection inventory</h3><p>Keep notes about individual Pokémon and where you store them. This is separate from the Pokédex checklist.</p></div><button type="button" className="dex-icon-button" onClick={onClose} aria-label="Close collection inventory">×</button></header>
    {error && <p className="dex-inventory-error" role="alert">{error} <button type="button" onClick={onReload}>Try again</button></p>}
    {loading ? <div className="dex-tracker-loading is-inline"><span className="dex-ball" aria-hidden="true" /><h3>Loading private inventory…</h3></div> : <>
      <section className="dex-inventory-locations">
        <div className="dex-inventory-section-heading"><div><h4>Storage locations</h4><p>Name a game save, HOME area, cartridge, or another place where you keep Pokémon.</p></div><button type="button" className="dex-secondary-button" onClick={() => setLocationDraft({})}>＋ Add location</button></div>
        {locationDraft && <LocationForm key={locationDraft.id || `new:${locationDraft.kind || "game_save"}`} location={locationDraft} busy={busy} onSave={async (...args) => { const saved = await onSaveLocation(...args); if (saved) setLocationDraft(null); }} onCancel={() => setLocationDraft(null)} />}
        <div className="dex-location-list">{(inventory?.locations || []).map((location) => <article key={location.id}><span>{kindLabel(location.kind)}</span><strong>{location.name}</strong><small>{location.platform || "Platform not recorded"} · {location.specimen_count || 0} Pokémon</small><div><button type="button" onClick={() => setLocationDraft(location)}>Edit</button><button type="button" onClick={() => onDeleteLocation(location)} disabled={busy || location.specimen_count > 0}>Delete</button></div></article>)}</div>
        {!inventory?.locations?.length && !locationDraft && <p className="dex-inventory-empty">No storage locations yet. Add one before assigning individuals to a save or box.</p>}
      </section>
      <section className="dex-inventory-specimens">
        <div className="dex-inventory-section-heading"><div><h4>Individual Pokémon</h4><p>{inventory?.specimens?.length || 0} private records. Add duplicates, special Pokémon, or anyone whose history matters.</p></div><div><button type="button" className="dex-secondary-button" onClick={onDownload} disabled={!inventory?.specimens?.length}>Download CSV</button><button type="button" className="dex-primary-button" onClick={() => onAddSpecimen()}>＋ Add individual</button></div></div>
        {inventory?.specimens?.length > 0 && <label className="dex-inventory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search individuals, locations, origins, or destinations…" /></label>}
        <div className="dex-specimen-list">{specimens.map((specimen) => <button type="button" key={specimen.id} onClick={() => onEditSpecimen(specimen)}><img src={pokedexArtworkUrl(specimen.pokemon_id, specimen.is_shiny)} alt="" loading="lazy" /><span><strong>{pokedexSpecimenDisplayName(specimen)}</strong><small>{specimen.location_name || "Location not recorded"}{specimen.box_label ? ` · ${specimen.box_label}` : ""}{specimen.box_position ? ` · Slot ${specimen.box_position}` : ""}</small>{specimen.notes && <i>{specimen.notes}</i>}</span><b aria-hidden="true">›</b></button>)}</div>
        {!inventory?.specimens?.length && <p className="dex-inventory-empty">Your checklist stays unchanged. Add an individual only when you want to remember its identity, location, or history.</p>}
        {inventory?.specimens?.length > 0 && !specimens.length && <p className="dex-inventory-empty">No individual records match that search.</p>}
      </section>
    </>}
  </section>;
}

function CollectionSearchPanel({ index, loading, error, onLoad, onOpenTracker }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [game, setGame] = useState("");
  const [ball, setBall] = useState("");
  const [ribbon, setRibbon] = useState("");
  const [mark, setMark] = useState("");
  const [status, setStatus] = useState("all");
  const [alphaOnly, setAlphaOnly] = useState(false);
  const records = useMemo(() => [
    ...(index?.specimens || []).map((record) => ({ ...record, record_kind: "owned" })),
    ...(index?.wanted || []).map((record) => ({
      ...record, record_kind: "wanted", pokeball: "", ribbons: [], is_alpha: record.wants_alpha,
    })),
  ], [index]);
  const results = useMemo(() => filterPokedexSpecimens(records, {
    query, type, game, ball, ribbon, mark, alpha: alphaOnly ? true : null,
  }).filter((record) => status === "all" || record.record_kind === status),
  [records, query, type, game, ball, ribbon, mark, status, alphaOnly]);
  const types = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];
  return <section className="dex-collection-search" aria-labelledby="dex-collection-search-title">
    <header><div><span className="dex-kicker">ALL SAVES AND TRACKERS</span><h3 id="dex-collection-search-title">Search your whole collection</h3><p>Find owned Pokémon or hunt targets by name, type, game, Ball, ribbon, mark, form, Shiny status, or Alpha status.</p></div>{!index && <button type="button" className="dex-primary-button" onClick={onLoad} disabled={loading}>{loading ? "Loading…" : "Open collection search"}</button>}</header>
    {error && <p className="dex-inventory-error" role="alert">{error} <button type="button" onClick={onLoad}>Try again</button></p>}
    {index && <><div className="dex-collection-filters">
      <label className="is-wide">Name or detail<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pokémon, form, nickname, save, or note…" /></label>
      <label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Any type</option>{types.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      <label>Game or save<input value={game} onChange={(event) => setGame(event.target.value)} placeholder="Any game" /></label>
      <label>Poké Ball<select value={ball} onChange={(event) => setBall(event.target.value)}><option value="">Any Ball</option>{POKEDEX_BALL_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
      <label>Ribbon<select value={ribbon} onChange={(event) => setRibbon(event.target.value)}><option value="">Any ribbon</option>{POKEDEX_RIBBON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
      <label>Mark<select value={mark} onChange={(event) => setMark(event.target.value)}><option value="">Any mark</option>{POKEDEX_MARK_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    </div><div className="dex-collection-status" role="group" aria-label="Collection search status">{[["all", "Everything"], ["owned", "Owned"], ["wanted", "Looking for"]].map(([value, label]) => <button type="button" key={value} className={status === value ? "is-active" : ""} onClick={() => setStatus(value)}>{label}</button>)}<label><input type="checkbox" checked={alphaOnly} onChange={(event) => setAlphaOnly(event.target.checked)} /> Alpha only</label><span>{results.length.toLocaleString()} match{results.length === 1 ? "" : "es"}</span></div>
    <div className="dex-collection-results">{results.slice(0, 200).map((record) => <article key={`${record.record_kind}:${record.id}`}><img src={pokedexArtworkUrl(record.pokemon_id, record.is_shiny)} alt="" loading="lazy" /><div><span>{record.record_kind === "wanted" ? "LOOKING FOR" : "OWNED"}{record.is_alpha ? " · ALPHA" : ""}{record.is_shiny ? " · SHINY" : ""}</span><strong>{pokedexSpecimenDisplayName(record)}</strong><small>{pokedexPokemonTypes(record.pokemon).join(" / ") || "Type unavailable"} · {record.tracker_title}</small>{record.form_label && <i>{record.form_label}</i>}<p>{[record.origin_game, record.location_name, record.pokeball, ...(record.ribbons || []), ...(record.marks || [])].filter(Boolean).join(" · ")}</p></div><button type="button" onClick={() => onOpenTracker(record.tracker_id)}>Open tracker</button></article>)}</div>
    {!results.length && <p className="dex-inventory-empty">No saved Pokémon or hunt targets match those filters.</p>}{results.length > 200 && <p className="dex-inventory-hint">Showing the first 200 matches. Add another filter to narrow the list.</p>}</>}
  </section>;
}

function CreateTracker({ catalogs, busy, onCreate, onCancel }) {
  const [catalogKey, setCatalogKey] = useState(catalogs[0]?.key || "home");
  const [title, setTitle] = useState("");
  const [includeShiny, setIncludeShiny] = useState(false);
  const [includeAlpha, setIncludeAlpha] = useState(false);
  const groups = groupPokedexCatalogs(catalogs);
  const selected = catalogs.find((catalog) => catalog.key === catalogKey);
  return <form className="dex-tracker-create" onSubmit={(event) => { event.preventDefault(); onCreate({ catalogKey, title, includeShiny, includeAlpha: selected?.supports_alpha && includeAlpha }); }}>
    <header><div><span className="dex-kicker">NEW COLLECTION</span><h2>Choose your next Pokédex</h2></div>{onCancel && <button type="button" className="dex-icon-button" onClick={onCancel} aria-label="Close new tracker form">×</button>}</header>
    <label>Game or service
      <select value={catalogKey} onChange={(event) => { setCatalogKey(event.target.value); setIncludeAlpha(false); }} required>
        {groups.map((group) => <optgroup key={group.label} label={group.label}>{group.catalogs.map((catalog) => <option key={catalog.key} value={catalog.key}>{catalog.name} · {catalog.total}</option>)}</optgroup>)}
      </select>
    </label>
    <label>Tracker name <span>optional</span>
      <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder={selected?.name || "My living dex"} />
    </label>
    <label className="dex-shiny-choice">
      <input type="checkbox" checked={includeShiny} onChange={(event) => setIncludeShiny(event.target.checked)} />
      <span><b>Add a shiny dex</b><small>Track shiny forms separately without changing your standard progress.</small></span>
      <i aria-hidden="true">✦</i>
    </label>
    {selected?.supports_alpha && <label className="dex-shiny-choice dex-alpha-choice">
      <input type="checkbox" checked={includeAlpha} onChange={(event) => setIncludeAlpha(event.target.checked)} />
      <span><b>Add an Alpha Dex</b><small>Track only species that can legitimately be Alpha in this game.</small></span>
      <i aria-hidden="true">α</i>
    </label>}
    <button className="dex-primary-button" disabled={busy || !catalogKey}>{busy ? "Creating…" : "Create tracker"}</button>
  </form>;
}

export default function PokedexTrackerPage() {
  const [supabase] = useState(() => createPlatformBrowserClient());
  const trackerRequestRef = useRef(0);
  const inventoryRequestRef = useRef(0);
  const accountVersionRef = useRef(0);
  const [authState, setAuthState] = useState("loading");
  const [hub, setHub] = useState(null);
  const [active, setActive] = useState(null);
  const [activeId, setActiveId] = useState("");
  const [loadingTracker, setLoadingTracker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("standard");
  const [sectionKey, setSectionKey] = useState("");
  const [finderPokemonId, setFinderPokemonId] = useState(null);
  const [shown, setShown] = useState(POKEDEX_TRACKER_PAGE_SIZE);
  const [pending, setPending] = useState(() => new Set());
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [wantedTarget, setWantedTarget] = useState(null);
  const [wantedBusy, setWantedBusy] = useState(false);
  const [wantedError, setWantedError] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventory, setInventory] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [specimenTarget, setSpecimenTarget] = useState(null);
  const [collectionIndex, setCollectionIndex] = useState(null);
  const [collectionIndexLoading, setCollectionIndexLoading] = useState(false);
  const [collectionIndexError, setCollectionIndexError] = useState("");

  async function openTracker(id, accountVersion = accountVersionRef.current) {
    const requestId = ++trackerRequestRef.current;
    inventoryRequestRef.current += 1;
    if (!id) {
      setActive(null);
      setActiveId("");
      setLoadingTracker(false);
      return;
    }
    setActiveId(id);
    setLoadingTracker(true);
    setMessage("");
    const { data, error } = await supabase.rpc("get_my_pokedex_tracker", { p_tracker_id: id });
    if (requestId !== trackerRequestRef.current || accountVersion !== accountVersionRef.current) return;
    setLoadingTracker(false);
    if (error || !data) {
      setActive(null);
      setMessage(error?.message || "That Pokédex tracker could not be opened.");
      return;
    }
    setActive(data);
    setSettingsTitle(data.tracker.title);
    setMode("standard");
    setQuery("");
    setStatus("all");
    setSectionKey(groupPokedexSections(data.pokemon)[0]?.key || "");
    setFinderPokemonId(null);
    setShown(POKEDEX_TRACKER_PAGE_SIZE);
    setShowSettings(false);
    setDetailsTarget(null);
    setDetailsBusy(false);
    setDetailsError("");
    setWantedTarget(null);
    setWantedBusy(false);
    setWantedError("");
    setInventoryOpen(false);
    setInventory(null);
    setInventoryLoading(false);
    setInventoryBusy(false);
    setInventoryError("");
    setSpecimenTarget(null);
  }

  async function loadHub(preferredId, accountVersion = accountVersionRef.current) {
    const { data, error } = await supabase.rpc("get_my_pokedex_trackers");
    if (accountVersion !== accountVersionRef.current) return;
    if (error) {
      setHub(null);
      setMessage(error.message);
      return;
    }
    setHub(data);
    const nextId = preferredId === undefined
      ? activeId || data?.trackers?.[0]?.id || ""
      : preferredId || data?.trackers?.[0]?.id || "";
    if (nextId) await openTracker(nextId, accountVersion);
    else { setActive(null); setActiveId(""); setShowCreate(true); }
  }

  useEffect(() => {
    let mounted = true;
    let currentUserId = null;

    async function updateSession(session) {
      if (!mounted) return;
      const nextUserId = session?.user?.id || "";
      if (nextUserId === currentUserId) return;
      currentUserId = nextUserId;
      const accountVersion = ++accountVersionRef.current;
      trackerRequestRef.current += 1;
      inventoryRequestRef.current += 1;
      setHub(null);
      setActive(null);
      setActiveId("");
      setLoadingTracker(false);
      setBusy(false);
      setPending(new Set());
      setDetailsTarget(null);
      setDetailsBusy(false);
      setDetailsError("");
      setWantedTarget(null);
      setWantedBusy(false);
      setWantedError("");
      setInventoryOpen(false);
      setInventory(null);
      setInventoryLoading(false);
      setInventoryBusy(false);
      setInventoryError("");
      setSpecimenTarget(null);
      setCollectionIndex(null);
      setCollectionIndexLoading(false);
      setCollectionIndexError("");
      setSectionKey("");
      setFinderPokemonId(null);
      setMessage("");
      setShowCreate(false);
      setShowSettings(false);
      if (!nextUserId) {
        setAuthState("signed-out");
        return;
      }
      setAuthState("signed-in");
      await loadHub("", accountVersion);
    }

    supabase.auth.getSession().then(({ data }) => { void updateSession(data.session); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void updateSession(session); });
    return () => {
      mounted = false;
      accountVersionRef.current += 1;
      trackerRequestRef.current += 1;
      inventoryRequestRef.current += 1;
      listener.subscription.unsubscribe();
    };
  // The browser client is stable for the life of this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setShown(POKEDEX_TRACKER_PAGE_SIZE); }, [query, status, mode, sectionKey, activeId]);

  useEffect(() => {
    if (!detailsTarget && !specimenTarget && !wantedTarget) return undefined;
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      if (specimenTarget && !inventoryBusy) {
        setSpecimenTarget(null);
      }
      else if (wantedTarget && !wantedBusy) setWantedTarget(null);
      else if (detailsTarget && !detailsBusy) setDetailsTarget(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detailsTarget, detailsBusy, specimenTarget, inventoryBusy, wantedTarget, wantedBusy]);

  const sections = useMemo(() => groupPokedexSections(active?.pokemon), [active]);
  const activeSection = sections.find((section) => section.key === sectionKey) || sections[0] || null;
  const sectionEntries = activeSection?.entries || [];
  const standardProgress = useMemo(() => pokedexTrackerProgress(sectionEntries, "standard"), [sectionEntries]);
  const shinyProgress = useMemo(() => pokedexTrackerProgress(sectionEntries, "shiny"), [sectionEntries]);
  const alphaProgress = useMemo(() => pokedexTrackerProgress(sectionEntries, "alpha"), [sectionEntries]);
  const activeCatalog = hub?.catalogs?.find(({ key }) => key === active?.tracker?.catalog_key);
  const boxLayout = useMemo(() => pokedexBoxLayout(active?.tracker?.catalog_key, activeCatalog?.generation), [active?.tracker?.catalog_key, activeCatalog?.generation]);
  const ballOptions = useMemo(() => pokedexBallOptions(active?.tracker?.catalog_key, activeCatalog?.generation), [active?.tracker?.catalog_key, activeCatalog?.generation]);
  const ribbonGroups = useMemo(() => pokedexRibbonGroups(active?.tracker?.catalog_key), [active?.tracker?.catalog_key]);
  const markGroups = useMemo(() => pokedexMarkGroups(active?.tracker?.catalog_key), [active?.tracker?.catalog_key]);
  const inventoryBallOptions = useMemo(() => pokedexBallOptions("home", 10), []);
  const inventoryRibbonGroups = useMemo(() => pokedexRibbonGroups("home"), []);
  const inventoryMarkGroups = useMemo(() => pokedexMarkGroups("home"), []);
  const detailsEntry = active?.pokemon?.find(({ pokemon_id }) => pokemon_id === detailsTarget?.pokemonId) || null;
  const wantedEntry = active?.pokemon?.find(({ pokemon_id }) => pokemon_id === wantedTarget?.pokemonId) || null;
  const filtered = useMemo(() => filterPokedexEntries(sectionEntries, { query, status, mode }), [sectionEntries, query, status, mode]);
  const visible = filtered.slice(0, shown);

  async function createTracker(values) {
    const accountVersion = accountVersionRef.current;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_my_pokedex_tracker", {
      p_catalog_key: values.catalogKey,
      p_title: values.title.trim() || null,
      p_include_shiny: values.includeShiny,
      p_include_alpha: Boolean(values.includeAlpha),
    });
    if (accountVersion !== accountVersionRef.current) return;
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    trackPokedexCollectorEvent("tracker_created", { kind: values.catalogKey === "home" ? "home" : "game" });
    setShowCreate(false);
    await loadHub(data.id);
  }

  async function toggleEntry(entry) {
    const trackerId = active?.tracker?.id;
    if (!trackerId) return;
    const accountVersion = accountVersionRef.current;
    const isShiny = mode === "shiny";
    const isAlpha = mode === "alpha";
    const field = isShiny ? "shiny_caught" : isAlpha ? "alpha_caught" : "caught";
    const caught = !entry[field];
    const pendingKey = `${trackerId}:${entry.pokemon_id}:${mode}`;
    if (pending.has(pendingKey)) return;
    setPending((current) => new Set(current).add(pendingKey));
    setActive((current) => current?.tracker?.id === trackerId
      ? { ...current, pokemon: current.pokemon.map((pokemon) => pokemon.pokemon_id === entry.pokemon_id ? { ...pokemon, [field]: caught } : pokemon) }
      : current);
    const { data, error } = isAlpha
      ? await supabase.rpc("set_my_pokedex_tracker_alpha_entry", {
        p_tracker_id: trackerId,
        p_pokemon_id: entry.pokemon_id,
        p_caught: caught,
      })
      : await supabase.rpc("set_my_pokedex_tracker_entry", {
        p_tracker_id: trackerId,
        p_pokemon_id: entry.pokemon_id,
        p_is_shiny: isShiny,
        p_caught: caught,
      });
    if (accountVersion !== accountVersionRef.current) return;
    setPending((current) => { const next = new Set(current); next.delete(pendingKey); return next; });
    if (error) {
      setActive((current) => current?.tracker?.id === trackerId
        ? { ...current, pokemon: current.pokemon.map((pokemon) => pokemon.pokemon_id === entry.pokemon_id ? { ...pokemon, [field]: !caught } : pokemon) }
        : current);
      setMessage(`Progress was not saved: ${error.message}`);
      return;
    }
    setHub((current) => current ? {
      ...current,
      trackers: current.trackers.map((tracker) => tracker.id === trackerId
        ? { ...tracker, caught: data.caught ?? tracker.caught, shiny_caught: data.shiny_caught ?? tracker.shiny_caught, alpha_caught: data.alpha_caught ?? tracker.alpha_caught, updated_at: new Date().toISOString() }
        : tracker),
    } : current);
    if (!isAlpha && active.tracker.catalog_key !== "home" && hub?.trackers?.some((tracker) => tracker.catalog_key === "home")) {
      const refreshed = await supabase.rpc("get_my_pokedex_trackers");
      if (accountVersion === accountVersionRef.current && !refreshed.error && refreshed.data) setHub(refreshed.data);
    }
    setMessage("");
  }

  function openEntryDetails(entry) {
    setDetailsTarget({ pokemonId: entry.pokemon_id, mode });
    setDetailsError("");
  }

  async function saveEntryDetails(values) {
    if (!active || !detailsEntry || !detailsTarget) return;
    const accountVersion = accountVersionRef.current;
    const trackerId = active.tracker.id;
    const detailMode = detailsTarget.mode;
    setDetailsBusy(true);
    setDetailsError("");
    const { data, error } = await supabase.rpc("set_my_pokedex_tracker_entry_details_v2", {
      p_tracker_id: trackerId,
      p_pokemon_id: detailsEntry.pokemon_id,
      p_is_shiny: detailMode === "shiny",
      p_payload: values,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setDetailsBusy(false);
    if (error || !data) {
      setDetailsError(error?.message || "Those collection details could not be saved.");
      return;
    }
    const prefix = detailMode === "shiny" ? "shiny_" : "";
    setActive((current) => current?.tracker?.id === trackerId ? {
      ...current,
      pokemon: current.pokemon.map((pokemon) => pokemon.pokemon_id === detailsEntry.pokemon_id ? {
        ...pokemon,
        [`${prefix}pokeball`]: data.pokeball,
        [`${prefix}ribbons`]: data.ribbons,
        [`${prefix}marks`]: data.marks,
        [`${prefix}notes`]: data.notes,
      } : pokemon),
    } : current);
    setDetailsTarget(null);
    setMessage("");
  }

  function openWanted(entry) {
    setWantedTarget({ pokemonId: entry.pokemon_id, mode });
    setWantedError("");
  }

  async function saveWanted(wanted, values) {
    if (!active || !wantedEntry || !wantedTarget) return;
    const accountVersion = accountVersionRef.current;
    const trackerId = active.tracker.id;
    const targetMode = wantedTarget.mode;
    setWantedBusy(true);
    setWantedError("");
    const { data, error } = await supabase.rpc("set_my_pokedex_tracker_wanted_entry", {
      p_tracker_id: trackerId,
      p_pokemon_id: wantedEntry.pokemon_id,
      p_is_shiny: targetMode === "shiny",
      p_wanted: wanted,
      p_payload: values,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setWantedBusy(false);
    if (error || !data) { setWantedError(error?.message || "That hunt target could not be saved."); return; }
    const prefix = targetMode === "shiny" ? "shiny_" : "";
    setActive((current) => current?.tracker?.id === trackerId ? {
      ...current,
      pokemon: current.pokemon.map((pokemon) => pokemon.pokemon_id === wantedEntry.pokemon_id ? {
        ...pokemon,
        [`${prefix}wanted`]: Boolean(data.wanted),
        [`${prefix}wanted_form`]: data.form_label || "",
        [`${prefix}wanted_marks`]: data.marks || [],
        [`${prefix}wanted_alpha`]: Boolean(data.wants_alpha),
        [`${prefix}wanted_notes`]: data.notes || "",
      } : pokemon),
    } : current);
    setWantedTarget(null);
    if (collectionIndex) await loadCollectionIndex();
  }

  async function loadCollectionIndex() {
    const accountVersion = accountVersionRef.current;
    setCollectionIndexLoading(true);
    setCollectionIndexError("");
    const { data, error } = await supabase.rpc("get_my_pokedex_collection_index");
    if (accountVersion !== accountVersionRef.current) return null;
    setCollectionIndexLoading(false);
    if (error || !data) {
      setCollectionIndexError(error?.message || "Your full collection could not be searched.");
      return null;
    }
    setCollectionIndex(data);
    return data;
  }

  async function loadInventory(trackerId = active?.tracker?.id) {
    if (!trackerId) return null;
    const requestId = ++inventoryRequestRef.current;
    const accountVersion = accountVersionRef.current;
    setInventoryLoading(true);
    setInventoryError("");
    const { data, error } = await supabase.rpc("get_my_pokedex_collection_inventory", { p_tracker_id: trackerId });
    if (accountVersion !== accountVersionRef.current || requestId !== inventoryRequestRef.current) return null;
    setInventoryLoading(false);
    if (error || !data) {
      setInventoryError(error?.message || "Your collection inventory could not be opened.");
      return null;
    }
    setInventory(data);
    setHub((current) => current ? {
      ...current,
      trackers: current.trackers.map((tracker) => tracker.id === trackerId ? {
        ...tracker,
        location_count: data.locations?.length || 0,
        specimen_count: data.specimens?.length || 0,
      } : tracker),
    } : current);
    return data;
  }

  async function openInventory(entry = null) {
    if (!active) return;
    trackPokedexCollectorEvent("inventory_opened", { kind: entry ? "entry" : "tracker" });
    setInventoryOpen(true);
    const loaded = inventory?.tracker_id === active.tracker.id ? inventory : await loadInventory(active.tracker.id);
    if (entry && loaded) setSpecimenTarget({ pokemon_id: entry.pokemon_id, is_shiny: mode === "shiny" });
  }

  function openFinder(entry) {
    setFinderPokemonId(entry.pokemon_id);
    window.setTimeout(() => document.getElementById("pokemon-finder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function saveInventoryLocation(locationId, payload) {
    if (!active) return false;
    const accountVersion = accountVersionRef.current;
    setInventoryBusy(true);
    setInventoryError("");
    const { error } = await supabase.rpc("save_my_pokedex_collection_location", {
      p_tracker_id: active.tracker.id,
      p_location_id: locationId,
      p_payload: payload,
    });
    if (accountVersion !== accountVersionRef.current) return false;
    setInventoryBusy(false);
    if (error) { setInventoryError(error.message); return false; }
    await loadInventory(active.tracker.id);
    return true;
  }

  async function deleteInventoryLocation(location) {
    if (!active || !window.confirm(`Delete the storage location “${location.name}”?`)) return;
    const accountVersion = accountVersionRef.current;
    setInventoryBusy(true);
    setInventoryError("");
    const { data, error } = await supabase.rpc("delete_my_pokedex_collection_location", {
      p_tracker_id: active.tracker.id,
      p_location_id: location.id,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setInventoryBusy(false);
    if (error || !data) { setInventoryError(error?.message || "That storage location could not be deleted."); return; }
    await loadInventory(active.tracker.id);
  }

  async function saveInventorySpecimen(specimenId, payload) {
    if (!active) return;
    const accountVersion = accountVersionRef.current;
    setInventoryBusy(true);
    setInventoryError("");
    const { data, error } = await supabase.rpc("save_my_pokedex_collection_specimen", {
      p_tracker_id: active.tracker.id,
      p_specimen_id: specimenId,
      p_payload: payload,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setInventoryBusy(false);
    if (error || !data) { setInventoryError(error?.message || "That individual Pokémon could not be saved."); return; }
    setSpecimenTarget(null);
    await loadInventory(active.tracker.id);
    if (collectionIndex) await loadCollectionIndex();
  }

  async function deleteInventorySpecimen(specimen) {
    if (!active || !window.confirm(`Delete the private record for “${pokedexSpecimenDisplayName(specimen)}”?`)) return;
    const accountVersion = accountVersionRef.current;
    setInventoryBusy(true);
    setInventoryError("");
    const { data, error } = await supabase.rpc("delete_my_pokedex_collection_specimen", {
      p_tracker_id: active.tracker.id,
      p_specimen_id: specimen.id,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setInventoryBusy(false);
    if (error || !data) { setInventoryError(error?.message || "That individual Pokémon could not be deleted."); return; }
    setSpecimenTarget(null);
    await loadInventory(active.tracker.id);
    if (collectionIndex) await loadCollectionIndex();
  }

  function downloadInventory() {
    if (!active || !inventory) return;
    const safeTitle = active.tracker.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pokedex";
    const exportedAt = new Date().toISOString();
    const content = pokedexInventoryCsv(inventory);
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}-collection-inventory-${exportedAt.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveSettings(
    includeShiny = active?.tracker.include_shiny,
    includeAlpha = active?.tracker.include_alpha,
  ) {
    if (!active) return;
    const accountVersion = accountVersionRef.current;
    const trackerId = active.tracker.id;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("update_my_pokedex_tracker", {
      p_tracker_id: trackerId,
      p_title: settingsTitle.trim() || active.tracker.title,
      p_include_shiny: includeShiny,
      p_include_alpha: Boolean(includeAlpha),
    });
    if (accountVersion !== accountVersionRef.current) return;
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setShowSettings(false);
    await loadHub(trackerId, accountVersion);
  }

  async function deleteTracker() {
    if (!active || !window.confirm(`Delete “${active.tracker.title}” and all of its saved progress? This cannot be undone.`)) return;
    const accountVersion = accountVersionRef.current;
    const trackerId = active.tracker.id;
    setBusy(true);
    const { data, error } = await supabase.rpc("delete_my_pokedex_tracker", { p_tracker_id: trackerId });
    if (accountVersion !== accountVersionRef.current) return;
    setBusy(false);
    if (error || !data) { setMessage(error?.message || "That tracker could not be deleted."); return; }
    const nextId = hub?.trackers?.find((tracker) => tracker.id !== trackerId)?.id || "";
    setActive(null);
    setActiveId("");
    await loadHub(nextId, accountVersion);
  }

  if (authState === "loading") return <main className="dex-tracker-shell"><section className="dex-tracker-loading"><span className="dex-ball" aria-hidden="true" /><h1>Pokédex Tracker</h1><p>Checking your DraftCenter account…</p></section></main>;

  if (authState === "signed-out") return <main className="dex-tracker-shell">
    <section className="dex-tracker-signin">
      <span className="dex-kicker">YOUR POKÉDEXES</span>
      <h1>Keep every game dex in one place.</h1>
      <p>Sign in to track numbered and postgame Pokédexes, Pokémon GO, forms, marks, shinies, supported Legends Alpha lists, and the Pokémon you are still hunting.</p>
      <div><a className="dex-primary-button" href="/#member-access">Sign in to start</a><a className="dex-secondary-button" href="/pokemon">Explore the Pokédex</a></div>
    </section>
  </main>;

  return <main className={`dex-tracker-shell ${mode === "shiny" ? "shiny-mode" : ""} ${mode === "alpha" ? "alpha-mode" : ""}`}>
    <header className="dex-tracker-hero">
      <div>
        <span className="dex-kicker">POKÉDEX TRACKER</span>
        <h1>One place for every dex</h1>
        <p>Track each numbered game and DLC Pokédex, verified postgame encounters, Pokémon GO, persistent forms, marks, individual Pokémon, and private hunt targets.</p>
      </div>
      <div className="dex-tracker-hero-card" aria-label="Tracker benefits">
        <span><b>39</b> games and services</span>
        <span><b>Postgame</b> encounters included</span>
        <span><b>Private</b> account saving</span>
      </div>
    </header>

    {message && <p className="dex-tracker-message" role="status" aria-live="polite">{message}</p>}

    <CollectionSearchPanel index={collectionIndex} loading={collectionIndexLoading} error={collectionIndexError} onLoad={loadCollectionIndex} onOpenTracker={(trackerId) => { void openTracker(trackerId); document.getElementById("dex-tracker-workspace")?.scrollIntoView({ behavior: "smooth" }); }} />

    <section className="dex-tracker-workspace" id="dex-tracker-workspace">
      <aside className="dex-tracker-sidebar">
        <div className="dex-tracker-sidebar-heading"><div><span className="dex-kicker">MY TRACKERS</span><strong>{hub?.trackers?.length || 0} collections</strong></div><button type="button" onClick={() => setShowCreate(true)} aria-label="Create a new Pokédex tracker">+</button></div>
        <div className="dex-tracker-list">
          {(hub?.trackers || []).map((tracker) => {
            const percent = tracker.total ? Math.round((tracker.caught / tracker.total) * 100) : 0;
            return <button type="button" key={tracker.id} className={tracker.id === activeId ? "is-active" : ""} onClick={() => openTracker(tracker.id)}>
              <span className={`dex-mini-icon ${tracker.catalog_key === "home" ? "is-home" : ""}`} aria-hidden="true">{tracker.catalog_key === "home" ? "⌂" : "◉"}</span>
              <span><strong>{tracker.title}</strong><small>{tracker.catalog_name}</small><i><b style={{ width: `${percent}%` }} /></i></span>
              <em>{percent}%</em>
            </button>;
          })}
        </div>
        {!showCreate && <button type="button" className="dex-new-button" onClick={() => setShowCreate(true)}>＋ New tracker</button>}
        {showCreate && <CreateTracker catalogs={hub?.catalogs || []} busy={busy} onCreate={createTracker} onCancel={hub?.trackers?.length ? () => setShowCreate(false) : null} />}
      </aside>

      <section className="dex-tracker-main">
        {loadingTracker && <div className="dex-tracker-loading is-inline"><span className="dex-ball" aria-hidden="true" /><h2>Loading this Pokédex…</h2></div>}
        {!loadingTracker && !active && <section className="dex-tracker-welcome">
          <div className="dex-welcome-orbit" aria-hidden="true"><span>001</span><span>151</span><span>1025</span><i>✓</i></div>
          <span className="dex-kicker">READY WHEN YOU ARE</span>
          <h2>Choose a game to begin.</h2>
          <p>Each tracker follows that game's Pokédex order. Games with regional or DLC dexes include a separate section for each one.</p>
          <button className="dex-primary-button" type="button" onClick={() => setShowCreate(true)}>Create my first tracker</button>
        </section>}
        {!loadingTracker && active && <>
          <header className="dex-active-header">
            <div><span className="dex-kicker">{active.tracker.catalog_name}</span><h2>{active.tracker.title}</h2><p>{standardProgress.caught.toLocaleString()} of {standardProgress.total.toLocaleString()} in {activeSection?.label || "this dex"}{active.tracker.include_shiny ? ` · ${shinyProgress.caught.toLocaleString()} shinies found` : ""}{active.tracker.include_alpha ? ` · ${alphaProgress.caught.toLocaleString()} Alphas found` : ""}</p>{active.tracker.catalog_key === "home" && <small>Pokémon marked in your game trackers count here automatically.</small>}</div>
            <div className="dex-active-actions"><button type="button" className="dex-primary-button" onClick={() => openInventory()}>Collection inventory{inventory?.specimens?.length ? ` · ${inventory.specimens.length}` : ""}</button><button type="button" className="dex-secondary-button" onClick={() => setShowSettings((value) => !value)}>Manage tracker</button></div>
          </header>

          {showSettings && <form className="dex-tracker-settings" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
            <label>Tracker name<input value={settingsTitle} onChange={(event) => setSettingsTitle(event.target.value)} maxLength={80} /></label>
            {!active.tracker.include_shiny && <button type="button" className="dex-shiny-button" onClick={() => saveSettings(true)}>✦ Add shiny dex</button>}
            {active.tracker.supports_alpha && !active.tracker.include_alpha && <button type="button" className="dex-shiny-button dex-alpha-button" onClick={() => saveSettings(undefined, true)}>α Add Alpha Dex</button>}
            <button className="dex-primary-button" disabled={busy}>{busy ? "Saving…" : "Save name"}</button>
            <button type="button" className="dex-danger-button" onClick={deleteTracker} disabled={busy}>Delete tracker</button>
          </form>}

          {sections.length > 1 && <nav className="dex-section-tabs" aria-label="Game Pokédex sections">{sections.map((section) => {
            const progress = pokedexTrackerProgress(section.entries, mode);
            return <button type="button" key={section.key} className={section.key === activeSection?.key ? "is-active" : ""} onClick={() => { setSectionKey(section.key); setQuery(""); setStatus("all"); }}><strong>{section.label}</strong><span>{progress.caught}/{progress.total}</span></button>;
          })}</nav>}
          {activeSection?.key === "obtainable" && <p className="dex-obtainable-note"><strong>Other obtainable Pokémon</strong> are verified encounters outside this game’s numbered Pokédex, including postgame and supported special encounters. Their displayed number is the National Dex number.</p>}

          <section className={`dex-progress-panel ${active.tracker.supports_alpha ? "has-alpha" : ""}`}>
            <ProgressRing progress={standardProgress} label="Standard" />
            {active.tracker.include_shiny ? <ProgressRing progress={shinyProgress} label="Shiny" shiny /> : <button className="dex-add-shiny-card" type="button" onClick={() => saveSettings(true)}><b>✦</b><span><strong>Add a shiny dex</strong><small>A second, independent checklist</small></span></button>}
            {active.tracker.include_alpha ? <ProgressRing progress={alphaProgress} label="Alpha" alpha /> : active.tracker.supports_alpha ? <button className="dex-add-shiny-card dex-add-alpha-card" type="button" onClick={() => saveSettings(undefined, true)}><b>α</b><span><strong>Add an Alpha Dex</strong><small>Only legitimately obtainable Alpha species</small></span></button> : null}
            <div className="dex-progress-copy"><span>{standardProgress.total - standardProgress.caught === 0 ? "COMPLETE" : "NEXT MILESTONE"}</span><strong>{standardProgress.total - standardProgress.caught === 0 ? "Pokédex complete!" : `${Math.min(standardProgress.total, Math.ceil((standardProgress.caught + 1) / 25) * 25).toLocaleString()} caught`}</strong><small>Your progress and collection notes stay private to your account.</small></div>
          </section>

          {inventoryOpen && <CollectionInventoryPanel inventory={inventory} loading={inventoryLoading} busy={inventoryBusy} error={inventoryError} onReload={() => loadInventory()} onSaveLocation={saveInventoryLocation} onDeleteLocation={deleteInventoryLocation} onAddSpecimen={() => setSpecimenTarget({ pokemon_id: sectionEntries[0]?.pokemon_id || null, is_shiny: false })} onEditSpecimen={setSpecimenTarget} onDownload={downloadInventory} onClose={() => { setInventoryOpen(false); setSpecimenTarget(null); }} />}

          <div className="dex-mode-tabs" role="tablist" aria-label="Pokédex progress type">
            <button type="button" role="tab" aria-selected={mode === "standard"} onClick={() => setMode("standard")}><span aria-hidden="true">◉</span> Standard dex <b>{standardProgress.caught}/{standardProgress.total}</b></button>
            {active.tracker.include_shiny && <button type="button" role="tab" aria-selected={mode === "shiny"} onClick={() => setMode("shiny")}><span aria-hidden="true">✦</span> Shiny dex <b>{shinyProgress.caught}/{shinyProgress.total}</b></button>}
            {active.tracker.include_alpha && <button type="button" role="tab" aria-selected={mode === "alpha"} onClick={() => setMode("alpha")}><span aria-hidden="true">α</span> Alpha Dex <b>{alphaProgress.caught}/{alphaProgress.total}</b></button>}
          </div>

          <section className="dex-tracker-controls">
            <label className="dex-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or number…" /></label>
            <div role="group" aria-label="Progress filter">
              {["all", "caught", "missing"].map((value) => <button type="button" key={value} className={status === value ? "is-active" : ""} onClick={() => setStatus(value)}>{value === "all" ? "All" : value === "caught" ? mode === "shiny" ? "Found" : "Registered" : "Missing"}</button>)}
            </div>
            <span><b>{filtered.length.toLocaleString()}</b> shown</span>
          </section>

          <PokedexBoxPlanner entries={sectionEntries} layout={boxLayout} mode={mode} pending={pending} onToggle={toggleEntry} sectionKey={activeSection?.key} sectionLabel={activeSection?.label || "Pokédex"} trackerId={active.tracker.id} />

          {visible.length ? <section className="dex-pokemon-grid" aria-label={`${mode === "shiny" ? "Shiny" : mode === "alpha" ? "Alpha" : "Standard"} Pokédex entries`}>
            {visible.map((entry) => <PokemonCard key={`${entry.pokedex_key}:${entry.pokemon_id}`} entry={entry} mode={mode} sectionLabel={activeSection?.label || "Pokédex"} pending={pending.has(`${active.tracker.id}:${entry.pokemon_id}:${mode}`)} ballOptions={ballOptions} onToggle={toggleEntry} onDetails={openEntryDetails} onInventory={openInventory} onWanted={openWanted} onFind={openFinder} />)}
          </section> : <section className="dex-no-results"><span aria-hidden="true">⌕</span><h3>No Pokémon match this view.</h3><p>Try a different name or switch the progress filter.</p></section>}
          {shown < filtered.length && <button type="button" className="dex-load-more" onClick={() => setShown((count) => count + POKEDEX_TRACKER_PAGE_SIZE)}>Show {Math.min(POKEDEX_TRACKER_PAGE_SIZE, filtered.length - shown)} more Pokémon</button>}
        </>}
      </section>
    </section>
    {active && <PokedexPokemonFinder
      activeCatalogKey={active.tracker.catalog_key}
      entries={active.pokemon}
      games={hub?.catalogs || []}
      selectedPokemonId={finderPokemonId}
      supabase={supabase}
      onOpenTracker={{
        available: (catalogKey) => Boolean(hub?.trackers?.some((tracker) => tracker.catalog_key === catalogKey)),
        open: (catalogKey) => {
          const tracker = hub?.trackers?.find((candidate) => candidate.catalog_key === catalogKey);
          if (tracker) void openTracker(tracker.id);
        },
      }}
    />}
    <PokemonChampionsAchievementCenter supabase={supabase} />
    <PokedexCollectorLaunchPanel
      supabase={supabase}
      hub={hub}
      active={active}
      inventory={inventory}
      onEnsureInventory={() => loadInventory(active?.tracker?.id)}
      onReload={(preferredId) => loadHub(preferredId, accountVersionRef.current)}
    />
    {detailsEntry && detailsTarget && <EntryDetailsDialog key={`${detailsEntry.pokemon_id}:${detailsTarget.mode}`} entry={detailsEntry} mode={detailsTarget.mode} ballOptions={ballOptions} ribbonGroups={ribbonGroups} markGroups={markGroups} busy={detailsBusy} error={detailsError} onSave={saveEntryDetails} onClose={() => setDetailsTarget(null)} />}
    {wantedEntry && wantedTarget && <WantedDialog key={`${wantedEntry.pokemon_id}:${wantedTarget.mode}`} entry={wantedEntry} mode={wantedTarget.mode} markGroups={inventoryMarkGroups} busy={wantedBusy} error={wantedError} onSave={saveWanted} onClose={() => setWantedTarget(null)} />}
    {active && specimenTarget && <SpecimenDialog key={specimenTarget.id || `new:${specimenTarget.pokemon_id}:${specimenTarget.is_shiny}`} specimen={specimenTarget} entries={uniquePokedexEntries(active.pokemon)} locations={inventory?.locations || []} ballOptions={inventoryBallOptions} ribbonGroups={inventoryRibbonGroups} markGroups={inventoryMarkGroups} busy={inventoryBusy} error={inventoryError} onSave={saveInventorySpecimen} onDelete={deleteInventorySpecimen} onClose={() => { if (!inventoryBusy) { setSpecimenTarget(null); setInventoryError(""); } }} />}
  </main>;
}
