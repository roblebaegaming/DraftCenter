"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  auctionDraftTournamentCreateRpcArguments,
  draftFirstTournamentCreateRpcArguments,
} from "../lib/draftTournament";
import { tournamentError } from "../lib/tournamentErrors";
import {
  DOUBLE_ELIMINATION_MAX_ENTRANTS,
  SINGLE_ELIMINATION_MAX_ENTRANTS,
  tournamentEntrantBounds,
} from "../lib/tournamentLimits";
import PredictionBracketDirectory from "./PredictionBracketDirectory";

function formatLabel(format, competitionFormat = null) {
  if (format === "draft-tournament" && competitionFormat === "double-elimination") return "Draft + double elimination";
  if (format === "draft-tournament" && competitionFormat === "single-elimination") return "Draft + single elimination";
  if (format === "draft-tournament" && competitionFormat === "swiss") return "Draft + Swiss";
  if (format === "draft-tournament") return "Draft Tournament";
  if (format === "double-elimination") return "Double elimination";
  if (format === "swiss") return "Swiss";
  return "Single elimination";
}

function formatDescription(format, competitionFormat = null) {
  if (format === "draft-tournament" && competitionFormat === "double-elimination") return "One shared draft followed by a winners bracket, losers bracket, Grand Final, and conditional reset.";
  if (format === "draft-tournament" && competitionFormat === "single-elimination") return "One shared draft followed by a single-elimination bracket.";
  if (format === "draft-tournament" && competitionFormat === "swiss") return "One shared draft followed by score-grouped Swiss rounds with standings and rematch-aware pairings.";
  if (format === "draft-tournament") return "One shared snake or auction draft followed by tournament play. Snake supports up to 16 entrants; auction supports up to 32.";
  if (format === "double-elimination") return `A first loss moves an entrant to the losers bracket. A second loss eliminates them. Up to ${DOUBLE_ELIMINATION_MAX_ENTRANTS} entrants.`;
  if (format === "swiss") return "Managers draft first, then play every Swiss round instead of being eliminated after a loss. Snake supports up to 16 entrants; auction supports up to 32.";
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
    draftRostersFirst: false,
    draftType: "snake",
    bestOf: 3,
    entrantLimit: 16,
    rules: "",
    rosterSize: 6,
    pickTimeLimitMinutes: 5,
    snakeBudgetEnabled: false,
    draftBudget: 120,
    auctionNominationSeconds: 30,
    auctionTimerSeconds: 30,
    auctionBidResetSeconds: 10,
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
    setForm((current) => ({
      ...current,
      format,
      draftRostersFirst: format === "swiss" ? true : current.draftRostersFirst,
      entrantLimit: Math.min(
        (format === "swiss" || current.draftRostersFirst) ? (current.draftType === "auction" ? 32 : 16) : tournamentEntrantBounds(format).max,
        Math.max((format === "swiss" || current.draftRostersFirst) ? 4 : tournamentEntrantBounds(format).min, current.entrantLimit),
      ),
    }));
  }

  function chooseDraftRostersFirst(draftRostersFirst) {
    if (!draftRostersFirst && form.format === "swiss") return;
    const bounds = draftRostersFirst ? { min: 4, max: form.draftType === "auction" ? 32 : 16 } : tournamentEntrantBounds(form.format);
    setForm((current) => ({
      ...current,
      draftRostersFirst,
      entrantLimit: Math.min(bounds.max, Math.max(bounds.min, current.entrantLimit)),
    }));
  }

  function chooseDraftType(draftType) {
    const maximum = draftType === "auction" ? 32 : 16;
    setForm((current) => ({
      ...current,
      draftType,
      snakeBudgetEnabled: draftType === "snake" && current.snakeBudgetEnabled,
      entrantLimit: Math.min(maximum, Math.max(4, current.entrantLimit)),
    }));
  }

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    let result;
    try {
      result = form.draftRostersFirst
        ? form.draftType === "auction"
          ? await supabase.rpc("create_auction_draft_first_tournament", auctionDraftTournamentCreateRpcArguments(form))
          : await supabase.rpc("create_draft_first_tournament", draftFirstTournamentCreateRpcArguments(form))
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

  const entrantBounds = form.draftRostersFirst ? { min: 4, max: form.draftType === "auction" ? 32 : 16 } : tournamentEntrantBounds(form.format);

  return (
    <main className="tournament-shell">
      <header className="tournament-hero">
        <a className="quiet-button" href="/?view=dashboard">&larr; DraftCenter home</a>
        <span className="eyebrow">TOURNAMENTS</span>
        <h1>Pokémon tournament organizer</h1>
        <p>Choose single elimination, double elimination, or Swiss, then decide whether everyone brings a team or drafts their rosters together first.</p>
        <a className="quiet-button inline-link-button" href="/tools/bracket-builder">Just make and download a bracket →</a>
      </header>
      <PredictionBracketDirectory />
      <div className="tournament-directory-layout">
        <section className="tournament-panel">
          <div className="section-heading"><div><span className="eyebrow">PUBLIC & YOUR EVENTS</span><h2>Tournaments</h2></div></div>
          {message && <p className="hub-message">{message}</p>}
          <div className="tournament-list">
            {tournaments.map((tournament) => (
              <a href={`/tournaments/${tournament.slug}`} key={tournament.id}>
                <div><strong>{tournament.name}</strong><p>{tournament.description || formatDescription(tournament.format, tournament.competition_format)}</p></div>
                <span>{formatLabel(tournament.format, tournament.competition_format)} &middot; {tournament.status} &middot; Best of {tournament.best_of}</span>
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
                  <option value="swiss">Swiss</option>
                </select>
                <small>{formatDescription(form.draftRostersFirst ? "draft-tournament" : form.format, form.draftRostersFirst ? form.format : null)}</small>
              </label>
              <button
                type="button"
                className={`tournament-draft-toggle ${form.draftRostersFirst ? "is-selected" : ""}`}
                aria-pressed={form.draftRostersFirst}
                disabled={form.format === "swiss"}
                onClick={() => chooseDraftRostersFirst(!form.draftRostersFirst)}
              >
                <strong>Draft teams first</strong>
                <span>{form.format === "swiss" ? "On — Swiss currently uses the shared draft before Round 1." : form.draftRostersFirst ? "On — every checked-in manager drafts a roster before tournament play." : "Off — entrants bring their own teams directly to the bracket."}</span>
              </button>
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

              {form.draftRostersFirst && (
                <fieldset className="form-stack tournament-draft-settings">
                  <legend>Shared draft</legend>
                  <label>Draft style
                    <select value={form.draftType} onChange={(event) => chooseDraftType(event.target.value)}>
                      <option value="snake">Snake draft — 4–16 managers</option>
                      <option value="auction">Auction draft — 4–32 managers</option>
                    </select>
                  </label>
                  <div className="tournament-form-pair">
                    <label>Pokémon per roster<input type="number" min="4" max="12" value={form.rosterSize} onChange={(event) => setForm({ ...form, rosterSize: Number(event.target.value) })} /></label>
                    {form.draftType === "snake" && <label>Pick clock
                      <select value={form.pickTimeLimitMinutes} onChange={(event) => setForm({ ...form, pickTimeLimitMinutes: Number(event.target.value) })}>
                        <option value="0">No limit</option><option value="2">2 minutes</option><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="60">1 hour</option>
                      </select>
                    </label>}
                  </div>
                  {form.draftType === "snake" && <label className="tournament-checkbox"><input type="checkbox" checked={form.snakeBudgetEnabled} onChange={(event) => setForm({ ...form, snakeBudgetEnabled: event.target.checked })} /> Use a point budget during the snake draft</label>}
                  {(form.draftType === "auction" || form.snakeBudgetEnabled) && <label>{form.draftType === "auction" ? "Auction budget" : "Draft budget"}<input type="number" min="60" max="1000" value={form.draftBudget} onChange={(event) => setForm({ ...form, draftBudget: Number(event.target.value) })} /></label>}
                  {form.draftType === "auction" && <div className="tournament-form-pair tournament-auction-clocks">
                    <label>Nomination clock<input type="number" min="5" max="600" value={form.auctionNominationSeconds} onChange={(event) => setForm({ ...form, auctionNominationSeconds: Number(event.target.value) })} /><small>Seconds</small></label>
                    <label>Opening bid clock<input type="number" min="5" max="600" value={form.auctionTimerSeconds} onChange={(event) => setForm({ ...form, auctionTimerSeconds: Number(event.target.value) })} /><small>Seconds</small></label>
                    <label>Bid reset<input type="number" min="1" max="120" value={form.auctionBidResetSeconds} onChange={(event) => setForm({ ...form, auctionBidResetSeconds: Number(event.target.value) })} /><small>Seconds after each new bid</small></label>
                  </div>}
                  {form.visibility === "public" && <label className="tournament-checkbox"><input type="checkbox" checked={form.publishRosters} onChange={(event) => setForm({ ...form, publishRosters: event.target.checked })} /> Publish locked rosters on the public event page</label>}
                  <small>{form.format === "swiss"
                    ? `After the ${form.draftType} draft, roster lock will pair Swiss Round 1 automatically. Events use 3 rounds for 4–8 managers, 4 for 9–16, or 5 for 17–32 auction managers.`
                    : `After the ${form.draftType} draft, roster lock will build the ${form.format === "double-elimination" ? "double-elimination winners and losers brackets" : "single-elimination bracket"} automatically.`}</small>
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
        <h2 id="tournament-format-guide-title">Choose tournament play, then choose how teams enter</h2>
        <p className="tournament-format-intro">Single or double elimination controls how losses eliminate entrants. Swiss pairs managers by record across every round. Draft teams first adds a shared snake room for 4–16 managers or a shared auction room for 4–32; it is required for Swiss.</p>
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
            <h3>Swiss</h3>
            <p>Draft together, then play three rounds with 4–8 managers, four with 9–16, or five with 17–32 auction managers. Pairings follow the standings and avoid rematches when possible.</p>
          </article>
          <article>
            <h3>Draft teams first</h3>
            <p>Add check-in and one shared snake or auction draft before elimination or Swiss play. Locked drafted rosters carry directly into the selected tournament format.</p>
          </article>
          <article>
            <h3>Connected championship</h3>
            <p>Multi-pod league organizations can finalize qualification, retain each qualifying roster, and promote those teams into a connected single- or double-elimination championship.</p>
          </article>
        </div>
      </section>
      <section className="tournament-panel tournament-event-guide" aria-labelledby="tournament-event-guide-title">
        <span className="eyebrow">REGISTRATION TO CHAMPION</span>
        <h2 id="tournament-event-guide-title">Keep tournament play and result history together</h2>
        <p>Commissioners seed the field, start the event, confirm reported results, and make bounded corrections when needed. Turning on Draft teams first adds check-in, a shared draft room, immutable roster snapshots, and optional public roster publication before tournament play.</p>
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
