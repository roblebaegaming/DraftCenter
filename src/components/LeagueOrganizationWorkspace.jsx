"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  MULTI_POD_RPCS,
  MULTI_POD_TIEBREAKERS,
  createMultiPodOrganizationDraft,
  multiPodAdministratorInviteUrl,
  multiPodAttachmentRpcArguments,
  multiPodOrganizationUpdateRpcArguments,
  multiPodQualificationDrawRpcArguments,
  multiPodSeasonRpcArguments,
} from "../lib/multiPodLeague";

const TIEBREAKER_LABELS = {
  wins: "Wins",
  differential: "Battle differential",
  "head-to-head": "Head-to-head",
  "game-win-percentage": "Game-win percentage",
  "commissioner-draw": "Commissioner draw",
};

function messageFrom(error, fallback) {
  return error?.message || fallback;
}

function OrganizationMark({ organization }) {
  return <div className="organization-mark" style={{ "--organization-color": organization.brand_color || "#4fd1c5" }}>
    {organization.image_url ? <img src={organization.image_url} alt="" /> : <span>{organization.name.slice(0, 2).toUpperCase()}</span>}
  </div>;
}

function RulesSummary({ season }) {
  const rules = season.regulations || {};
  const qualification = season.qualification_rules || {};
  return <div className="organization-rules-summary">
    <p><strong>Shared format</strong><span>{rules.format || "Commissioner-defined"}</span></p>
    <p><strong>Roster size</strong><span>{rules.roster_size || "Use shared rules"}</span></p>
    <p><strong>Qualification</strong><span>Top {qualification.top_per_pod || 2} per pod{qualification.wildcard_slots ? ` + ${qualification.wildcard_slots} wild card${qualification.wildcard_slots === 1 ? "" : "s"}` : ""}</span></p>
    <p><strong>Tiebreakers</strong><span>{(qualification.tiebreakers || []).map((item) => TIEBREAKER_LABELS[item] || item).join(" → ")}</span></p>
    {rules.notes && <p className="organization-rules-notes"><strong>Rule notes</strong><span>{rules.notes}</span></p>}
  </div>;
}

function PodList({ season, canManage, busy, onConfirm }) {
  if (!season.pods?.length) return <div className="organization-empty"><strong>No pods linked yet.</strong><span>Link at least two existing leagues before launching this season.</span></div>;
  return <div className="organization-pod-list">{season.pods.map((pod) => <article key={pod.id}>
    <div>
      <span className={`organization-status ${pod.regulations_status}`}>{pod.regulations_status === "confirmed" ? "Rules confirmed" : pod.regulations_status === "out-of-sync" ? "Review again" : "Review needed"}</span>
      <h4>{pod.label}</h4>
      <p>{pod.league_name} · League season {pod.league_season_number} · {pod.qualification_spots} qualifier{pod.qualification_spots === 1 ? "" : "s"}</p>
    </div>
    <div className="organization-pod-actions">
      <a className="quiet-button" href={`/league/${pod.league_slug}`}>Open league</a>
      {canManage && season.status === "planning" && <button className="secondary-button" disabled={busy} onClick={() => onConfirm(season, pod)}>{pod.regulations_status === "confirmed" ? "Review again" : "Confirm shared rules"}</button>}
    </div>
  </article>)}</div>;
}

function QualificationPanel({ season, run, canManage, busy, staffLeagueIds, drawOrder, onBegin, onLock, onMoveDraw, onRecordDraw, onFinalize, onCancel, onSyncManager }) {
  if (!canManage || !["active", "qualification"].includes(season.status)) return null;
  if (!run) return <section className="organization-qualification-panel">
    <div><span className="eyebrow">QUALIFICATION</span><h4>Lock final pod standings</h4><p>Start only after every regular-season result is final. Each pod must be locked by an organization administrator who is also staff in that source league.</p></div>
    <button className="primary-button" disabled={busy} onClick={() => onBegin(season)}>Begin qualification</button>
  </section>;

  const unresolved = run.candidates?.filter((candidate) => candidate.unresolved && !candidate.draw_recorded) || [];
  const order = drawOrder?.length ? drawOrder : unresolved.map((candidate) => candidate.id);
  const candidateById = new Map((run.candidates || []).map((candidate) => [candidate.id, candidate]));
  const lockedPods = new Set((run.candidates || []).map((candidate) => candidate.pod_id));
  const finalized = run.status === "finalized";

  return <section className="organization-qualification-panel">
    <header><div><span className="eyebrow">QUALIFICATION</span><h4>{finalized ? "Qualified teams" : run.status === "collecting" ? "Collect final standings" : "Review qualification"}</h4></div><strong>{run.locked_pod_count}/{run.pod_count} pods locked</strong></header>
    <p className="organization-qualification-note">A locked pod is an immutable review snapshot. If its source league changes before final approval, DraftCenter stops finalization and requires a fresh qualification run.</p>
    {run.status === "collecting" && <div className="organization-qualification-pods">{season.pods.map((pod) => {
      const locked = lockedPods.has(pod.id);
      const hasSourceAuthority = staffLeagueIds.has(pod.league_id);
      return <div key={pod.id}><span><strong>{pod.label}</strong><small>{locked ? "Standings locked" : hasSourceAuthority ? "Ready for source-league review" : "Source-league staff must lock this pod"}</small></span>{!locked && <button className="secondary-button" disabled={busy || !hasSourceAuthority} onClick={() => onLock(season, pod, run)}>Lock final standings</button>}</div>;
    })}</div>}
    {!!run.candidates?.length && <div className="organization-qualification-table" role="table" aria-label="Qualification standings">
      <div className="organization-qualification-row heading" role="row"><span>Team</span><span>Record</span><span>Diff.</span><span>Outcome</span></div>
      {run.candidates.map((candidate) => <div className={`organization-qualification-row ${candidate.unresolved ? "unresolved" : ""}`} role="row" key={candidate.id}>
        <span><strong>#{candidate.pod_rank || "—"} {candidate.display_name}</strong><small>{candidate.pod_label} · roster {candidate.roster_size}</small></span>
        <span>{candidate.wins}-{candidate.losses}<small>{candidate.game_wins}-{candidate.game_losses} games</small></span>
        <span>{candidate.differential > 0 ? "+" : ""}{candidate.differential}</span>
        <span>{candidate.unresolved ? "Draw needed" : candidate.selected_kind === "pod-finish" ? "Pod qualifier" : candidate.selected_kind === "wildcard" ? `Wild card #${candidate.wildcard_rank}` : "Not selected"}</span>
      </div>)}
    </div>}
    {run.status === "review" && run.needs_draw && unresolved.length > 0 && <div className="organization-draw-review">
      <h5>Record the commissioner draw</h5><p>Only exact ties that cross a qualification boundary are affected. Put the winner of the recorded draw first.</p>
      {order.map((candidateId, index) => {
        const candidate = candidateById.get(candidateId);
        if (!candidate) return null;
        return <div key={candidateId}><strong>#{index + 1} {candidate.display_name}</strong><span>{candidate.pod_label}</span><button className="quiet-button" disabled={busy || index === 0} onClick={() => onMoveDraw(run, candidateId, -1)}>Move up</button><button className="quiet-button" disabled={busy || index === order.length - 1} onClick={() => onMoveDraw(run, candidateId, 1)}>Move down</button></div>;
      })}
      <button className="secondary-button" disabled={busy || order.length !== unresolved.length} onClick={() => onRecordDraw(run, order)}>Save recorded draw order</button>
    </div>}
    {finalized && <div className="organization-qualified-list">{run.qualifiers?.map((qualifier) => <div key={qualifier.id}><span><strong>{qualifier.display_name}</strong><small>{qualifier.pod_label} · {qualifier.qualification_kind === "wildcard" ? "Wild card" : `Pod place #${qualifier.placement}`} · roster {qualifier.roster_size}</small></span>{staffLeagueIds.has(season.pods.find((pod) => pod.id === qualifier.pod_id)?.league_id) && <button className="quiet-button" disabled={busy} onClick={() => onSyncManager(qualifier)}>Sync replacement manager</button>}</div>)}</div>}
    {!finalized && <div className="organization-season-actions"><button className="quiet-button" disabled={busy} onClick={() => onCancel(season, run)}>Cancel and unlock review</button>{run.status === "review" && <button className="primary-button" disabled={busy || run.needs_draw} onClick={() => onFinalize(season, run)}>Finalize qualifiers</button>}</div>}
  </section>;
}

export function PublicLeagueOrganizationWorkspace({ slug }) {
  const [supabase] = useState(() => createClient());
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc(MULTI_POD_RPCS.getPublicWorkspace, { p_slug: slug }).then(({ data }) => {
      if (!active) return;
      setWorkspace(data || null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [slug, supabase]);

  if (loading) return <main className="organization-shell"><p className="hub-message">Loading organization…</p></main>;
  if (!workspace?.organization) return <main className="organization-shell"><section className="organization-empty organization-not-found"><h1>Organization not available</h1><p>This organization is private or the link is no longer valid.</p><a className="primary-button" href="/">Return to DraftCenter</a></section></main>;
  const organization = workspace.organization;
  return <main className="organization-shell">
    <section className="organization-public-hero" style={{ "--organization-color": organization.brand_color || "#4fd1c5" }}>
      <OrganizationMark organization={organization} />
      <div><span className="eyebrow">LEAGUE ORGANIZATION</span><h1>{organization.name}</h1><p>{organization.description || "A multi-pod DraftCenter organization."}</p></div>
      {organization.is_admin && <a className="primary-button" href={`/organizations?organization=${organization.id}`}>Commissioner workspace</a>}
    </section>
    <section className="organization-public-seasons">
      {!workspace.seasons?.length && <div className="organization-empty"><strong>No published seasons yet.</strong><span>Season details will appear here when the organization is ready.</span></div>}
      {workspace.seasons?.map((season) => <article className="organization-season-card" key={season.id}>
        <header><div><span className="eyebrow">{season.status.toUpperCase()}</span><h2>{season.name}</h2></div><span>{season.pods?.length || 0} pods</span></header>
        <RulesSummary season={season} />
        <PodList season={season} canManage={false} />
        <p className="organization-policy-note">Qualified teams keep their full regular-season rosters. Pokémon duplicated across independent pods remain legal in the championship.</p>
      </article>)}
    </section>
  </main>;
}

export default function LeagueOrganizationWorkspace() {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState(undefined);
  const [organizations, setOrganizations] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [staffLeagues, setStaffLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [qualificationDrawOrders, setQualificationDrawOrders] = useState({});
  const [invitePreview, setInvitePreview] = useState(null);
  const [administratorInviteUrl, setAdministratorInviteUrl] = useState("");
  const [newOrganizationDraft, setNewOrganizationDraft] = useState({ name: "", description: "", visibility: "private", imageUrl: "", brandColor: "#4fd1c5" });
  const [organizationDraft, setOrganizationDraft] = useState({ name: "", description: "", visibility: "private", imageUrl: "", brandColor: "#4fd1c5" });
  const [seasonDraft, setSeasonDraft] = useState({ name: "", format: "National Dex", rosterSize: 12, notes: "", topPerPod: 2, wildcardSlots: 0, tiebreakers: ["wins", "differential", "head-to-head", "commissioner-draw"] });
  const [podDraft, setPodDraft] = useState({ seasonId: "", leagueId: "", label: "", sortOrder: 1, leagueSeasonNumber: 1, qualificationSpots: 2 });

  const selectedOrganization = workspace?.organization || null;

  const loadStaffLeagues = useCallback(async (userId) => {
    if (!userId) return setStaffLeagues([]);
    const { data: memberships } = await supabase
      .from("league_memberships")
      .select("role, league:leagues(id,name,slug,season_label,status)")
      .eq("user_id", userId)
      .in("role", ["commissioner", "co_commissioner"]);
    const leagues = (memberships || []).map((entry) => entry.league).filter(Boolean);
    if (!leagues.length) return setStaffLeagues([]);
    const { data: snapshots } = await supabase.from("league_state_snapshots").select("league_id,state,revision").in("league_id", leagues.map((league) => league.id));
    const byLeague = new Map((snapshots || []).map((snapshot) => [snapshot.league_id, snapshot]));
    setStaffLeagues(leagues.map((league) => ({ ...league, state_revision: byLeague.get(league.id)?.revision || 0, season_number: Number(byLeague.get(league.id)?.state?.seasonNumber || 1) })));
  }, [supabase]);

  const loadWorkspace = useCallback(async (organizationId) => {
    if (!organizationId) return setWorkspace(null);
    const [{ data, error }, qualificationResult] = await Promise.all([
      supabase.rpc(MULTI_POD_RPCS.getWorkspace, { p_organization_id: organizationId }),
      supabase.rpc(MULTI_POD_RPCS.getQualificationWorkspace, { p_organization_id: organizationId }),
    ]);
    if (error) throw error;
    // Keep the existing organization workspace usable while the forward-only
    // qualification migration is promoted after the application preview.
    if (qualificationResult.error && qualificationResult.error.code !== "PGRST202") throw qualificationResult.error;
    const qualificationRuns = new Map((qualificationResult.data?.runs || []).map((run) => [run.season_id, run]));
    const nextWorkspace = data ? {
      ...data,
      seasons: (data.seasons || []).map((season) => ({ ...season, qualification: qualificationRuns.get(season.id) || null })),
    } : null;
    setWorkspace(nextWorkspace);
    if (data?.organization) setOrganizationDraft({
      name: data.organization.name || "",
      description: data.organization.description || "",
      visibility: data.organization.visibility || "private",
      imageUrl: data.organization.image_url || "",
      brandColor: data.organization.brand_color || "#4fd1c5",
    });
    return nextWorkspace;
  }, [supabase]);

  const loadOrganizations = useCallback(async (preferredId = "") => {
    const { data, error } = await supabase.rpc(MULTI_POD_RPCS.listMine);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    setOrganizations(rows);
    const params = new URLSearchParams(window.location.search);
    const requested = preferredId || params.get("organization") || rows[0]?.id || "";
    if (requested) await loadWorkspace(requested);
    else setWorkspace(null);
  }, [loadWorkspace, supabase]);

  useEffect(() => {
    let active = true;
    const inviteToken = new URLSearchParams(window.location.search).get("administrator_invite") || "";
    if (inviteToken) supabase.rpc(MULTI_POD_RPCS.previewAdministratorInvite, { p_token: inviteToken }).then(({ data }) => { if (active) setInvitePreview(data ? { ...data, token: inviteToken } : { invalid: true }); });
    async function update(currentSession) {
      if (!active) return;
      setSession(currentSession || null);
      try {
        if (currentSession) await Promise.all([loadOrganizations(), loadStaffLeagues(currentSession.user.id)]);
      } catch (error) {
        if (active) setMessage(messageFrom(error, "The organization workspace could not be loaded."));
      } finally {
        if (active) setLoading(false);
      }
    }
    supabase.auth.getSession().then(({ data }) => update(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => update(nextSession));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadOrganizations, loadStaffLeagues, supabase]);

  const availableLeagues = useMemo(() => staffLeagues.filter((league) => !workspace?.seasons?.some((season) => season.pods?.some((pod) => pod.league_id === league.id && !["complete", "archived"].includes(season.status)))), [staffLeagues, workspace]);
  const staffLeagueIds = useMemo(() => new Set(staffLeagues.map((league) => league.id)), [staffLeagues]);

  async function run(action, success) {
    setBusy(true); setMessage("");
    try { await action(); if (success) setMessage(success); }
    catch (error) { setMessage(messageFrom(error, "That organization action could not be completed.")); }
    finally { setBusy(false); }
  }

  async function createOrganization(event) {
    event.preventDefault();
    await run(async () => {
      const draft = createMultiPodOrganizationDraft(newOrganizationDraft);
      const { data, error } = await supabase.rpc(MULTI_POD_RPCS.createOrganization, { p_name: draft.name, p_description: draft.description, p_visibility: draft.visibility });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      const { error: brandingError } = await supabase.rpc(MULTI_POD_RPCS.updateOrganization, multiPodOrganizationUpdateRpcArguments(result.id, 0, draft));
      if (brandingError) throw brandingError;
      await loadOrganizations(result.id);
      setNewOrganizationDraft({ name: "", description: "", visibility: "private", imageUrl: "", brandColor: "#4fd1c5" });
      window.history.replaceState({}, "", `/organizations?organization=${result.id}`);
    }, "Organization created. Add the first shared season when you are ready.");
  }

  async function saveOrganization(event) {
    event.preventDefault();
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.updateOrganization, multiPodOrganizationUpdateRpcArguments(selectedOrganization.id, selectedOrganization.revision, organizationDraft));
      if (error) throw error;
      await loadOrganizations(selectedOrganization.id);
    }, "Organization details saved.");
  }

  async function createSeason(event) {
    event.preventDefault();
    await run(async () => {
      const regulations = { format: seasonDraft.format.trim(), roster_size: Number(seasonDraft.rosterSize), notes: seasonDraft.notes.trim() };
      const args = multiPodSeasonRpcArguments(selectedOrganization.id, { name: seasonDraft.name, regulations, qualificationRules: seasonDraft });
      const { error } = await supabase.rpc(MULTI_POD_RPCS.createSeason, args);
      if (error) throw error;
      setSeasonDraft((current) => ({ ...current, name: "", notes: "" }));
      await loadOrganizations(selectedOrganization.id);
    }, "Shared season created. Link the source leagues that will become pods.");
  }

  function choosePodLeague(leagueId) {
    const league = availableLeagues.find((entry) => entry.id === leagueId);
    setPodDraft((current) => ({ ...current, leagueId, label: league?.name || current.label, leagueSeasonNumber: league?.season_number || 1 }));
  }

  function beginPod(season) {
    const first = availableLeagues[0];
    setPodDraft({ seasonId: season.id, leagueId: first?.id || "", label: first?.name || "", sortOrder: (season.pods?.length || 0) + 1, leagueSeasonNumber: first?.season_number || 1, qualificationSpots: season.qualification_rules?.top_per_pod || 2 });
  }

  async function attachPod(event) {
    event.preventDefault();
    await run(async () => {
      const args = multiPodAttachmentRpcArguments(podDraft);
      const { error } = await supabase.rpc(MULTI_POD_RPCS.attachPod, args);
      if (error) throw error;
      setPodDraft((current) => ({ ...current, seasonId: "" }));
      await loadOrganizations(selectedOrganization.id);
    }, "Pod linked. A commissioner must now review and confirm the shared regulations.");
  }

  async function confirmRegulations(season, pod) {
    if (!window.confirm(`Confirm that ${pod.league_name} has been reviewed against the shared regulations for ${season.name}?`)) return;
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.confirmPodRegulations, { p_pod_id: pod.id, p_expected_season_revision: season.revision });
      if (error) throw error;
      await loadOrganizations(selectedOrganization.id);
    }, `${pod.label} regulations confirmed.`);
  }

  async function launchSeason(season) {
    if (!window.confirm(`Launch ${season.name}? Pod links and shared regulations will move into the active season.`)) return;
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.launchSeason, { p_season_id: season.id, p_expected_revision: season.revision });
      if (error) throw error;
      await loadOrganizations(selectedOrganization.id);
    }, `${season.name} is now active.`);
  }

  async function beginQualification(season) {
    if (!window.confirm(`Begin qualification for ${season.name}? Each pod commissioner must confirm every regular-season result before locking that pod.`)) return;
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.beginQualification, { p_season_id: season.id, p_expected_revision: season.revision });
      if (error) throw error;
      await loadWorkspace(selectedOrganization.id);
    }, `${season.name} is collecting final pod standings.`);
  }

  async function lockPodStandings(season, pod, qualification) {
    if (!window.confirm(`Lock the final standings, team identities, and rosters for ${pod.label}? Confirm every scheduled result in ${pod.league_name} is final first.`)) return;
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.lockPodStandings, { p_pod_id: pod.id, p_expected_run_revision: qualification.revision });
      if (error) throw error;
      await loadWorkspace(selectedOrganization.id);
    }, `${pod.label} standings are locked for qualification review.`);
  }

  function moveQualificationDrawCandidate(qualification, candidateId, direction) {
    const unresolved = qualification.candidates?.filter((candidate) => candidate.unresolved && !candidate.draw_recorded).map((candidate) => candidate.id) || [];
    setQualificationDrawOrders((current) => {
      const next = [...(current[qualification.id] || unresolved)];
      const index = next.indexOf(candidateId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, [qualification.id]: next };
    });
  }

  async function recordQualificationDraw(qualification, candidateIds) {
    if (!window.confirm("Save this as the recorded commissioner draw order? Only otherwise unresolved qualification ties will use it.")) return;
    await run(async () => {
      const args = multiPodQualificationDrawRpcArguments(qualification.id, qualification.revision, candidateIds);
      const { error } = await supabase.rpc(MULTI_POD_RPCS.recordQualificationDraw, args);
      if (error) throw error;
      setQualificationDrawOrders((current) => ({ ...current, [qualification.id]: [] }));
      await loadWorkspace(selectedOrganization.id);
    }, "Commissioner draw recorded in the qualification audit history.");
  }

  async function finalizeQualification(season, qualification) {
    if (!window.confirm(`Finalize the qualified teams for ${season.name}? Team identities and complete rosters will become the immutable championship source.`)) return;
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.finalizeQualification, { p_run_id: qualification.id, p_expected_revision: qualification.revision });
      if (error) throw error;
      await loadWorkspace(selectedOrganization.id);
    }, `${season.name} qualifiers are final and ready for a connected championship.`);
  }

  async function cancelQualification(season, qualification) {
    if (!window.confirm(`Cancel the current qualification review for ${season.name}? Locked review snapshots will be removed so corrected standings can be collected again.`)) return;
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.cancelQualification, { p_run_id: qualification.id, p_expected_revision: qualification.revision });
      if (error) throw error;
      await loadWorkspace(selectedOrganization.id);
    }, `${season.name} returned to its active regular-season state.`);
  }

  async function syncQualifierManager(qualifier) {
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.syncQualifierManager, { p_qualifier_id: qualifier.id });
      if (error) throw error;
      await loadWorkspace(selectedOrganization.id);
    }, `${qualifier.display_name}'s replacement manager identity is synchronized. The qualified roster did not change.`);
  }

  async function createAdministratorInvite() {
    await run(async () => {
      const { data, error } = await supabase.rpc(MULTI_POD_RPCS.createAdministratorInvite, { p_organization_id: selectedOrganization.id });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      setAdministratorInviteUrl(multiPodAdministratorInviteUrl(window.location.origin, result.token));
      await loadWorkspace(selectedOrganization.id);
    }, "Administrator invitation created. Share it only with the person you trust to help run this organization.");
  }

  async function revokeAdministratorInvite(invitationId) {
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.revokeAdministratorInvite, { p_organization_id: selectedOrganization.id, p_invitation_id: invitationId });
      if (error) throw error;
      setAdministratorInviteUrl("");
      await loadWorkspace(selectedOrganization.id);
    }, "Administrator invitation revoked.");
  }

  async function removeAdministrator(administrator) {
    const label = administrator.display_name || (administrator.username ? `@${administrator.username}` : "this administrator");
    if (!window.confirm(`Remove ${label} from ${selectedOrganization.name}? Their source-league roles will not change.`)) return;
    await run(async () => {
      const { error } = await supabase.rpc(MULTI_POD_RPCS.removeAdministrator, { p_organization_id: selectedOrganization.id, p_user_id: administrator.user_id });
      if (error) throw error;
      await loadWorkspace(selectedOrganization.id);
    }, `${label} was removed from the organization.`);
  }

  async function acceptAdministratorInvite() {
    await run(async () => {
      const { data, error } = await supabase.rpc(MULTI_POD_RPCS.acceptAdministratorInvite, { p_token: invitePreview.token });
      if (error) throw error;
      setInvitePreview(null);
      window.history.replaceState({}, "", `/organizations?organization=${data}`);
      await loadOrganizations(data);
    }, "Administrator invitation accepted.");
  }

  if (loading || session === undefined) return <main className="organization-shell"><p className="hub-message">Loading organization workspace…</p></main>;
  return <main className="organization-shell">
    <section className="organization-workspace-hero"><div><span className="eyebrow">MULTI-POD LEAGUES</span><h1>League organizations</h1><p>Coordinate independent league pods under shared rules, then advance complete teams and rosters into one championship.</p></div><a className="quiet-button" href="/">Back to your leagues</a></section>
    {message && <p className="hub-message">{message}</p>}
    {invitePreview && <section className="organization-invite-card">
      <span className="eyebrow">ADMINISTRATOR INVITATION</span>
      {invitePreview.invalid ? <><h2>This invitation is no longer available.</h2><p>Ask the organization owner for a new link.</p></> : <><h2>Help run {invitePreview.organization_name}?</h2><p>Administrators can coordinate seasons and pods. They do not automatically gain commissioner access to the source leagues.</p>{session ? <button className="primary-button" disabled={busy} onClick={acceptAdministratorInvite}>Accept administrator role</button> : <a className="primary-button" href="/#member-access">Sign in before accepting</a>}</>}
    </section>}
    {!session ? <section className="organization-empty organization-not-found"><h2>Sign in to manage organizations</h2><p>Public organization pages remain available through their shared links.</p><a className="primary-button" href="/#member-access">Sign in to DraftCenter</a></section> : <div className="organization-workspace-grid">
      <aside className="organization-sidebar">
        <div className="section-heading"><div><span className="eyebrow">YOUR NETWORKS</span><h2>Organizations</h2></div></div>
        <div className="organization-switcher">{organizations.map((organization) => <button key={organization.id} className={selectedOrganization?.id === organization.id ? "active" : ""} onClick={() => { loadWorkspace(organization.id); window.history.replaceState({}, "", `/organizations?organization=${organization.id}`); }}><strong>{organization.name}</strong><span>{organization.role}</span></button>)}</div>
        <details className="organization-create-card" open={!organizations.length}><summary>Start an organization</summary><form className="form-stack" onSubmit={createOrganization}><label>Name<input required minLength={2} value={newOrganizationDraft.name} onChange={(event) => setNewOrganizationDraft({ ...newOrganizationDraft, name: event.target.value })} placeholder="Premier Draft Association" /></label><label>Description<textarea rows={3} value={newOrganizationDraft.description} onChange={(event) => setNewOrganizationDraft({ ...newOrganizationDraft, description: event.target.value })} placeholder="What brings these leagues together?" /></label><label>Visibility<select value={newOrganizationDraft.visibility} onChange={(event) => setNewOrganizationDraft({ ...newOrganizationDraft, visibility: event.target.value })}><option value="private">Private while planning</option><option value="public">Public organization page</option></select></label><button className="primary-button" disabled={busy}>Create organization</button></form></details>
      </aside>
      <section className="organization-workspace-main">
        {!selectedOrganization && <div className="organization-empty"><strong>Create your first organization.</strong><span>It will contain shared seasons and the existing leagues you link as pods.</span></div>}
        {selectedOrganization && <>
          <header className="organization-heading" style={{ "--organization-color": selectedOrganization.brand_color || "#4fd1c5" }}><OrganizationMark organization={selectedOrganization} /><div><span className="eyebrow">{selectedOrganization.visibility.toUpperCase()} ORGANIZATION</span><h2>{selectedOrganization.name}</h2><p>{selectedOrganization.description || "Add a description for commissioners and the public organization page."}</p></div>{selectedOrganization.visibility === "public" && <a className="quiet-button" href={`/organizations/${selectedOrganization.slug}`}>View public page</a>}</header>
          {selectedOrganization.is_admin && <details className="organization-panel"><summary>Branding and public details</summary><form className="organization-form-grid" onSubmit={saveOrganization}><label>Name<input required value={organizationDraft.name} onChange={(event) => setOrganizationDraft({ ...organizationDraft, name: event.target.value })} /></label><label>Brand color<input type="color" value={organizationDraft.brandColor} onChange={(event) => setOrganizationDraft({ ...organizationDraft, brandColor: event.target.value })} /></label><label className="organization-form-wide">Description<textarea rows={3} value={organizationDraft.description} onChange={(event) => setOrganizationDraft({ ...organizationDraft, description: event.target.value })} /></label><label className="organization-form-wide">Organization artwork URL<input type="url" value={organizationDraft.imageUrl} onChange={(event) => setOrganizationDraft({ ...organizationDraft, imageUrl: event.target.value })} placeholder="https://…" /></label><label>Visibility<select value={organizationDraft.visibility} onChange={(event) => setOrganizationDraft({ ...organizationDraft, visibility: event.target.value })}><option value="private">Private</option><option value="public">Public page</option></select></label><button className="primary-button" disabled={busy}>Save details</button></form></details>}
          {selectedOrganization.is_admin && <details className="organization-panel"><summary>Administrators</summary><div className="organization-administrators">{workspace.administrators?.map((administrator) => <p key={administrator.user_id}><span>{administrator.display_name || (administrator.username ? `@${administrator.username}` : "Administrator")}</span><span className="organization-administrator-role"><strong>{administrator.role}</strong>{selectedOrganization.is_owner && administrator.role === "administrator" && <button className="quiet-button" disabled={busy} onClick={() => removeAdministrator(administrator)}>Remove</button>}</span></p>)}</div>{selectedOrganization.is_owner && <><button className="secondary-button" disabled={busy} onClick={createAdministratorInvite}>Create secure invitation</button>{administratorInviteUrl && <div className="organization-invite-link"><label>Share this one-time link<input readOnly value={administratorInviteUrl} onFocus={(event) => event.target.select()} /></label><button className="quiet-button" onClick={() => navigator.clipboard?.writeText(administratorInviteUrl)}>Copy link</button></div>}{workspace.pending_invitations?.map((invitation) => <p className="organization-pending-invite" key={invitation.id}><span>Unused invitation · expires {new Date(invitation.expires_at).toLocaleDateString()}</span><button className="quiet-button" disabled={busy} onClick={() => revokeAdministratorInvite(invitation.id)}>Revoke</button></p>)}</>}</details>}
          <div className="organization-season-stack">
            {workspace.seasons?.map((season) => <article className="organization-season-card" key={season.id}>
              <header><div><span className="eyebrow">{season.status.toUpperCase()}</span><h3>{season.name}</h3></div><span>{season.pods?.length || 0} pods</span></header>
              <RulesSummary season={season} />
              <PodList season={season} canManage={selectedOrganization.is_admin} busy={busy} onConfirm={confirmRegulations} />
              <QualificationPanel
                season={season}
                run={season.qualification}
                canManage={selectedOrganization.is_admin}
                busy={busy}
                staffLeagueIds={staffLeagueIds}
                drawOrder={qualificationDrawOrders[season.qualification?.id] || []}
                onBegin={beginQualification}
                onLock={lockPodStandings}
                onMoveDraw={moveQualificationDrawCandidate}
                onRecordDraw={recordQualificationDraw}
                onFinalize={finalizeQualification}
                onCancel={cancelQualification}
                onSyncManager={syncQualifierManager}
              />
              {selectedOrganization.is_admin && season.status === "planning" && <div className="organization-season-actions"><button className="secondary-button" disabled={busy || !availableLeagues.length} onClick={() => beginPod(season)}>Link existing league as pod</button><button className="primary-button" disabled={busy || season.pods?.length < 2 || season.pods?.some((pod) => pod.regulations_status !== "confirmed")} onClick={() => launchSeason(season)}>Launch season</button></div>}
              {podDraft.seasonId === season.id && <form className="organization-pod-form" onSubmit={attachPod}><label>Source league<select required value={podDraft.leagueId} onChange={(event) => choosePodLeague(event.target.value)}>{availableLeagues.map((league) => <option key={league.id} value={league.id}>{league.name} · season {league.season_number}</option>)}</select></label><label>Pod label<input required value={podDraft.label} onChange={(event) => setPodDraft({ ...podDraft, label: event.target.value })} placeholder="Pod A" /></label><label>Qualification spots<input type="number" min="1" max="16" value={podDraft.qualificationSpots} onChange={(event) => setPodDraft({ ...podDraft, qualificationSpots: event.target.value })} /></label><button className="primary-button" disabled={busy}>Link pod</button><button type="button" className="quiet-button" onClick={() => setPodDraft({ ...podDraft, seasonId: "" })}>Cancel</button></form>}
              <p className="organization-policy-note">Teams retain their exact identities and rosters if they qualify. Cross-pod duplicate Pokémon are allowed.</p>
            </article>)}
          </div>
          {selectedOrganization.is_admin && <details className="organization-panel organization-new-season" open={!workspace.seasons?.length}><summary>Create shared season</summary><form className="organization-form-grid" onSubmit={createSeason}><label>Season name<input required value={seasonDraft.name} onChange={(event) => setSeasonDraft({ ...seasonDraft, name: event.target.value })} placeholder="2027 Championship Series" /></label><label>Battle format<input required value={seasonDraft.format} onChange={(event) => setSeasonDraft({ ...seasonDraft, format: event.target.value })} /></label><label>Roster size<input type="number" min="1" max="30" value={seasonDraft.rosterSize} onChange={(event) => setSeasonDraft({ ...seasonDraft, rosterSize: event.target.value })} /></label><label>Automatic qualifiers per pod<input type="number" min="1" max="16" value={seasonDraft.topPerPod} onChange={(event) => setSeasonDraft({ ...seasonDraft, topPerPod: event.target.value })} /></label><label>Wild-card slots<input type="number" min="0" max="32" value={seasonDraft.wildcardSlots} onChange={(event) => setSeasonDraft({ ...seasonDraft, wildcardSlots: event.target.value })} /></label><label className="organization-form-wide">Shared rule notes<textarea rows={4} value={seasonDraft.notes} onChange={(event) => setSeasonDraft({ ...seasonDraft, notes: event.target.value })} placeholder="Transaction windows, playoff freeze, battle rules, and other shared requirements." /></label><fieldset className="organization-form-wide organization-tiebreakers"><legend>Tiebreaker order</legend>{seasonDraft.tiebreakers.map((value, index) => <label key={index}>#{index + 1}<select value={value} onChange={(event) => { const next = [...seasonDraft.tiebreakers]; next[index] = event.target.value; setSeasonDraft({ ...seasonDraft, tiebreakers: next }); }}>{MULTI_POD_TIEBREAKERS.map((option) => <option key={option} value={option}>{TIEBREAKER_LABELS[option]}</option>)}</select></label>)}<div><button type="button" className="quiet-button" disabled={seasonDraft.tiebreakers.length >= 5} onClick={() => setSeasonDraft({ ...seasonDraft, tiebreakers: [...seasonDraft.tiebreakers, MULTI_POD_TIEBREAKERS.find((item) => !seasonDraft.tiebreakers.includes(item)) || "commissioner-draw"] })}>Add tiebreaker</button><button type="button" className="quiet-button" disabled={seasonDraft.tiebreakers.length <= 1} onClick={() => setSeasonDraft({ ...seasonDraft, tiebreakers: seasonDraft.tiebreakers.slice(0, -1) })}>Remove last</button></div></fieldset><button className="primary-button" disabled={busy}>Create shared season</button></form></details>}
        </>}
      </section>
    </div>}
  </main>;
}
