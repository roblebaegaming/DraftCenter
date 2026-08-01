"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";

function value(item) {
  return item == null || item === "" ? "Not configured" : typeof item === "object" ? JSON.stringify(item, null, 2) : String(item);
}

async function readPricingFile(file, settings) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets.Pricing || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook does not contain a readable pricing sheet.");
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const seen = new Set(); const errors = []; const direct = []; const ranked = [];
  rows.forEach((row, index) => {
    const name = String(row["Pokémon"] || row.Pokemon || "").trim();
    const rawPrice = String(row["New Price"] ?? row.Price ?? "").trim();
    const rawRank = String(row.Rank ?? row.Ranking ?? "").trim();
    if (!name && !rawPrice && !rawRank) return;
    if (!rawPrice && !rawRank) return;
    if (!name) { errors.push(`Row ${index + 2}: the Pokémon name is blank.`); return; }
    const key = name.toLowerCase();
    if (seen.has(key)) { errors.push(`Row ${index + 2}: ${name} appears more than once.`); return; }
    seen.add(key);
    const oldPriceValue = Number(row["Current Price"] ?? settings.costOverrides?.[name]);
    const oldPrice = Number.isFinite(oldPriceValue) ? oldPriceValue : null;
    if (rawPrice) {
      const price = Number(rawPrice);
      if (!Number.isInteger(price) || price < 1 || price > 100) errors.push(`Row ${index + 2}: ${name} needs a whole-number price from 1 to 100.`);
      else direct.push({ name, price, oldPrice, source: "price" });
    } else {
      const rank = Number(rawRank);
      if (!Number.isFinite(rank) || rank <= 0) errors.push(`Row ${index + 2}: ${name} needs a positive numeric rank.`);
      else ranked.push({ name, rank, oldPrice, source: "rank" });
    }
  });
  const duplicateRanks = ranked.filter((item, index) => ranked.findIndex((other) => other.rank === item.rank) !== index);
  if (duplicateRanks.length) errors.push(`Ranks must be unique. Repeated: ${[...new Set(duplicateRanks.map((item) => item.rank))].join(", ")}.`);
  if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
  ranked.sort((a, b) => a.rank - b.rank);
  const currentTierMax = Number(settings.priceTierMax) || 20;
  const tierMax = Math.max(currentTierMax, ...direct.map((item) => item.price));
  if (!Number.isInteger(tierMax) || tierMax < 2 || tierMax > 100) throw new Error("The league’s top price tier must be a whole number from 2 to 100 before support can apply this file.");
  const rankedWithPrices = ranked.map((item, index) => ({ ...item, price: ranked.length === 1 ? tierMax : Math.max(1, tierMax - Math.round((index / (ranked.length - 1)) * (tierMax - 1))) }));
  const changes = [...direct, ...rankedWithPrices]
    .filter((item) => item.oldPrice == null || item.oldPrice !== item.price)
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
  if (!changes.length) throw new Error("No price changes were found in that file.");
  if (changes.length > 1000) throw new Error("Support pricing updates are limited to 1,000 Pokémon at a time.");
  return { changes, tierMax, fileName: file.name };
}

function PricingSupportEditor({ data, onSaved }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const settings = data.snapshot.state?.settings || {};

  async function selectFile(event) {
    const file = event.target.files?.[0]; event.target.value = ""; setPreview(null); setConfirmation(""); setMessage("");
    if (!file) return;
    try { setPreview(await readPricingFile(file, settings)); }
    catch (error) { setMessage(error.message); }
  }

  async function applyPricing() {
    if (!preview || confirmation.trim() !== data.league.name) return;
    setBusy(true); setMessage("");
    try {
      const supabase = createClient(); const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Sign in again with the approved support account.");
      const response = await fetch(`/api/operations/league/${data.league.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_revision: data.snapshot.revision,
          confirmation,
          changes: preview.changes.map(({ name, price }) => ({ name, price })),
          price_tier_max: preview.tierMax,
          source_file: preview.fileName,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The pricing changes could not be saved.");
      setPreview(null); setConfirmation("");
      setMessage(`${result.change_count} Pokémon price${result.change_count === 1 ? "" : "s"} updated. A recovery point and audit entry were created.`);
      await onSaved();
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  }

  const overrides = Object.entries(settings.costOverrides || {}).sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]));
  return <section className="support-pricing-editor">
    <span className="eyebrow">AUTHORIZED PRICING SCOPE</span>
    <h2>Upload commissioner pricing</h2>
    <p>This session can change only Pokémon price overrides and the top price tier. DraftCenter creates a recovery point before applying the file and records every changed Pokémon in the support audit log.</p>
    <div className="support-pricing-summary"><div><strong>{settings.priceTierMax || 20}</strong><span>Top price tier</span></div><div><strong>{overrides.length}</strong><span>Saved price overrides</span></div></div>
    <button type="button" className="primary-button" disabled={busy} onClick={() => inputRef.current?.click()}>Upload completed pricing file</button>
    <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={selectFile} />
    {message && <p className="hub-message support-pricing-message">{message}</p>}
    {preview && <div className="support-pricing-preview">
      <h3>Review {preview.changes.length} change{preview.changes.length === 1 ? "" : "s"}</h3>
      <p>{preview.fileName} · top tier {preview.tierMax} · Nothing has changed yet.</p>
      <div className="support-pricing-change-list">{preview.changes.map((item) => <div key={item.name}><span>{item.name}{item.source === "rank" ? ` · rank ${item.rank}` : ""}</span><span>{item.oldPrice == null ? "Current" : item.oldPrice} → <strong>{item.price}</strong></span></div>)}</div>
      <label>Type <strong>{data.league.name}</strong> to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
      <div className="live-stream-actions"><button type="button" className="danger-button" disabled={busy || confirmation.trim() !== data.league.name} onClick={applyPricing}>{busy ? "Applying safely…" : "Create recovery point and apply"}</button><button type="button" className="quiet-button" disabled={busy} onClick={() => { setPreview(null); setConfirmation(""); }}>Cancel</button></div>
    </div>}
    <details><summary>Current saved price overrides</summary><pre className="support-state-preview">{value(Object.fromEntries(overrides))}</pre></details>
  </section>;
}

export default function SupportLeagueView({ leagueId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const supabase = createClient(); const { data: session } = await supabase.auth.getSession();
    if (!session.session) { setError("Sign in with the approved support account."); return; }
    const response = await fetch(`/api/operations/league/${leagueId}`, { headers: { Authorization: `Bearer ${session.session.access_token}` } });
    const result = await response.json();
    if (response.ok) { setData(result); setError(""); } else setError(result.error);
  }, [leagueId]);
  useEffect(() => { load(); }, [load]);
  if (error) return <main className="operations-shell"><a className="quiet-button" href="/operations">Back to Operations</a><section className="operations-error"><h1>Support access unavailable</h1><p>{error}</p></section></main>;
  if (!data) return <main className="operations-shell"><p>Loading approved support view…</p></main>;
  const state = data.snapshot.state || {}; const settings = state.settings || {}; const canEditPricing = data.grant.permission === "pricing_edit";
  return <main className="operations-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/operations">Back to Operations</a></nav>
    <header className="operations-hero"><span className="eyebrow">{canEditPricing ? "SCOPED PRICING SUPPORT" : "READ-ONLY SUPPORT SESSION"}</span><h1>{data.league.name}</h1><p>{canEditPricing ? "Only the guarded pricing importer below can change league data." : "No controls on this page can change league data."} Access expires {new Date(data.grant.expires_at).toLocaleString()}.</p></header>
    {canEditPricing && <PricingSupportEditor data={data} onSaved={load} />}
    <section className="operations-league"><h2>League configuration</h2><dl>{Object.entries(settings).map(([key, item]) => <div key={key}><dt>{key.replaceAll(/([A-Z_])/g, " $1").trim()}</dt><dd><pre>{value(item)}</pre></dd></div>)}</dl><p className="muted">Snapshot revision {data.snapshot.revision} · saved {data.snapshot.updated_at ? new Date(data.snapshot.updated_at).toLocaleString() : "unknown"}</p></section>
  </main>;
}
