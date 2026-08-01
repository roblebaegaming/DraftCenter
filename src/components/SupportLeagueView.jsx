"use client";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

function value(value) { return value == null || value === "" ? "Not configured" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value); }
export default function SupportLeagueView({ leagueId }) {
  const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { (async () => { const supabase = createClient(); const { data: session } = await supabase.auth.getSession(); if (!session.session) return setError("Sign in with the approved support account."); const response = await fetch(`/api/operations/league/${leagueId}`, { headers: { Authorization: `Bearer ${session.session.access_token}` } }); const result = await response.json(); response.ok ? setData(result) : setError(result.error); })(); }, [leagueId]);
  if (error) return <main className="operations-shell"><a className="quiet-button" href="/operations">Back to Operations</a><section className="operations-error"><h1>Support access unavailable</h1><p>{error}</p></section></main>;
  if (!data) return <main className="operations-shell"><p>Loading approved support view…</p></main>;
  const state = data.snapshot.state || {}; const settings = state.settings || {};
  return <main className="operations-shell"><nav className="public-page-nav"><a className="quiet-button" href="/operations">Back to Operations</a></nav><header className="operations-hero"><span className="eyebrow">READ-ONLY SUPPORT SESSION</span><h1>{data.league.name}</h1><p>No controls on this page can change league data. Access expires {new Date(data.grant.expires_at).toLocaleString()}.</p></header><section className="operations-league"><h2>League configuration</h2><dl>{Object.entries(settings).map(([key,item]) => <div key={key}><dt>{key.replaceAll(/([A-Z_])/g," $1").trim()}</dt><dd><pre>{value(item)}</pre></dd></div>)}</dl><h2>Current tiers and pricing</h2><pre className="support-state-preview">{value(state.tiers || state.tierList || state.pokemonTiers || "No tier structure found in the current snapshot.")}</pre><p className="muted">Snapshot revision {data.snapshot.revision} · saved {data.snapshot.updated_at ? new Date(data.snapshot.updated_at).toLocaleString() : "unknown"}</p></section></main>;
}
