"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

function permissionLabel(permission) {
  return permission === "pricing_edit" ? "Review and edit tiers/pricing" : "Review only";
}

function auditLabel(entry) {
  if (entry.action === "pricing_updated") return `updated ${entry.details?.change_count || 0} Pokémon price${entry.details?.change_count === 1 ? "" : "s"}`;
  if (entry.action === "approved") return `approved ${permissionLabel(entry.details?.permission).toLowerCase()}`;
  return entry.action;
}

export default function SupportAccessPanel({ leagueId }) {
  const [duration, setDuration] = useState("24");
  const [permission, setPermission] = useState("read_only");
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (method = "GET") => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Sign in again to manage support access.");
    const url = method === "GET" ? `/api/support-access?league_id=${leagueId}` : "/api/support-access";
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      body: method === "GET" ? undefined : JSON.stringify({ league_id: leagueId, hours: Number(duration), permission }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Support access could not be updated.");
    return result;
  }, [duration, leagueId, permission]);

  useEffect(() => {
    request().then(setData).catch((error) => setMessage(error.message));
  }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve() {
    setBusy(true); setMessage("");
    try {
      await request("POST");
      setData(await request());
      setMessage(permission === "pricing_edit" ? "Tier and pricing support access approved." : "Read-only support access approved.");
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  }

  async function revoke() {
    if (!window.confirm("Revoke DraftCentral support access now?")) return;
    setBusy(true); setMessage("");
    try {
      await request("DELETE");
      setData(await request());
      setMessage("Support access revoked.");
    } catch (error) { setMessage(error.message); }
    setBusy(false);
  }

  const current = data?.current;
  return <section className="support-access-panel">
    <h3>Temporary support access</h3>
    <p className="muted">Approve a separate, expiring support session for DraftCentral’s owner. Review-only access cannot change anything. The optional pricing scope can change only Pokémon prices and the top price tier; it cannot manage members, drafts, rosters, messages, results, or other league settings.</p>
    {current ? <>
      <p><strong>Scope:</strong> {permissionLabel(current.permission)}</p>
      <p><strong>Active until:</strong> {new Date(current.expires_at).toLocaleString()}</p>
      <button type="button" className="danger-button league-tool-small-action" disabled={busy} onClick={revoke}>Revoke support access</button>
    </> : <div className="support-access-row">
      <label>Support scope<select value={permission} onChange={(event) => setPermission(event.target.value)}>
        <option value="read_only">Review only</option>
        {data?.can_approve_pricing && <option value="pricing_edit">Review and edit tiers/pricing</option>}
      </select></label>
      <label>Access duration<select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label>
      <button type="button" className="secondary-button" disabled={busy} onClick={approve}>{permission === "pricing_edit" ? "Approve pricing support" : "Approve read-only access"}</button>
    </div>}
    {!data?.can_approve_pricing && !current && <p className="muted">Only the primary commissioner can approve tier and pricing changes. Co-commissioners can still approve review-only access.</p>}
    {message && <p className="hub-message">{message}</p>}
    {data?.audit?.length > 0 && <details><summary>Support audit log</summary><ol className="support-audit-list">{data.audit.map((entry) => <li key={entry.id}>{new Date(entry.created_at).toLocaleString()} — {auditLabel(entry)}</li>)}</ol></details>}
  </section>;
}
