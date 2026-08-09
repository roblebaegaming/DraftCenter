"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { tournamentError } from "../lib/tournamentErrors";

const statusLabel = (status) => status.replaceAll("-", " ");
const formatLabel = (format) => format === "double-elimination" ? "Double elimination" : "Single elimination";

function tournamentRoundLabel(stage, round, matchCount, finalRound) {
  if (stage === "grand-final") return round === 1 ? "Grand Final" : "Bracket Reset";
  if (stage === "winners") return round === finalRound ? "Winners Final" : `Winners Round ${round}`;
  if (stage === "losers") return round === finalRound ? "Losers Final" : `Losers Round ${round}`;
  return matchCount === 1 ? "Final" : `Round ${round}`;
}

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

function MatchCard({ match, entrants, submission, canReport, isOwner, onRefresh, onRequestForfeit, supabase, requestConfirmation }) {
  const [scoreA, setScoreA] = useState(match.games_a ?? "");
  const [scoreB, setScoreB] = useState(match.games_b ?? "");
  const [replay, setReplay] = useState(match.replay_urls?.[0] || "");
  const [mvp, setMvp] = useState(match.mvp || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [forfeitingEntrant, setForfeitingEntrant] = useState("");
  const [forfeitReason, setForfeitReason] = useState("");
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

  function requestForfeit(event) {
    event.preventDefault();
    const loser = entrants.get(forfeitingEntrant);
    if (!loser || forfeitReason.trim().length < 2) {
      setMessage("Choose the forfeiting entrant and enter a short reason.");
      return;
    }
    onRequestForfeit(match, loser, forfeitReason.trim());
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
      {["ready", "reported"].includes(match.status) && isOwner && (
        <details className="tournament-correction tournament-recovery-control">
          <summary>Record a match forfeit</summary>
          <form className="tournament-report" onSubmit={requestForfeit}>
            <label>Forfeiting entrant
              <select required value={forfeitingEntrant} onChange={(event) => setForfeitingEntrant(event.target.value)}>
                <option value="">Choose entrant</option>
                {[a, b].filter(Boolean).map((entrant) => <option key={entrant.id} value={entrant.id}>{entrant.display_name}</option>)}
              </select>
            </label>
            <label>Reason
              <textarea required minLength={2} maxLength={500} value={forfeitReason} onChange={(event) => setForfeitReason(event.target.value)} />
            </label>
            <button className="quiet-button" disabled={busy}>Review forfeit</button>
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
  const [replacementInvite, setReplacementInvite] = useState(null);
  const [replacementClaimTeam, setReplacementClaimTeam] = useState("");
  const [recoveryEntrantId, setRecoveryEntrantId] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [replacementName, setReplacementName] = useState("");
  const [replacementRosterPolicy, setReplacementRosterPolicy] = useState("retain-roster");
  const [replacementLink, setReplacementLink] = useState("");

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
    const connectedResult = await supabase.rpc("get_connected_championship_tournament", { p_tournament_id: data.tournament.id });
    if (connectedResult.error && connectedResult.error.code !== "PGRST202") {
      setMessage(tournamentError(connectedResult.error));
      setWorkspace(data);
      return false;
    }
    setWorkspace({ ...data, connected_championship: connectedResult.data || null });
    setMessage("");
    return true;
  }

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = hash.get("code");
    const replacementCode = hash.get("replacement");
    const replacementEntrantId = hash.get("entrant");
    const replacementRoster = hash.get("roster");
    setInviteCode(code && /^[0-9a-f]{32}$/.test(code) ? code : null);
    setReplacementInvite(
      replacementCode && /^[0-9a-f]{32}$/.test(replacementCode)
        && replacementEntrantId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(replacementEntrantId)
        ? {
            code: replacementCode,
            entrantId: replacementEntrantId,
            rosterPolicy: replacementRoster === "replacement-selects-roster" ? replacementRoster : "retain-roster",
          }
        : null,
    );
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
  const registeredEntrants = useMemo(() => (workspace?.entrants || []).filter((entrant) => entrant.status === "registered"), [workspace]);
  const me = workspace?.entrants?.find((entrant) => entrant.is_me && entrant.status === "registered");
  const hasTournamentIdentity = workspace?.entrants?.some((entrant) => entrant.is_me);
  const selectedRecoveryEntrant = registeredEntrants.find((entrant) => entrant.id === recoveryEntrantId) || null;
  const rounds = useMemo(() => {
    const grouped = new Map();
    for (const match of workspace?.matches || []) {
      const stage = match.bracket_stage || "single";
      const bracketRound = match.bracket_round || match.round_number;
      const key = `${stage}:${bracketRound}`;
      if (!grouped.has(key)) grouped.set(key, { key, stage, round: bracketRound, globalRound: match.round_number, matches: [] });
      grouped.get(key).matches.push(match);
    }
    const finalRounds = new Map();
    for (const group of grouped.values()) finalRounds.set(group.stage, Math.max(finalRounds.get(group.stage) || 0, group.round));
    return [...grouped.values()]
      .sort((a, b) => a.globalRound - b.globalRound || a.round - b.round)
      .map((group) => ({ ...group, label: tournamentRoundLabel(group.stage, group.round, group.matches.length, finalRounds.get(group.stage)) }));
  }, [workspace]);
  const defaultRound = useMemo(() => rounds.find((group) => group.matches.some((match) => ["ready", "reported"].includes(match.status)))?.key ?? rounds.at(-1)?.key ?? null, [rounds]);
  const visibleRound = rounds.some((group) => group.key === selectedRound) ? selectedRound : defaultRound;

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
    const rpc = workspace.tournament.format === "double-elimination" ? "lock_double_elimination_tournament" : "lock_single_elimination_tournament";
    const { error } = await supabase.rpc(rpc, { p_tournament_id: workspace.tournament.id });
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

  async function claimReplacement(event) {
    event.preventDefault();
    if (!replacementInvite || !user || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("claim_tournament_replacement", {
      p_replacement_entrant_id: replacementInvite.entrantId,
      p_claim_code: replacementInvite.code,
      p_registered_team_id: replacementInvite.rosterPolicy === "replacement-selects-roster" && replacementClaimTeam ? replacementClaimTeam : null,
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return;
    }
    setReplacementInvite(null);
    setReplacementClaimTeam("");
    window.history.replaceState(null, "", `/tournaments/${slug}`);
    await load();
  }

  async function recordForfeit(match, loser, reason) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("forfeit_tournament_match", {
      p_match_id: match.id,
      p_expected_tournament_revision: workspace.tournament.revision,
      p_expected_match_revision: match.revision,
      p_forfeiting_entrant_id: loser.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await load();
    return true;
  }

  function requestMatchForfeit(match, loser, reason) {
    const opponentId = match.entrant_a_id === loser.id ? match.entrant_b_id : match.entrant_a_id;
    const opponent = entrants.get(opponentId);
    setConfirmation({
      title: `Record a forfeit for ${loser.display_name}?`,
      description: `${opponent?.display_name || "The opponent"} will receive the match win and advance. Any pending report for this match will be rejected. Reason: ${reason}`,
      confirmLabel: "Record forfeit",
      workingLabel: "Recording...",
      tone: "danger",
      onConfirm: () => recordForfeit(match, loser, reason),
    });
  }

  async function changeEntrantStatus(status) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("set_tournament_entrant_status", {
      p_tournament_id: workspace.tournament.id,
      p_entrant_id: selectedRecoveryEntrant.id,
      p_expected_tournament_revision: workspace.tournament.revision,
      p_status: status,
      p_reason: recoveryReason.trim(),
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    setRecoveryEntrantId("");
    setRecoveryReason("");
    await load();
    return true;
  }

  function requestEntrantStatus(status) {
    if (!selectedRecoveryEntrant || recoveryReason.trim().length < 2) {
      setMessage("Choose an active entrant and enter a short recovery reason.");
      return;
    }
    const action = status === "dropped" ? "Drop" : "Disqualify";
    setConfirmation({
      title: `${action} ${selectedRecoveryEntrant.display_name}?`,
      description: workspace.tournament.status === "active"
        ? "If the entrant has a live opponent, that match will be recorded as a forfeit and the opponent will advance. This action remains in the tournament audit history."
        : "The entrant will be removed from active registration and the action will remain in the tournament audit history.",
      confirmLabel: action,
      workingLabel: `${action === "Drop" ? "Dropping" : "Disqualifying"}...`,
      tone: "danger",
      onConfirm: () => changeEntrantStatus(status),
    });
  }

  async function replaceEntrant() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("replace_tournament_entrant", {
      p_tournament_id: workspace.tournament.id,
      p_outgoing_entrant_id: selectedRecoveryEntrant.id,
      p_expected_tournament_revision: workspace.tournament.revision,
      p_replacement_display_name: replacementName.trim(),
      p_roster_policy: replacementRosterPolicy,
      p_reason: recoveryReason.trim(),
    });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    const link = `${window.location.origin}/tournaments/${slug}#replacement=${encodeURIComponent(data.claim_code)}&entrant=${encodeURIComponent(data.replacement_entrant_id)}&roster=${encodeURIComponent(replacementRosterPolicy)}`;
    setReplacementLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Replacement created. The one-time claim link was copied and expires in 14 days.");
    } catch {
      setMessage("Replacement created. Copy the one-time claim link below; it expires in 14 days.");
    }
    setRecoveryEntrantId("");
    setRecoveryReason("");
    setReplacementName("");
    await load();
    return true;
  }

  function requestReplacement() {
    if (!selectedRecoveryEntrant || recoveryReason.trim().length < 2 || replacementName.trim().length < 1) {
      setMessage("Choose an active entrant, name the replacement, and enter a short reason.");
      return;
    }
    setConfirmation({
      title: `Replace ${selectedRecoveryEntrant.display_name} with ${replacementName.trim()}?`,
      description: replacementRosterPolicy === "retain-roster"
        ? "The replacement will keep the existing registered roster. The old identity remains in history, and the new participant must accept a one-time claim link."
        : "The replacement will choose their own saved roster when accepting a one-time claim link. Replacement is blocked if play has already begun.",
      confirmLabel: "Create replacement",
      workingLabel: "Creating...",
      tone: "danger",
      onConfirm: replaceEntrant,
    });
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
    const doubleElimination = workspace.tournament.format === "double-elimination";
    setConfirmation({
      title: "Lock registration and build the bracket?",
      description: doubleElimination
        ? "Entrants cannot join after this point. Current seeds will create permanent winners and losers brackets, a Grand Final, and a conditional bracket-reset match."
        : "Entrants cannot join after this point. Current seeds will create the permanent single-elimination bracket.",
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

  function chooseRound(roundKey) {
    setSelectedRound(roundKey);
    window.requestAnimationFrame(() => {
      document.getElementById(`tournament-round-panel-${roundKey.replaceAll(":", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    });
  }

  if (!workspace) {
    return (
      <main className="tournament-shell">
        <a className="quiet-button" href="/tournaments">&larr; Tournaments</a>
        {replacementInvite ? (
          <section className="tournament-panel tournament-claim-panel" aria-labelledby="replacement-claim-heading">
            <span className="eyebrow">REPLACEMENT INVITATION</span>
            <h1 id="replacement-claim-heading">Accept your tournament place</h1>
            {!user ? (
              <p role="status" aria-live="polite">{user === undefined ? "Checking your account..." : "Sign in from the DraftCenter home page, then reopen this one-time link."}</p>
            ) : (
              <form className="form-stack" onSubmit={claimReplacement}>
                <p className="muted">This invitation can be used once. Accepting it attaches your account to the replacement entrant.</p>
                {replacementInvite.rosterPolicy === "retain-roster" ? (
                  <p>The commissioner chose to retain the existing registered roster.</p>
                ) : (
                  <label>Saved roster <span>(optional)</span>
                    <select value={replacementClaimTeam} onChange={(event) => setReplacementClaimTeam(event.target.value)}>
                      <option value="">No saved roster</option>
                      {personalTeams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}
                    </select>
                  </label>
                )}
                <button className="primary-button" disabled={busy}>{busy ? "Accepting..." : "Accept replacement place"}</button>
              </form>
            )}
            {message && message !== "This tournament is private or unavailable." && <p className="hub-message" role="status" aria-live="polite">{message}</p>}
          </section>
        ) : (
          <section className="tournament-panel"><p role="status" aria-live="polite">{message}</p></section>
        )}
      </main>
    );
  }

  const tournament = workspace.tournament;
  const connectedChampionship = workspace.connected_championship;
  const connectedEntrants = new Map((connectedChampionship?.entrants || []).map((entrant) => [entrant.tournament_entrant_id, entrant]));
  return (
    <main className="tournament-shell">
      <ConfirmationDialog request={confirmation} onDismiss={() => setConfirmation(null)} />
      <header className="tournament-detail-hero">
        <a className="quiet-button" href="/tournaments">&larr; Tournaments</a>
        <span className="eyebrow">{statusLabel(tournament.status)} &middot; {tournament.visibility}</span>
        <h1>{tournament.name}</h1>
        <p>{tournament.description || `Standalone ${formatLabel(tournament.format).toLowerCase()} tournament`}</p>
        {connectedChampionship && <a className="tournament-connected-link" href={`/organizations/${connectedChampionship.organization_slug}`}>{connectedChampionship.organization_name} · {connectedChampionship.season_name}</a>}
        <div>
          <span>Best of {tournament.best_of}</span>
          <span>{registeredEntrants.length} / {tournament.entrant_limit} active entrants</span>
          {tournament.is_owner && tournament.visibility === "private" && tournament.status === "registration" && (
            <button type="button" className="quiet-button" disabled={busy} onClick={copyInvite}>{inviteCode ? "Copy private registration link" : "Create private registration link"}</button>
          )}
          {tournament.is_owner && ["registration", "complete"].includes(tournament.status) && (
            <button type="button" className="quiet-button" disabled={busy} onClick={requestArchive}>Archive</button>
          )}
        </div>
      </header>
      {message && <p className="hub-message" role="status" aria-live="polite">{message}</p>}

      {connectedChampionship && <section className="tournament-panel tournament-connected-panel" aria-labelledby="connected-championship-heading">
        <div className="section-heading"><div><span className="eyebrow">CONNECTED CHAMPIONSHIP</span><h2 id="connected-championship-heading">Qualified field</h2></div><span>{connectedChampionship.seeding_policy === "overall-record" ? "Overall record seeds" : connectedChampionship.seeding_policy === "pod-finish-bands" ? "Pod-finish seeds" : "Pod-finish seeds · rematches avoided"}</span></div>
        <p className="muted">These are promoted qualification snapshots. Teams keep their finalized rosters, and duplicate Pokémon drafted in different pods remain legal.</p>
        <div className="tournament-connected-entrants">{registeredEntrants.map((entrant) => {
          const source = connectedEntrants.get(entrant.id);
          return <article key={entrant.id}><strong>#{entrant.seed} {entrant.display_name}</strong><span>{source?.pod_label || "Qualified pod"} · {source?.qualification_kind === "wildcard" ? "Wild card" : `Pod place #${source?.placement || "—"}`}</span><small>{source?.roster_size || 0} retained Pokémon</small></article>;
        })}</div>
      </section>}

      {replacementInvite && (
        <section className="tournament-panel tournament-claim-panel" aria-labelledby="replacement-claim-heading-public">
          <span className="eyebrow">REPLACEMENT INVITATION</span>
          <h2 id="replacement-claim-heading-public">Accept your tournament place</h2>
          {!user ? (
            <p>{user === undefined ? "Checking your account..." : "Sign in from the DraftCenter home page, then reopen this one-time link."}</p>
          ) : (
            <form className="form-stack" onSubmit={claimReplacement}>
              <p className="muted">Accepting attaches your account to this replacement entrant. The invitation can be used once.</p>
              {replacementInvite.rosterPolicy === "retain-roster" ? (
                <p>The commissioner chose to retain the existing registered roster.</p>
              ) : (
                <label>Saved roster <span>(optional)</span>
                  <select value={replacementClaimTeam} onChange={(event) => setReplacementClaimTeam(event.target.value)}>
                    <option value="">No saved roster</option>
                    {personalTeams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}
                  </select>
                </label>
              )}
              <button className="primary-button" disabled={busy}>{busy ? "Accepting..." : "Accept replacement place"}</button>
            </form>
          )}
        </section>
      )}

      {tournament.status === "registration" && (
        <section className="tournament-panel" aria-labelledby="tournament-entrants-heading">
          <div className="section-heading">
            <div><span className="eyebrow">REGISTRATION</span><h2 id="tournament-entrants-heading">Entrants</h2></div>
            {tournament.is_owner && registeredEntrants.length >= (tournament.format === "double-elimination" ? 4 : 2) && (
              <div className="tournament-owner-actions">
                <button type="button" className="quiet-button" disabled={busy} onClick={requestShuffle}>Shuffle seeds</button>
                <button type="button" className="primary-button" disabled={busy} onClick={requestLock}>Lock & build bracket</button>
              </div>
            )}
          </div>
          {!hasTournamentIdentity && (user ? (
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
                {tournament.is_owner && entrant.status === "registered" ? (
                  <label>Seed
                    <input key={`${entrant.id}-${entrant.seed ?? "none"}`} type="number" inputMode="numeric" min="1" max={registeredEntrants.length} defaultValue={entrant.seed || ""} onBlur={(event) => seed(entrant, event.target.value)} />
                  </label>
                ) : <span>{entrant.status === "registered" ? (entrant.seed ? `Seed ${entrant.seed}` : "Awaiting seed") : statusLabel(entrant.status)}</span>}
                {entrant.replacement_pending && <small>Awaiting replacement claim</small>}
              </article>
            ))}
          </div>
        </section>
      )}

      {tournament.is_owner && ["registration", "active"].includes(tournament.status) && (
        <section className="tournament-panel tournament-recovery-panel" aria-labelledby="tournament-recovery-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COMMISSIONER TOOLS</span>
              <h2 id="tournament-recovery-heading">Entrant recovery</h2>
            </div>
          </div>
          <p className="muted">{connectedChampionship ? "Record a drop or disqualification here. Replacement managers must first take over the same source-league team, then be synchronized from the organization workspace before play begins." : "Record a drop or disqualification, or create a replacement before play begins. Match-specific forfeits are available inside each ready match."}</p>
          <div className="tournament-recovery-grid">
            <label>Active entrant
              <select value={recoveryEntrantId} onChange={(event) => setRecoveryEntrantId(event.target.value)}>
                <option value="">Choose entrant</option>
                {registeredEntrants.map((entrant) => <option key={entrant.id} value={entrant.id}>{entrant.display_name}</option>)}
              </select>
            </label>
            <label>Recovery reason
              <textarea minLength={2} maxLength={500} value={recoveryReason} onChange={(event) => setRecoveryReason(event.target.value)} placeholder="Recorded in the commissioner audit history" />
            </label>
            <div className="tournament-recovery-actions">
              <button type="button" className="quiet-button" disabled={busy || !selectedRecoveryEntrant} onClick={() => requestEntrantStatus("dropped")}>Record drop</button>
              <button type="button" className="danger-button" disabled={busy || !selectedRecoveryEntrant} onClick={() => requestEntrantStatus("disqualified")}>Disqualify</button>
            </div>
          </div>
          {!connectedChampionship && <details className="tournament-replacement-tools">
            <summary>Replace the selected entrant</summary>
            <div className="tournament-recovery-grid">
              <label>Replacement display name
                <input maxLength={100} value={replacementName} onChange={(event) => setReplacementName(event.target.value)} />
              </label>
              <label>Roster handling
                <select value={replacementRosterPolicy} onChange={(event) => setReplacementRosterPolicy(event.target.value)}>
                  <option value="retain-roster">Keep the existing registered roster</option>
                  <option value="replacement-selects-roster">Replacement chooses a saved roster</option>
                </select>
              </label>
              <button type="button" className="primary-button" disabled={busy || !selectedRecoveryEntrant} onClick={requestReplacement}>Review replacement</button>
            </div>
          </details>}
          {replacementLink && (
            <div className="tournament-replacement-link" role="status">
              <strong>One-time replacement claim link</strong>
              <p>Share this privately. It expires in 14 days and disappears after use.</p>
              <input aria-label="One-time replacement claim link" readOnly value={replacementLink} onFocus={(event) => event.currentTarget.select()} />
            </div>
          )}
        </section>
      )}

      {rounds.length > 0 && (
        <section className="tournament-bracket" aria-labelledby="tournament-bracket-heading">
          <div className="section-heading">
            <div><span className="eyebrow">{formatLabel(tournament.format).toUpperCase()}</span><h2 id="tournament-bracket-heading">Bracket</h2></div>
            <button type="button" className="quiet-button" onClick={load}>Refresh</button>
          </div>
          <nav className="tournament-round-picker" aria-label="Choose a bracket round">
            {rounds.map((group) => <button key={group.key} type="button" aria-pressed={visibleRound === group.key} aria-controls={`tournament-round-panel-${group.key.replaceAll(":", "-")}`} onClick={() => chooseRound(group.key)}>{group.label}<span>{group.matches.length} {group.matches.length === 1 ? "match" : "matches"}</span></button>)}
          </nav>
          <div className="tournament-rounds" aria-label={`${formatLabel(tournament.format)} bracket rounds`}>
            {rounds.map((group) => {
              const roundHeadingId = `tournament-round-${group.key.replaceAll(":", "-")}`;
              return (
                <section id={`tournament-round-panel-${group.key.replaceAll(":", "-")}`} key={group.key} className={visibleRound === group.key ? "is-selected" : ""} aria-labelledby={roundHeadingId} data-bracket-stage={group.stage}>
                  <h3 id={roundHeadingId}>{group.label}</h3>
                  {group.stage === "losers" && group.round === 1 && <p className="tournament-stage-note">A second loss eliminates an entrant.</p>}
                  {group.stage === "grand-final" && group.round === 2 && <p className="tournament-stage-note">Played only if the losers-bracket champion wins the Grand Final.</p>}
                  {group.matches.map((match) => {
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
                        onRequestForfeit={requestMatchForfeit}
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
