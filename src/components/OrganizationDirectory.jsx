"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

function roleLabel(role) {
  if (role === "owner") return "owner";
  if (role === "administrator") return "commissioner";
  return role || "";
}

function OrganizationCard({ organization, signedIn, busy, onJoin, onLeave, onPolicy }) {
  const staff = ["owner", "administrator"].includes(organization.my_role);
  return <article className="organization-directory-card">
    <div className="organization-directory-card-heading">
      <div><span className="eyebrow">{organization.membership_policy === "open" ? "OPEN COMMUNITY" : "INVITE ONLY"}</span><h2>{organization.name}</h2></div>
      {organization.my_role && <span className="organization-role-badge">{roleLabel(organization.my_role)}</span>}
    </div>
    <p>{organization.description || "A DraftCenter organization for connected leagues, seasons, and community members."}</p>
    <dl><div><dt>Members</dt><dd>{organization.member_count || 0}</dd></div><div><dt>Current programs</dt><dd>{organization.active_season_count || 0}</dd></div><div><dt>Joining</dt><dd>{organization.membership_policy === "open" ? "Open" : "Invite only"}</dd></div></dl>
    <div className="organization-directory-actions">
      <a className="secondary-button" href={`/organizations/${organization.slug}`}>View organization</a>
      {!organization.my_role && organization.membership_policy === "open" && <button className="primary-button" disabled={busy} onClick={() => onJoin(organization)}>{signedIn ? "Join organization" : "Sign in to join"}</button>}
      {organization.my_role === "member" && <button className="quiet-button" disabled={busy} onClick={() => onLeave(organization)}>Leave organization</button>}
      {staff && <><a className="quiet-button" href={`/organizations?organization=${organization.id}#organization-commissioner-workspace`}>Commissioner workspace</a><button className="quiet-button" disabled={busy} onClick={() => onPolicy(organization, organization.membership_policy === "open" ? "closed" : "open")}>{organization.membership_policy === "open" ? "Make invite-only" : "Open independent joining"}</button></>}
    </div>
  </article>;
}

export default function OrganizationDirectory() {
  const [supabase] = useState(() => createClient());
  const [organizations, setOrganizations] = useState([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const [sessionResult, directoryResult] = await Promise.all([
      supabase.auth.getSession(),
      supabase.rpc("get_league_organization_directory"),
    ]);
    setSignedIn(Boolean(sessionResult.data.session));
    if (directoryResult.error) setMessage("The organization directory could not be loaded.");
    else setOrganizations(Array.isArray(directoryResult.data) ? directoryResult.data : []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const { data } = supabase.auth.onAuthStateChange(() => load());
    return () => data.subscription.unsubscribe();
  }, [load, supabase]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((organization) => `${organization.name} ${organization.description || ""}`.toLowerCase().includes(term));
  }, [organizations, search]);
  const memberships = organizations.filter((organization) => organization.my_role);

  async function run(action, success) {
    setBusy(true);
    setMessage("");
    const { error } = await action();
    setBusy(false);
    if (error) return setMessage(error.message || "That organization action could not be completed.");
    await load();
    setMessage(success);
  }

  async function join(organization) {
    if (!signedIn) return window.location.assign("/#member-access");
    await run(() => supabase.rpc("join_open_league_organization", { p_organization_id: organization.id }), `You joined ${organization.name}. Its commissioners can now include you in organization announcements.`);
  }

  async function leave(organization) {
    if (!window.confirm(`Leave ${organization.name}? This will not remove you from any league you joined separately.`)) return;
    await run(() => supabase.rpc("leave_league_organization", { p_organization_id: organization.id }), `You left ${organization.name}. Your separate league memberships were not changed.`);
  }

  async function updatePolicy(organization, policy) {
    const action = policy === "open" ? "allow independent joining" : "make joining invite-only";
    if (!window.confirm(`Update ${organization.name} to ${action}?`)) return;
    await run(() => supabase.rpc("update_league_organization_membership_policy", { p_organization_id: organization.id, p_membership_policy: policy }), policy === "open" ? `${organization.name} is now open for independent joining.` : `${organization.name} is now invite-only.`);
  }

  return <main className="organization-directory-shell">
    <header className="organization-directory-hero">
      <span className="eyebrow">DRAFTCENTER ORGANIZATIONS</span>
      <h1>Find the communities behind the leagues.</h1>
      <p>Join an open organization once, stay connected across its league programs and seasons, and receive only the announcements you allow.</p>
      <div className="organization-directory-hero-actions"><a className="secondary-button" href="/leagues">Browse public leagues</a>{signedIn && <a className="primary-button" href="#organization-commissioner-workspace">Run an organization</a>}</div>
    </header>
    {memberships.length > 0 && <section className="organization-membership-summary"><span className="eyebrow">YOUR COMMUNITIES</span><p>{memberships.map((organization) => organization.name).join(" · ")}</p></section>}
    <section className="organization-directory-controls"><label>Search organizations<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or description" /></label><button className="quiet-button" disabled={loading || busy} onClick={load}>Refresh</button></section>
    {message && <p className="hub-message" role="status">{message}</p>}
    {loading && <p className="muted">Loading organizations…</p>}
    {!loading && !message && filtered.length === 0 && <section className="organization-directory-empty"><h2>No matching open organizations yet.</h2><p>Commissioners can create an organization below and open it for independent joining.</p></section>}
    <section className="organization-directory-grid">{filtered.map((organization) => <OrganizationCard key={organization.id} organization={organization} signedIn={signedIn} busy={busy} onJoin={join} onLeave={leave} onPolicy={updatePolicy} />)}</section>
  </main>;
}
