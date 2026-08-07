"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { tournamentError } from "../lib/tournamentErrors";

const statusLabel = (status) => status.replaceAll("-", " ");

function ConfirmationDialog({ request, onDismiss }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (request && dialog && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!request && dialog?.open) {
      dialog.close();
    }
    if (!request) {
      setWorking(false);
      setFailure("");
    }
  }, [request]);

  async function confirmAction() {
    if (!request || working) return;
    setWorking(true);
    setFailure("");
    try {
      const completed = await request.onConfirm();
      if (completed === false) {
        setFailure("That action could not be completed. Close this dialog to review the tournament message, then refresh before trying again.");
        return;
      }
      onDismiss();
    } catch {
      setFailure("The action was interrupted. Refresh the tournament before trying again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`tournament-dialog ${request?.tone === "danger" ? "is-danger" : ""}`}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!working) onDismiss();
      }}
    >
      <div className="tournament-dialog-body">
        <span className="eyebrow">CONFIRM ACTION</span>
        <h2 id={titleId}>{request?.title || "Confirm tournament action"}</h2>
        <p id={descriptionId}>{request?.description}</p>
        {failure && <p className="tournament-dialog-error" role="alert">{failure}</p>}
        <div className="tournament-dialog-actions">
          <button ref={cancelRef} type="button" className="quiet-button" disabled={working} onClick={onDismiss}>
            Cancel
          </button>
          <button type="button" className={request?.tone === "danger" ? "danger-button" : "primary-button"} disabled={working} onClick={confirmAction}>
            {working ? request?.workingLabel || "Working..." : request?.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function MatchCard({ match, entrants, submission, canReport, isOwner, onRefresh, supabase, requestConfirmation }) {
  const [scoreA, setScoreA] = useState(match.games_a ?? "");
  const [scoreB, setScoreB] = useState(match.games_b ?? "");
  const [replay, setReplay] = useState(match.replay_urls?.[0] || "");
  const [mvp, setMvp] = useState(match.mvp || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const a = entrants.get(match.entrant_a_id);
  const b = entrants.get(match.entrant_b_id);
  const wins = Math.ceil(match.best_of / 2);

  useEffect(() => {
    setScoreA(match.games_a ?? "");
    setScoreB(match.games_b ?? "");
    setReplay(match.replay_urls?.[0] || "");
    setMvp(match.mvp || "");
  }, [match.games_a, match.games_b, match.mvp, match.replay_urls]);

  async function report(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("submit_tournament_result", {
      p_match_id: match.id,
      p_expected_revision: match.revision,
      p_games_a: Number(scoreA),
      p_games_b: Number(scoreB),
      p_replay_urls: replay.trim() ? [replay.trim()] : [],
      p_mvp: mvp.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return;
    }
    await onRefresh();
  }

  async function confirm() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("confirm_tournament_result", {
      p_submission_id: submission.id,
      p_expected_match_revision: match.revision,
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await onRefresh();
    return true;
  }

  async function reject() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("reject_tournament_result", {
      p_submission_id: submission.id,
      p_expected_match_revision: match.revision,
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await onRefresh();
    return true;
  }

  async function correct() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("correct_tournament_result", {
      p_match_id: match.id,
      p_expected_revision: match.revision,
      p_games_a: Number(scoreA),
      p_games_b: Number(scoreB),
      p_replay_urls: replay.trim() ? [replay.trim()] : [],
      p_mvp: mvp.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await onRefresh();
    return true;
  }

  function requestResultConfirmation() {
    requestConfirmation({
      title: "Confirm and advance this result?",
      description: `${submission.games_a}-${submission.games_b} was reported for ${a?.display_name || "Entrant A"} against ${b?.display_name || "Entrant B"}. Confirming advances the winner and can affect the next match.`,
      confirmLabel: "Confirm & advance",
      workingLabel: "Confirming...",
      onConfirm: confirm,
    });
  }

  function requestRejection() {
    requestConfirmation({
      title: "Reject this reported result?",
      description: "The match will return to ready so a participant or commissioner can submit a corrected score.",
      confirmLabel: "Reject report",
      workingLabel: "Rejecting...",
      tone: "danger",
      onConfirm: reject,
    });
  }

  function requestCorrection(event) {
    event.preventDefault();
    requestConfirmation({
      title: "Save this result correction?",
      description: "The winner and the next bracket slot will be updated. This is blocked after the downstream match has started.",
      confirmLabel: "Save correction",
      workingLabel: "Correcting...",
      tone: "danger",
      onConfirm: correct,
    });
  }

  const scoreFields = (
    <>
      <fieldset className="tournament-score-fields">
        <legend>Series score</legend>
        <label>{a?.display_name || "Entrant A"} games
          <input type="number" inputMode="numeric" min="0" max={wins} required value={scoreA} onChange={(event) => setScoreA(event.target.value)} />
        </label>
        <label>{b?.display_name || "Entrant B"} games
          <input type="number" inputMode="numeric" min="0" max={wins} required value={scoreB} onChange={(event) => setScoreB(event.target.value)} />
        </label>
      </fieldset>
      <label>Replay URL <span>(optional)</span>
        <input type="url" placeholder="https://..." value={replay} onChange={(event) => setReplay(event.target.value)} />
      </label>
      <label>MVP <span>(optional)</span>
        <input maxLength={120} value={mvp} onChange={(event) => setMvp(event.target.value)} />
      </label>
    </>
  );

  return (
    <article className={`tournament-match is-${match.status}`} aria-labelledby={headingId}>
      <header>
        <h4 id={headingId}>Match {match.match_number}</h4>
        <span>{statusLabel(match.status)}</span>
      </header>
      <div className={`tournament-match-side ${match.winner_id === a?.id ? "winner" : ""}`}>
        <span>{a ? `#${a.seed}` : "-"}</span>
        <strong>{a?.display_name || "TBD"}</strong>
        {match.games_a != null && <b>{match.games_a}</b>}
      </div>
      <div className={`tournament-match-side ${match.winner_id === b?.id ? "winner" : ""}`}>
        <span>{b ? `#${b.seed}` : "-"}</span>
        <strong>{b?.display_name || "TBD"}</strong>
        {match.games_b != null && <b>{match.games_b}</b>}
      </div>
      {match.mvp && <small>MVP: {match.mvp}</small>}

      {match.status === "ready" && canReport && (
        <form className="tournament-report" onSubmit={report}>
          {scoreFields}
          <button className="secondary-button" disabled={busy}>{busy ? "Reporting..." : "Report result"}</button>
        </form>
      )}

      {match.status === "reported" && submission && (
        <div className="tournament-confirm">
          <p role="status">{submission.games_a}-{submission.games_b} reported{submission.submitted_by_me ? " - waiting for your opponent." : " - review this result."}</p>
          {(!submission.submitted_by_me || isOwner) && (
            <div>
              <button type="button" className="primary-button" disabled={busy} onClick={requestResultConfirmation}>Confirm & advance</button>
              <button type="button" className="quiet-button" disabled={busy} onClick={requestRejection}>Reject report</button>
            </div>
          )}
        </div>
      )}

      {match.status === "complete" && isOwner && (
        <details className="tournament-correction">
          <summary>Correct result for {a?.display_name || "Entrant A"} vs. {b?.display_name || "Entrant B"}</summary>
          <form className="tournament-report" onSubmit={requestCorrection}>
            {scoreFields}
            <button className="quiet-button" disabled={busy}>Review correction</button>
          </form>
        </details>
      )}
      {message && <p className="hub-message" role="status" aria-live="polite">{message}</p>}
    </article>
  );
}

export default function TournamentWorkspace({ slug }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [personalTeams, setPersonalTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [message, setMessage] = useState("Loading tournament...");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteReady, setInviteReady] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);

  async function load() {
    const { data, error } = await supabase.rpc("get_tournament_workspace", { p_slug: slug, p_access_code: inviteCode });
    if (error) {
      setMessage(tournamentError(error));
      setWorkspace(null);
      return false;
    }
    if (!data) {
      setMessage("This tournament is private or unavailable.");
      setWorkspace(null);
      return false;
    }
    setWorkspace(data);
    setMessage("");
    return true;
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    setInviteCode(code && /^[0-9a-f]{32}$/.test(code) ? code : null);
    setInviteReady(true);
  }, []);

  useEffect(() => {
    if (!inviteReady) return;
    supabase.auth.getUser().then(async ({ data }) => {
      const next = data.user || null;
      setUser(next);
      if (next) {
        const result = await supabase.from("personal_teams").select("id,team_name").eq("owner_id", next.id).eq("archived", false).order("updated_at", { ascending: false });
        if (!result.error) setPersonalTeams(result.data || []);
      }
    });
    load();
  }, [supabase, slug, inviteCode, inviteReady]);

  const entrants = useMemo(() => new Map((workspace?.entrants || []).map((entrant) => [entrant.id, entrant])), [workspace]);
  const me = workspace?.entrants?.find((entrant) => entrant.is_me);
  const rounds = useMemo(() => {
    const grouped = new Map();
    for (const match of workspace?.matches || []) {
      if (!grouped.has(match.round_number)) grouped.set(match.round_number, []);
      grouped.get(match.round_number).push(match);
    }
    return [...grouped.entries()];
  }, [workspace]);
  const defaultRound = useMemo(() => rounds.find(([, matches]) => matches.some((match) => ["ready", "reported"].includes(match.status)))?.[0] ?? rounds.at(-1)?.[0] ?? null, [rounds]);
  const visibleRound = rounds.some(([round]) => round === selectedRound) ? selectedRound : defaultRound;

  async function join(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("join_tournament", {
      p_tournament_id: workspace.tournament.id,
      p_display_name: name,
      p_registered_team_id: selectedTeam || null,
      p_access_code: inviteCode,
    });
    setBusy(false);
    if (error) return setMessage(tournamentError(error));
    setName("");
    setSelectedTeam("");
    await load();
  }

  async function copyInvite() {
    setBusy(true);
    setMessage("");
    let code = inviteCode;
    if (!code) {
      const { data, error } = await supabase.rpc("rotate_tournament_registration_code", { p_tournament_id: workspace.tournament.id });
      if (error) {
        setBusy(false);
        return setMessage(tournamentError(error));
      }
      code = data;
      setInviteCode(data);
      window.history.replaceState(null, "", `/tournaments/${slug}#code=${encodeURIComponent(data)}`);
    }
    const link = `${window.location.origin}/tournaments/${slug}#code=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Private registration link copied. Replacing the link will invalidate this one.");
    } catch {
      setMessage("Copy the private registration link from your browser address bar.");
    }
    setBusy(false);
  }

  async function seed(entrant, value) {
    if (!value) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_tournament_seed", {
      p_tournament_id: workspace.tournament.id,
      p_entrant_id: entrant.id,
      p_seed: Number(value),
    });
    setBusy(false);
    if (error) return setMessage(tournamentError(error));
    await load();
  }

  async function shuffleSeeds() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("randomize_tournament_seeds", {
      p_tournament_id: workspace.tournament.id,
      p_random_key: crypto.randomUUID(),
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await load();
    return true;
  }

  async function lock() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("lock_single_elimination_tournament", { p_tournament_id: workspace.tournament.id });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await load();
    return true;
  }

  async function archive() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("archive_tournament", { p_tournament_id: workspace.tournament.id });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await load();
    return true;
  }

  function requestShuffle() {
    setConfirmation({
      title: "Shuffle every seed?",
      description: "Every registered entrant will receive a new deterministic seed order. You can still adjust individual seeds before locking the bracket.",
      confirmLabel: "Shuffle seeds",
      workingLabel: "Shuffling...",
      onConfirm: shuffleSeeds,
    });
  }

  function requestLock() {
    setConfirmation({
      title: "Lock registration and build the bracket?",
      description: "Entrants cannot join after this point. Current seeds will create the permanent single-elimination bracket.",
      confirmLabel: "Lock & build bracket",
      workingLabel: "Building bracket...",
      tone: "danger",
      onConfirm: lock,
    });
  }

  function requestArchive() {
    setConfirmation({
      title: "Archive this tournament?",
      description: "The bracket and history will remain visible, but the tournament will become read-only.",
      confirmLabel: "Archive tournament",
      workingLabel: "Archiving...",
      tone: "danger",
      onConfirm: archive,
    });
  }

  function chooseRound(round) {
    setSelectedRound(round);
    window.requestAnimationFrame(() => {
      document.getElementById(`tournament-round-panel-${round}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    });
  }

  if (!workspace) {
    return (
      <main className="tournament-shell">
        <a className="quiet-button" href="/tournaments">&larr; Tournaments</a>
        <section className="tournament-panel"><p role="status" aria-live="polite">{message}</p></section>
      </main>
    );
  }

  const tournament = workspace.tournament;
  return (
    <main className="tournament-shell">
      <ConfirmationDialog request={confirmation} onDismiss={() => setConfirmation(null)} />
      <header className="tournament-detail-hero">
        <a className="quiet-button" href="/tournaments">&larr; Tournaments</a>
        <span className="eyebrow">{statusLabel(tournament.status)} &middot; {tournament.visibility}</span>
        <h1>{tournament.name}</h1>
        <p>{tournament.description || "Standalone single-elimination tournament"}</p>
        <div>
          <span>Best of {tournament.best_of}</span>
          <span>{workspace.entrants.length} / {tournament.entrant_limit} entrants</span>
          {tournament.is_owner && tournament.visibility === "private" && tournament.status === "registration" && (
            <button type="button" className="quiet-button" disabled={busy} onClick={copyInvite}>{inviteCode ? "Copy private registration link" : "Create private registration link"}</button>
          )}
          {tournament.is_owner && ["registration", "complete"].includes(tournament.status) && (
            <button type="button" className="quiet-button" disabled={busy} onClick={requestArchive}>Archive</button>
          )}
        </div>
      </header>
      {message && <p className="hub-message" role="status" aria-live="polite">{message}</p>}

      {tournament.status === "registration" && (
        <section className="tournament-panel" aria-labelledby="tournament-entrants-heading">
          <div className="section-heading">
            <div><span className="eyebrow">REGISTRATION</span><h2 id="tournament-entrants-heading">Entrants</h2></div>
            {tournament.is_owner && workspace.entrants.length >= 2 && (
              <div className="tournament-owner-actions">
                <button type="button" className="quiet-button" disabled={busy} onClick={requestShuffle}>Shuffle seeds</button>
                <button type="button" className="primary-button" disabled={busy} onClick={requestLock}>Lock & build bracket</button>
              </div>
            )}
          </div>
          {!me && (user ? (
            <form className="tournament-join" onSubmit={join}>
              <label>Display name
                <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              {personalTeams.length > 0 && (
                <label>Saved team
                  <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
                    <option value="">No saved team</option>
                    {personalTeams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}
                  </select>
                </label>
              )}
              <button className="secondary-button" disabled={busy}>Register</button>
            </form>
          ) : <p className="muted">Sign in from the DraftCenter home page to register.</p>)}
          <div className="tournament-entrant-list">
            {workspace.entrants.map((entrant) => (
              <article key={entrant.id}>
                <strong>{entrant.display_name}</strong>
                {tournament.is_owner ? (
                  <label>Seed
                    <input key={`${entrant.id}-${entrant.seed ?? "none"}`} type="number" inputMode="numeric" min="1" max={workspace.entrants.length} defaultValue={entrant.seed || ""} onBlur={(event) => seed(entrant, event.target.value)} />
                  </label>
                ) : <span>{entrant.seed ? `Seed ${entrant.seed}` : "Awaiting seed"}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      {rounds.length > 0 && (
        <section className="tournament-bracket" aria-labelledby="tournament-bracket-heading">
          <div className="section-heading">
            <div><span className="eyebrow">SINGLE ELIMINATION</span><h2 id="tournament-bracket-heading">Bracket</h2></div>
            <button type="button" className="quiet-button" onClick={load}>Refresh</button>
          </div>
          <nav className="tournament-round-picker" aria-label="Choose a bracket round">
            {rounds.map(([round, matches]) => {
              const label = matches.length === 1 ? "Final" : `Round ${round}`;
              return <button key={round} type="button" aria-pressed={visibleRound === round} aria-controls={`tournament-round-panel-${round}`} onClick={() => chooseRound(round)}>{label}<span>{matches.length} {matches.length === 1 ? "match" : "matches"}</span></button>;
            })}
          </nav>
          <div className="tournament-rounds" aria-label="Single-elimination bracket rounds">
            {rounds.map(([round, matches]) => {
              const label = matches.length === 1 ? "Final" : `Round ${round}`;
              const roundHeadingId = `tournament-round-${round}`;
              return (
                <section id={`tournament-round-panel-${round}`} key={round} className={visibleRound === round ? "is-selected" : ""} aria-labelledby={roundHeadingId}>
                  <h3 id={roundHeadingId}>{label}</h3>
                  {matches.map((match) => {
                    const submission = workspace.submissions.find((item) => item.match_id === match.id);
                    const involved = me && [match.entrant_a_id, match.entrant_b_id].includes(me.id);
                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        entrants={entrants}
                        submission={submission}
                        canReport={Boolean(involved || tournament.is_owner)}
                        isOwner={Boolean(tournament.is_owner && tournament.status !== "archived")}
                        onRefresh={load}
                        supabase={supabase}
                        requestConfirmation={setConfirmation}
                      />
                    );
                  })}
                </section>
              );
            })}
          </div>
        </section>
      )}

      {tournament.rules && (
        <section className="tournament-panel" aria-labelledby="tournament-rules-heading">
          <span className="eyebrow">RULES</span>
          <h2 id="tournament-rules-heading">Tournament rules</h2>
          <p className="tournament-rules">{tournament.rules}</p>
        </section>
      )}
    </main>
  );
}
