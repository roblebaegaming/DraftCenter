"use client";

import { useMemo } from "react";
import { buildBankRescueDashboard } from "../lib/pokemonBankRescue";

function readableDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function PokedexRescueDashboard({
  active,
  hub,
  inventory,
  loading,
  error,
  onOpenInventory,
  onOpenHomeBoxes,
}) {
  const dashboard = useMemo(() => buildBankRescueDashboard(inventory), [inventory]);
  const sourceById = useMemo(() => new Map(dashboard.sources.map((source) => [source.id, source])), [dashboard.sources]);
  const homeTracker = hub?.trackers?.find(({ catalog_key: catalogKey }) => catalogKey === "home") || null;
  const homeTotal = homeTracker?.total || (active?.tracker?.catalog_key === "home" ? active.tracker.total : 0);
  const homeBoxes = homeTotal ? Math.ceil(homeTotal / 30) : 0;

  return <section className="dex-rescue-dashboard" id="bank-rescue" aria-labelledby="dex-rescue-dashboard-title">
    <header className="dex-rescue-dashboard-heading">
      <div>
        <span className="dex-kicker">BANK RESCUE</span>
        <h2 id="dex-rescue-dashboard-title">Protect the collection history that matters.</h2>
        <p>Map where your Pokémon live, record the individuals you care about, and work through an explainable review queue. DraftCenter never requests Nintendo credentials or claims to perform a transfer.</p>
      </div>
      <div className="dex-bank-status-card">
        <span><i aria-hidden="true" /> Pokémon Bank status</span>
        <strong>{dashboard.status.label}</strong>
        <p>No closure date announced</p>
        <small>Official guidance reviewed {readableDate(dashboard.source_freshness.reviewed_on)}</small>
      </div>
    </header>

    <div className="dex-rescue-dashboard-grid">
      <article className="dex-rescue-readiness">
        <div><span>RESCUE READINESS</span><strong>{dashboard.readiness_complete} of {dashboard.readiness.length}</strong></div>
        <h3>{active?.tracker?.title || "Start with a collection"}</h3>
        <ol>{dashboard.readiness.map((item) => <li key={item.key} className={item.complete ? "is-complete" : ""}>
          <b aria-hidden="true">{item.complete ? "✓" : "○"}</b>
          <span><strong>{item.label}</strong><small>{item.detail}</small></span>
        </li>)}</ol>
        <button type="button" className="dex-primary-button" onClick={onOpenInventory} disabled={!active || loading}>{loading ? "Loading private inventory…" : active ? "Open Rescue workspace" : "Create a tracker first"}</button>
        {error && <p className="dex-rescue-dashboard-error" role="alert">{error}</p>}
      </article>

      <article className="dex-rescue-priorities">
        <div><span>TODAY’S PRIORITIES</span><strong>{dashboard.stats.individuals.toLocaleString()} recorded</strong></div>
        {dashboard.priorities.length ? <ol>{dashboard.priorities.map(({ specimen, classification }, index) => {
          const publishers = classification.source_ids.map((sourceId) => sourceById.get(sourceId)?.publisher).filter(Boolean);
          return <li key={specimen.id || `${specimen.pokemon_id}-${index}`}>
            <b>{index + 1}</b>
            <span><strong>{specimen.nickname || specimen.pokemon || "Recorded Pokémon"}</strong><mark className={`is-${classification.tone}`}>{classification.label}</mark><small>{classification.reason}</small><cite>{publishers.join(" · ")} · reviewed {readableDate(classification.reviewed_on)}</cite></span>
          </li>;
        })}</ol> : <div className="dex-rescue-priority-empty">
          <strong>{dashboard.stats.individuals ? "No open review priorities." : "Your review queue starts with your records."}</strong>
          <p>{dashboard.stats.individuals ? "Transferred and intentionally preserved records stay in your archive without appearing as open work." : "Add storage locations and important individuals; the app will organize the next review steps without guessing availability."}</p>
        </div>}
        <p className={`dex-rescue-dashboard-freshness ${dashboard.source_freshness.stale ? "is-stale" : ""}`} role={dashboard.source_freshness.stale ? "alert" : undefined}><strong>{dashboard.source_freshness.stale ? "Source review due." : "Official-source review current."}</strong> {dashboard.source_freshness.message}</p>
      </article>
    </div>

    <div className="dex-rescue-shortcuts">
      <article id="collection-inventory">
        <span>COLLECTION</span><h3>Individuals and locations</h3>
        <p><strong>{dashboard.stats.locations}</strong> locations · <strong>{dashboard.stats.important_individuals}</strong> important individuals · <strong>{dashboard.stats.decisions}</strong> intentions</p>
        <button type="button" className="dex-secondary-button" onClick={onOpenInventory} disabled={!active}>Manage collection</button>
      </article>
      <article id="home-box-planner">
        <span>BOXES</span><h3>HOME box-by-box view</h3>
        <p>{homeTracker ? <><strong>{homeBoxes}</strong> boxes for {homeTotal.toLocaleString()} National Pokédex entries</> : "Create a Pokémon HOME tracker to organize the National Pokédex into 30-slot boxes."}</p>
        <button type="button" className="dex-secondary-button" onClick={onOpenHomeBoxes} disabled={!homeTracker}>{homeTracker ? "Open HOME boxes" : "HOME tracker needed"}</button>
      </article>
      <article>
        <span>SAFE GUIDANCE</span><h3>Verify before acting</h3>
        <p>Species, form, ribbon, and reacquisition availability remain explicitly uncertain until supported by a reviewed catalog.</p>
        <details><summary>Official sources</summary><ul>{dashboard.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title}</a></li>)}</ul></details>
      </article>
    </div>
  </section>;
}
