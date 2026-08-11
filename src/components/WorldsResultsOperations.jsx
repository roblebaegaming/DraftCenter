"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

function when(value) { return value ? new Date(value).toLocaleString() : "Never"; }
function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function ownerRequest(path, options = {}) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in with an owner account.");
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(options.headers || {}) },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The Worlds result operation could not be completed.");
  return result;
}

function sourceForm(source) {
  return {
    feed_url: source?.feed_url || "",
    attribution_name: source?.attribution_name || "PokeData",
    attribution_url: source?.attribution_url || "https://www.pokedata.ovh/standingsVGC/",
    permission_status: source?.permission_status || "pending",
    enabled: Boolean(source?.enabled),
    poll_interval_seconds: source?.poll_interval_seconds || 300,
    active_from: localDateTime(source?.active_from || "2026-08-28T07:00:00Z"),
    active_through: localDateTime(source?.active_through || "2026-08-31T12:00:00Z"),
    minimum_row_count: source?.minimum_row_count || 64,
    maximum_row_count: source?.maximum_row_count || 512,
  };
}

export default function WorldsResultsOperations() {
  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [suggestionsConfirmed, setSuggestionsConfirmed] = useState(false);
  const [manualMappings, setManualMappings] = useState({});
  const [officialUrl, setOfficialUrl] = useState("");
  const [finalConfirmation, setFinalConfirmation] = useState("");

  async function load({ preserveConfig = false } = {}) {
    setError("");
    try {
      const result = await ownerRequest("/api/operations/worlds-results");
      setData(result);
      if (!preserveConfig) setConfig(sourceForm(result.source));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => { load(); }, []);

  const competitorsBySlug = useMemo(() => new Map((data?.competitors || []).map((item) => [item.slug, item])), [data]);
  const exactSuggestions = (data?.issues || []).filter((issue) => issue.suggestion_reason === "exact_name_country" && issue.suggested_competitor_slug);

  async function mutate(body, successMessage) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await ownerRequest("/api/operations/worlds-results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setMessage(typeof successMessage === "function" ? successMessage(result) : successMessage);
      await load();
    } catch (mutationError) {
      setError(mutationError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveConfiguration(event) {
    event.preventDefault();
    await mutate({
      action: "configure",
      ...config,
      poll_interval_seconds: Number(config.poll_interval_seconds),
      minimum_row_count: Number(config.minimum_row_count),
      maximum_row_count: Number(config.maximum_row_count),
      active_from: new Date(config.active_from).toISOString(),
      active_through: new Date(config.active_through).toISOString(),
      permission_confirmed: permissionConfirmed,
      manual_source_confirmed: manualConfirmed,
    }, "The disabled-by-default source configuration was saved.");
  }

  async function runImport(action, payload) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await ownerRequest("/api/operations/worlds-results/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "upload" ? { payload } : {}) }),
      });
      setMessage(`Import ${String(result.status || "finished").replaceAll("_", " ")}. The previous leaderboard was preserved unless a new snapshot was accepted.`);
      await load();
    } catch (importError) {
      setError(importError.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload)) throw new Error("Choose a PokeData JSON download whose root is an array.");
      await runImport("upload", payload);
    } catch (uploadError) {
      setError(uploadError.message);
    }
  }

  if (error && !data) return <section className="worlds-results-operations" id="worlds-results"><h2>Worlds live scoring</h2><p className="worlds-ops-error">{error}</p><button className="quiet-button" onClick={() => load()}>Try again</button></section>;
  if (!data || !config) return <section className="worlds-results-operations" id="worlds-results"><p>Loading Worlds live-scoring operations…</p></section>;

  const source = data.source;
  const finalized = source?.state === "final";
  return <section className="worlds-results-operations" id="worlds-results">
    <header><div><span className="eyebrow">OWNER ONLY · VGC MASTERS</span><h2>Worlds live scoring</h2><p>Review the exact feed and competitor mappings, preserve the last accepted scores on every failure, and finalize only after checking an official result.</p></div><button className="quiet-button" disabled={busy} onClick={() => load()}>Refresh</button></header>
    {(error || message) && <p className={error ? "worlds-ops-error" : "worlds-ops-message"} role="status">{error || message}</p>}

    <div className="worlds-ops-metrics">
      <article><span>State</span><strong>{source?.state || "not configured"}</strong></article>
      <article><span>Last accepted</span><strong>{when(source?.last_accepted_at)}</strong></article>
      <article className={source?.is_stale ? "needs-attention" : ""}><span>Feed health</span><strong>{source?.is_stale ? "Updates delayed" : source?.consecutive_failures ? `${source.consecutive_failures} failed` : "Ready"}</strong></article>
      <article className={data.issues.length ? "needs-attention" : ""}><span>Unresolved identities</span><strong>{data.issues.length}</strong></article>
      <article><span>Reviewed aliases</span><strong>{data.aliases.length}</strong></article>
    </div>

    <details className="worlds-ops-panel" open={!source?.enabled && !finalized}>
      <summary>Approved source and polling window</summary>
      <form className="worlds-ops-form" onSubmit={saveConfiguration}>
        <label className="wide">Exact PokeData Masters JSON URL<input type="url" value={config.feed_url} disabled={finalized} onChange={(event) => setConfig({ ...config, feed_url: event.target.value })} placeholder="https://www.pokedata.ovh/standingsVGC/0000000/masters/0000000_Masters.json" /></label>
        <label>Attribution name<input required value={config.attribution_name} disabled={finalized} onChange={(event) => setConfig({ ...config, attribution_name: event.target.value })} /></label>
        <label>Public source link<input required type="url" value={config.attribution_url} disabled={finalized} onChange={(event) => setConfig({ ...config, attribution_url: event.target.value })} /></label>
        <label>Permission status<select value={config.permission_status} disabled={finalized} onChange={(event) => setConfig({ ...config, permission_status: event.target.value, enabled: false })}><option value="pending">Pending</option><option value="approved">Polling approved</option><option value="manual_only">Manual use only</option><option value="denied">Not approved</option></select></label>
        <label>Polling interval<select value={config.poll_interval_seconds} disabled={finalized} onChange={(event) => setConfig({ ...config, poll_interval_seconds: event.target.value })}><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option><option value="1800">30 minutes</option></select></label>
        <label>Live window begins<input required type="datetime-local" value={config.active_from} disabled={finalized} onChange={(event) => setConfig({ ...config, active_from: event.target.value })} /></label>
        <label>Live window ends<input required type="datetime-local" value={config.active_through} disabled={finalized} onChange={(event) => setConfig({ ...config, active_through: event.target.value })} /></label>
        <label>Minimum rows<input required type="number" min="1" max="4096" value={config.minimum_row_count} disabled={finalized} onChange={(event) => setConfig({ ...config, minimum_row_count: event.target.value })} /></label>
        <label>Maximum rows<input required type="number" min="1" max="4096" value={config.maximum_row_count} disabled={finalized} onChange={(event) => setConfig({ ...config, maximum_row_count: event.target.value })} /></label>
        {config.permission_status === "approved" && <label className="wide check"><input type="checkbox" checked={permissionConfirmed} onChange={(event) => setPermissionConfirmed(event.target.checked)} /> I confirm PokeData approved production polling, attribution, and this exact event feed.</label>}
        {config.permission_status === "manual_only" && <label className="wide check"><input type="checkbox" checked={manualConfirmed} onChange={(event) => setManualConfirmed(event.target.checked)} /> I confirm this source may be uploaded manually with the displayed attribution.</label>}
        <label className="wide check"><input type="checkbox" checked={config.enabled} disabled={finalized || config.permission_status !== "approved"} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} /> Enable scheduled polling during this window. Saving does not create a provider schedule.</label>
        <div className="wide worlds-ops-actions"><button className="primary-button" type="submit" disabled={busy || finalized}>Save reviewed source</button><button className="quiet-button" type="button" disabled={busy || finalized || config.permission_status !== "approved" || !config.feed_url} onClick={() => runImport("fetch")}>Fetch approved feed now</button><label className="quiet-button file-button">Upload reviewed JSON<input type="file" accept="application/json,.json" disabled={busy || finalized || !["approved", "manual_only"].includes(config.permission_status)} onChange={uploadFile} /></label></div>
      </form>
    </details>

    <details className="worlds-ops-panel" open={data.issues.length > 0}>
      <summary>Competitor mapping review · {data.issues.length} unresolved</summary>
      {!data.issues.length ? <p>No unresolved source identities are waiting for review.</p> : <>
        {exactSuggestions.length > 0 && <div className="worlds-bulk-review"><p><strong>{exactSuggestions.length} exact name-and-country suggestions</strong> are ready for review. Accents and punctuation remain part of the stored source identity.</p><label className="check"><input type="checkbox" checked={suggestionsConfirmed} onChange={(event) => setSuggestionsConfirmed(event.target.checked)} /> I reviewed the suggestions listed below.</label><button className="primary-button" disabled={busy || !suggestionsConfirmed} onClick={() => mutate({ action: "approve_exact_suggestions" }, (result) => `${result.approved || 0} reviewed aliases approved.`)}>Approve reviewed exact suggestions</button></div>}
        <datalist id="worlds-result-competitors">{data.competitors.map((competitor) => <option value={competitor.slug} key={competitor.slug}>{competitor.display_name} · {competitor.country_code}</option>)}</datalist>
        <div className="worlds-mapping-list">{data.issues.map((issue) => {
          const suggested = competitorsBySlug.get(issue.suggested_competitor_slug);
          const selectedSlug = manualMappings[issue.id] ?? issue.suggested_competitor_slug ?? "";
          return <article key={issue.id} className={issue.score_points ? "needs-attention" : ""}><div><strong>#{issue.placing} · {issue.source_name} [{issue.source_country_code}]</strong><span>{issue.score_points} points · {issue.issue_code.replaceAll("_", " ")}</span>{suggested && <small>Suggested: {suggested.display_name} · {suggested.country_code}</small>}</div><div><input list="worlds-result-competitors" value={selectedSlug} aria-label={`Roster competitor for ${issue.source_name}`} onChange={(event) => setManualMappings({ ...manualMappings, [issue.id]: event.target.value })} placeholder="Enter roster slug" /><button className="quiet-button" disabled={busy || !selectedSlug} onClick={() => mutate({ action: "approve_alias", issue_id: issue.id, competitor_slug: selectedSlug }, `Reviewed alias saved for ${issue.source_name}.`)}>Approve mapping</button></div></article>;
        })}</div>
      </>}
    </details>

    <details className="worlds-ops-panel">
      <summary>Recent importer audit · {data.runs.length} runs shown</summary>
      <div className="worlds-run-list">{data.runs.map((run) => <article key={run.id}><strong>{run.status}</strong><span>{run.import_method} · {when(run.started_at)}</span><small>{run.row_count == null ? "No row count" : `${run.row_count} rows`}{run.issue_code ? ` · ${run.issue_code.replaceAll("_", " ")}` : ""}</small></article>)}</div>
    </details>

    <details className="worlds-ops-panel finalization" open={Boolean(source?.current_snapshot_id && !finalized)}>
      <summary>Finalize official results</summary>
      {finalized ? <p><strong>Finalized {when(source.finalized_at)}.</strong> Automated imports are disabled and the audit history is preserved.</p> : <div className="worlds-finalize-form"><p>Compare the current completed standings with an official Pokémon result before using this action. It copies the accepted placement set into a new immutable final snapshot and stops imports.</p><label>Official published result URL<input type="url" value={officialUrl} onChange={(event) => setOfficialUrl(event.target.value)} /></label><label>Type <strong>FINALIZE 2026 VGC MASTERS</strong><input value={finalConfirmation} onChange={(event) => setFinalConfirmation(event.target.value)} /></label><button className="primary-button danger-button" disabled={busy || !source?.current_snapshot_id || finalConfirmation !== "FINALIZE 2026 VGC MASTERS" || !officialUrl} onClick={() => mutate({ action: "finalize", official_source_url: officialUrl, confirmation_text: finalConfirmation }, "Official VGC Masters results finalized and automated imports stopped.")}>Finalize results</button></div>}
    </details>
  </section>;
}
