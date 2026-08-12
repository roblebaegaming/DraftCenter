"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import WorldsBracketOperations from "./WorldsBracketOperations";
import WorldsFutureOperations from "./WorldsFutureOperations";
import WorldsResultsOperations from "./WorldsResultsOperations";

const severityOrder = { high: 0, medium: 1, low: 2 };
function when(value) { return value ? new Date(value).toLocaleString() : "Never"; }
function supportScope(permission) { return permission === "pricing_edit" ? "Tier/pricing support" : "Read-only support"; }
function pulseActivity(pulse) {
  const days = pulse?.days_since_meaningful_activity;
  if (!pulse?.post_draft_activity && ["awaiting_activity", "inactive"].includes(pulse?.season_state)) {
    if (days == null) return "None since draft";
    if (days === 0) return "None since draft · today";
    return `None since draft · ${days} day${days === 1 ? "" : "s"}`;
  }
  if (days == null) return "Not recorded";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
function pulseSeason(state) {
  return ({
    archived: "Archived",
    complete: "Season complete",
    drafting: "Draft in progress",
    paused: "Draft paused",
    pre_draft: "Pre-draft setup",
    inactive: "Inactive",
    underway: "Season underway",
    awaiting_activity: "Awaiting season activity",
  })[state] || "Pre-draft setup";
}
function worldsEntryStatus(status) {
  return ({
    draft: "Not live",
    waiting_for_official_bracket: "Not live",
    open: "Open",
    locked: "Locked",
    scoring: "Scoring",
    final: "Final",
  })[status] || String(status || "Unknown").replaceAll("_", " ");
}
function WorldsEntrySummary({ summary }) {
  const events = summary?.events || [];
  return <section className="worlds-entry-summary" aria-labelledby="worlds-entry-summary-title">
    <header><div><span className="eyebrow">WORLDS PREDICTIONS</span><h2 id="worlds-entry-summary-title">Current entries</h2><p>Saved entries in each Worlds prediction experience. Counts are aggregate only and never expose a member&apos;s selections or identity.</p></div><div className="worlds-entry-total"><strong>{summary?.unavailable ? "—" : summary?.total || 0}</strong><span>Total saved entries</span></div></header>
    {summary?.unavailable ? <p className="worlds-entry-unavailable" role="status">Counts are temporarily unavailable. Refresh Operations to try again.</p> : <div className="worlds-entry-grid">{events.map((event) => <article key={`${event.experience}:${event.event_id}`}><div><span>{event.experience_label}</span><small>{worldsEntryStatus(event.status)}</small></div><h3>{event.display_name}</h3><strong>{event.entries}</strong><span>{event.entries === 1 ? "saved entry" : "saved entries"}</span></article>)}</div>}
  </section>;
}
function LeagueInsights({ insights, chooseRegulation, chooseDraftType, chooseStage }) {
  const groups = [
    { title: "Popular regulations", items: insights?.regulations || [], choose: chooseRegulation },
    { title: "Draft types", items: insights?.draft_types || [], choose: chooseDraftType },
    { title: "Season stages", items: insights?.stages || [], choose: chooseStage },
  ];
  return <section className="operations-league-insights" aria-labelledby="league-insights-title">
    <header><div><span className="eyebrow">ACTIVE REAL LEAGUES</span><h2 id="league-insights-title">League formats and stages</h2><p>See which regulations and draft styles are most popular, then narrow the league list to find where seasons are now.</p></div><div><strong>{insights?.total_leagues || 0}</strong><span>Leagues counted</span></div></header>
    <div className="operations-insight-grid">{groups.map((group) => <article key={group.title}><h3>{group.title}</h3><div>{group.items.map((item) => <button type="button" key={item.key} onClick={() => group.choose(item.key)}><span>{item.label}</span><strong>{item.count}</strong></button>)}</div></article>)}</div>
  </section>;
}
function LeaguePulse({ pulse, leagueName, regulationLabel, draftStyleLabel }) {
  if (!pulse) return null;
  return <section className="league-pulse" aria-label="League Pulse">
    <header><div><span className="eyebrow">LEAGUE PULSE</span><h3>{leagueName}</h3></div><p>{regulationLabel} · {draftStyleLabel}</p></header>
    <div className="league-pulse-grid">
      <article><span>Results recorded</span><strong>{pulse.results_recorded || 0}</strong></article>
      <article><span>Transactions completed</span><strong>{pulse.transactions_completed || 0}</strong></article>
      <article><span>Meaningful activity</span><strong>{pulseActivity(pulse)}</strong></article>
      <article className={pulse.season_state === "inactive" ? "needs-attention" : ""}><span>Season status</span><strong>{pulseSeason(pulse.season_state)}</strong></article>
      <article className={pulse.support_requests ? "needs-attention" : ""}><span>Open support requests</span><strong>{pulse.support_requests || 0}</strong></article>
      <article className={pulse.system_failures ? "needs-attention" : ""}><span>System failures (30 days)</span><strong>{pulse.system_failures || 0}</strong></article>
    </div>
  </section>;
}

function trafficMetric(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(Number(value) || 0);
}
function trafficDate(value, includeYear = false) {
  if (!value) return "Unknown";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: includeYear ? "numeric" : undefined, timeZone: "UTC" });
}
function TrafficChart({ daily }) {
  const rows = daily || [];
  const maximum = Math.max(1, ...rows.map((row) => Number(row.visitors) || 0));
  return <div className="website-traffic-chart" role="img" aria-label="Daily visitors over the last 30 days">
    {rows.map((row, index) => <span key={row.date} aria-label={`${trafficDate(row.date, true)}: ${trafficMetric(row.visitors)} visitors`}><i style={{ height: `${Math.max(4, ((Number(row.visitors) || 0) / maximum) * 100)}%` }} /><small>{index === 0 || index === rows.length - 1 ? trafficDate(row.date) : ""}</small></span>)}
  </div>;
}
function WebsiteTraffic({ traffic }) {
  const unavailable = !traffic || traffic.unavailable;
  return <section className="website-traffic-summary" aria-labelledby="website-traffic-title">
    <header><div><span className="eyebrow">VERCEL WEB ANALYTICS</span><h2 id="website-traffic-title">Website traffic</h2><p>Anonymized human production traffic. Known bots and private Operations or workspace paths are excluded. Visitors include signed-in and signed-out visits, and visitor identifiers reset daily.</p></div>{!unavailable && <small>Updated {when(traffic.generated_at)}</small>}</header>
    {unavailable ? <p className="website-traffic-unavailable" role="status">Website traffic is temporarily unavailable. The rest of Operations remains current.</p> : <>
      <div className="website-traffic-metrics">
        <article><strong>{trafficMetric(traffic.today?.visitors)}</strong><span>Visitors today</span><small>{trafficMetric(traffic.today?.pageviews)} page views</small></article>
        <article><strong>{trafficMetric(traffic.yesterday?.visitors)}</strong><span>Visitors yesterday</span><small>{trafficMetric(traffic.yesterday?.pageviews)} page views</small></article>
        <article><strong>{trafficMetric(traffic.seven_day_average_visitors, 1)}</strong><span>7-day daily average</span><small>visitors per day</small></article>
        <article><strong>{trafficMetric(traffic.last_30_days?.visitors)}</strong><span>30-day visitors</span><small>sum of daily visitors</small></article>
        <article><strong>{trafficMetric(traffic.last_30_days?.pageviews)}</strong><span>30-day page views</span><small>{trafficDate(traffic.last_30_days?.start)} to {trafficDate(traffic.last_30_days?.end)}</small></article>
      </div>
      <div className="website-traffic-details">
        <article><h3>Visitors by day</h3><TrafficChart daily={traffic.daily} /></article>
        <article><h3>Most visited pages</h3>{traffic.top_pages_unavailable ? <p className="website-traffic-note">Page rankings are temporarily unavailable.</p> : traffic.top_pages?.length ? <ol>{traffic.top_pages.map((page) => <li key={page.path}><span title={page.path}>{page.path}</span><strong>{trafficMetric(page.pageviews)}</strong><small>views</small></li>)}</ol> : <p className="website-traffic-note">No public page visits in this period.</p>}</article>
      </div>
    </>}
  </section>;
}

export default function OperationsDashboard() {
  const [data, setData] = useState(null); const [error, setError] = useState(""); const [filter, setFilter] = useState("attention"); const [query, setQuery] = useState(""); const [regulationFilter, setRegulationFilter] = useState("all"); const [draftTypeFilter, setDraftTypeFilter] = useState("all"); const [stageFilter, setStageFilter] = useState("all"); const [supportLeague, setSupportLeague] = useState(null); const [copyStatus, setCopyStatus] = useState("");
  async function load() { setError(""); const supabase = createClient(); const { data: sessionData } = await supabase.auth.getSession(); if (!sessionData.session) return setError("Sign in with an owner account to open League Operations."); const response = await fetch("/api/operations/overview", { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }); const result = await response.json(); if (!response.ok) return setError(result.error || "League Operations could not load."); setData(result); }
  async function updateSupportRequest(id, status) { const supabase=createClient(); const {data:sessionData}=await supabase.auth.getSession(); if(!sessionData.session)return; const response=await fetch(`/api/operations/support-request/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${sessionData.session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({status})}); if(response.ok)load(); }
  useEffect(() => { load(); }, []);
  const leagues = useMemo(() => (data?.leagues || []).filter((league) => { const archived = String(league.status) === "archived"; const seasonStage = league.pulse?.season_state || "pre_draft"; if (filter === "archived" && !archived) return false; if (filter !== "archived" && archived) return false; if (filter === "attention" && !league.warnings.length) return false; if (filter === "drafts" && !["drafting", "paused"].includes(league.lifecycle?.phase)) return false; if (filter === "post_draft" && !["awaiting_activity", "underway", "inactive", "complete"].includes(seasonStage)) return false; if (filter === "real" && league.is_practice) return false; if (filter === "practice" && !league.is_practice) return false; if (regulationFilter !== "all" && league.regulation_id !== regulationFilter) return false; if (draftTypeFilter !== "all" && league.draft_style !== draftTypeFilter) return false; if (stageFilter !== "all" && seasonStage !== stageFilter) return false; return `${league.name} ${league.commissioner} ${league.lifecycle?.label || ""} ${league.regulation_label || ""} ${league.draft_style_label || ""} ${pulseSeason(seasonStage)}`.toLowerCase().includes(query.toLowerCase()); }).sort((a, b) => { const aPriority = Math.min(...a.warnings.map((w) => severityOrder[w.severity]), 9); const bPriority = Math.min(...b.warnings.map((w) => severityOrder[w.severity]), 9); return aPriority - bPriority || new Date(b.lifecycle?.updated_at || b.created_at) - new Date(a.lifecycle?.updated_at || a.created_at); }), [data, draftTypeFilter, filter, query, regulationFilter, stageFilter]);
  function supportMessage(league) { return `Hi ${league.commissioner || "there"},\n\nI can review ${league.name}'s DraftCenter configuration without becoming a league member or receiving commissioner powers. If you want me to apply a completed pricing spreadsheet, the primary commissioner can approve the separate “Review and edit tiers/pricing” scope.\n\nPlease open ${league.name}, choose Commissioner Tools, and use Temporary support access to choose the scope and duration. You can revoke it at any time. Pricing support cannot change members, drafts, rosters, messages, results, or other league settings. DraftCenter creates a recovery point and audit entry before applying prices.`; }
  async function copyInstructions() { if (!supportLeague) return; try { await navigator.clipboard.writeText(supportMessage(supportLeague)); setCopyStatus("Instructions copied."); } catch { setCopyStatus("Copy was blocked. Select the message below and copy it manually."); } }
  if (error) return <main className="operations-shell"><nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a></nav><section className="operations-error"><h1>League Operations</h1><p>{error}</p><button className="primary-button" onClick={load}>Try again</button></section></main>;
  if (!data) return <main className="operations-shell"><p>Loading League Operations…</p></main>;
  return <main className="operations-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/operations/daily-three">Daily Games activity</a><button className="quiet-button" onClick={load}>Refresh</button></nav>
    <header className="operations-hero"><span className="eyebrow">OWNER ONLY</span><h1>League Operations</h1><p>Monitor league health without bypassing private-league membership. Configuration support requires commissioner-approved access.</p><small>Updated {when(data.generated_at)}</small></header>
    <section className="operations-user-summary" aria-labelledby="registered-users-title"><div><span className="eyebrow">AUTHENTICATION</span><h2 id="registered-users-title">Registered users</h2><p>Every DraftCenter account is counted, including people who joined through Discord. These totals show sign-in identities only; no emails or Discord usernames are exposed here.</p></div><div className="operations-metrics"><article><strong>{data.users?.total || 0}</strong><span>Total accounts</span></article><article><strong>{data.users?.discord || 0}</strong><span>Discord identity</span></article><article><strong>{data.users?.email || 0}</strong><span>Email identity</span></article><article><strong>{data.users?.both || 0}</strong><span>Email + Discord linked</span></article></div></section>
    <WebsiteTraffic traffic={data.website_traffic} />
    <WorldsEntrySummary summary={data.worlds_entries} />
    <WorldsResultsOperations />
    <WorldsBracketOperations />
    <WorldsFutureOperations />
    <section className="operations-metrics"><article><strong>{data.totals.leagues}</strong><span>Active leagues</span></article><article><strong>{data.totals.archived || 0}</strong><span>Archived leagues</span></article><article><strong>{data.totals.real}</strong><span>Active real leagues</span></article><article><strong>{data.totals.drafting || 0}</strong><span>Active or paused drafts</span></article><article><strong>{data.totals.needing_attention}</strong><span>Need attention</span></article><article className={data.totals.high_priority ? "danger" : ""}><strong>{data.totals.high_priority}</strong><span>High priority</span></article><article className={data.totals.open_support_requests ? "danger" : ""}><strong>{data.totals.open_support_requests || 0}</strong><span>Support requests</span></article><article className={data.totals.errors_24h ? "danger" : ""}><strong>{data.totals.errors_24h || 0}</strong><span>System failures · 24 hours</span></article><article><strong>{data.totals.expected_rejections_24h || 0}</strong><span>Safety rejections · 24 hours</span></article></section>
    <LeagueInsights insights={data.league_insights} chooseRegulation={(value) => { setRegulationFilter(value); setFilter("real"); }} chooseDraftType={(value) => { setDraftTypeFilter(value); setFilter("real"); }} chooseStage={(value) => { setStageFilter(value); setFilter("real"); }} />
    {(data.support_requests || []).length > 0 && <section className="operations-support-requests"><h2>Open support requests</h2>{data.support_requests.map((request) => <article key={request.id}><div><span className="eyebrow">{request.category} · {request.status.replaceAll("_"," ")}</span><h3>{request.league_name}</h3><p>{request.message}</p><small>{when(request.created_at)} · {request.diagnostics_included ? "safe diagnostics included" : "no diagnostics"}</small><div className="live-stream-actions">{request.status==="open"&&<button className="quiet-button" onClick={()=>updateSupportRequest(request.id,"in_progress")}>Mark in progress</button>}<button className="primary-button" onClick={()=>updateSupportRequest(request.id,"resolved")}>Resolve</button></div></div>{request.diagnostic_context?.last_error && <details><summary>Latest reported error</summary><pre>{request.diagnostic_context.last_error}</pre></details>}</article>)}</section>}
    {(data.operational_failures || []).length > 0 && <details className="operations-error-feed"><summary><strong>System failures</strong> · last 30 days</summary><p>Unexpected failures that may require investigation or a code, configuration, or provider fix.</p>{data.operational_failures.map((event)=><article key={event.id}><span className="eyebrow">{event.kind.replaceAll("_"," ")}</span><h3>{event.league_name}</h3><p>{event.message}</p><small>{when(event.occurred_at)} · {event.actor}</small></article>)}</details>}
    {(data.operational_rejections || []).length > 0 && <details className="operations-rejection-feed"><summary><strong>Expected safety rejections</strong> · last 30 days</summary><p>Permission checks, stale-session protection, duplicate picks, and other server safeguards working as intended.</p>{data.operational_rejections.map((event)=><article key={event.id}><span className="eyebrow">{event.kind.replaceAll("_"," ")}</span><h3>{event.league_name}</h3><p>{event.message}</p><small>{when(event.occurred_at)} · {event.actor}</small></article>)}</details>}
    <section className="operations-pulse-board" aria-labelledby="league-pulse-title">
      <header><div><span className="eyebrow">AGGREGATE ONLY</span><h2 id="league-pulse-title">League Pulse</h2></div><p>Follow real post-draft leagues without opening them. Counts never expose teams, Pokemon, matchups, messages, or transaction details.</p></header>
      <div>{(data.leagues || []).filter((league) => !league.is_practice && ["post_draft", "season", "completed"].includes(league.lifecycle?.phase)).sort((a, b) => new Date(b.pulse?.last_meaningful_activity_at || b.created_at) - new Date(a.pulse?.last_meaningful_activity_at || a.created_at)).map((league) => <LeaguePulse key={league.id} leagueName={league.name} regulationLabel={league.regulation_label} draftStyleLabel={league.draft_style_label} pulse={league.pulse} />)}</div>
    </section>
    <section className="operations-controls"><div>{[["attention","Needs attention"],["drafts","Drafts"],["post_draft","After draft"],["real","Real leagues"],["practice","Practice"],["all","All active"],["archived","Archived"]].map(([key,label]) => <button key={key} className={filter === key ? "primary-button" : "quiet-button"} onClick={() => setFilter(key)}>{label}</button>)}<button className="quiet-button" type="button" onClick={() => { setFilter("all"); setRegulationFilter("all"); setDraftTypeFilter("all"); setStageFilter("all"); setQuery(""); }}>Clear filters</button></div><div className="operations-filter-fields"><label>Regulation<select value={regulationFilter} onChange={(event) => setRegulationFilter(event.target.value)}><option value="all">All regulations</option>{(data.league_insights?.regulations || []).map((item) => <option value={item.key} key={item.key}>{item.label} ({item.count})</option>)}</select></label><label>Draft type<select value={draftTypeFilter} onChange={(event) => setDraftTypeFilter(event.target.value)}><option value="all">All draft types</option>{(data.league_insights?.draft_types || []).map((item) => <option value={item.key} key={item.key}>{item.label} ({item.count})</option>)}</select></label><label>Season stage<select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="all">All stages</option>{(data.league_insights?.stages || []).map((item) => <option value={item.key} key={item.key}>{item.label} ({item.count})</option>)}</select></label><input aria-label="Search leagues" placeholder="Search league or commissioner" value={query} onChange={(event) => setQuery(event.target.value)} /></div></section>
    {filter !== "archived" && <section className="operations-lifecycle-board" aria-label="Draft lifecycle overview">
      <h2>League stage</h2><p>See setup, draft, and post-draft season progress—and whether teams are controlled by people or bots—without entering the league.</p>
      <div>{(data.leagues || []).filter((league) => ["drafting", "paused", "post_draft", "scheduled", "season", "completed"].includes(league.lifecycle?.phase)).map((league) => <article className={league.lifecycle.phase} key={league.id}><div><strong>{league.name}</strong><span>{league.regulation_label} · {league.draft_style_label}</span></div><div><strong>{pulseSeason(league.pulse?.season_state)}</strong><span>{league.lifecycle.label} · {league.lifecycle.detail}</span></div><small>Last lifecycle activity<br />{when(league.lifecycle.updated_at)}</small></article>)}</div>
    </section>}
    <section className="operations-list">{leagues.length === 0 && <div className="operations-empty">No leagues match this view.</div>}{leagues.map((league) => <article className="operations-league" key={league.id}><header><div><span className="eyebrow">{league.is_practice ? "PRACTICE" : String(league.status || "setup").toUpperCase()}</span><h2>{league.name}</h2><p>{league.commissioner} · created {when(league.created_at)}</p><small className={(league.owner_has_access || league.support_access) ? "operations-access granted" : "operations-access required"}>{league.owner_has_access ? `Your access: ${String(league.owner_role || "member").replaceAll("_", " ")}` : league.support_access ? `${supportScope(league.support_access.permission)} active until ${when(league.support_access.expires_at)}` : "Your access: support approval required"}</small></div>{league.owner_has_access ? <a className="quiet-button" href={`/?league=${encodeURIComponent(league.slug)}`}>Open league</a> : league.support_access ? <a className="primary-button" href={`/operations/league/${league.id}`}>Open {league.support_access.permission === "pricing_edit" ? "pricing support" : "read-only support"}</a> : <button className="quiet-button support-required-button" onClick={() => { setSupportLeague(league); setCopyStatus(""); }}>Support access required</button>}</header>{league.warnings.length > 0 && <div className="operations-warnings">{league.warnings.sort((a,b) => severityOrder[a.severity] - severityOrder[b.severity]).map((item) => <p className={`operations-warning ${item.severity}`} key={item.code}><strong>{item.severity}</strong><span>{item.text}</span></p>)}</div>}<dl><div><dt>Regulation</dt><dd>{league.regulation_label}</dd></div><div><dt>Draft type</dt><dd>{league.draft_style_label}</dd></div><div><dt>Season stage</dt><dd>{pulseSeason(league.pulse?.season_state)}</dd></div><div><dt>Managers</dt><dd>{league.member_count}</dd></div><div><dt>Claimed teams</dt><dd>{league.claimed_team_count}/{league.team_count || "—"}</dd></div><div><dt>Team control</dt><dd>{league.draft_participant_label}</dd></div><div><dt>Draft</dt><dd>{when(league.draft_starts_at)}</dd></div><div><dt>Last activity</dt><dd>{when(league.last_activity_at)}</dd></div><div><dt>Last recovery</dt><dd>{when(league.last_backup_at)}</dd></div><div><dt>Discord</dt><dd>{league.discord_connected ? "Connected" : "Not connected"}</dd></div></dl></article>)}</section>
    {supportLeague && <div className="modal-backdrop"><section className="tools-modal support-access-modal" role="dialog" aria-modal="true" aria-labelledby="support-access-title"><button className="modal-close" onClick={() => setSupportLeague(null)}>×</button><span className="eyebrow">COMMISSIONER APPROVAL</span><h2 id="support-access-title">Support access required</h2><p>Send these instructions to {supportLeague.commissioner || "the commissioner"}. Their approval creates a separate, expiring support session; it does not add you as a manager or co-commissioner.</p><ol><li>Open the league in DraftCenter.</li><li>Open <strong>Commissioner Tools</strong>.</li><li>Find <strong>Temporary support access</strong>.</li><li>Choose <strong>Review only</strong> or, for the primary commissioner, <strong>Review and edit tiers/pricing</strong>.</li><li>Choose a duration, approve it, and then refresh Operations.</li></ol><textarea readOnly rows={10} value={supportMessage(supportLeague)} aria-label="Support invitation instructions" /><div className="live-stream-actions"><button className="primary-button" onClick={copyInstructions}>Copy message for commissioner</button><button className="quiet-button" onClick={() => setSupportLeague(null)}>Close</button></div>{copyStatus && <p className="hub-message">{copyStatus}</p>}</section></div>}
  </main>;
}
