"use client";

import { useMemo, useState } from "react";
import { buildBankRescueDashboard } from "../lib/pokemonBankRescue";
import { pokedexArtworkUrl, pokedexSpecimenDisplayName } from "../lib/pokedexTracker";

const STEPS = [
  { key: "access", label: "Access map" },
  { key: "important", label: "Important Pokémon" },
  { key: "intentions", label: "Intentions" },
  { key: "archive", label: "Archive" },
];

const LOCATION_CHOICES = [
  {
    key: "game_save",
    icon: "▣",
    title: "Game saves",
    description: "Name each save or cartridge you can currently open, including the game and console in its label.",
  },
  {
    key: "pokemon_bank",
    icon: "◫",
    title: "Pokémon Bank",
    description: "Add a Bank box or box group you can currently review. One broad Bank area is enough to begin.",
  },
  {
    key: "pokemon_home",
    icon: "⌂",
    title: "Pokémon HOME",
    description: "Add the HOME area that can receive or organize records after you verify the official requirements.",
  },
];

function StepButton({ step, index, currentStep, complete, onSelect }) {
  const selected = currentStep === step.key;
  return <button
    type="button"
    role="tab"
    aria-selected={selected}
    aria-controls={`dex-rescue-guide-panel-${step.key}`}
    className={`${selected ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
    onClick={() => onSelect(step.key)}
  >
    <b aria-hidden="true">{complete ? "✓" : index + 1}</b>
    <span>{step.label}</span>
  </button>;
}

export default function PokedexRescueGuideDialog({
  trackerTitle,
  inventory,
  loading,
  error,
  onAddLocation,
  onAddIndividual,
  onEditIndividual,
  onOpenInventory,
  onDownloadArchive,
  onClose,
}) {
  const dashboard = useMemo(() => buildBankRescueDashboard(inventory), [inventory]);
  const project = dashboard.guided_project;
  const [currentStep, setCurrentStep] = useState(project.next_step);
  const completedByKey = new Map([
    ["access", dashboard.readiness[0].complete],
    ["important", dashboard.readiness[1].complete],
    ["intentions", dashboard.readiness[2].complete],
    ["archive", false],
  ]);
  const unplanned = project.unplanned_specimens;
  const recorded = Array.isArray(inventory?.specimens) ? inventory.specimens : [];

  function next(step) {
    setCurrentStep(step);
    window.setTimeout(() => document.getElementById(`dex-rescue-guide-panel-${step}`)?.focus(), 0);
  }

  return <div className="dex-details-backdrop dex-rescue-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dex-rescue-guide" role="dialog" aria-modal="true" aria-labelledby="dex-rescue-guide-title">
      <header>
        <div><span className="dex-kicker">GUIDED BANK RESCUE</span><h2 id="dex-rescue-guide-title">Build a rescue plan you can resume.</h2><p>{trackerTitle} · progress comes from the private records already saved to this tracker.</p></div>
        <button type="button" className="dex-icon-button" onClick={onClose} aria-label="Close guided Bank Rescue">×</button>
      </header>

      <nav className="dex-rescue-guide-steps" role="tablist" aria-label="Bank Rescue project steps">
        {STEPS.map((step, index) => <StepButton key={step.key} step={step} index={index} currentStep={currentStep} complete={completedByKey.get(step.key)} onSelect={next} />)}
      </nav>

      {loading ? <div className="dex-tracker-loading is-inline"><span className="dex-ball" aria-hidden="true" /><h3>Loading your private Rescue project…</h3></div> : <div className="dex-rescue-guide-content">
        {error && <p className="dex-rescue-guide-error" role="alert">{error}</p>}

        {currentStep === "access" && <section id="dex-rescue-guide-panel-access" tabIndex="-1" role="tabpanel" aria-labelledby="dex-rescue-guide-title">
          <div className="dex-rescue-guide-intro"><span>STEP 1</span><h3>Map only the storage you can access.</h3><p>These are owner-entered labels, not a connection to Nintendo. DraftCenter does not request Nintendo credentials, inspect a console, or verify that a save, Bank box, or HOME account is accessible.</p></div>
          <div className="dex-rescue-access-grid">
            {LOCATION_CHOICES.map((choice) => {
              const count = project.location_counts[choice.key];
              return <article key={choice.key}>
                <span aria-hidden="true">{choice.icon}</span>
                <div><h4>{choice.title}</h4><p>{choice.description}</p><small>{count ? `${count} recorded` : "None recorded yet"}</small></div>
                <button type="button" className="dex-secondary-button" onClick={() => onAddLocation(choice.key)}>＋ Add {choice.title === "Game saves" ? "save" : choice.title.replace("Pokémon ", "")}</button>
              </article>;
            })}
          </div>
          <footer><button type="button" className="dex-secondary-button" onClick={onOpenInventory}>Review all locations</button><button type="button" className="dex-primary-button" onClick={() => next("important")}>Continue to important Pokémon</button></footer>
        </section>}

        {currentStep === "important" && <section id="dex-rescue-guide-panel-important" tabIndex="-1" role="tabpanel" aria-labelledby="dex-rescue-guide-title">
          <div className="dex-rescue-guide-intro"><span>STEP 2</span><h3>Record the individuals whose history matters.</h3><p>Start with sentimental Pokémon, shinies, event Pokémon, ribbon journeys, or anything you would regret overlooking. This is separate from the species checklist.</p></div>
          <div className="dex-rescue-guide-summary"><strong>{recorded.length.toLocaleString()}</strong><span>individual {recorded.length === 1 ? "record" : "records"} saved</span></div>
          {recorded.length ? <div className="dex-rescue-guide-pokemon">{recorded.slice(0, 4).map((specimen) => <button type="button" key={specimen.id} onClick={() => onEditIndividual(specimen)}><img src={pokedexArtworkUrl(specimen.pokemon_id, specimen.is_shiny)} alt="" /><span><strong>{pokedexSpecimenDisplayName(specimen)}</strong><small>{specimen.location_name || "Location not recorded"}</small></span><b aria-hidden="true">›</b></button>)}</div> : <p className="dex-rescue-guide-empty">No individual records yet. One meaningful Pokémon is enough to make the next step useful.</p>}
          <footer><button type="button" className="dex-primary-button" onClick={onAddIndividual}>＋ Record an important Pokémon</button><button type="button" className="dex-secondary-button" onClick={() => next("intentions")} disabled={!recorded.length}>Continue to intentions</button></footer>
        </section>}

        {currentStep === "intentions" && <section id="dex-rescue-guide-panel-intentions" tabIndex="-1" role="tabpanel" aria-labelledby="dex-rescue-guide-title">
          <div className="dex-rescue-guide-intro"><span>STEP 3</span><h3>Choose an intention—without claiming a transfer.</h3><p>Record whether each Pokémon is not planned, planned, ready, transferred, or staying in its original game. A saved intention is your note; it is never proof of compatibility or completion.</p></div>
          {unplanned.length ? <><p className="dex-rescue-guide-queue"><strong>{unplanned.length.toLocaleString()}</strong> still need an intention</p><div className="dex-rescue-guide-pokemon">{unplanned.slice(0, 6).map((specimen) => <button type="button" key={specimen.id} onClick={() => onEditIndividual(specimen)}><img src={pokedexArtworkUrl(specimen.pokemon_id, specimen.is_shiny)} alt="" /><span><strong>{pokedexSpecimenDisplayName(specimen)}</strong><small>Choose transfer state and intended destination</small></span><b aria-hidden="true">Review</b></button>)}</div></> : recorded.length ? <div className="dex-rescue-guide-complete"><b aria-hidden="true">✓</b><div><strong>Every recorded Pokémon has an intention.</strong><p>Recheck official guidance before acting; form, ribbon, and game availability remain uncertain unless the app shows a reviewed source.</p></div></div> : <p className="dex-rescue-guide-empty">Record an important Pokémon before choosing transfer intentions.</p>}
          <footer><button type="button" className="dex-secondary-button" onClick={onOpenInventory}>Open full review queue</button><button type="button" className="dex-primary-button" onClick={() => next("archive")} disabled={!recorded.length}>Continue to archive</button></footer>
        </section>}

        {currentStep === "archive" && <section id="dex-rescue-guide-panel-archive" tabIndex="-1" role="tabpanel" aria-labelledby="dex-rescue-guide-title">
          <div className="dex-rescue-guide-intro"><span>STEP 4</span><h3>Keep a portable copy you control.</h3><p>Download the tracker’s locations, individual records, intentions, and dated Bank guidance as JSON. The archive does not contain Nintendo credentials and downloading it does not perform or confirm a transfer.</p></div>
          <div className="dex-rescue-archive-card">
            <div><span>{dashboard.readiness_complete} / {dashboard.readiness.length}</span><strong>{project.complete ? "Rescue plan ready to work" : "Your partial plan is still exportable"}</strong><p>{dashboard.stats.locations} locations · {dashboard.stats.individuals} individuals · {dashboard.stats.decisions} intentions</p></div>
            <button type="button" className="dex-primary-button" onClick={onDownloadArchive}>Download Rescue archive</button>
          </div>
          <p className="dex-rescue-guide-boundary"><strong>Verify before acting.</strong> DraftCenter does not yet claim species, form, ribbon, or destination compatibility. Use the linked official guidance and keep the original game or save until you are comfortable with the one-way move.</p>
          <footer><button type="button" className="dex-secondary-button" onClick={onOpenInventory}>Keep working in Collection</button><button type="button" className="dex-primary-button" onClick={onClose}>Finish for now</button></footer>
        </section>}
      </div>}
    </section>
  </div>;
}
