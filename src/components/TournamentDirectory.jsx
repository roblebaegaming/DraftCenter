"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { tournamentError } from "../lib/tournamentErrors";
import {
  DOUBLE_ELIMINATION_MAX_ENTRANTS,
  SINGLE_ELIMINATION_MAX_ENTRANTS,
  tournamentEntrantBounds,
} from "../lib/tournamentLimits";

export default function TournamentDirectory() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [tournaments, setTournaments] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "public",
    format: "single-elimination",
    bestOf: 3,
    entrantLimit: 16,
    rules: "",
  });
  const entrantBounds = tournamentEntrantBounds(form.format);

  async function load() {
    const { data, error } = await supabase.rpc("list_tournaments");
    if (error) setMessage(tournamentError(error));
    else setTournaments(data || []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    load();
  }, [supabase]);

  function changeFormat(format) {
    const bounds = tournamentEntrantBounds(format);
    setForm({
      ...form,
      format,
      entrantLimit: Math.min(bounds.max, Math.max(bounds.min, form.entrantLimit)),
    });
  }

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_tournament", {
      p_name: form.name,
      p_description: form.description,
      p_visibility: form.visibility,
      p_format: form.format,
      p_best_of: Number(form.bestOf),
      p_entrant_limit: Number(form.entrantLimit),
      p_rules: form.rules,
    });
    setBusy(false);
    if (error) return setMessage(tournamentError(error));
    if (!data?.slug) return setMessage("The tournament was created, but its registration page could not be opened.");
    const code = data.registration_code ? `#code=${encodeURIComponent(data.registration_code)}` : "";
    window.location.assign(`/tournaments/${data.slug}${code}`);
  }

  return (
    <main className="tournament-shell">
      <header className="tournament-hero">
        <a className="quiet-button" href="/?view=dashboard">&larr; DraftCenter home</a>
        <span className="eyebrow">TOURNAMENTS</span>
        <h1>Run a clean bracket</h1>
        <p>Create a standalone single- or double-elimination tournament, register entrants, seed the bracket, and confirm every advancement atomically.</p>
      </header>
      <div className="tournament-directory-layout">
        <section className="tournament-panel">
          <div className="section-heading"><div><span className="eyebrow">PUBLIC & YOUR EVENTS</span><h2>Tournaments</h2></div></div>
          {message && <p className="hub-message">{message}</p>}
          <div className="tournament-list">
            {tournaments.map((tournament) => (
              <a href={`/tournaments/${tournament.slug}`} key={tournament.id}>
                <div>
                  <strong>{tournament.name}</strong>
                  <p>{tournament.description || `${tournament.format === "double-elimination" ? "Double" : "Single"}-elimination tournament`}</p>
                </div>
                <span>{tournament.format === "double-elimination" ? "Double elimination" : "Single elimination"} &middot; {tournament.status} &middot; Best of {tournament.best_of}</span>
              </a>
            ))}
            {!tournaments.length && !message && <div className="empty-state">No tournaments are visible yet.</div>}
          </div>
        </section>
        <section className="tournament-panel tournament-create">
          <span className="eyebrow">COMMISSIONER</span>
          <h2>Create tournament</h2>
          {user === undefined ? <p>Checking your account...</p> : !user ? (
            <>
              <p className="muted">Sign in to create and seed a tournament.</p>
              <a className="primary-button inline-link-button" href="/">Sign in</a>
            </>
          ) : (
            <form className="form-stack" onSubmit={create}>
              <label>Name<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Description<textarea maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label>Format
                <select value={form.format} onChange={(event) => changeFormat(event.target.value)}>
                  <option value="single-elimination">Single elimination</option>
                  <option value="double-elimination">Double elimination</option>
                </select>
                <small>{form.format === "double-elimination"
                  ? `A first loss moves an entrant to the losers bracket. A second loss eliminates them. Up to ${DOUBLE_ELIMINATION_MAX_ENTRANTS} entrants.`
                  : `One loss eliminates an entrant. Up to ${SINGLE_ELIMINATION_MAX_ENTRANTS} entrants.`}</small>
              </label>
              <div className="tournament-form-pair">
                <label>Visibility
                  <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <label>Series
                  <select value={form.bestOf} onChange={(event) => setForm({ ...form, bestOf: Number(event.target.value) })}>
                    <option value="1">Best of 1</option>
                    <option value="3">Best of 3</option>
                  </select>
                </label>
              </div>
              <label>Entrant limit<input type="number" min={entrantBounds.min} max={entrantBounds.max} value={form.entrantLimit} onChange={(event) => setForm({ ...form, entrantLimit: Number(event.target.value) })} /></label>
              <label>Rules<textarea maxLength={10000} rows={5} value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} /></label>
              <button className="primary-button" disabled={busy}>{busy ? "Creating..." : "Create registration"}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
