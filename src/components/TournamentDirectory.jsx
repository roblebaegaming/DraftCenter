"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { draftTournamentCreateRpcArguments } from "../lib/draftTournament";
import { tournamentError } from "../lib/tournamentErrors";
import {
  DOUBLE_ELIMINATION_MAX_ENTRANTS,
  SINGLE_ELIMINATION_MAX_ENTRANTS,
  tournamentEntrantBounds,
} from "../lib/tournamentLimits";

function formatLabel(format) {
  if (format === "draft-tournament") return "Draft Tournament";
  if (format === "double-elimination") return "Double elimination";
  return "Single elimination";
}

function formatDescription(format) {
  if (format === "draft-tournament") return "One shared draft, Swiss rounds, and an optional top cut. Up to 16 entrants.";
  if (format === "double-elimination") return `A first loss moves an entrant to the losers bracket. A second loss eliminates them. Up to ${DOUBLE_ELIMINATION_MAX_ENTRANTS} entrants.`;
  return `One loss eliminates an entrant. Up to ${SINGLE_ELIMINATION_MAX_ENTRANTS} entrants.`;
}

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
    rosterSize: 6,
    pickTimeLimitMinutes: 5,
    topCutSize: 0,
    snakeBudgetEnabled: false,
    draftBudget: 120,
    publishRosters: false,
  });

  async function load() {
    const { data, error } = await supabase.rpc("list_tournaments");
    if (error) setMessage(tournamentError(error));
    else setTournaments(data || []);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    load();
  }, [supabase]);

  function chooseFormat(format) {
    const bounds = format === "draft-tournament" ? { min: 4, max: 16 } : tournamentEntrantBounds(format);
    setForm((current) => ({
      ...current,
      format,
      entrantLimit: Math.min(bounds.max, Math.max(bounds.min, current.entrantLimit)),
      topCutSize: format === "draft-tournament" ? current.topCutSize : 0,
    }));
  }

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    let result;
    try {
      result = form.format === "draft-tournament"
        ? await supabase.rpc("create_draft_tournament", draftTournamentCreateRpcArguments(form))
        : await supabase.rpc("create_tournament", {
          p_name: form.name,
          p_description: form.description,
          p_visibility: form.visibility,
          p_format: form.format,
          p_best_of: Number(form.bestOf),
          p_entrant_limit: Number(form.entrantLimit),
          p_rules: form.rules,
        });
    } catch (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    setBusy(false);
    if (result.error) return setMessage(tournamentError(result.error));
    if (!result.data?.slug) return setMessage("The tournament was created, but its registration page could not be opened.");
    const code = result.data.registration_code ? `#code=${encodeURIComponent(result.data.registration_code)}` : "";
    window.location.assign(`/tournaments/${result.data.slug}${code}`);
  }

  const draftTournament = form.format === "draft-tournament";
  const entrantBounds = draftTournament ? { min: 4, max: 16 } : tournamentEntrantBounds(form.format);

  return (
    <main className="tournament-shell">
      <header className="tournament-hero">
        <a className="quiet-button" href="/?view=dashboard">&larr; DraftCenter home</a>
        <span className="eyebrow">TOURNAMENTS</span>
        <h1>Pokémon tournament organizer</h1>
        <p>Run single- or double-elimination brackets, connect a multi-pod championship, or draft every roster together before Swiss competition and an optional top cut.</p>
      </header>
      <div className="tournament-directory-layout">
        <section className="tournament-panel">
          <div className="section-heading"><div><span className="eyebrow">PUBLIC & YOUR EVENTS</span><h2>Tournaments</h2></div></div>
          {message && <p className="hub-message">{message}</p>}
          <div className="tournament-list">
            {tournaments.map((tournament) => (
              <a href={`/tournaments/${tournament.slug}`} key={tournament.id}>
                <div><strong>{tournament.name}</strong><p>{tournament.description || formatDescription(tournament.format)}</p></div>
                <span>{formatLabel(tournament.format)} &middot; {tournament.status} &middot; Best of {tournament.best_of}</span>
              </a>
            ))}
            {!tournaments.length && !message && <div className="empty-state">No tournaments are visible yet.</div>}
          </div>
        </section>

        <section className="tournament-panel tournament-create">
          <span className="eyebrow">COMMISSIONER</span>
          <h2>Create tournament</h2>
          {user === undefined ? <p>Checking your account...</p> : !user ? (
            <><p className="muted">Sign in to create and run a tournament.</p><a className="primary-button inline-link-button" href="/">Sign in</a></>
          ) : (
            <form className="form-stack" onSubmit={create}>
              <label>Name<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Description<textarea maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label>Format
                <select value={form.format} onChange={(event) => chooseFormat(event.target.value)}>
                  <option value="single-elimination">Single elimination</option>
                  <option value="double-elimination">Double elimination</option>
                  <option value="draft-tournament">Draft Tournament</option>
                </select>
                <small>{formatDescription(form.format)}</small>
              </label>
              <div className="tournament-form-pair">
                <label>Visibility
                  <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value, publishRosters: event.target.value === "public" && form.publishRosters })}>
                    <option value="public">Public</option><option value="private">Private</option>
                  </select>
                </label>
                <label>Series
                  <select value={form.bestOf} onChange={(event) => setForm({ ...form, bestOf: Number(event.target.value) })}>
                    <option value="1">Best of 1</option><option value="3">Best of 3</option>
                  </select>
                </label>
              </div>
              <label>Entrant limit<input type="number" min={entrantBounds.min} max={entrantBounds.max} value={form.entrantLimit} onChange={(event) => setForm({ ...form, entrantLimit: Number(event.target.value) })} /></label>

              {draftTournament && (
                <fieldset className="form-stack tournament-draft-settings">
                  <legend>Shared draft</legend>
                  <div className="tournament-form-pair">
                    <label>Pokémon per roster<input type="number" min="4" max="12" value={form.rosterSize} onChange={(event) => setForm({ ...form, rosterSize: Number(event.target.value) })} /></label>
                    <label>Pick clock
                      <select value={form.pickTimeLimitMinutes} onChange={(event) => setForm({ ...form, pickTimeLimitMinutes: Number(event.target.value) })}>
                        <option value="0">No limit</option><option value="2">2 minutes</option><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="60">1 hour</option>
                      </select>
                    </label>
                  </div>
                  <div className="tournament-form-pair">
                    <label>Top cut
                      <select value={form.topCutSize} onChange={(event) => setForm({ ...form, topCutSize: Number(event.target.value) })}>
                        <option value="0">No top cut</option><option value="2">Top 2</option><option value="4">Top 4</option><option value="8">Top 8</option>
                      </select>
                    </label>
                  </div>
                  <label className="tournament-checkbox"><input type="checkbox" checked={form.snakeBudgetEnabled} onChange={(event) => setForm({ ...form, snakeBudgetEnabled: event.target.checked })} /> Use a point budget during the snake draft</label>
                  {form.snakeBudgetEnabled && <label>Draft budget<input type="number" min="60" max="1000" value={form.draftBudget} onChange={(event) => setForm({ ...form, draftBudget: Number(event.target.value) })} /></label>}
                  {form.visibility === "public" && <label className="tournament-checkbox"><input type="checkbox" checked={form.publishRosters} onChange={(event) => setForm({ ...form, publishRosters: event.target.checked })} /> Publish locked rosters on the public event page</label>}
                  <small>Swiss rounds are automatic: three rounds for 4–8 checked-in entrants and four rounds for 9–16.</small>
                </fieldset>
              )}

              <label>Rules<textarea maxLength={10000} rows={5} value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} /></label>
              <button className="primary-button" disabled={busy}>{busy ? "Creating..." : "Create registration"}</button>
            </form>
          )}
        </section>
      </div>
      <section className="tournament-panel tournament-format-guide" aria-labelledby="tournament-format-guide-title">
        <span className="eyebrow">CHOOSE YOUR EVENT</span>
        <h2 id="tournament-format-guide-title">Four ways to run a Pokémon tournament</h2>
        <p className="tournament-format-intro">Choose a direct bracket for a standalone event, a shared-draft competition for up to 16 players, or promote qualified league rosters into a connected championship.</p>
        <div className="tournament-format-grid">
          <article>
            <h3>Single elimination</h3>
            <p>Run a best-of-one or best-of-three bracket for 2–{SINGLE_ELIMINATION_MAX_ENTRANTS} entrants. One match loss eliminates an entrant.</p>
          </article>
          <article>
            <h3>Double elimination</h3>
            <p>Run a winners bracket, losers bracket, Grand Final, and reset match when required for 4–{DOUBLE_ELIMINATION_MAX_ENTRANTS} entrants.</p>
          </article>
          <article>
            <h3>Draft Tournament</h3>
            <p>Register and check in 4–16 players, complete one hidden shared snake draft, lock the rosters, play deterministic Swiss rounds, and optionally advance to a Top 2, 4, or 8.</p>
          </article>
          <article>
            <h3>Connected championship</h3>
            <p>Multi-pod league organizations can finalize qualification, retain each qualifying roster, and promote those teams into a connected single- or double-elimination championship.</p>
          </article>
        </div>
      </section>
      <section className="tournament-panel tournament-event-guide" aria-labelledby="tournament-event-guide-title">
        <span className="eyebrow">REGISTRATION TO CHAMPION</span>
        <h2 id="tournament-event-guide-title">Keep the bracket and result history together</h2>
        <p>Commissioners seed the field, start the event, confirm reported results, and make bounded corrections when needed. Draft Tournaments add check-in, a shared draft room, roster publication controls, Swiss standings, and an optional elimination top cut.</p>
        <p>Public events appear in the directory for spectators. Private events and commissioner controls remain available only to the people who have access; DraftCenter does not publish private registrations, rosters, or workspaces for search discovery.</p>
        <nav className="tournament-learning-links" aria-label="Tournament planning resources">
          <a href="/formats">Compare Pokémon draft formats</a>
          <a href="/guides/pokemon-draft-league-rules-template">Start with a rules template</a>
          <a href="/guides/how-to-run-pokemon-draft-league">Read the commissioner guide</a>
        </nav>
      </section>
    </main>
  );
}
