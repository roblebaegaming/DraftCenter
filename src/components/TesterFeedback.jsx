"use client";

import { useEffect, useMemo, useState } from "react";
import { DRAFTCENTER_RELEASE } from "../lib/operational-reporting";

const STATUSES = ["New", "Needs reproduction", "Confirmed", "Fixing", "Ready to retest", "Verified", "Deferred"];
const SEVERITIES = ["Blocker", "Major", "Minor", "Suggestion"];

function localDateTimeInput(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function deviceBrowserSummary() {
  if (typeof navigator === "undefined") return "";
  const agent = navigator.userAgent || "";
  const browser = /Edg\//.test(agent) ? "Edge"
    : /Chrome\//.test(agent) ? "Chrome"
      : /Firefox\//.test(agent) ? "Firefox"
        : /Safari\//.test(agent) ? "Safari"
          : "Other browser";
  const device = /iPhone|iPad/.test(agent) ? "iPhone/iPad"
    : /Android/.test(agent) ? "Android"
      : /Windows/.test(agent) ? "Windows"
        : /Macintosh/.test(agent) ? "Mac"
          : "Other device";
  return `${device} · ${browser}`;
}

function statusClass(status) {
  return `feedback-status feedback-status-${String(status || "").toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

export default function TesterFeedback({ supabase, profile, league, onClose }) {
  const [testerAlias, setTesterAlias] = useState(profile?.display_name || profile?.username || "");
  const [reportedLocalAt, setReportedLocalAt] = useState(localDateTimeInput());
  const [deviceBrowser, setDeviceBrowser] = useState("");
  const [draftType, setDraftType] = useState("unknown");
  const [attempted, setAttempted] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [refreshFixed, setRefreshFixed] = useState("not_tried");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [severity, setSeverity] = useState("Major");
  const [issues, setIssues] = useState([]);
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const isStaff = ["commissioner", "co_commissioner"].includes(league?.role);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  async function loadEvidence() {
    setLoading(true);
    const [issueResult, eventResult] = await Promise.all([
      supabase.rpc("list_accessible_tester_feedback", {
        p_league_id: league?.id || null,
        p_limit: 100,
      }),
      supabase.rpc("list_accessible_operational_health", {
        p_league_id: league?.id || null,
        p_limit: 50,
      }),
    ]);
    setLoading(false);
    if (issueResult.error || eventResult.error) {
      setMessage((issueResult.error || eventResult.error).message);
      return;
    }
    setIssues(Array.isArray(issueResult.data) ? issueResult.data : []);
    setEvents(Array.isArray(eventResult.data) ? eventResult.data : []);
  }

  useEffect(() => {
    setDeviceBrowser(deviceBrowserSummary());
    loadEvidence();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const reportedAt = new Date(reportedLocalAt);
    const { data, error } = await supabase.rpc("submit_tester_feedback", {
      p_tester_alias: testerAlias,
      p_reported_at: Number.isNaN(reportedAt.getTime()) ? new Date().toISOString() : reportedAt.toISOString(),
      p_reporter_timezone: timezone,
      p_device_browser: deviceBrowser,
      p_account_role: league?.role || "unknown",
      p_league_id: league?.id || null,
      p_league_name: league?.name || "No league selected",
      p_draft_type: draftType,
      p_attempted: attempted,
      p_expected_result: expectedResult,
      p_actual_result: actualResult,
      p_refresh_fixed: refreshFixed,
      p_evidence_url: evidenceUrl.trim() || null,
      p_severity: severity,
      p_release: DRAFTCENTER_RELEASE,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setAttempted("");
    setExpectedResult("");
    setActualResult("");
    setEvidenceUrl("");
    setMessage(`${data.issue_number} was recorded and is ready for triage.`);
    await loadEvidence();
  }

  async function createMonitoringTest() {
    if (!league?.id) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_operational_smoke_test", {
      p_league_id: league.id,
      p_release: DRAFTCENTER_RELEASE,
      p_route: window.location.pathname || "league",
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage(`Monitoring test ${data.correlation_id} is visible below.`);
    await loadEvidence();
  }

  async function updateStatus(issueNumber, status) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("update_tester_feedback_status", {
      p_issue_number: issueNumber,
      p_status: status,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    await loadEvidence();
  }

  return <div className="modal-backdrop">
    <section className="tools-modal feedback-modal">
      <button className="modal-close" onClick={onClose}>×</button>
      <span className="eyebrow">REHEARSAL FEEDBACK</span>
      <h2>Report what happened</h2>
      <p className="muted">Do not include passwords, sign-in links, session tokens, private availability that did not overlap, private roster notes, or another person’s private information.</p>
      <form className="form-stack feedback-form" onSubmit={submit}>
        <div className="feedback-two-column">
          <label>Tester name or alias<input required maxLength={100} value={testerAlias} onChange={(event) => setTesterAlias(event.target.value)} /></label>
          <label>Date and exact local time<input required type="datetime-local" value={reportedLocalAt} onChange={(event) => setReportedLocalAt(event.target.value)} /></label>
          <label>Device and browser<input required maxLength={160} value={deviceBrowser} onChange={(event) => setDeviceBrowser(event.target.value)} placeholder="Windows · Chrome" /></label>
          <label>Account role<input readOnly value={league?.role || "No league selected"} /></label>
          <label>League<input readOnly value={league?.name || "No league selected"} /></label>
          <label>Draft type<select value={draftType} onChange={(event) => setDraftType(event.target.value)}><option value="unknown">Unknown / not sure</option><option value="snake">Snake</option><option value="auction">Auction</option><option value="not_applicable">Not applicable</option></select></label>
        </div>
        <label>What were you attempting?<textarea required maxLength={2000} rows={3} value={attempted} onChange={(event) => setAttempted(event.target.value)} /></label>
        <label>What did you expect?<textarea required maxLength={2000} rows={3} value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} /></label>
        <label>What actually happened?<textarea required maxLength={4000} rows={4} value={actualResult} onChange={(event) => setActualResult(event.target.value)} /></label>
        <div className="feedback-two-column">
          <label>Did refreshing fix it?<select value={refreshFixed} onChange={(event) => setRefreshFixed(event.target.value)}><option value="not_tried">Not tried</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}>{SEVERITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label>Screenshot or recording link (optional)<input type="url" maxLength={1000} value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://…" /></label>
        <p className="muted">Blocker means the draft cannot continue, data was lost, access was unauthorized, a winner was wrong, or no recovery exists. Major means an important action failed but has a safe workaround.</p>
        <button className="primary-button" disabled={busy}>{busy ? "Recording…" : "Submit report"}</button>
      </form>
      {league?.id && <section className="feedback-monitor-test">
        <h3>Monitoring check</h3>
        <p className="muted">Creates a clearly labeled test record—no league data is changed and no real incident is declared.</p>
        <button type="button" className="secondary-button" disabled={busy} onClick={createMonitoringTest}>Create test error record</button>
      </section>}
      {message && <p className="hub-message">{message}</p>}
      <section className="feedback-list">
        <h3>{isStaff ? "Shared issue list" : "My reports"}</h3>
        {loading && <p className="muted">Loading reports…</p>}
        {!loading && !issues.length && <p className="muted">No tester reports yet.</p>}
        {issues.map((issue) => <article key={issue.issue_number}>
          <header><strong>{issue.issue_number}</strong><span className={statusClass(issue.status)}>{issue.status}</span><b>{issue.severity}</b></header>
          <p>{issue.attempted}</p>
          <small>{new Date(issue.created_at).toLocaleString()} · {issue.account_role} · {issue.league_name} · release {issue.release}</small>
          {issue.correlation_id && <small>Correlation: {issue.correlation_id}</small>}
          {isStaff && <label>Update status<select disabled={busy} value={issue.status} onChange={(event) => updateStatus(issue.issue_number, event.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>}
        </article>)}
      </section>
      <section className="feedback-list">
        <h3>Operational evidence</h3>
        {!loading && !events.length && <p className="muted">No accessible operational records yet.</p>}
        {events.map((entry) => <article key={entry.id}>
          <header><strong>{entry.kind}</strong><b>{entry.actor_reference}</b></header>
          <p>{entry.message}</p>
          <small>{new Date(entry.occurred_at).toLocaleString()} · release {entry.context?.release || "unknown"}</small>
          <small>Correlation: {entry.context?.correlation_id || "not supplied"}</small>
        </article>)}
      </section>
    </section>
  </div>;
}
