"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function SupportAccessPanel({ leagueId }) {
  const [duration, setDuration] = useState("24"); const [data, setData] = useState(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const request = useCallback(async (method = "GET") => {
    const supabase = createClient(); const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Sign in again to manage support access.");
    const url = method === "GET" ? `/api/support-access?league_id=${leagueId}` : "/api/support-access";
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${session.session.access_token}`, ...(method === "GET" ? {} : { "Content-Type": "application/json" }) }, body: method === "GET" ? undefined : JSON.stringify({ league_id: leagueId, hours: Number(duration) }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Support access could not be updated."); return result;
  }, [duration, leagueId]);
  useEffect(() => { request().then(setData).catch((error) => setMessage(error.message)); }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function approve() { setBusy(true); setMessage(""); try { await request("POST"); setData(await request()); setMessage("Read-only support access approved."); } catch (error) { setMessage(error.message); } setBusy(false); }
  async function revoke() { if (!window.confirm("Revoke DraftCentral support access now?")) return; setBusy(true); setMessage(""); try { await request("DELETE"); setData(await request()); setMessage("Support access revoked."); } catch (error) { setMessage(error.message); } setBusy(false); }
  return <section className="support-access-panel"><h3>Temporary support access</h3><p className="muted">Approve a separate read-only support session for DraftCentral’s owner. This does not make support a league member or commissioner. It expires automatically, can be revoked immediately, and every view is logged.</p>{data?.current ? <><p><strong>Active until:</strong> {new Date(data.current.expires_at).toLocaleString()}</p><button type="button" className="danger-button league-tool-small-action" disabled={busy} onClick={revoke}>Revoke support access</button></> : <div className="support-access-row"><label>Access duration<select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label><button type="button" className="secondary-button" disabled={busy} onClick={approve}>Approve read-only access</button></div>}{message && <p className="hub-message">{message}</p>}{data?.audit?.length > 0 && <details><summary>Support audit log</summary><ol className="support-audit-list">{data.audit.map((entry) => <li key={entry.id}>{new Date(entry.created_at).toLocaleString()} — {entry.action}</li>)}</ol></details>}</section>;
}
