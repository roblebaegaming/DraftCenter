"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPlatformBrowserClient } from "../platform/supabase";
import PokedexCollectorLaunchPanel from "./PokedexCollectorLaunchPanel";
import PokedexRescueDashboard from "./PokedexRescueDashboard";
import PokedexRescueGuideDialog from "./PokedexRescueGuideDialog";
import {
  bankRescueExport,
  BANK_RESCUE_ACTIONS,
  buildBankRescueReview,
} from "../lib/pokemonBankRescue";
import {
  filterPokedexEntries,
  filterPokedexSpecimens,
  groupPokedexCatalogs,
  pokedexBallOptions,
  pokedexEntryDetails,
  pokedexHasEntryDetails,
  pokedexArtworkUrl,
  pokedexHomePlacement,
  pokedexInventoryCsv,
  pokedexRibbonGroups,
  pokedexSpecimenDisplayName,
  pokedexTrackerProgress,
  POKEDEX_ENTRY_NOTE_MAX_LENGTH,
  POKEDEX_IMPORTANCE_OPTIONS,
  POKEDEX_INVENTORY_NOTE_MAX_LENGTH,
  POKEDEX_LOCATION_NOTE_MAX_LENGTH,
  POKEDEX_LOCATION_OPTIONS,
  POKEDEX_TRACKER_PAGE_SIZE,
  POKEDEX_TRANSFER_STATE_OPTIONS,
} from "../lib/pokedexTracker";
import { trackPokedexCollectorEvent } from "../lib/pokedexAnalytics";

function ProgressRing({ progress, label, shiny = false }) {
  return <div className={`dex-tracker-ring ${shiny ? "is-shiny" : ""}`} style={{ "--dex-progress": `${progress.percentage * 3.6}deg` }}>
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

function PokemonCard({ entry, mode, pending, onToggle, onDetails, onInventory, placement = null, ballOptions = [] }) {
  const isShiny = mode === "shiny";
  const caught = isShiny ? entry.shiny_caught : entry.caught;
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
  return <article className={`dex-tracker-pokemon ${caught ? "is-caught" : ""} ${isShiny ? "is-shiny" : ""} ${hasDetails ? "has-details" : ""}`}>
    <button
      type="button"
      className="dex-entry-catch"
      aria-pressed={caught}
      aria-label={`${caught ? "Remove" : "Mark"} ${isShiny ? "shiny " : ""}${entry.pokemon} ${caught ? "from" : "in"} this Pokédex`}
      disabled={pending}
      onClick={() => onToggle(entry)}
    >
      <span className="dex-tracker-check" aria-hidden="true">{pending ? "···" : caught ? "✓" : "+"}</span>
      <span className="dex-tracker-number">#{String(entry.dex_number).padStart(3, "0")}</span>
      <span className="dex-tracker-art">
        <img src={artwork} alt="" loading="lazy" onError={handleImageError} />
        {isShiny && <i aria-hidden="true">✦</i>}
      </span>
      <strong>{entry.pokemon}</strong>
      <small title={placement ? `Pokémon HOME page ${placement.page}, box ${placement.box}, position ${placement.position}, row ${placement.row}, slot ${placement.slot}` : undefined}>
        {placement ? `HOME P${placement.page} · B${placement.box} · Slot ${placement.position}` : entry.pokedex_key === "national" ? "National Pokédex" : String(entry.pokedex_key).replaceAll("-", " ")}
      </small>
    </button>
    <div className="dex-entry-actions">
      <button type="button" className="dex-entry-details-trigger" onClick={() => onDetails(entry)} aria-label={`Edit ${isShiny ? "shiny " : ""}${entry.pokemon} collection details`}>
        {hasDetails ? <>
          {ball && <BallBadge option={ball} compact />}
          {details.ribbons.length > 0 && <span title={`${details.ribbons.length} saved ribbon${details.ribbons.length === 1 ? "" : "s"}`}>◇ {details.ribbons.length}</span>}
          {details.notes.trim() && <span title="A private note is saved">✎</span>}
        </> : <span>＋ Details</span>}
      </button>
      <button type="button" className="dex-entry-inventory-trigger" onClick={() => onInventory(entry)} aria-label={`Record an individual ${isShiny ? "shiny " : ""}${entry.pokemon}`}>＋ Individual</button>
    </div>
  </article>;
}

function EntryDetailsDialog({ entry, mode, ballOptions, ribbonGroups, busy, error, onSave, onClose }) {
  const initial = pokedexEntryDetails(entry, mode);
  const [pokeball, setPokeball] = useState(initial.pokeball);
  const [ribbons, setRibbons] = useState(initial.ribbons);
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
        <button type="button" className="dex-secondary-button" onClick={() => { setPokeball(""); setRibbons([]); setNotes(""); }} disabled={busy}>Clear fields</button>
        <button type="button" className="dex-primary-button" onClick={() => onSave({ pokeball, ribbons, notes })} disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
      </footer>
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
    <label>Location name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Example: Bank Box 1" /></label>
    <label>Console or platform <span>optional</span><input value={platform} onChange={(event) => setPlatform(event.target.value)} maxLength={80} placeholder="Example: Blue 3DS" /></label>
    <label className="dex-location-notes">Private note <span>optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={POKEDEX_LOCATION_NOTE_MAX_LENGTH} rows={2} /></label>
    <div><button type="button" className="dex-secondary-button" onClick={onCancel} disabled={busy}>Cancel</button><button className="dex-primary-button" disabled={busy || !name.trim()}>{busy ? "Saving…" : location?.id ? "Save location" : "Add location"}</button></div>
  </form>;
}

function SpecimenDialog({ specimen, entries, locations, ballOptions, ribbonGroups, busy, error, onSave, onDelete, onClose }) {
  const [pokemonId, setPokemonId] = useState(String(specimen?.pokemon_id || entries[0]?.pokemon_id || ""));
  const [formLabel, setFormLabel] = useState(specimen?.form_label || "");
  const [nickname, setNickname] = useState(specimen?.nickname || "");
  const [isShiny, setIsShiny] = useState(Boolean(specimen?.is_shiny));
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
  const [isEvent, setIsEvent] = useState(Boolean(specimen?.is_event));
  const [importance, setImportance] = useState(specimen?.importance || "standard");
  const [destination, setDestination] = useState(specimen?.intended_destination || "");
  const [transferState, setTransferState] = useState(specimen?.transfer_state || "not_planned");
  const [transferredOn, setTransferredOn] = useState(specimen?.transferred_on || "");
  const [notes, setNotes] = useState(specimen?.notes || "");
  const [ribbonQuery, setRibbonQuery] = useState("");
  const selectedEntry = entries.find((entry) => String(entry.pokemon_id) === pokemonId);
  const selectedBall = ballOptions.find((option) => option.key === pokeball);
  const ribbonNeedle = ribbonQuery.trim().toLocaleLowerCase();
  const visibleRibbonGroups = ribbonGroups.map((group) => ({
    ...group,
    options: group.options.filter((option) => !ribbonNeedle || option.label.toLocaleLowerCase().includes(ribbonNeedle)),
  })).filter((group) => group.options.length);

  function toggleRibbon(key) {
    setRibbons((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  function submit(event) {
    event.preventDefault();
    onSave(specimen?.id || null, {
      pokemon_id: Number(pokemonId), form_label: formLabel, nickname, is_shiny: isShiny,
      gender, level: level || null, original_trainer: originalTrainer, origin_game: originGame, origin_mark: originMark,
      location_id: locationId || null, box_label: boxLabel, box_position: boxPosition || null,
      pokeball: pokeball || null, ribbons, is_event: isEvent, importance,
      intended_destination: destination, transfer_state: transferState,
      transferred_on: transferState === "transferred" ? transferredOn || null : null, notes,
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
          <div><span className="dex-details-icon" aria-hidden="true">◉</span><div><h3>Identity</h3><p>Describe this actual individual. A free-text form label does not imply reviewed availability.</p></div></div>
          <div className="dex-specimen-grid">
            <label className="is-wide">Species<select value={pokemonId} onChange={(event) => setPokemonId(event.target.value)} required>{entries.map((entry) => <option key={entry.pokemon_id} value={entry.pokemon_id}>#{String(entry.dex_number).padStart(4, "0")} · {entry.pokemon}</option>)}</select></label>
            <label>Nickname<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={50} /></label>
            <label>Form description<input value={formLabel} onChange={(event) => setFormLabel(event.target.value)} maxLength={80} placeholder="Optional" /></label>
            <label>Gender<select value={gender} onChange={(event) => setGender(event.target.value)}><option value="unknown">Not recorded</option><option value="male">Male</option><option value="female">Female</option><option value="genderless">Genderless</option></select></label>
            <label>Level<input type="number" min="1" max="100" value={level} onChange={(event) => setLevel(event.target.value)} /></label>
            <label>Original Trainer<input value={originalTrainer} onChange={(event) => setOriginalTrainer(event.target.value)} maxLength={50} /></label>
            <label>Origin game<input value={originGame} onChange={(event) => setOriginGame(event.target.value)} maxLength={80} /></label>
            <label>Origin mark<input value={originMark} onChange={(event) => setOriginMark(event.target.value)} maxLength={80} placeholder="Optional" /></label>
          </div>
          <div className="dex-specimen-checks"><label><input type="checkbox" checked={isShiny} onChange={(event) => setIsShiny(event.target.checked)} /> Shiny</label><label><input type="checkbox" checked={isEvent} onChange={(event) => setIsEvent(event.target.checked)} /> Event Pokémon</label></div>
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
          <div><span className="dex-details-icon" aria-hidden="true">◓</span><div><h3>Ball and ribbons</h3><p>These belong to this individual record and can differ from the quick checklist details.</p></div></div>
          <label className="dex-ball-select">{selectedBall ? <BallBadge option={selectedBall} /> : <span className="dex-ball-empty" aria-hidden="true">—</span>}<select value={pokeball} onChange={(event) => setPokeball(event.target.value)}><option value="">Not recorded</option>{ballOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          {ribbonGroups.length > 0 && <><label className="dex-ribbon-search"><span aria-hidden="true">⌕</span><input value={ribbonQuery} onChange={(event) => setRibbonQuery(event.target.value)} placeholder="Find a ribbon…" /></label><div className="dex-ribbon-groups">{visibleRibbonGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend><div>{group.options.map((option) => <button type="button" key={option.key} aria-pressed={ribbons.includes(option.key)} onClick={() => toggleRibbon(option.key)}><span aria-hidden="true">◇</span>{option.label}</button>)}</div></fieldset>)}</div></>}
        </section>

        <section className="dex-details-section">
          <div><span className="dex-details-icon is-ribbon" aria-hidden="true">→</span><div><h3>Preservation plan</h3><p>Record your intent only. DraftCenter does not connect to Bank or perform transfers.</p></div></div>
          <div className="dex-specimen-grid">
            <label>Importance<select value={importance} onChange={(event) => setImportance(event.target.value)}>{POKEDEX_IMPORTANCE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
            <label>Transfer state<select value={transferState} onChange={(event) => setTransferState(event.target.value)}>{POKEDEX_TRANSFER_STATE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
            <label className="is-wide">Intended destination<input value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={120} placeholder="Example: Pokémon HOME · Legacy favorites" /></label>
            {transferState === "transferred" && <label>Confirmed date<input type="date" value={transferredOn} onChange={(event) => setTransferredOn(event.target.value)} /></label>}
          </div>
          <label className="dex-notes-field">Private notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={POKEDEX_INVENTORY_NOTE_MAX_LENGTH} rows={4} placeholder="Memory, ribbon journey, unusual move, or transfer reminder…" /><span>{notes.length.toLocaleString()} / {POKEDEX_INVENTORY_NOTE_MAX_LENGTH.toLocaleString()}</span></label>
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

function CollectionInventoryPanel({ inventory, loading, busy, error, initialLocationKind, onReload, onSaveLocation, onDeleteLocation, onAddSpecimen, onEditSpecimen, onDownload, onClose }) {
  const [locationDraft, setLocationDraft] = useState(initialLocationKind ? { kind: initialLocationKind } : null);
  const [query, setQuery] = useState("");
  const specimens = filterPokedexSpecimens(inventory?.specimens || [], query);
  const rescueReview = useMemo(() => buildBankRescueReview(inventory), [inventory]);
  const rescueBySpecimenId = useMemo(() => new Map(rescueReview.records.map(({ specimen, classification }) => [specimen.id, classification])), [rescueReview]);
  const rescueSourceById = useMemo(() => new Map(rescueReview.sources.map((source) => [source.id, source])), [rescueReview]);
  const transferLabel = (key) => POKEDEX_TRANSFER_STATE_OPTIONS.find((option) => option.key === key)?.label || key;
  const kindLabel = (key) => POKEDEX_LOCATION_OPTIONS.find((option) => option.key === key)?.label || key;
  return <section className="dex-inventory-panel" aria-labelledby="dex-inventory-title">
    <header><div><span className="dex-kicker">BANK RESCUE FOUNDATION</span><h3 id="dex-inventory-title">Collection inventory</h3><p>Record actual individuals and where they live. No Nintendo credentials are requested, and no transfer is performed.</p></div><button type="button" className="dex-icon-button" onClick={onClose} aria-label="Close collection inventory">×</button></header>
    {error && <p className="dex-inventory-error" role="alert">{error} <button type="button" onClick={onReload}>Try again</button></p>}
    {loading ? <div className="dex-tracker-loading is-inline"><span className="dex-ball" aria-hidden="true" /><h3>Loading private inventory…</h3></div> : <>
      <section className="dex-rescue-review" aria-labelledby="dex-rescue-review-title">
        <div className="dex-rescue-status"><span>OFFICIAL STATUS · REVIEWED {rescueReview.reviewed_on}</span><h4 id="dex-rescue-review-title">{rescueReview.status.headline}</h4><p>{rescueReview.status.summary}</p></div>
        <p className={`dex-rescue-freshness ${rescueReview.source_freshness.stale ? "is-stale" : ""}`} role={rescueReview.source_freshness.stale ? "alert" : undefined}><strong>{rescueReview.source_freshness.stale ? "Source review due." : "Source review current."}</strong> {rescueReview.source_freshness.message}</p>
        {!!rescueReview.records.length && <div className="dex-rescue-counts" aria-label="Bank Rescue classification counts">{Object.entries(rescueReview.counts).map(([key, count]) => <span key={key} className={`is-${BANK_RESCUE_ACTIONS[key].tone}`}><b>{count}</b>{BANK_RESCUE_ACTIONS[key].label}</span>)}</div>}
        <p className="dex-rescue-boundary"><strong>{rescueReview.uncertain_count || 0} availability checks remain uncertain—verify.</strong> Labels use your private inventory plus the dated official facts below. They do not prove transfer support, current form availability, ribbon availability, or completion.</p>
        <details><summary>Why these labels and sources</summary><p>Review order uses your recorded location, transfer choice, importance, event flag, ribbons, and origin mark. It never infers a deadline or says an individual is easy to obtain later.</p><ul>{rescueReview.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title}</a><span>Reviewed {source.reviewed_on}{source.source_updated_on ? ` · source updated ${source.source_updated_on}` : ""}</span></li>)}</ul></details>
      </section>
      <section className="dex-inventory-locations">
        <div className="dex-inventory-section-heading"><div><h4>Storage locations</h4><p>Name each save, Bank box group, HOME area, cartridge, or other place.</p></div><button type="button" className="dex-secondary-button" onClick={() => setLocationDraft({})}>＋ Add location</button></div>
        {locationDraft && <LocationForm key={locationDraft.id || `new:${locationDraft.kind || "game_save"}`} location={locationDraft} busy={busy} onSave={async (...args) => { const saved = await onSaveLocation(...args); if (saved) setLocationDraft(null); }} onCancel={() => setLocationDraft(null)} />}
        <div className="dex-location-list">{(inventory?.locations || []).map((location) => <article key={location.id}><span>{kindLabel(location.kind)}</span><strong>{location.name}</strong><small>{location.platform || "Platform not recorded"} · {location.specimen_count || 0} Pokémon</small><div><button type="button" onClick={() => setLocationDraft(location)}>Edit</button><button type="button" onClick={() => onDeleteLocation(location)} disabled={busy || location.specimen_count > 0}>Delete</button></div></article>)}</div>
        {!inventory?.locations?.length && !locationDraft && <p className="dex-inventory-empty">No storage locations yet. Add one before assigning individuals to a save or box.</p>}
      </section>
      <section className="dex-inventory-specimens">
        <div className="dex-inventory-section-heading"><div><h4>Individual Pokémon</h4><p>{inventory?.specimens?.length || 0} private records. Add duplicates, special Pokémon, or anyone whose history matters.</p></div><div><button type="button" className="dex-secondary-button" onClick={() => onDownload("json")} disabled={!inventory?.specimens?.length}>JSON</button><button type="button" className="dex-secondary-button" onClick={() => onDownload("csv")} disabled={!inventory?.specimens?.length}>CSV</button><button type="button" className="dex-primary-button" onClick={() => onAddSpecimen()}>＋ Add individual</button></div></div>
        {inventory?.specimens?.length > 0 && <label className="dex-inventory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search individuals, locations, origins, or destinations…" /></label>}
        <div className="dex-specimen-list">{specimens.map((specimen) => { const rescue = rescueBySpecimenId.get(specimen.id); const rescueSources = rescue?.source_ids.map((sourceId) => rescueSourceById.get(sourceId)?.publisher).filter(Boolean).join(" · "); return <button type="button" key={specimen.id} onClick={() => onEditSpecimen(specimen)}><img src={pokedexArtworkUrl(specimen.pokemon_id, specimen.is_shiny)} alt="" loading="lazy" /><span><strong>{pokedexSpecimenDisplayName(specimen)}</strong><small>{specimen.location_name || "Location not recorded"}{specimen.box_label ? ` · ${specimen.box_label}` : ""}{specimen.box_position ? ` · Slot ${specimen.box_position}` : ""}</small><i>{transferLabel(specimen.transfer_state)}{specimen.importance !== "standard" ? ` · ${specimen.importance}` : ""}</i>{rescue && <><mark className={`is-${rescue.tone}`}>{rescue.label}</mark><em>{rescue.reason}</em><cite>{rescueSources} · reviewed {rescue.reviewed_on}</cite></>}</span><b aria-hidden="true">›</b></button>; })}</div>
        {!inventory?.specimens?.length && <p className="dex-inventory-empty">Your checklist stays unchanged. Add an individual only when you want to preserve its identity, location, or transfer plan.</p>}
        {inventory?.specimens?.length > 0 && !specimens.length && <p className="dex-inventory-empty">No individual records match that search.</p>}
      </section>
    </>}
  </section>;
}

function CreateTracker({ catalogs, busy, onCreate, onCancel }) {
  const [catalogKey, setCatalogKey] = useState(catalogs[0]?.key || "home");
  const [title, setTitle] = useState("");
  const [includeShiny, setIncludeShiny] = useState(false);
  const groups = groupPokedexCatalogs(catalogs);
  const selected = catalogs.find((catalog) => catalog.key === catalogKey);
  return <form className="dex-tracker-create" onSubmit={(event) => { event.preventDefault(); onCreate({ catalogKey, title, includeShiny }); }}>
    <header><div><span className="dex-kicker">NEW COLLECTION</span><h2>Choose your next Pokédex</h2></div>{onCancel && <button type="button" className="dex-icon-button" onClick={onCancel} aria-label="Close new tracker form">×</button>}</header>
    <label>Game or service
      <select value={catalogKey} onChange={(event) => setCatalogKey(event.target.value)} required>
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
  const [homeBox, setHomeBox] = useState("all");
  const [shown, setShown] = useState(POKEDEX_TRACKER_PAGE_SIZE);
  const [pending, setPending] = useState(() => new Set());
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventory, setInventory] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [specimenTarget, setSpecimenTarget] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [inventoryStartLocationKind, setInventoryStartLocationKind] = useState(null);
  const [resumeGuideAfterSave, setResumeGuideAfterSave] = useState(false);

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
    setHomeBox("all");
    setShown(POKEDEX_TRACKER_PAGE_SIZE);
    setShowSettings(false);
    setDetailsTarget(null);
    setDetailsBusy(false);
    setDetailsError("");
    setInventoryOpen(false);
    setInventory(null);
    setInventoryLoading(false);
    setInventoryBusy(false);
    setInventoryError("");
    setSpecimenTarget(null);
    setGuideOpen(false);
    setInventoryStartLocationKind(null);
    setResumeGuideAfterSave(false);
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
      setInventoryOpen(false);
      setInventory(null);
      setInventoryLoading(false);
      setInventoryBusy(false);
      setInventoryError("");
      setSpecimenTarget(null);
      setGuideOpen(false);
      setInventoryStartLocationKind(null);
      setResumeGuideAfterSave(false);
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

  useEffect(() => { setShown(POKEDEX_TRACKER_PAGE_SIZE); }, [query, status, mode, homeBox, activeId]);

  useEffect(() => {
    if (!active?.tracker?.id) return;
    void loadInventory(active.tracker.id);
  // Inventory is loaded once for each newly opened tracker so Rescue can summarize it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.tracker?.id]);

  useEffect(() => {
    if (!detailsTarget && !specimenTarget && !guideOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      if (specimenTarget && !inventoryBusy) {
        setSpecimenTarget(null);
        if (resumeGuideAfterSave) {
          setInventoryOpen(false);
          setInventoryStartLocationKind(null);
          setResumeGuideAfterSave(false);
          setGuideOpen(true);
        }
      }
      else if (detailsTarget && !detailsBusy) setDetailsTarget(null);
      else if (guideOpen) setGuideOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detailsTarget, detailsBusy, specimenTarget, inventoryBusy, guideOpen, resumeGuideAfterSave]);

  const standardProgress = useMemo(() => pokedexTrackerProgress(active?.pokemon, "standard"), [active]);
  const shinyProgress = useMemo(() => pokedexTrackerProgress(active?.pokemon, "shiny"), [active]);
  const activeCatalog = hub?.catalogs?.find(({ key }) => key === active?.tracker?.catalog_key);
  const ballOptions = useMemo(() => pokedexBallOptions(active?.tracker?.catalog_key, activeCatalog?.generation), [active?.tracker?.catalog_key, activeCatalog?.generation]);
  const ribbonGroups = useMemo(() => pokedexRibbonGroups(active?.tracker?.catalog_key), [active?.tracker?.catalog_key]);
  const inventoryBallOptions = useMemo(() => pokedexBallOptions("home", 10), []);
  const inventoryRibbonGroups = useMemo(() => pokedexRibbonGroups("home"), []);
  const detailsEntry = active?.pokemon?.find(({ pokemon_id }) => pokemon_id === detailsTarget?.pokemonId) || null;
  const homeBoxes = useMemo(() => active?.tracker?.catalog_key === "home"
    ? Array.from({ length: Math.ceil(standardProgress.total / 30) }, (_, index) => pokedexHomePlacement((index * 30) + 1))
    : [], [active?.tracker?.catalog_key, standardProgress.total]);
  const filtered = useMemo(() => {
    const entries = filterPokedexEntries(active?.pokemon, { query, status, mode });
    if (active?.tracker?.catalog_key !== "home" || homeBox === "all") return entries;
    return entries.filter((entry) => String(pokedexHomePlacement(entry.dex_number)?.globalBox || "") === homeBox);
  }, [active, query, status, mode, homeBox]);
  const visible = filtered.slice(0, shown);

  async function createTracker(values) {
    const accountVersion = accountVersionRef.current;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_my_pokedex_tracker", {
      p_catalog_key: values.catalogKey,
      p_title: values.title.trim() || null,
      p_include_shiny: values.includeShiny,
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
    const field = isShiny ? "shiny_caught" : "caught";
    const caught = !entry[field];
    const pendingKey = `${trackerId}:${entry.pokemon_id}:${mode}`;
    if (pending.has(pendingKey)) return;
    setPending((current) => new Set(current).add(pendingKey));
    setActive((current) => current?.tracker?.id === trackerId
      ? { ...current, pokemon: current.pokemon.map((pokemon) => pokemon.pokemon_id === entry.pokemon_id ? { ...pokemon, [field]: caught } : pokemon) }
      : current);
    const { data, error } = await supabase.rpc("set_my_pokedex_tracker_entry", {
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
        ? { ...tracker, caught: data.caught, shiny_caught: data.shiny_caught, updated_at: new Date().toISOString() }
        : tracker),
    } : current);
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
    const { data, error } = await supabase.rpc("set_my_pokedex_tracker_entry_details", {
      p_tracker_id: trackerId,
      p_pokemon_id: detailsEntry.pokemon_id,
      p_is_shiny: detailMode === "shiny",
      p_pokeball_key: values.pokeball || null,
      p_ribbon_keys: values.ribbons,
      p_notes: values.notes,
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
        [`${prefix}notes`]: data.notes,
      } : pokemon),
    } : current);
    setDetailsTarget(null);
    setMessage("");
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
    setGuideOpen(false);
    setResumeGuideAfterSave(false);
    setInventoryStartLocationKind(null);
    setInventoryOpen(true);
    const loaded = inventory?.tracker_id === active.tracker.id ? inventory : await loadInventory(active.tracker.id);
    if (entry && loaded) setSpecimenTarget({ pokemon_id: entry.pokemon_id, is_shiny: mode === "shiny" });
  }

  async function openGuidedRescue() {
    if (!active) return;
    setInventoryOpen(false);
    setSpecimenTarget(null);
    setInventoryStartLocationKind(null);
    setResumeGuideAfterSave(false);
    setGuideOpen(true);
    if (inventory?.tracker_id !== active.tracker.id && !inventoryLoading) await loadInventory(active.tracker.id);
  }

  function startGuidedLocation(kind) {
    if (!active) return;
    setGuideOpen(false);
    setResumeGuideAfterSave(true);
    setInventoryStartLocationKind(kind);
    setInventoryOpen(true);
  }

  function startGuidedIndividual(specimen = null) {
    if (!active) return;
    setGuideOpen(false);
    setResumeGuideAfterSave(true);
    setInventoryStartLocationKind(null);
    setInventoryOpen(true);
    setSpecimenTarget(specimen || { pokemon_id: active.pokemon[0]?.pokemon_id || null, is_shiny: false });
  }

  function closeGuidedAction() {
    if (inventoryBusy) return;
    setSpecimenTarget(null);
    if (resumeGuideAfterSave) {
      setInventoryOpen(false);
      setInventoryStartLocationKind(null);
      setResumeGuideAfterSave(false);
      setGuideOpen(true);
    }
  }

  async function openHomeBoxes() {
    const homeTracker = hub?.trackers?.find(({ catalog_key: catalogKey }) => catalogKey === "home");
    if (!homeTracker) return;
    if (active?.tracker?.id !== homeTracker.id) await openTracker(homeTracker.id);
    setMode("standard");
    setStatus("all");
    setHomeBox("all");
    window.setTimeout(() => document.getElementById("dex-tracker-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
    setInventoryStartLocationKind(null);
    if (resumeGuideAfterSave) {
      setInventoryOpen(false);
      setResumeGuideAfterSave(false);
      setGuideOpen(true);
    }
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
    if (resumeGuideAfterSave) {
      setInventoryOpen(false);
      setResumeGuideAfterSave(false);
      setGuideOpen(true);
    }
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
  }

  function downloadInventory(format) {
    if (!active || !inventory) return;
    const safeTitle = active.tracker.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pokedex";
    const exportedAt = new Date().toISOString();
    const content = format === "csv" ? pokedexInventoryCsv(inventory) : JSON.stringify({
      format: "draftcenter-pokedex-inventory",
      version: 2,
      exported_at: exportedAt,
      tracker: active.tracker,
      locations: inventory.locations,
      specimens: inventory.specimens,
      bank_rescue_review: bankRescueExport(inventory),
    }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}-collection-inventory-${exportedAt.slice(0, 10)}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveSettings(includeShiny = active?.tracker.include_shiny) {
    if (!active) return;
    const accountVersion = accountVersionRef.current;
    const trackerId = active.tracker.id;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("update_my_pokedex_tracker", {
      p_tracker_id: trackerId,
      p_title: settingsTitle.trim() || active.tracker.title,
      p_include_shiny: includeShiny,
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
      <span className="dex-kicker">ACCOUNT COLLECTIONS</span>
      <h1>Your Pokédex journey deserves one organized home.</h1>
      <p>Create a tracker for any supported game or Pokémon HOME, check off every discovery, and keep a separate shiny dex—all safely tied to your DraftCenter account.</p>
      <div><a className="dex-primary-button" href="/#member-access">Sign in to start</a><a className="dex-secondary-button" href="/pokemon">Explore the Pokédex</a></div>
    </section>
  </main>;

  return <main className={`dex-tracker-shell ${mode === "shiny" ? "shiny-mode" : ""}`}>
    <header className="dex-tracker-hero">
      <div>
        <span className="dex-kicker">LIVING COLLECTIONS</span>
        <h1>Every Pokédex</h1>
        <p>Track catches game by game, build a complete HOME collection, and privately record the actual Pokémon, saves, boxes, and transfer plans that matter to you. Everything saves to your account.</p>
      </div>
      <div className="dex-tracker-hero-card" aria-label="Tracker benefits">
        <span><b>37+</b> verified game catalogs</span>
        <span><b>HOME</b> box-by-box organization</span>
        <span><b>Private</b> account saving</span>
      </div>
    </header>

    {message && <p className="dex-tracker-message" role="status" aria-live="polite">{message}</p>}

    <PokedexRescueDashboard
      active={active}
      hub={hub}
      inventory={inventory}
      loading={inventoryLoading}
      error={inventoryError}
      onStartGuide={openGuidedRescue}
      onOpenInventory={() => openInventory()}
      onOpenHomeBoxes={openHomeBoxes}
    />

    <PokedexCollectorLaunchPanel
      supabase={supabase}
      hub={hub}
      active={active}
      inventory={inventory}
      onEnsureInventory={() => loadInventory(active?.tracker?.id)}
      onReload={(preferredId) => loadHub(preferredId, accountVersionRef.current)}
    />

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
          <h2>Start a collection worth finishing.</h2>
          <p>Choose a game in the panel to build your first tracker. You can make separate lists for every playthrough and add shiny progress whenever the hunt begins.</p>
          <button className="dex-primary-button" type="button" onClick={() => setShowCreate(true)}>Create my first tracker</button>
        </section>}
        {!loadingTracker && active && <>
          <header className="dex-active-header">
            <div><span className="dex-kicker">{active.tracker.catalog_name}</span><h2>{active.tracker.title}</h2><p>{standardProgress.caught.toLocaleString()} of {standardProgress.total.toLocaleString()} registered{active.tracker.include_shiny ? ` · ${shinyProgress.caught.toLocaleString()} shinies found` : ""}</p></div>
            <div className="dex-active-actions"><button type="button" className="dex-primary-button" onClick={() => openInventory()}>Collection inventory{inventory?.specimens?.length ? ` · ${inventory.specimens.length}` : ""}</button><button type="button" className="dex-secondary-button" onClick={() => setShowSettings((value) => !value)}>Manage tracker</button></div>
          </header>

          {showSettings && <form className="dex-tracker-settings" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
            <label>Tracker name<input value={settingsTitle} onChange={(event) => setSettingsTitle(event.target.value)} maxLength={80} /></label>
            {!active.tracker.include_shiny && <button type="button" className="dex-shiny-button" onClick={() => saveSettings(true)}>✦ Add shiny dex</button>}
            <button className="dex-primary-button" disabled={busy}>{busy ? "Saving…" : "Save name"}</button>
            <button type="button" className="dex-danger-button" onClick={deleteTracker} disabled={busy}>Delete tracker</button>
          </form>}

          <section className="dex-progress-panel">
            <ProgressRing progress={standardProgress} label="Standard" />
            {active.tracker.include_shiny ? <ProgressRing progress={shinyProgress} label="Shiny" shiny /> : <button className="dex-add-shiny-card" type="button" onClick={() => saveSettings(true)}><b>✦</b><span><strong>Add a shiny dex</strong><small>A second, independent checklist</small></span></button>}
            <div className="dex-progress-copy"><span>{standardProgress.total - standardProgress.caught === 0 ? "COMPLETE" : "NEXT MILESTONE"}</span><strong>{standardProgress.total - standardProgress.caught === 0 ? "Pokédex complete!" : `${Math.min(standardProgress.total, Math.ceil((standardProgress.caught + 1) / 25) * 25).toLocaleString()} registered`}</strong><small>Catches and collection details stay private to your account.</small></div>
          </section>

          {inventoryOpen && <CollectionInventoryPanel inventory={inventory} loading={inventoryLoading} busy={inventoryBusy} error={inventoryError} initialLocationKind={inventoryStartLocationKind} onReload={() => loadInventory()} onSaveLocation={saveInventoryLocation} onDeleteLocation={deleteInventoryLocation} onAddSpecimen={() => setSpecimenTarget({ pokemon_id: active.pokemon[0]?.pokemon_id || null, is_shiny: false })} onEditSpecimen={setSpecimenTarget} onDownload={downloadInventory} onClose={() => { setInventoryOpen(false); setSpecimenTarget(null); setInventoryStartLocationKind(null); if (resumeGuideAfterSave) { setResumeGuideAfterSave(false); setGuideOpen(true); } }} />}

          <div className="dex-mode-tabs" role="tablist" aria-label="Pokédex progress type">
            <button type="button" role="tab" aria-selected={mode === "standard"} onClick={() => setMode("standard")}><span aria-hidden="true">◉</span> Standard dex <b>{standardProgress.caught}/{standardProgress.total}</b></button>
            {active.tracker.include_shiny && <button type="button" role="tab" aria-selected={mode === "shiny"} onClick={() => setMode("shiny")}><span aria-hidden="true">✦</span> Shiny dex <b>{shinyProgress.caught}/{shinyProgress.total}</b></button>}
          </div>

          <section className="dex-tracker-controls">
            <label className="dex-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or number…" /></label>
            {active.tracker.catalog_key === "home" && <label className="dex-home-box-filter"><span>HOME box</span><select value={homeBox} onChange={(event) => setHomeBox(event.target.value)}><option value="all">All boxes</option>{homeBoxes.map((placement) => <option key={placement.globalBox} value={placement.globalBox}>Page {placement.page} · Box {placement.box}</option>)}</select></label>}
            <div role="group" aria-label="Progress filter">
              {["all", "caught", "missing"].map((value) => <button type="button" key={value} className={status === value ? "is-active" : ""} onClick={() => setStatus(value)}>{value === "all" ? "All" : value === "caught" ? mode === "shiny" ? "Found" : "Registered" : "Missing"}</button>)}
            </div>
            <span><b>{filtered.length.toLocaleString()}</b> shown</span>
          </section>

          {visible.length ? <section className="dex-pokemon-grid" aria-label={`${mode === "shiny" ? "Shiny" : "Standard"} Pokédex entries`}>
            {visible.map((entry) => <PokemonCard key={entry.pokemon_id} entry={entry} mode={mode} placement={active.tracker.catalog_key === "home" ? pokedexHomePlacement(entry.dex_number) : null} pending={pending.has(`${active.tracker.id}:${entry.pokemon_id}:${mode}`)} ballOptions={ballOptions} onToggle={toggleEntry} onDetails={openEntryDetails} onInventory={openInventory} />)}
          </section> : <section className="dex-no-results"><span aria-hidden="true">⌕</span><h3>No Pokémon match this view.</h3><p>Try a different name or switch the progress filter.</p></section>}
          {shown < filtered.length && <button type="button" className="dex-load-more" onClick={() => setShown((count) => count + POKEDEX_TRACKER_PAGE_SIZE)}>Show {Math.min(POKEDEX_TRACKER_PAGE_SIZE, filtered.length - shown)} more Pokémon</button>}
        </>}
      </section>
    </section>
    {active && guideOpen && <PokedexRescueGuideDialog key={`${active.tracker.id}:${inventory?.locations?.length || 0}:${inventory?.specimens?.length || 0}`} trackerTitle={active.tracker.title} inventory={inventory} loading={inventoryLoading} error={inventoryError} onAddLocation={startGuidedLocation} onAddIndividual={() => startGuidedIndividual()} onEditIndividual={startGuidedIndividual} onOpenInventory={() => openInventory()} onDownloadArchive={() => downloadInventory("json")} onClose={() => setGuideOpen(false)} />}
    {detailsEntry && detailsTarget && <EntryDetailsDialog key={`${detailsEntry.pokemon_id}:${detailsTarget.mode}`} entry={detailsEntry} mode={detailsTarget.mode} ballOptions={ballOptions} ribbonGroups={ribbonGroups} busy={detailsBusy} error={detailsError} onSave={saveEntryDetails} onClose={() => setDetailsTarget(null)} />}
    {active && specimenTarget && <SpecimenDialog key={specimenTarget.id || `new:${specimenTarget.pokemon_id}:${specimenTarget.is_shiny}`} specimen={specimenTarget} entries={active.pokemon} locations={inventory?.locations || []} ballOptions={inventoryBallOptions} ribbonGroups={inventoryRibbonGroups} busy={inventoryBusy} error={inventoryError} onSave={saveInventorySpecimen} onDelete={deleteInventorySpecimen} onClose={() => { if (!inventoryBusy) { closeGuidedAction(); setInventoryError(""); } }} />}
  </main>;
}
