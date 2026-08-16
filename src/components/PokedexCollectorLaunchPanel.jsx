"use client";

import { useMemo, useState } from "react";
import {
  buildPokedexCollectorDashboard,
  buildPokedexTrackerPortableExport,
  parsePokedexCollectorCsv,
  parsePokedexRestoreJson,
  POKEDEX_COLLECTOR_FEEDBACK_CHECKLIST,
  POKEDEX_COLLECTOR_MAX_FILE_BYTES,
  pokedexCollectorCsvTemplate,
  pokedexCollectorFilename,
} from "../lib/pokedexCollector";
import { buildPokedexCollectorWorkbookFilename, buildPokedexCollectorWorkbookSheets } from "../platform/exports";
import { useInstallableWebApp } from "../platform/useInstallableWebApp";
import { pokedexCountBucket, trackPokedexCollectorEvent } from "../lib/pokedexAnalytics";

const KOFI_URL = "https://ko-fi.com/draftcenter";

function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ImportPreview({ preview, busy, onConfirm, onCancel }) {
  const summary = preview.kind === "csv" ? {
    "CSV rows": preview.payload.rowCount,
    "Checklist entries": preview.payload.progress.length,
    "New locations": preview.payload.locations.length,
    "New individuals": preview.payload.specimens.length,
  } : {
    "New tracker copies": preview.payload.summary.trackers,
    "Checklist entries": preview.payload.summary.entries,
    "Entry details": preview.payload.summary.details,
    "Storage locations": preview.payload.summary.locations,
    "Individuals": preview.payload.summary.specimens,
  };
  return <section className="dex-collector-import-preview" aria-live="polite">
    <div>
      <span className="dex-kicker">REVIEW BEFORE SAVING</span>
      <h3>{preview.kind === "csv" ? "Add this CSV to the open tracker?" : "Create new trackers from this backup?"}</h3>
      <p>{preview.kind === "csv"
        ? "Import is additive: it checks listed entries and creates new inventory records. Existing records are not edited or removed."
        : "Restore always creates new private copies. It never overwrites or deletes an existing tracker."}</p>
    </div>
    <dl>{Object.entries(summary).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString()}</dd></div>)}</dl>
    {preview.payload.warnings?.length > 0 && <ul className="dex-collector-warnings">{preview.payload.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    <div className="dex-collector-preview-actions">
      <button type="button" className="dex-secondary-button" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" className="dex-primary-button" onClick={onConfirm} disabled={busy}>{busy ? "Saving atomically…" : preview.kind === "csv" ? "Import additive records" : "Create private copies"}</button>
    </div>
  </section>;
}

export default function PokedexCollectorLaunchPanel({ supabase, hub, active, inventory, onEnsureInventory, onReload }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const dashboard = useMemo(() => buildPokedexCollectorDashboard(hub?.trackers), [hub?.trackers]);
  const { promptInstall } = useInstallableWebApp({ serviceWorkerUrl: "/pokedex-tracker/sw.js", scope: "/pokedex-tracker/" });

  async function chooseFile(event, kind) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setStatus("");
    if (file.size > POKEDEX_COLLECTOR_MAX_FILE_BYTES) {
      setError("Choose a CSV or JSON file under 10 MB.");
      return;
    }
    try {
      const text = await file.text();
      const payload = kind === "csv"
        ? parsePokedexCollectorCsv(text, active?.pokemon || [])
        : parsePokedexRestoreJson(text);
      if (payload.errors?.length) {
        setError(payload.errors.slice(0, 10).join(" "));
        return;
      }
      setPreview({ kind, payload });
    } catch (fileError) {
      setError(fileError?.message || "That file could not be read.");
    }
  }

  async function confirmImport() {
    if (!preview || (preview.kind === "csv" && !active)) return;
    setBusy(true);
    setError("");
    setStatus("");
    const accountVersionTracker = active?.tracker?.id || "";
    const result = preview.kind === "csv"
      ? await supabase.rpc("import_my_pokedex_collection", {
        p_tracker_id: active.tracker.id,
        p_progress: preview.payload.progress,
        p_locations: preview.payload.locations,
        p_specimens: preview.payload.specimens,
      })
      : await supabase.rpc("restore_my_pokedex_trackers", { p_trackers: preview.payload.trackers });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "The import was rejected. Nothing was partially saved.");
      return;
    }
    if (preview.kind === "csv") {
      const added = preview.payload.progress.length + preview.payload.locations.length + preview.payload.specimens.length;
      trackPokedexCollectorEvent("import_completed", { kind: "csv", count_bucket: pokedexCountBucket(added), result: "success" });
      setStatus("CSV import completed. Listed progress and new inventory records were added; existing records were left unchanged.");
      setPreview(null);
      await onReload(accountVersionTracker);
    } else {
      trackPokedexCollectorEvent("restore_completed", { kind: "json", count_bucket: pokedexCountBucket(result.data?.restored), result: "success" });
      setStatus(`${Number(result.data?.restored || 0).toLocaleString()} new private tracker ${Number(result.data?.restored) === 1 ? "copy was" : "copies were"} created.`);
      setPreview(null);
      await onReload(result.data?.tracker_ids?.[0] || "");
    }
  }

  async function fetchAllTrackers() {
    const { data, error: exportError } = await supabase.rpc("export_my_pokedex_trackers");
    if (exportError || !data) throw new Error(exportError?.message || "Your Collector export could not be prepared.");
    return data;
  }

  function downloadTemplate() {
    downloadFile(pokedexCollectorCsvTemplate(), "draftcenter-collector-import-template.csv", "text/csv;charset=utf-8");
    trackPokedexCollectorEvent("export_downloaded", { kind: "csv-template" });
    setStatus("Blank Collector CSV template downloaded.");
  }

  async function downloadActiveJson() {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      const loadedInventory = inventory?.tracker_id === active.tracker.id ? inventory : await onEnsureInventory();
      if (!loadedInventory) throw new Error("The private inventory could not be loaded, so the backup was not downloaded.");
      const payload = buildPokedexTrackerPortableExport(active, loadedInventory);
      downloadFile(JSON.stringify(payload, null, 2), pokedexCollectorFilename(active.tracker.title, "backup"), "application/json;charset=utf-8");
      trackPokedexCollectorEvent("export_downloaded", { kind: "active-json" });
      setStatus("Restorable JSON backup downloaded for the open tracker.");
    } catch (downloadError) {
      setError(downloadError?.message || "The tracker backup could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadAllJson() {
    setBusy(true);
    setError("");
    try {
      const payload = await fetchAllTrackers();
      downloadFile(JSON.stringify(payload, null, 2), pokedexCollectorFilename("DraftCenter Collector", "all-trackers-backup"), "application/json;charset=utf-8");
      trackPokedexCollectorEvent("export_downloaded", { kind: "all-json" });
      setStatus("Restorable JSON backup downloaded for every Collector tracker.");
    } catch (downloadError) {
      setError(downloadError?.message || "The all-tracker backup could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadWorkbook() {
    setBusy(true);
    setError("");
    try {
      const [XLSX, exportPayload] = await Promise.all([import("xlsx"), fetchAllTrackers()]);
      const workbook = XLSX.utils.book_new();
      for (const definition of buildPokedexCollectorWorkbookSheets({ hub, exportPayload })) {
        const worksheet = XLSX.utils.aoa_to_sheet(definition.rows);
        worksheet["!cols"] = definition.widths.map((width) => ({ wch: width }));
        worksheet["!rows"] = [{ hpt: 26 }, { hpt: 34 }];
        worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: definition.mergeTitleThrough } }];
        if (definition.rows.length > definition.headerRow + 1) {
          worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({
            s: { r: definition.headerRow, c: 0 },
            e: { r: definition.rows.length - 1, c: Math.max(definition.widths.length - 1, 0) },
          }) };
        }
        worksheet["!views"] = [{ state: "frozen", ySplit: definition.headerRow + 1 }];
        XLSX.utils.book_append_sheet(workbook, worksheet, definition.name);
      }
      XLSX.writeFile(workbook, buildPokedexCollectorWorkbookFilename());
      trackPokedexCollectorEvent("workbook_downloaded", { kind: "xlsx", count_bucket: pokedexCountBucket(hub?.trackers?.length) });
      setStatus("Eight-sheet Collector workbook downloaded for Excel or Google Sheets.");
    } catch (downloadError) {
      setError(downloadError?.message || "The Collector workbook could not be created in this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function installCollector() {
    trackPokedexCollectorEvent("install_selected", { placement: "collector-tools" });
    const choice = await promptInstall();
    if (choice.outcome === "unavailable") {
      setShowInstallHelp(true);
      return;
    }
    trackPokedexCollectorEvent("install_completed", { result: choice.outcome });
    if (choice.outcome === "accepted") setStatus("Pokédex Tracker was added to this device.");
  }

  async function copyFeedbackChecklist() {
    try {
      await navigator.clipboard.writeText(POKEDEX_COLLECTOR_FEEDBACK_CHECKLIST);
      trackPokedexCollectorEvent("feedback_checklist_copied", { placement: "founding-beta" });
      setStatus("Collector beta checklist copied. Paste it into the conversation or community you choose.");
    } catch {
      setError("The checklist could not be copied automatically in this browser.");
    }
  }

  return <section className="dex-collector-launch" id="collector-tools" aria-labelledby="dex-collector-launch-title">
    <div className="dex-collector-launch-heading">
      <div><span className="dex-kicker">COLLECTOR CONTROL CENTER</span><h2 id="dex-collector-launch-title">Your whole collection, portable.</h2><p>Move in with a CSV, restore safe copies from JSON, or take every private tracker into a workbook you control.</p></div>
      <img src="/pokedex-collector-icon.png" alt="" />
    </div>

    <div className="dex-collector-dashboard" aria-label="Cross-tracker collection summary">
      <article><strong>{dashboard.trackers.toLocaleString()}</strong><span>trackers</span></article>
      <article><strong>{dashboard.caught.toLocaleString()}</strong><span>registered</span></article>
      <article><strong>{dashboard.shinyCaught.toLocaleString()}</strong><span>shinies</span></article>
      <article><strong>{dashboard.specimens.toLocaleString()}</strong><span>individuals</span></article>
      <article><strong>{dashboard.locations.toLocaleString()}</strong><span>locations</span></article>
      <article><strong>{dashboard.completion}%</strong><span>combined</span></article>
    </div>

    <div className="dex-collector-tool-grid">
      <article>
        <span>01 · MOVE IN</span><h3>CSV import</h3><p>Use the template for checklist rows or repeatable individual records. Every row is checked before anything saves.</p>
        <div><button type="button" className="dex-secondary-button" onClick={downloadTemplate}>Get template</button><label className={`dex-primary-button ${!active ? "is-disabled" : ""}`}>Choose CSV<input type="file" accept=".csv,text/csv" disabled={!active || busy} onChange={(event) => { void chooseFile(event, "csv"); }} /></label></div>
        {!active && <small>Open a tracker before choosing its CSV.</small>}
      </article>
      <article>
        <span>02 · BACK UP</span><h3>JSON restore</h3><p>Download one tracker or all of them. Restoring a backup always creates a new private copy.</p>
        <div><button type="button" className="dex-secondary-button" onClick={downloadActiveJson} disabled={!active || busy}>Open tracker JSON</button><button type="button" className="dex-secondary-button" onClick={downloadAllJson} disabled={!hub?.trackers?.length || busy}>All JSON</button><label className="dex-primary-button">Restore JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { void chooseFile(event, "json"); }} /></label></div>
      </article>
      <article>
        <span>03 · TAKE IT WITH YOU</span><h3>Collector workbook</h3><p>Eight Sheets-ready tabs cover progress, details, locations, individuals, Bank review, and an import template.</p>
        <button type="button" className="dex-primary-button" onClick={downloadWorkbook} disabled={!hub?.trackers?.length || busy}>{busy ? "Preparing…" : "Download workbook"}</button>
      </article>
      <article id="install-collector">
        <span>04 · FOCUSED APP</span><h3>Install Pokédex Tracker</h3><p>Add a focused launcher to this device. An internet connection and sign-in are still required for private collection data.</p>
        <button type="button" className="dex-secondary-button" onClick={installCollector}>Install or show instructions</button>
        {showInstallHelp && <small>Open your browser’s share or menu button, then choose “Add to Home Screen” or “Install app.”</small>}
      </article>
    </div>

    {preview && <ImportPreview preview={preview} busy={busy} onConfirm={confirmImport} onCancel={() => setPreview(null)} />}
    {error && <p className="dex-collector-error" role="alert">{error}</p>}
    {status && <p className="dex-collector-status" role="status">{status}</p>}

    <aside className="dex-collector-founding" id="collector-founding-beta">
      <div><span className="dex-kicker">FOUNDING COLLECTOR BETA</span><h3>Help shape the convenience layer.</h3><p>Current Collector tools stay free. A suggested $10—or any amount you choose—is a voluntary one-time contribution through Ko-fi, not a purchase, subscription, or promise of premium access.</p></div>
      <div><a className="dex-primary-button" href={KOFI_URL} target="_blank" rel="noreferrer" onClick={() => trackPokedexCollectorEvent("supporter_cta_selected", { placement: "founding-beta" })}>Support the beta</a><button type="button" className="dex-secondary-button" onClick={copyFeedbackChecklist}>Copy tester checklist</button></div>
    </aside>
  </section>;
}
