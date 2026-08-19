"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { safeHttpsImageSource } from "../lib/imageSecurity";
import { loadPokemonArtwork } from "../lib/pokemonArtwork";
import { tournamentError } from "../lib/tournamentErrors";
import { tournamentEntrantStatusLabel } from "../lib/participantStatus";
import { tournamentOperationRpcArguments } from "../lib/draftTournament";
import { REGULATION_GROUPS, REGULATION_METADATA, regulationLabelFor } from "../lib/regulation-catalog";

const MATCH_PAGE_SIZE = 64;
const ENTRANT_PAGE_SIZE = 64;
const AUCTION_TOURNAMENT_ENTRANT_PAGE_SIZE = 16;

const statusLabel = (status) => status.replaceAll("-", " ");
const rosterSpend = (roster = []) => roster.reduce((total, pokemon) => total + (Number.isFinite(Number(pokemon?.cost)) ? Number(pokemon.cost) : 0), 0);
const formatLabel = (format, competitionFormat = null) => format === "draft-tournament"
  ? competitionFormat === "double-elimination"
    ? "Draft + double elimination"
    : competitionFormat === "single-elimination"
      ? "Draft + single elimination"
      : competitionFormat === "swiss"
        ? "Draft + Swiss"
        : "Draft Tournament"
  : format === "double-elimination" ? "Double elimination" : format === "swiss" ? "Swiss" : "Single elimination";

function dateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function eventTimeLabel(value, emptyLabel = "Not scheduled") {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function tournamentRoundLabel(stage, round, matchCount, finalRound) {
  if (stage === "swiss") return `Swiss Round ${round}`;
  if (stage === "top-cut") return matchCount === 1 ? "Top Cut Final" : `Top Cut Round ${round}`;
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

function TournamentPokemonArtwork({ pokemon }) {
  const providedArtwork = safeHttpsImageSource(pokemon.spriteUrl || pokemon.sprite_url || pokemon.sprite);
  const [artwork, setArtwork] = useState(providedArtwork);

  useEffect(() => {
    let active = true;
    if (providedArtwork) {
      setArtwork(providedArtwork);
      return () => { active = false; };
    }
    setArtwork("");
    loadPokemonArtwork(pokemon.name).then((resolved) => {
      if (active) setArtwork(safeHttpsImageSource(resolved));
    });
    return () => { active = false; };
  }, [pokemon.name, providedArtwork]);

  return artwork
    ? <img src={artwork} alt="" loading="lazy" />
    : <i aria-hidden="true">{String(pokemon.name || "?").replace(/^Mega /, "").charAt(0)}</i>;
}

function TournamentMatchRoster({ entrant, roster }) {
  if (!entrant || !Array.isArray(roster) || roster.length === 0) return null;
  const visibleRoster = roster.slice(0, 6);
  return (
    <div className="tournament-match-roster" role="list" aria-label={`${entrant.display_name} team: ${roster.map((pokemon) => pokemon.name).join(", ")}`}>
      {visibleRoster.map((pokemon) => (
        <span role="listitem" key={pokemon.id || pokemon.name} title={pokemon.name}>
          <TournamentPokemonArtwork pokemon={pokemon} />
          <small>{pokemon.name}</small>
        </span>
      ))}
      {roster.length > visibleRoster.length && <b title={`${roster.length - visibleRoster.length} more Pokémon`}>+{roster.length - visibleRoster.length}</b>}
    </div>
  );
}

function MatchCard({ match, entrants, rostersByEntrant, seedOverrides, showSeedLabels = false, submission, canReport, isOwner, onRefresh, onRequestForfeit, supabase, requestConfirmation }) {
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
  const seedA = a ? seedOverrides?.get(a.id) ?? a.seed : null;
  const seedB = b ? seedOverrides?.get(b.id) ?? b.seed : null;
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
        <span aria-label={showSeedLabels && a ? `Seed ${seedA}` : undefined}>{showSeedLabels ? (a ? `#${seedA}` : "-") : ""}</span>
        <div className="tournament-match-entrant">
          <strong>{a?.display_name || "TBD"} {a?.is_synthetic && <span className="tournament-bot-badge">{a.synthetic_label}</span>}</strong>
          <TournamentMatchRoster entrant={a} roster={a ? rostersByEntrant?.get(a.id) : null} />
        </div>
        {match.games_a != null && <b>{match.games_a}</b>}
      </div>
      <div className={`tournament-match-side ${match.winner_id === b?.id ? "winner" : ""}`}>
        <span aria-label={showSeedLabels && b ? `Seed ${seedB}` : undefined}>{showSeedLabels ? (b ? `#${seedB}` : "-") : ""}</span>
        <div className="tournament-match-entrant">
          <strong>{b?.display_name || "TBD"} {b?.is_synthetic && <span className="tournament-bot-badge">{b.synthetic_label}</span>}</strong>
          <TournamentMatchRoster entrant={b} roster={b ? rostersByEntrant?.get(b.id) : null} />
        </div>
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
  const [roundBusy, setRoundBusy] = useState(false);
  const [entrantQuery, setEntrantQuery] = useState("");
  const [entrantPage, setEntrantPage] = useState(1);
  const [replacementInvite, setReplacementInvite] = useState(null);
  const [replacementClaimTeam, setReplacementClaimTeam] = useState("");
  const [recoveryEntrantId, setRecoveryEntrantId] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [replacementName, setReplacementName] = useState("");
  const [replacementRosterPolicy, setReplacementRosterPolicy] = useState("retain-roster");
  const [replacementLink, setReplacementLink] = useState("");
  const [recoveryEffectiveRound, setRecoveryEffectiveRound] = useState("0");
  const [recoveryPolicy, setRecoveryPolicy] = useState("left-unplayed");
  const [viewMode, setViewMode] = useState("operator");
  const [operationDraft, setOperationDraft] = useState({
    regulationId: "reg-mb",
    registrationClosesAt: "",
    checkInOpensAt: "",
    startsAt: "",
  });
  const [practiceCount, setPracticeCount] = useState(1);
  const [practiceLabel, setPracticeLabel] = useState("Practice Player");

  async function load(options = {}) {
    const requestedRound = options.roundKey ?? selectedRound;
    const [requestedStage, requestedRoundValue] = requestedRound?.split(":") || [];
    const requestedPage = options.matchPage ?? workspace?.match_page?.page ?? null;
    let { data, error } = await supabase.rpc("get_tournament_workspace_page", {
      p_slug: slug,
      p_access_code: inviteCode,
      p_bracket_stage: requestedStage || null,
      p_bracket_round: requestedRoundValue ? Number(requestedRoundValue) : null,
      p_match_page: requestedPage,
      p_match_page_size: MATCH_PAGE_SIZE,
    });
    if (error?.code === "PGRST202") {
      ({ data, error } = await supabase.rpc("get_tournament_workspace", { p_slug: slug, p_access_code: inviteCode }));
    }
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
    const operationResult = await supabase.rpc("get_tournament_operation_details", {
      p_tournament_id: data.tournament.id,
      p_access_code: inviteCode,
    });
    if (operationResult.error && operationResult.error.code !== "PGRST202") {
      setMessage(tournamentError(operationResult.error));
      setWorkspace(data);
      return false;
    }
    let draftTournament = null;
    if (data.tournament.format === "draft-tournament") {
      const draftResult = await supabase.rpc("get_draft_tournament_workspace", { p_tournament_id: data.tournament.id });
      if (draftResult.error) {
        setMessage(tournamentError(draftResult.error));
        setWorkspace(data);
        return false;
      }
      draftTournament = draftResult.data;
    }
    const connectedResult = data.tournament.format === "draft-tournament"
      ? { data: null, error: null }
      : await supabase.rpc("get_connected_championship_tournament", { p_tournament_id: data.tournament.id });
    if (connectedResult.error && connectedResult.error.code !== "PGRST202") {
      setMessage(tournamentError(connectedResult.error));
      setWorkspace(data);
      return false;
    }
    const participationResult = await supabase.rpc("get_tournament_participation_statuses", { p_tournament_id: data.tournament.id });
    if (!participationResult.error && Array.isArray(participationResult.data)) {
      const participation = new Map(participationResult.data.map((entry) => [entry.entrant_id, entry]));
      data = { ...data, entrants: (data.entrants || []).map((entrant) => ({ ...entrant, ...(participation.get(entrant.id) || {}) })) };
    }
    const operation = operationResult.data || {
      regulation_id: "reg-mb",
      registration_closes_at: null,
      check_in_opens_at: null,
      starts_at: null,
      is_practice: false,
      synthetic_entrant_ids: [],
    };
    const syntheticEntrants = new Set(operation.synthetic_entrant_ids || []);
    data = {
      ...data,
      entrants: (data.entrants || []).map((entrant) => ({
        ...entrant,
        is_synthetic: syntheticEntrants.has(entrant.id),
        synthetic_label: draftTournament?.event?.is_demo ? "Bot" : "Practice",
      })),
    };
    const pageStage = data.match_page?.bracket_stage;
    const pageRound = data.match_page?.bracket_round;
    if (pageStage && pageRound) setSelectedRound(`${pageStage}:${pageRound}`);
    setWorkspace({
      ...data,
      operation,
      connected_championship: connectedResult.data || null,
      draft_tournament: draftTournament,
    });
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

  useEffect(() => {
    const operation = workspace?.operation;
    if (!operation) return;
    setOperationDraft({
      regulationId: operation.regulation_id || "reg-mb",
      registrationClosesAt: dateTimeLocalValue(operation.registration_closes_at),
      checkInOpensAt: dateTimeLocalValue(operation.check_in_opens_at),
      startsAt: dateTimeLocalValue(operation.starts_at),
    });
  }, [workspace?.operation]);

  const entrants = useMemo(() => new Map((workspace?.entrants || []).map((entrant) => [entrant.id, entrant])), [workspace]);
  const tournamentRostersByEntrant = useMemo(() => new Map(
    (workspace?.draft_tournament?.seats || [])
      .filter((seat) => seat.entrant_id && Array.isArray(seat.roster) && seat.roster.length > 0)
      .map((seat) => [seat.entrant_id, seat.roster]),
  ), [workspace]);
  const registeredEntrants = useMemo(() => (workspace?.entrants || []).filter((entrant) => entrant.status === "registered"), [workspace]);
  const me = workspace?.entrants?.find((entrant) => entrant.is_me && entrant.status === "registered");
  const hasTournamentIdentity = workspace?.entrants?.some((entrant) => entrant.is_me);
  const selectedRecoveryEntrant = registeredEntrants.find((entrant) => entrant.id === recoveryEntrantId) || null;
  const filteredEntrants = useMemo(() => {
    const query = entrantQuery.trim().toLocaleLowerCase();
    if (!query) return workspace?.entrants || [];
    return (workspace?.entrants || []).filter((entrant) => entrant.display_name.toLocaleLowerCase().includes(query));
  }, [entrantQuery, workspace]);
  const entrantPageSize = workspace?.draft_tournament?.event?.draft_type === "auction"
    ? AUCTION_TOURNAMENT_ENTRANT_PAGE_SIZE
    : ENTRANT_PAGE_SIZE;
  const entrantPageCount = Math.max(1, Math.ceil(filteredEntrants.length / entrantPageSize));
  const visibleEntrantPage = Math.min(entrantPage, entrantPageCount);
  const visibleEntrants = filteredEntrants.slice((visibleEntrantPage - 1) * entrantPageSize, visibleEntrantPage * entrantPageSize);
  const rounds = useMemo(() => {
    if (workspace?.rounds) {
      const finalRounds = new Map();
      for (const summary of workspace.rounds) {
        finalRounds.set(summary.bracket_stage, Math.max(finalRounds.get(summary.bracket_stage) || 0, summary.bracket_round));
      }
      const loadedRound = workspace.match_page?.bracket_stage && workspace.match_page?.bracket_round
        ? `${workspace.match_page.bracket_stage}:${workspace.match_page.bracket_round}`
        : null;
      return workspace.rounds.map((summary) => ({
        key: `${summary.bracket_stage}:${summary.bracket_round}`,
        stage: summary.bracket_stage,
        round: summary.bracket_round,
        globalRound: summary.global_round,
        matchCount: Number(summary.match_count),
        liveMatchCount: Number(summary.live_match_count),
        matches: loadedRound === `${summary.bracket_stage}:${summary.bracket_round}` ? (workspace.matches || []) : [],
        label: tournamentRoundLabel(summary.bracket_stage, summary.bracket_round, Number(summary.match_count), finalRounds.get(summary.bracket_stage)),
      }));
    }
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
      .map((group) => ({ ...group, matchCount: group.matches.length, liveMatchCount: group.matches.filter((match) => ["ready", "reported"].includes(match.status)).length, label: tournamentRoundLabel(group.stage, group.round, group.matches.length, finalRounds.get(group.stage)) }));
  }, [workspace]);
  const serverRound = workspace?.match_page?.bracket_stage && workspace?.match_page?.bracket_round
    ? `${workspace.match_page.bracket_stage}:${workspace.match_page.bracket_round}`
    : null;
  const defaultRound = useMemo(() => serverRound ?? rounds.find((group) => group.liveMatchCount > 0)?.key ?? rounds.at(-1)?.key ?? null, [rounds, serverRound]);
  const visibleRound = rounds.some((group) => group.key === selectedRound) ? selectedRound : defaultRound;
  const visibleGroup = rounds.find((group) => group.key === visibleRound) || null;
  const matchPage = workspace?.match_page || {
    page: 1,
    page_size: visibleGroup?.matchCount || 0,
    total_matches: visibleGroup?.matchCount || 0,
    total_pages: visibleGroup ? 1 : 0,
  };

  async function join(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("join_tournament", {
      p_tournament_id: workspace.tournament.id,
      p_display_name: name,
      p_registered_team_id: workspace.tournament.format === "draft-tournament" ? null : selectedTeam || null,
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

  async function lock() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("start_tournament_with_random_draw", { p_tournament_id: workspace.tournament.id });
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await load();
    return true;
  }

  async function runDraftTournamentAction(rpc, arguments_) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc(rpc, arguments_);
    setBusy(false);
    if (error) {
      setMessage(tournamentError(error));
      return false;
    }
    await load();
    return true;
  }

  function requestOpenDraftCheckIn() {
    setConfirmation({
      title: "Open entrant check-in?",
      description: "Registered entrants will need to confirm they are present. Registration remains open until you lock the checked-in field.",
      confirmLabel: "Open check-in",
      workingLabel: "Opening...",
      onConfirm: () => runDraftTournamentAction("open_draft_tournament_check_in", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestEnableTournamentDemo() {
    setConfirmation({
      title: "Turn this into a private organizer demo?",
      description: "DraftCenter will keep your real owner seat, add 31 clearly labeled bot seats, check in the full field, and permanently mark this tournament as synthetic and private.",
      confirmLabel: "Add 31 demo bots",
      workingLabel: "Building demo field...",
      onConfirm: () => runDraftTournamentAction("enable_tournament_demo", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.tournament.revision,
      }),
    });
  }

  async function setDraftCheckIn(checkedIn) {
    return runDraftTournamentAction("set_draft_tournament_check_in", {
      p_tournament_id: workspace.tournament.id,
      p_checked_in: checkedIn,
    });
  }

  function requestLockDraftField() {
    const isAuction = workspace.draft_tournament?.event?.draft_type === "auction";
    const isDemo = Boolean(workspace.draft_tournament?.event?.is_demo);
    const isPractice = Boolean(workspace.operation?.is_practice);
    setConfirmation({
      title: "Lock the checked-in field?",
      description: isDemo
        ? "DraftCenter will lock your owner seat plus 31 synthetic bot seats and create the private auction room. You can run the auction live against the bots or generate completed demo rosters."
        : isPractice
          ? `Unchecked real entrants become recorded no-shows. Practice entries become unclaimed bot-controlled teams in the private shared ${isAuction ? "auction" : "snake"} room.`
          : `Unchecked entrants become recorded no-shows, late entry closes, and DraftCenter creates the private shared ${isAuction ? "auction" : "snake"} room with exact account ownership.`,
      confirmLabel: "Lock field",
      workingLabel: "Creating draft room...",
      tone: "danger",
      onConfirm: () => runDraftTournamentAction("lock_draft_tournament_field_with_draw", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestFillDemoAuction() {
    setConfirmation({
      title: "Generate a completed demo auction?",
      description: "DraftCenter will assign six unique Regulation M-B Pokémon to all 32 seats, with one Mega per team and visible winning bids that stay within each 120-point budget. If you already practiced part of this demo auction, its partial auction state will be replaced.",
      confirmLabel: "Generate 32 rosters",
      workingLabel: "Generating auction...",
      tone: "danger",
      onConfirm: () => runDraftTournamentAction("fill_tournament_demo_auction", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestCompleteDemoSwiss() {
    setConfirmation({
      title: "Generate the remaining demo Swiss results?",
      description: "DraftCenter will finish every unresolved synthetic match, pair all remaining rounds from the live standings, and seed the Top 8 playoff. Existing completed demo results remain intact.",
      confirmLabel: "Complete demo Swiss",
      workingLabel: "Generating results...",
      onConfirm: () => runDraftTournamentAction("complete_tournament_demo_swiss", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestCompleteDemoTopCut() {
    setConfirmation({
      title: "Generate the demo Top 8 results?",
      description: "DraftCenter will complete all seven synthetic playoff matches through the championship. You can leave the bracket live instead if you want to practice reporting each result yourself.",
      confirmLabel: "Complete demo playoffs",
      workingLabel: "Generating playoffs...",
      onConfirm: () => runDraftTournamentAction("complete_tournament_demo_top_cut", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestResetDemo() {
    setConfirmation({
      title: "Reset this organizer demo?",
      description: "This removes the synthetic draft room, rosters, pairings, standings, and results, then returns all 32 demo entrants to check-in. The private demo itself and its audit history remain available.",
      confirmLabel: "Reset demo",
      workingLabel: "Resetting demo...",
      tone: "danger",
      onConfirm: () => runDraftTournamentAction("reset_tournament_demo", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestLockDraftRosters() {
    const competitionFormat = workspace.draft_tournament?.event?.competition_format;
    const bracketLabel = competitionFormat === "double-elimination" ? "double-elimination" : "single-elimination";
    const usesEliminationBracket = ["single-elimination", "double-elimination"].includes(competitionFormat);
    setConfirmation({
      title: "Lock every drafted roster?",
      description: usesEliminationBracket
        ? `DraftCenter will verify every team has the required roster size, save tamper-evident snapshots, make both roster stores immutable, and build the ${bracketLabel} bracket atomically.`
        : "DraftCenter will verify every team has the required roster size, save tamper-evident snapshots, make both roster stores immutable, and pair Swiss Round 1 atomically.",
      confirmLabel: usesEliminationBracket ? "Lock rosters & build bracket" : "Lock rosters & pair Round 1",
      workingLabel: "Locking rosters...",
      tone: "danger",
      onConfirm: () => runDraftTournamentAction("lock_draft_tournament_rosters", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestNextSwissRound() {
    const nextRound = Number(workspace.draft_tournament?.event?.current_swiss_round || 0) + 1;
    setConfirmation({
      title: `Pair Swiss Round ${nextRound}?`,
      description: "The server will use the confirmed standings, avoid repeat opponents whenever possible, and assign any bye to the lowest-ranked eligible entrant who has not already received one.",
      confirmLabel: `Pair Round ${nextRound}`,
      workingLabel: "Pairing...",
      onConfirm: () => runDraftTournamentAction("start_next_draft_tournament_swiss_round", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestStartTopCut() {
    const size = Number(workspace.draft_tournament?.event?.top_cut_size || 0);
    setConfirmation({
      title: size ? `Start the Top ${size}?` : "Complete the Draft Tournament?",
      description: size
        ? `The top ${size} entrants in the final Swiss standings will enter a permanent single-elimination bracket.`
        : "The final Swiss standings will become the completed event standings.",
      confirmLabel: size ? `Start Top ${size}` : "Complete event",
      workingLabel: size ? "Building top cut..." : "Completing...",
      tone: "danger",
      onConfirm: () => runDraftTournamentAction("start_draft_tournament_top_cut", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
  }

  function requestCancelDraftTournament() {
    setConfirmation({
      title: "Cancel this Draft Tournament?",
      description: "This permanently closes the event and removes its private draft room and draft records. It is available only before rosters lock and cannot be undone.",
      confirmLabel: "Cancel event",
      workingLabel: "Cancelling...",
      tone: "danger",
      onConfirm: () => runDraftTournamentAction("cancel_draft_tournament", {
        p_tournament_id: workspace.tournament.id,
        p_expected_revision: workspace.draft_tournament.event.revision,
      }),
    });
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
    const { error } = await supabase.rpc("set_tournament_participation_status", {
      p_tournament_id: workspace.tournament.id,
      p_entrant_id: selectedRecoveryEntrant.id,
      p_expected_tournament_revision: workspace.tournament.revision,
      p_status: status,
      p_effective_round: Number(recoveryEffectiveRound),
      p_unresolved_match_policy: recoveryPolicy,
      p_private_reason: recoveryReason.trim(),
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
        ? `Completed results remain unchanged. The current unresolved pairing will be handled as ${recoveryPolicy.replaceAll("-", " ")}; future Swiss rounds omit the entrant, and Top Cut eligibility is removed.`
        : "The entrant will be removed from active registration and the action will remain in the tournament audit history.",
      confirmLabel: action,
      workingLabel: `${action === "Drop" ? "Dropping" : "Disqualifying"}...`,
      tone: "danger",
      onConfirm: () => changeEntrantStatus(status),
    });
  }

  async function reactivateEntrant(entrant) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("reactivate_tournament_participant", {
      p_tournament_id: workspace.tournament.id,
      p_entrant_id: entrant.id,
      p_expected_tournament_revision: workspace.tournament.revision,
    });
    setBusy(false);
    if (error) return setMessage(tournamentError(error));
    await load();
    return true;
  }

  async function saveOperationDetails(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    let arguments_;
    try {
      arguments_ = tournamentOperationRpcArguments(operationDraft);
    } catch (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    const { error } = await supabase.rpc("update_tournament_operation_details", {
      p_tournament_id: workspace.tournament.id,
      p_expected_revision: workspace.tournament.revision,
      ...arguments_,
    });
    setBusy(false);
    if (error) return setMessage(tournamentError(error));
    setMessage("Regulation and event times saved.");
    await load();
  }

  async function addPracticeEntrants(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("add_tournament_practice_entrants", {
      p_tournament_id: workspace.tournament.id,
      p_expected_revision: workspace.tournament.revision,
      p_count: Number(practiceCount),
      p_label_prefix: practiceLabel.trim(),
    });
    setBusy(false);
    if (error) return setMessage(tournamentError(error));
    setMessage(`${practiceCount} clearly labeled practice ${Number(practiceCount) === 1 ? "entrant was" : "entrants were"} added.`);
    await load();
  }

  function requestRemovePracticeEntrant(entrant) {
    setConfirmation({
      title: `Remove ${entrant.display_name}?`,
      description: "This removes only the synthetic practice entry. Real registrations and tournament capacity are unchanged.",
      confirmLabel: "Remove practice entry",
      workingLabel: "Removing...",
      tone: "danger",
      onConfirm: async () => {
        setBusy(true);
        setMessage("");
        const { error } = await supabase.rpc("remove_tournament_practice_entrant", {
          p_tournament_id: workspace.tournament.id,
          p_entrant_id: entrant.id,
          p_expected_revision: workspace.tournament.revision,
        });
        setBusy(false);
        if (error) return setMessage(tournamentError(error));
        await load();
        return true;
      },
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

  function requestLock() {
    const doubleElimination = workspace.tournament.format === "double-elimination";
    setConfirmation({
      title: "Lock registration and build the bracket?",
      description: doubleElimination
        ? "Entrants cannot join after this point. A random draw will create permanent winners and losers brackets, a Grand Final, and a conditional bracket-reset match."
        : "Entrants cannot join after this point. A random draw will create the permanent single-elimination bracket.",
      confirmLabel: "Start & draw bracket",
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

  async function chooseRound(roundKey) {
    if (roundBusy || roundKey === visibleRound) return;
    setSelectedRound(roundKey);
    setRoundBusy(true);
    const loaded = await load({ roundKey, matchPage: 1 });
    setRoundBusy(false);
    if (loaded) {
      window.requestAnimationFrame(() => {
        document.getElementById(`tournament-round-panel-${roundKey.replaceAll(":", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      });
    }
  }

  async function chooseMatchPage(page) {
    if (roundBusy || !visibleRound || page < 1 || page > matchPage.total_pages) return;
    setRoundBusy(true);
    await load({ roundKey: visibleRound, matchPage: page });
    setRoundBusy(false);
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
  const draftTournament = workspace.draft_tournament;
  const draftEvent = draftTournament?.event || null;
  const competitionFormat = draftEvent?.competition_format || null;
  const tournamentDraftType = draftEvent?.draft_type || "snake";
  const isDemo = Boolean(draftEvent?.is_demo);
  const displayFormat = formatLabel(tournament.format, competitionFormat);
  const usesDraftFirstBracket = ["single-elimination", "double-elimination"].includes(competitionFormat);
  const currentDraftRound = draftTournament?.rounds?.find((round) => round.round_number === draftEvent?.current_swiss_round) || null;
  const latestDraftStandings = (draftTournament?.standings || []).filter((standing) => standing.round_id === currentDraftRound?.id);
  const topCutSeeds = new Map((draftTournament?.top_cut || []).map((entry) => [entry.entrant_id, Number(entry.seed)]));
  const projectedTopCutIds = new Set(
    latestDraftStandings
      .filter((standing) => entrants.get(standing.entrant_id)?.status === "registered")
      .slice(0, Number(draftEvent?.top_cut_size || 0))
      .map((standing) => standing.entrant_id),
  );
  const connectedChampionship = workspace.connected_championship;
  const connectedEntrants = new Map((connectedChampionship?.entrants || []).map((entrant) => [entrant.tournament_entrant_id, entrant]));
  const canEnableDemo = Boolean(
    tournament.is_owner
      && !isDemo
      && tournament.visibility === "private"
      && tournament.status === "registration"
      && draftEvent?.phase === "registration"
      && tournamentDraftType === "auction"
      && competitionFormat === "swiss"
      && registeredEntrants.length === 1
      && me,
  );
  const isOperatorMode = Boolean(tournament.is_owner && viewMode === "operator");
  const operation = workspace.operation || {};
  const isPractice = Boolean(operation.is_practice);
  const syntheticEntrants = registeredEntrants.filter((entrant) => entrant.is_synthetic);
  const realEntrants = registeredEntrants.filter((entrant) => !entrant.is_synthetic);
  const openEntrantSlots = Math.max(0, Number(tournament.entrant_limit || 0) - registeredEntrants.length);
  const checkedInCount = Number(draftTournament?.check_in?.checked_in_count || 0);
  const minimumEntrants = tournament.format === "draft-tournament" || tournament.format === "double-elimination" ? 4 : 2;
  const registrationShortfall = Math.max(0, minimumEntrants - registeredEntrants.length);
  const checkInShortfall = Math.max(0, 4 - checkedInCount);
  let nextOperatorAction = null;
  if (tournament.status === "registration" && tournament.format === "draft-tournament" && draftEvent?.phase === "registration") {
    nextOperatorAction = {
      label: "Open participant check-in",
      detail: "Open check-in whenever you are ready. Registration can remain open, and the configured capacity is only the maximum field size.",
      disabled: false,
      onClick: requestOpenDraftCheckIn,
    };
  } else if (tournament.status === "registration" && tournament.format === "draft-tournament" && draftEvent?.phase === "check-in") {
    nextOperatorAction = {
      label: "Lock field & create draft board",
      detail: checkInShortfall ? `${checkInShortfall} more checked-in ${checkInShortfall === 1 ? "entrant is" : "entrants are"} needed for the four-seat draft minimum. Add private practice entries or wait for registrations.` : "Start with this checked-in field; unused capacity is fine.",
      disabled: checkInShortfall > 0,
      onClick: requestLockDraftField,
    };
  } else if (tournament.status === "registration" && tournament.format !== "draft-tournament") {
    nextOperatorAction = {
      label: "Start tournament & draw bracket",
      detail: registrationShortfall ? `${registrationShortfall} more ${registrationShortfall === 1 ? "entrant is" : "entrants are"} needed for this format's technical minimum. Add private practice entries or wait for registrations.` : "Start with the current field. Unused capacity is fine; DraftCenter creates a random opening bracket.",
      disabled: registrationShortfall > 0,
      onClick: requestLock,
    };
  } else if (draftTournament?.draft_room?.slug && ["draft-setup", "drafting"].includes(draftEvent?.phase)) {
    nextOperatorAction = { label: "Open live draft board", detail: "Run the shared draft, queues, clocks, and roster progress in the draft room.", href: `/?league=${encodeURIComponent(draftTournament.draft_room.slug)}` };
  } else if (draftEvent?.phase === "roster-review") {
    nextOperatorAction = { label: usesDraftFirstBracket ? "Lock rosters & build bracket" : "Lock rosters & pair Swiss Round 1", detail: "Verify every drafted roster, then begin tournament play.", onClick: requestLockDraftRosters };
  } else if (draftEvent?.phase === "swiss" && currentDraftRound?.status === "complete" && draftEvent.current_swiss_round < draftEvent.swiss_round_count) {
    nextOperatorAction = { label: `Pair Swiss Round ${draftEvent.current_swiss_round + 1}`, detail: "The next round is paired from confirmed standings and prior opponents.", onClick: requestNextSwissRound };
  } else if (draftEvent?.phase === "swiss-complete") {
    nextOperatorAction = { label: draftEvent.top_cut_size ? `Start Top ${draftEvent.top_cut_size}` : "Complete tournament", detail: "Final standings now determine playoff qualification and placement.", onClick: requestStartTopCut };
  } else if (tournament.status === "active") {
    nextOperatorAction = { label: "Review live matches", detail: "Report, confirm, or correct results in the active round below.", href: "#tournament-bracket-heading" };
  }

  const participantNext = !hasTournamentIdentity && tournament.status === "registration"
    ? "Register below to join this event."
    : draftEvent?.phase === "check-in" && me && !draftTournament?.check_in?.my_checked_in_at
      ? "Check in below so the operator can include you in the field."
      : draftTournament?.draft_room?.slug && ["draft-setup", "drafting", "roster-review"].includes(draftEvent?.phase)
        ? "Open the draft board for your queue, picks, budget, and roster."
        : tournament.status === "active"
          ? "Find your current match below and report the result when it is complete."
          : tournament.status === "complete"
            ? "The event is complete. Final standings and results remain available below."
            : "Event details and the participant list are available below.";
  return (
    <main className={`tournament-shell ${tournament.format === "draft-tournament" ? "is-draft-tournament" : ""}`}>
      <ConfirmationDialog request={confirmation} onDismiss={() => setConfirmation(null)} />
      <header className="tournament-detail-hero">
        <a className="quiet-button" href="/tournaments">&larr; Tournaments</a>
        <span className="eyebrow">{isDemo ? "PRIVATE ORGANIZER DEMO" : isPractice ? "PRIVATE PRACTICE TOURNAMENT" : draftEvent ? statusLabel(draftEvent.phase) : statusLabel(tournament.status)} &middot; {tournament.visibility}</span>
        <h1>{tournament.name}</h1>
        <p>{tournament.description || `${displayFormat} tournament`}</p>
        {connectedChampionship && <a className="tournament-connected-link" href={`/organizations/${connectedChampionship.organization_slug}`}>{connectedChampionship.organization_name} · {connectedChampionship.season_name}</a>}
        <div>
          <span>Best of {tournament.best_of}</span>
          <span>{registeredEntrants.length} registered &middot; {tournament.entrant_limit} maximum</span>
          <span>{regulationLabelFor(operation.regulation_id)}</span>
          {draftEvent && <span>{draftEvent.roster_size} Pokémon &middot; {tournamentDraftType === "auction" ? `${draftEvent.draft_budget}-point budget · ${draftEvent.auction_timer_seconds}s opening bid` : draftEvent.pick_time_limit_minutes ? `${draftEvent.pick_time_limit_minutes} min/pick` : "No pick clock"} &middot; {usesDraftFirstBracket ? `${formatLabel(competitionFormat)} bracket` : draftEvent.swiss_round_count ? `${draftEvent.swiss_round_count} Swiss rounds${draftEvent.top_cut_size ? ` · Top ${draftEvent.top_cut_size}` : ""}` : "Swiss rounds set at field lock"}</span>}
          {isOperatorMode && !isDemo && tournament.visibility === "private" && tournament.status === "registration" && (
            <button type="button" className="quiet-button" disabled={busy} onClick={copyInvite}>{inviteCode ? "Copy private registration link" : "Create private registration link"}</button>
          )}
          {isOperatorMode && ["registration", "complete"].includes(tournament.status) && (
            <button type="button" className="quiet-button" disabled={busy} onClick={requestArchive}>Archive</button>
          )}
        </div>
      </header>
      {message && <p className="hub-message" role="status" aria-live="polite">{message}</p>}

      <section className={`tournament-mode-bar ${isOperatorMode ? "is-operator" : "is-participant"}`} aria-labelledby="tournament-mode-heading">
        <div>
          <span className="eyebrow">{isOperatorMode ? "TOURNAMENT OPERATOR" : "PARTICIPANT VIEW"}</span>
          <h2 id="tournament-mode-heading">{isOperatorMode ? "Run the event" : "Play in the event"}</h2>
          <p>{isOperatorMode ? "Operational controls are visible. Participants never see these controls or private recovery reasons." : participantNext}</p>
        </div>
        {tournament.is_owner && <div className="tournament-mode-switch" role="tablist" aria-label="Tournament view">
          <button type="button" role="tab" aria-selected={isOperatorMode} className={isOperatorMode ? "is-selected" : ""} onClick={() => setViewMode("operator")}>Operator mode</button>
          <button type="button" role="tab" aria-selected={!isOperatorMode} className={!isOperatorMode ? "is-selected" : ""} onClick={() => setViewMode("participant")}>Participant view</button>
        </div>}
        {!tournament.is_owner && <span className="tournament-role-badge">Participant</span>}
      </section>

      <section className="tournament-panel tournament-event-plan" aria-labelledby="tournament-event-plan-heading">
        <div className="section-heading"><div><span className="eyebrow">EVENT PLAN</span><h2 id="tournament-event-plan-heading">Regulation &amp; schedule</h2></div><strong>{regulationLabelFor(operation.regulation_id)}</strong></div>
        <div className="tournament-timeline">
          <article><span>1</span><div><strong>Registration closes</strong><p>{eventTimeLabel(operation.registration_closes_at)}</p></div></article>
          {tournament.format === "draft-tournament" && <article><span>2</span><div><strong>Check-in opens</strong><p>{eventTimeLabel(operation.check_in_opens_at)}</p></div></article>}
          <article><span>{tournament.format === "draft-tournament" ? "3" : "2"}</span><div><strong>Tournament starts</strong><p>{eventTimeLabel(operation.starts_at)}</p></div></article>
        </div>
      </section>

      {isOperatorMode && <section className="tournament-panel tournament-operator-center" aria-labelledby="tournament-operator-heading">
        <div className="section-heading">
          <div><span className="eyebrow">OPERATOR CONTROL CENTER</span><h2 id="tournament-operator-heading">What happens next</h2></div>
          <span className="tournament-stage-badge">Current stage: {draftEvent ? statusLabel(draftEvent.phase) : statusLabel(tournament.status)}</span>
        </div>
        {nextOperatorAction ? <div className="tournament-next-action">
          <div><strong>{nextOperatorAction.label}</strong><p>{nextOperatorAction.detail}</p></div>
          {nextOperatorAction.href
            ? <a className="primary-button inline-link-button" href={nextOperatorAction.href}>{nextOperatorAction.label}</a>
            : <button type="button" className="primary-button" disabled={busy || nextOperatorAction.disabled} onClick={nextOperatorAction.onClick}>{nextOperatorAction.label}</button>}
        </div> : <p className="muted">No operator action is required at this stage. Results and preserved history remain available below.</p>}
        {tournament.status === "registration" && <section className="tournament-field-manager" aria-labelledby="tournament-field-manager-heading">
          <div className="section-heading">
            <div><span className="eyebrow">FIELD MANAGER</span><h3 id="tournament-field-manager-heading">Build the field you actually have</h3></div>
            <span>{openEntrantSlots} open of {tournament.entrant_limit} maximum</span>
          </div>
          <div className="tournament-field-summary" aria-label="Current tournament field">
            <span><strong>{realEntrants.length}</strong> real</span>
            <span><strong>{syntheticEntrants.length}</strong> practice</span>
            <span><strong>{registeredEntrants.length}</strong> total</span>
          </div>
          <p className="muted">The entrant limit is a capacity ceiling. Start with any field that meets the format&apos;s technical minimum; you never need to fill every available place.</p>
          {tournament.visibility === "private" && !isDemo ? <form className="tournament-practice-entry-form" onSubmit={addPracticeEntrants}>
            <label>Practice entry label<input maxLength={70} required value={practiceLabel} onChange={(event) => setPracticeLabel(event.target.value)} /></label>
            <label>How many<input type="number" min="1" max={Math.max(1, Math.min(64, openEntrantSlots))} required value={practiceCount} onChange={(event) => setPracticeCount(Number(event.target.value))} /></label>
            <button className="secondary-button" disabled={busy || openEntrantSlots < 1 || practiceCount < 1 || practiceCount > openEntrantSlots}>{busy ? "Adding…" : "Add practice entries"}</button>
          </form> : isDemo ? <p className="muted">This fixed organizer demo already manages its synthetic field with the demo controls below.</p> : <p className="muted">Synthetic entries are available only in private practice tournaments so public events cannot be mistaken for real participation.</p>}
          {tournament.format === "draft-tournament" && tournament.visibility === "private" && !isDemo && <p className="muted">Practice entries check in automatically and become unclaimed bot-controlled teams on the shared draft board.</p>}
        </section>}
        {canEnableDemo && <button type="button" className="secondary-button" disabled={busy} onClick={requestEnableTournamentDemo}>Build 32-seat organizer demo</button>}
        {tournament.status === "registration" && !isDemo && <details className="tournament-operation-editor">
          <summary>Edit regulation &amp; event times</summary>
          <form className="form-stack" onSubmit={saveOperationDetails}>
            <label>Regulation
              <select value={operationDraft.regulationId} onChange={(event) => setOperationDraft({ ...operationDraft, regulationId: event.target.value })}>
                {REGULATION_GROUPS.map((group) => {
                  const options = Object.values(REGULATION_METADATA).filter((regulation) => regulation.gameId === group.id).sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
                  return options.length ? <optgroup key={group.id} label={group.label}>{options.map((regulation) => <option key={regulation.id} value={regulation.id}>{regulation.label}{regulation.current ? " · Current" : ""}</option>)}</optgroup> : null;
                })}
              </select>
            </label>
            <div className="tournament-form-pair tournament-schedule-fields">
              <label>Registration closes<input type="datetime-local" value={operationDraft.registrationClosesAt} onChange={(event) => setOperationDraft({ ...operationDraft, registrationClosesAt: event.target.value })} /></label>
              <label>Check-in opens<input type="datetime-local" value={operationDraft.checkInOpensAt} onChange={(event) => setOperationDraft({ ...operationDraft, checkInOpensAt: event.target.value })} /></label>
              <label>Tournament starts<input type="datetime-local" value={operationDraft.startsAt} onChange={(event) => setOperationDraft({ ...operationDraft, startsAt: event.target.value })} /></label>
            </div>
            <button className="secondary-button" disabled={busy}>{busy ? "Saving…" : "Save event plan"}</button>
          </form>
        </details>}
      </section>}

      {!isOperatorMode && draftTournament?.draft_room?.slug && <section className="tournament-panel tournament-participant-action" aria-labelledby="participant-draft-board-heading">
        <div><span className="eyebrow">YOUR TOURNAMENT</span><h2 id="participant-draft-board-heading">Draft board</h2><p>Open the shared room for live picks, your queue, budget, and roster. It remains available after the draft for roster review.</p></div>
        <a className="primary-button inline-link-button" href={`/?league=${encodeURIComponent(draftTournament.draft_room.slug)}`}>{["draft-setup", "drafting"].includes(draftEvent?.phase) ? "Open live draft board" : "View draft board & rosters"}</a>
      </section>}

      {isDemo && <section className="tournament-demo-banner" aria-labelledby="tournament-demo-heading">
        <div>
          <span className="eyebrow">SYNTHETIC · PRIVATE · RESETTABLE</span>
          <h2 id="tournament-demo-heading">Tournament organizer sandbox</h2>
          <p>Only your commissioner account is real. Every Bot badge, Regulation M-B roster, auction price, pairing, score, standing, and playoff result belongs to this private practice event and is never presented as real competition data.</p>
        </div>
        <div className="tournament-demo-summary" aria-label="Organizer demo safeguards">
          <span><strong>1</strong> owner account</span>
          <span><strong>31</strong> bot seats</span>
          <span><strong>6</strong> Pokémon / team</span>
          <span><strong>8</strong> playoff cut</span>
        </div>
      </section>}

      {isPractice && !isDemo && <section className="tournament-demo-banner tournament-practice-banner" aria-labelledby="tournament-practice-heading">
        <div>
          <span className="eyebrow">PRIVATE · PRACTICE · SYNTHETIC ENTRIES</span>
          <h2 id="tournament-practice-heading">Tournament rehearsal</h2>
          <p>Practice badges identify every accountless entry. Results from this private rehearsal are never presented as real competitive participation.</p>
        </div>
        <div className="tournament-demo-summary" aria-label="Practice tournament field">
          <span><strong>{realEntrants.length}</strong> real accounts</span>
          <span><strong>{syntheticEntrants.length}</strong> practice entries</span>
          <span><strong>{tournament.entrant_limit}</strong> maximum capacity</span>
        </div>
      </section>}

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
            <span>{registeredEntrants.length} registered</span>
          </div>
          {!hasTournamentIdentity && (user ? (
            <form className="tournament-join" onSubmit={join}>
              {isOperatorMode && <p className="muted">Register the operator as a player only if you will also participate. Operating the event does not require taking a seat.</p>}
              <label>Display name
                <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              {tournament.format !== "draft-tournament" && personalTeams.length > 0 && (
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
          {workspace.entrants.length > entrantPageSize && (
            <div className="tournament-list-toolbar">
              <label>Find entrant
                <input
                  type="search"
                  value={entrantQuery}
                  onChange={(event) => { setEntrantQuery(event.target.value); setEntrantPage(1); }}
                  placeholder="Search display names"
                />
              </label>
              <span>{filteredEntrants.length} {filteredEntrants.length === 1 ? "entrant" : "entrants"}</span>
            </div>
          )}
          {!isOperatorMode && tournament.format === "draft-tournament" && draftEvent?.phase === "check-in" && me && (
            <div className="tournament-check-in-card">
              <div><strong>{draftTournament?.check_in?.my_checked_in_at ? "You are checked in" : "Confirm that you are here"}</strong><p className="muted">Only checked-in entrants receive a seat when the commissioner locks the field.</p></div>
              <button type="button" className={draftTournament?.check_in?.my_checked_in_at ? "quiet-button" : "primary-button"} disabled={busy} onClick={() => setDraftCheckIn(!draftTournament?.check_in?.my_checked_in_at)}>{draftTournament?.check_in?.my_checked_in_at ? "Withdraw check-in" : "Check in"}</button>
            </div>
          )}
          {tournament.format === "draft-tournament" && draftEvent?.phase === "check-in" && <p className="muted">{draftTournament?.check_in?.checked_in_count || 0} checked in</p>}
          <div className="tournament-entrant-list">
            {visibleEntrants.map((entrant) => (
              <article key={entrant.id}>
                <strong>{entrant.display_name} {entrant.is_synthetic && <span className="tournament-bot-badge">{entrant.synthetic_label}</span>}</strong>
                <span>{entrant.status === "registered" ? "Registered" : tournamentEntrantStatusLabel(entrant, draftEvent)}</span>
                {entrant.replacement_pending && <small>Awaiting replacement claim</small>}
                {isOperatorMode && entrant.is_synthetic && !isDemo && entrant.status === "registered" && <button type="button" className="quiet-button" disabled={busy} onClick={() => requestRemovePracticeEntrant(entrant)}>Remove</button>}
              </article>
            ))}
          </div>
          {entrantPageCount > 1 && (
            <nav className="tournament-pagination" aria-label="Entrant pages">
              <button type="button" className="quiet-button" disabled={visibleEntrantPage <= 1} onClick={() => setEntrantPage(visibleEntrantPage - 1)}>Previous entrants</button>
              <span>Page {visibleEntrantPage} of {entrantPageCount}</span>
              <button type="button" className="quiet-button" disabled={visibleEntrantPage >= entrantPageCount} onClick={() => setEntrantPage(visibleEntrantPage + 1)}>Next entrants</button>
            </nav>
          )}
        </section>
      )}

      {draftEvent && draftEvent.phase !== "registration" && draftEvent.phase !== "check-in" && (
        <section className="tournament-panel tournament-draft-event-panel" aria-labelledby="draft-tournament-event-heading">
          <div className="section-heading">
            <div><span className="eyebrow">{displayFormat.toUpperCase()}</span><h2 id="draft-tournament-event-heading">{statusLabel(draftEvent.phase)}</h2></div>
            <button type="button" className="quiet-button" onClick={load}>Refresh</button>
          </div>
          {draftTournament?.draft_room?.slug && (
            <div className="tournament-draft-room-callout">
              <div>
                <strong>{draftEvent.phase === "draft-setup" ? `The shared ${tournamentDraftType} board is ready` : draftEvent.phase === "drafting" ? `The shared ${tournamentDraftType} draft is live` : "Draft board & rosters"}</strong>
                <p className="muted">{isDemo ? "You control your owner seat; the other 31 unclaimed teams use the existing draft bots. Practice the live room or use the synthetic fast-forward below." : "The board stays linked to this tournament for live picks, queues, budgets, and post-draft roster review."}</p>
              </div>
              <a className="primary-button inline-link-button" href={`/?league=${encodeURIComponent(draftTournament.draft_room.slug)}`}>{["draft-setup", "drafting"].includes(draftEvent.phase) ? "Open live draft board" : "View draft board & rosters"}</a>
            </div>
          )}
          {isOperatorMode && isDemo && ["draft-setup", "drafting"].includes(draftEvent.phase) && (
            <button type="button" className="secondary-button" disabled={busy} onClick={requestFillDemoAuction}>Generate completed demo auction</button>
          )}
          {isOperatorMode && draftEvent.phase === "roster-review" && (
            <button type="button" className="primary-button" disabled={busy} onClick={requestLockDraftRosters}>{usesDraftFirstBracket ? `Lock rosters & build ${formatLabel(competitionFormat).toLowerCase()} bracket` : "Lock rosters & pair Swiss Round 1"}</button>
          )}
          {isOperatorMode && draftEvent.phase === "swiss" && currentDraftRound?.status === "complete" && draftEvent.current_swiss_round < draftEvent.swiss_round_count && (
            <button type="button" className="primary-button" disabled={busy} onClick={requestNextSwissRound}>Pair Swiss Round {draftEvent.current_swiss_round + 1}</button>
          )}
          {isOperatorMode && !isDemo && draftEvent.phase === "swiss-complete" && (
            <button type="button" className="primary-button" disabled={busy} onClick={requestStartTopCut}>{draftEvent.top_cut_size ? `Start Top ${draftEvent.top_cut_size}` : "Complete event"}</button>
          )}
          {isOperatorMode && isDemo && ["swiss", "swiss-complete"].includes(draftEvent.phase) && (
            <button type="button" className="secondary-button" disabled={busy} onClick={requestCompleteDemoSwiss}>Complete remaining demo Swiss rounds</button>
          )}
          {isOperatorMode && isDemo && draftEvent.phase === "top-cut" && (
            <button type="button" className="secondary-button" disabled={busy} onClick={requestCompleteDemoTopCut}>Complete demo playoffs</button>
          )}
          {isOperatorMode && !isDemo && ["draft-setup", "drafting", "roster-review"].includes(draftEvent.phase) && (
            <button type="button" className="danger-button" disabled={busy} onClick={requestCancelDraftTournament}>Cancel event</button>
          )}
          {isOperatorMode && isDemo && ["draft-setup", "drafting", "roster-review", "swiss", "swiss-complete", "top-cut", "complete"].includes(draftEvent.phase) && (
            <button type="button" className="quiet-button" disabled={busy} onClick={requestResetDemo}>Reset demo to check-in</button>
          )}
          {draftEvent.phase === "top-cut" && <p className="muted">Swiss standings are final. The remaining matches use the confirmed single-elimination top-cut bracket below.</p>}
          {draftEvent.phase === "bracket" && <p className="muted">The drafted rosters are locked. The {formatLabel(competitionFormat).toLowerCase()} bracket is live below.</p>}
          {["complete", "archived"].includes(draftEvent.phase) && <p className="muted">The event is complete. Its locked rosters, {usesDraftFirstBracket ? "bracket" : "Swiss standings and top cut"}, and result history remain preserved.</p>}
          {draftEvent.phase === "cancelled" && <p className="muted">The event was cancelled before roster lock. Its private draft room and draft records were removed.</p>}

          {latestDraftStandings.length > 0 && (
            <div className="tournament-standings-table" role="region" aria-label={`Standings after Swiss Round ${draftEvent.current_swiss_round}`} tabIndex="0">
              <table>
                <thead><tr><th>Rank</th><th>Entrant</th><th>Record</th><th>OMWP</th><th>Games</th><th>OGWP</th></tr></thead>
                <tbody>{latestDraftStandings.map((standing) => {
                  const entrant = entrants.get(standing.entrant_id);
                  const madeTopCut = topCutSeeds.size ? topCutSeeds.has(standing.entrant_id) : projectedTopCutIds.has(standing.entrant_id);
                  return <tr className={madeTopCut ? "is-top-cut" : ""} key={standing.entrant_id}><td>#{standing.rank}</td><th scope="row">{entrant?.display_name || "Entrant"}{entrant?.status !== "registered" && <small>{tournamentEntrantStatusLabel(entrant, draftEvent)}</small>}{madeTopCut && <span className="tournament-top-cut-badge">Top {draftEvent.top_cut_size}</span>}</th><td>{standing.match_wins}-{standing.match_losses}</td><td>{Math.round(Number(standing.opponent_match_win_percentage || 0) * 1000) / 10}%</td><td>{standing.game_wins}-{standing.game_losses}</td><td>{Math.round(Number(standing.opponent_game_win_percentage || 0) * 1000) / 10}%</td></tr>;
                })}</tbody>
              </table>
            </div>
          )}

          {tournamentDraftType === "auction" && (draftTournament?.seats || []).some((seat) => Array.isArray(seat.roster)) && (
            <section className="tournament-auction-recap" aria-labelledby="tournament-auction-recap-heading">
              <div className="section-heading">
                <div><span className="eyebrow">AUCTION RECAP</span><h3 id="tournament-auction-recap-heading">Winning rosters and prices</h3></div>
                <span>{draftTournament.seats.filter((seat) => Array.isArray(seat.roster)).length} teams · {isDemo ? "Synthetic winning bids" : "Winning bids"}</span>
              </div>
              <p className="muted">{isDemo ? "Each price is the synthetic winning bid charged to that team. Regulation M-B demo rosters use one Mega and five non-Mega Pokémon." : "Each price is the winning bid charged to that team."}</p>
              <div className="tournament-roster-grid">
                {draftTournament.seats.filter((seat) => Array.isArray(seat.roster)).map((seat) => {
                  const spent = rosterSpend(seat.roster);
                  const remaining = Math.max(0, Number(draftEvent.draft_budget || 0) - spent);
                  return <article key={seat.id}>
                    <header>
                      <strong>Draft position {seat.initial_seed} · {entrants.get(seat.entrant_id)?.display_name || "Entrant"} {seat.is_bot && <span className="tournament-bot-badge">Bot</span>}</strong>
                      <small>{spent} spent · {remaining} left</small>
                    </header>
                    <div>{seat.roster.map((pokemon) => <span className="tournament-auction-pick" key={pokemon.id || pokemon.name}><strong>{pokemon.name}</strong><small>{Number(pokemon.cost) || 0} pts</small></span>)}</div>
                  </article>;
                })}
              </div>
            </section>
          )}
          {tournamentDraftType !== "auction" && (draftTournament?.seats || []).some((seat) => Array.isArray(seat.roster)) && (
            <div className="tournament-roster-grid">
              {draftTournament.seats.filter((seat) => Array.isArray(seat.roster)).map((seat) => (
                <article key={seat.id}>
                  <strong>Draft position {seat.initial_seed} · {entrants.get(seat.entrant_id)?.display_name || "Entrant"} {seat.is_bot && <span className="tournament-bot-badge">Bot</span>}</strong>
                  <div>{seat.roster.map((pokemon) => <span key={pokemon.id || pokemon.name}>{pokemon.name}</span>)}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {isOperatorMode && ["registration", "active"].includes(tournament.status) && (
        <section className="tournament-panel tournament-recovery-panel" aria-labelledby="tournament-recovery-heading">
          <details>
          <summary className="section-heading">
            <div>
              <span className="eyebrow">OPERATOR RECOVERY</span>
              <h2 id="tournament-recovery-heading">Drops, disqualifications &amp; replacements</h2>
            </div>
            <span>Open only when needed</span>
          </summary>
          <p className="muted">{connectedChampionship ? "Record a drop or disqualification here. Replacement managers must first take over the same source-league team, then be synchronized from the organization workspace before play begins." : "Record a drop or disqualification, or create a replacement before play begins. Match-specific forfeits are available inside each ready match."}</p>
          <div className="tournament-recovery-grid">
            <label>Active entrant
              <select value={recoveryEntrantId} onChange={(event) => { setRecoveryEntrantId(event.target.value); setRecoveryEffectiveRound(String(draftEvent?.current_swiss_round || 0)); }}>
                <option value="">Choose entrant</option>
                {registeredEntrants.map((entrant) => <option key={entrant.id} value={entrant.id}>{entrant.display_name}</option>)}
              </select>
            </label>
            <label>Recovery reason
              <textarea minLength={2} maxLength={500} value={recoveryReason} onChange={(event) => setRecoveryReason(event.target.value)} placeholder="Private commissioner history; never shown publicly" />
            </label>
            <label>Effective after round
              <input type="number" min="0" max="10" value={recoveryEffectiveRound} onChange={(event) => setRecoveryEffectiveRound(event.target.value)} />
            </label>
            <label>Current unresolved pairing
              <select value={recoveryPolicy} onChange={(event) => setRecoveryPolicy(event.target.value)}>
                <option value="left-unplayed">Leave unplayed</option>
                <option value="no-contest">No contest</option>
                <option value="forfeit">Forfeit to opponent</option>
              </select>
            </label>
            <div className="tournament-recovery-actions">
              <button type="button" className="quiet-button" disabled={busy || !selectedRecoveryEntrant} onClick={() => requestEntrantStatus("dropped")}>Record drop</button>
              <button type="button" className="danger-button" disabled={busy || !selectedRecoveryEntrant} onClick={() => requestEntrantStatus("disqualified")}>Disqualify</button>
            </div>
          </div>
          {(workspace.entrants || []).some((entrant) => ["dropped", "disqualified"].includes(entrant.status)) && <div className="tournament-recovery-grid">{workspace.entrants.filter((entrant) => ["dropped", "disqualified"].includes(entrant.status)).map((entrant) => <article key={entrant.id}><strong>{entrant.display_name}</strong><span>{tournamentEntrantStatusLabel(entrant, draftEvent)}</span><button type="button" className="quiet-button" disabled={busy} onClick={() => reactivateEntrant(entrant)}>Reactivate safely</button></article>)}</div>}
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
          </details>
        </section>
      )}

      {rounds.length > 0 && (
        <section className="tournament-bracket" aria-labelledby="tournament-bracket-heading">
          <div className="section-heading">
            <div><span className="eyebrow">{displayFormat.toUpperCase()}</span><h2 id="tournament-bracket-heading">{rounds.some((group) => group.stage === "top-cut") ? `Top ${draftEvent?.top_cut_size || topCutSeeds.size} playoff bracket` : "Bracket"}</h2></div>
            <button type="button" className="quiet-button" disabled={roundBusy} onClick={() => chooseMatchPage(matchPage.page)}>Refresh</button>
          </div>
          <nav className="tournament-round-picker" aria-label="Choose a bracket round">
            {rounds.map((group) => <button key={group.key} type="button" disabled={roundBusy} aria-pressed={visibleRound === group.key} onClick={() => chooseRound(group.key)}>{group.label}<span>{group.matchCount} {group.matchCount === 1 ? "match" : "matches"}</span></button>)}
          </nav>
          {roundBusy && <p className="muted" role="status" aria-live="polite">Loading bracket round...</p>}
          {visibleGroup && (() => {
            const roundHeadingId = `tournament-round-${visibleGroup.key.replaceAll(":", "-")}`;
            return (
              <div className="tournament-rounds" aria-label={`${displayFormat} bracket round`}>
                <section id={`tournament-round-panel-${visibleGroup.key.replaceAll(":", "-")}`} className="is-selected" aria-labelledby={roundHeadingId} data-bracket-stage={visibleGroup.stage}>
                  <h3 id={roundHeadingId}>{visibleGroup.label}</h3>
                  {visibleGroup.stage === "losers" && visibleGroup.round === 1 && <p className="tournament-stage-note">A second loss eliminates an entrant.</p>}
                  {visibleGroup.stage === "grand-final" && visibleGroup.round === 2 && <p className="tournament-stage-note">Played only if the losers-bracket champion wins the Grand Final.</p>}
                  {visibleGroup.matches.map((match) => {
                    const submission = workspace.submissions.find((item) => item.match_id === match.id);
                    const involved = me && [match.entrant_a_id, match.entrant_b_id].includes(me.id);
                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        entrants={entrants}
                        rostersByEntrant={visibleGroup.stage === "swiss" ? null : tournamentRostersByEntrant}
                        seedOverrides={visibleGroup.stage === "top-cut" ? topCutSeeds : null}
                        showSeedLabels={Boolean(visibleGroup.stage === "top-cut" || connectedChampionship)}
                        submission={submission}
                        canReport={Boolean(involved || isOperatorMode)}
                        isOwner={Boolean(isOperatorMode && tournament.status !== "archived")}
                        onRefresh={() => load({ roundKey: visibleRound, matchPage: matchPage.page })}
                        onRequestForfeit={requestMatchForfeit}
                        supabase={supabase}
                        requestConfirmation={setConfirmation}
                      />
                    );
                  })}
                </section>
              </div>
            );
          })()}
          {matchPage.total_pages > 1 && (
            <nav className="tournament-pagination" aria-label="Match pages">
              <button type="button" className="quiet-button" disabled={roundBusy || matchPage.page <= 1} onClick={() => chooseMatchPage(matchPage.page - 1)}>Previous matches</button>
              <span>Page {matchPage.page} of {matchPage.total_pages}</span>
              <button type="button" className="quiet-button" disabled={roundBusy || matchPage.page >= matchPage.total_pages} onClick={() => chooseMatchPage(matchPage.page + 1)}>Next matches</button>
            </nav>
          )}
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
