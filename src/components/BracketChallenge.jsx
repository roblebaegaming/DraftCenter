"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import PredictionBracketDownload from "./PredictionBracketDownload";
import {
  bracketChallengeEntryIsComplete,
  bracketChallengeMaximumScore,
  buildBracketChallengeArchiveResults,
  buildBracketChallengeRounds,
  chooseBracketChallengeWinner,
  scoreBracketChallengeEntry,
} from "../lib/bracketChallenge";
import { predictionBracketEntryPath } from "../lib/predictionBracketPaths";

function localTime(value) {
  if (!value) return "To be announced";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(value));
}

function statusCopy(status) {
  return ({
    waiting_for_official_bracket: ["Waiting for the official bracket", "The challenge is ready. We will add the real players and pairings after the organizer publishes them."],
    scheduled: ["The bracket is ready", "The official field is loaded. Predictions open at the time shown below."],
    open: ["Bracket predictions are open", "Pick a winner in every played matchup, then save before entries lock."],
    locked: ["Predictions are locked", "Everyone's saved brackets are public now. Points start as official results are recorded."],
    scoring: ["Scoring is live", "Scores update as reviewed match winners advance through the bracket."],
    final: ["Final results", "The tournament is complete and the prediction leaderboard is final."],
  })[status] || ["Waiting for the bracket", "Predictions are not open yet."];
}

export function BracketRounds({ rounds, roundPoints, choices, resultNames = {}, open = false, onChoose }) {
  return <div className="worlds-bracket-rounds" style={{ "--worlds-bracket-rounds": rounds.length }}>{rounds.map((round, roundIndex) => <section key={roundIndex} aria-label={`Round ${roundIndex + 1}`}>
    <header><span>Round {roundIndex + 1}</span><strong>{roundPoints[String(roundIndex + 1)]} pts each</strong></header>
    <div>{round.map((match) => <article key={match.key} className={match.result ? "has-result" : ""}>
      <small>Match {match.match}</small>
      {match.isBye ? <><div className="worlds-bracket-tbd">{match.automaticWinner.displayName}</div><p>Advances with a bye</p></> : [match.a, match.b].map((competitor, sideIndex) => competitor ? <button type="button" key={competitor.id} aria-pressed={match.pickedId === competitor.id} disabled={!open} className={`${match.pickedId === competitor.id ? "is-picked" : ""}${match.result?.winner_id === competitor.id ? " is-result-winner" : ""}`} onClick={() => onChoose?.(match.round, match.match, competitor.id)}><span>{competitor.sourceSeed ? `#${competitor.sourceSeed}` : sideIndex === 0 ? "A" : "B"}</span><strong>{competitor.displayName}</strong><small>{competitor.countryCode}</small></button> : <div className="worlds-bracket-tbd" key={sideIndex}>Winner from earlier round</div>)}
      {match.result && <p>Official winner: {resultNames[match.result.winner_id] || "Recorded"}{choices[match.key] === match.result.winner_id ? " · Pick correct" : choices[match.key] ? " · Pick missed" : ""}</p>}
    </article>)}</div>
  </section>)}</div>;
}

function bracketEntrySignature(entry) {
  return entry?.picks ? `${entry.display_name}\n${JSON.stringify(entry.picks)}` : "";
}

function bracketStatusIsPublic(status) {
  return ["locked", "scoring", "final"].includes(status);
}

function BracketLeaderboard({
  capacity,
  entryCount,
  eventId,
  eventStatus,
  eventTitle,
  label,
  maximumScore,
  results,
  roundPoints,
  slots,
  standings = [],
}) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const selectedSignature = bracketEntrySignature(selectedEntry);
  const viewedEntry = useMemo(() => selectedEntry ? standings.find((entry) => bracketEntrySignature(entry) === selectedSignature) || selectedEntry : null, [selectedEntry, selectedSignature, standings]);
  const selectedRounds = useMemo(() => viewedEntry ? buildBracketChallengeRounds({
    capacity,
    slots,
    choices: viewedEntry.picks,
    results,
  }) : [], [capacity, results, slots, viewedEntry]);
  const selectedScore = viewedEntry ? scoreBracketChallengeEntry({
    choices: viewedEntry.picks,
    results,
    roundPoints,
  }) : 0;
  const selectedEntryPath = viewedEntry?.entry_id && bracketStatusIsPublic(eventStatus)
    ? predictionBracketEntryPath(eventId, viewedEntry.entry_id)
    : null;
  const resultNames = useMemo(() => Object.fromEntries(slots.map((slot) => [slot.competitor_id, slot.display_name])), [slots]);

  useEffect(() => {
    if (!selectedEntry) return;
    const viewer = document.getElementById("leaderboard-entry-bracket");
    viewer?.focus({ preventScroll: true });
    viewer?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedEntry]);

  return <section className="worlds-bracket-leaderboard" aria-labelledby="bracket-leaderboard-heading">
    <header><div><span className="eyebrow">{label}</span><h2 id="bracket-leaderboard-heading">{entryCount || 0} brackets</h2><p>Once entries lock, select any Trainer to see every pick in their bracket.</p></div><p>Maximum score: <strong>{maximumScore} points</strong></p></header>
    {viewedEntry && <section className="worlds-entry-bracket-view" id="leaderboard-entry-bracket" tabIndex="-1" aria-labelledby="leaderboard-entry-heading">
      <header><div><span className="eyebrow">ENTRY BRACKET · LEADERBOARD #{viewedEntry.rank}</span><h3 id="leaderboard-entry-heading">{viewedEntry.display_name}&rsquo;s bracket</h3><p>{selectedScore} of {maximumScore} points · {Object.keys(viewedEntry.picks).length} saved picks</p></div><div className="worlds-entry-bracket-actions"><PredictionBracketDownload bracket={{ eventId, title: eventTitle, bracketLabel: `Leaderboard #${viewedEntry.rank}`, displayName: viewedEntry.display_name, rounds: selectedRounds, roundPoints, choices: viewedEntry.picks, resultNames, score: selectedScore, maximumScore, status: eventStatus }} />{selectedEntryPath && <Link className="quiet-button inline-link-button" href={selectedEntryPath}>Open permanent page</Link>}<button type="button" className="quiet-button" onClick={() => setSelectedEntry(null)}>Close bracket</button></div></header>
      <div className="worlds-bracket-legend" aria-label="Bracket color key"><span><i className="is-pick" />Yellow: saved pick</span><span><i className="is-winner" />Aqua outline: official winner</span></div>
      <BracketRounds rounds={selectedRounds} roundPoints={roundPoints} choices={viewedEntry.picks} resultNames={resultNames} />
    </section>}
    {standings.length ? <div className="worlds-bracket-entry-list">{standings.map((entry, index) => {
      const canView = Boolean(entry.picks);
      const isSelected = canView && selectedSignature === bracketEntrySignature(entry);
      return <button
        type="button"
        key={entry.entry_id || `${entry.display_name}-${index}`}
        className={`${entry.is_me ? "is-me" : ""}${isSelected ? " is-selected" : ""}`}
        disabled={!canView}
        aria-expanded={isSelected}
        aria-controls={canView ? "leaderboard-entry-bracket" : undefined}
        onClick={() => canView && setSelectedEntry(entry)}
      >
        <span>#{entry.rank}</span>
        <span><strong>{entry.display_name}</strong><small>{canView ? "View bracket" : "Private until entries lock"}</small></span>
        <b>{entry.score} pts</b>
        <i aria-hidden="true">{canView ? "→" : "🔒"}</i>
      </button>;
    })}</div> : <p className="worlds-empty-state">No brackets have been saved yet.</p>}
  </section>;
}

export default function BracketChallenge({ eventId, infoUrl }) {
  const [hub, setHub] = useState(null);
  const [archive, setArchive] = useState(null);
  const [user, setUser] = useState(undefined);
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load(supabase) {
    const [{ data, error }, { data: archiveData, error: archiveError }] = await Promise.all([
      supabase.rpc("get_prediction_bracket_hub", { p_event_id: eventId }),
      supabase.rpc("get_prediction_bracket_archive", { p_event_id: eventId }),
    ]);
    if (error || !data) {
      setHub({ event: { status: "waiting_for_official_bracket", revision: 0 }, slots: [], results: [], standings: [], entry_count: 0, my_entry: null });
    } else {
      setHub(data);
      setChoices(data.my_entry?.picks || {});
    }
    setArchive(archiveError ? null : archiveData);
    setLoading(false);
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user || null);
      load(supabase);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user || null);
      queueMicrotask(() => active && load(supabase));
    });
    const refresh = setInterval(() => { if (active) load(supabase); }, 60_000);
    return () => { active = false; clearInterval(refresh); listener.subscription.unsubscribe(); };
  }, [eventId]);

  const event = hub?.event || { status: "waiting_for_official_bracket", revision: 0 };
  const slots = hub?.slots || [];
  const rounds = useMemo(() => event.bracket_capacity ? buildBracketChallengeRounds({ capacity: event.bracket_capacity, slots, choices, results: hub?.results || [] }) : [], [choices, event.bracket_capacity, hub?.results, slots]);
  const complete = event.bracket_capacity ? bracketChallengeEntryIsComplete({ fieldSize: event.field_size, capacity: event.bracket_capacity, slots, choices }) : false;
  const open = event.status === "open" && Boolean(user);
  const maximumScore = event.bracket_capacity ? bracketChallengeMaximumScore({ capacity: event.bracket_capacity, slots, roundPoints: event.round_points }) : 0;
  const resultNames = useMemo(() => Object.fromEntries(slots.map((slot) => [slot.competitor_id, slot.display_name])), [slots]);
  const archiveResults = useMemo(() => archive ? buildBracketChallengeArchiveResults({
    archiveCapacity: archive.bracket_capacity,
    archiveSlots: archive.slots,
    activeCapacity: event.bracket_capacity,
    activeSlots: slots,
    activeResults: hub?.results || [],
  }) : [], [archive, event.bracket_capacity, hub?.results, slots]);
  const archiveRounds = useMemo(() => archive ? buildBracketChallengeRounds({
    capacity: archive.bracket_capacity,
    slots: archive.slots,
    choices: archive.picks,
    results: archiveResults,
  }) : [], [archive, archiveResults]);
  const archiveMaximumScore = archive ? bracketChallengeMaximumScore({ capacity: archive.bracket_capacity, slots: archive.slots, roundPoints: archive.round_points }) : 0;
  const archiveScore = archive ? scoreBracketChallengeEntry({ choices: archive.picks, results: archiveResults, roundPoints: archive.round_points }) : 0;
  const archiveResultNames = useMemo(() => Object.fromEntries((archive?.slots || []).map((slot) => [`slot-${Number(slot.slot_number ?? slot.slot)}`, slot.display_name])), [archive]);
  const [statusTitle, statusDetail] = statusCopy(event.status);
  const eventInfoUrl = event.official_info_url || infoUrl;
  const eventTitle = event.display_name ? `${event.display_name} bracket challenge` : "Tournament bracket challenge";
  const myEntryPath = hub?.my_entry?.entry_id && bracketStatusIsPublic(event.status)
    ? predictionBracketEntryPath(eventId, hub.my_entry.entry_id)
    : null;

  function choose(round, match, winnerId) {
    if (!open) return;
    setChoices(chooseBracketChallengeWinner({ capacity: event.bracket_capacity, slots, choices, round, match, winnerId }));
    setMessage("");
  }

  async function save() {
    if (!user) return setMessage("Sign in before saving your bracket.");
    if (!complete) return setMessage("Pick a winner in every played matchup first.");
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("save_prediction_bracket_entry", { p_event_id: eventId, p_picks: choices });
    if (error) setMessage(error.message || "Your bracket could not be saved.");
    else {
      await load(supabase);
      setMessage("Your bracket is saved. You can change it until entries lock.");
    }
    setBusy(false);
  }

  return <main className="worlds-shell worlds-bracket-shell">
    <section className="worlds-hero worlds-top-cut-hero">
      <div>
        <span className="eyebrow">FULL TOURNAMENT BRACKET CHALLENGE</span>
        <h1>{eventTitle}</h1>
        <p>Choose each matchup winner and build your own path to the champion. Correct picks earn more points in each later round.</p>
        <div className="worlds-hero-actions"><Link className="primary-button inline-link-button" href="#prediction-bracket">{event.status === "open" ? "Build my bracket" : "See bracket status"}</Link><Link className="quiet-button" href="/tournaments">Tournament directory</Link></div>
      </div>
      <aside className={`worlds-event-card worlds-top-cut-status is-${event.status}`}>
        <span>CHALLENGE STATUS</span><strong>{statusTitle}</strong><p>{statusDetail}</p>
        <dl><div><dt>Official field</dt><dd>{event.field_size ? `${event.field_size} players` : "Not published"}</dd></div><div><dt>Predictions open</dt><dd>{localTime(event.opens_at)}</dd></div><div><dt>Entry lock</dt><dd>{localTime(event.locks_at)}</dd></div></dl>
      </aside>
    </section>

    {!event.revision ? <section className="worlds-bracket-waiting" id="prediction-bracket">
      <span className="eyebrow">READY FOR THE OFFICIAL PAIRINGS</span><h2>The bracket challenge will open as soon as the elimination bracket is official.</h2>
      <p>No players, seeds, or matchups are guessed. Once the organizer publishes the official elimination bracket, it can be loaded here without another app release.</p>
      {eventInfoUrl && <a className="quiet-button" href={eventInfoUrl} target="_blank" rel="noreferrer">Official event information ↗</a>}
    </section> : <>
      <section className="worlds-bracket-source-bar"><div><span className="eyebrow">REVIEWED OFFICIAL BRACKET</span><strong>{event.field_size} players · revision {event.revision}</strong><small>Source checked {localTime(event.source_checked_at)}</small></div><a href={event.official_bracket_url} target="_blank" rel="noreferrer">View official bracket ↗</a></section>
      {archive && <section className="worlds-public-bracket worlds-bracket-archive" id="prediction-bracket" aria-labelledby="archived-bracket-heading">
        <header><div><span className="eyebrow">ORIGINAL TOP 16 BRACKET</span><h2 id="archived-bracket-heading">{archive.display_name}</h2><p>This is Rob&rsquo;s exact original bracket, with every name and pick shown as saved.</p></div><div><strong>{archiveScore}/{archiveMaximumScore}</strong><span>{archiveResults.length}/{archive.field_size - 1} results scored</span><PredictionBracketDownload bracket={{ eventId, title: event.display_name, bracketLabel: "Original Top 16 bracket", displayName: archive.display_name, rounds: archiveRounds, roundPoints: archive.round_points, choices: archive.picks, resultNames: archiveResultNames, score: archiveScore, maximumScore: archiveMaximumScore, status: event.status }} /></div></header>
        <div className="worlds-bracket-legend" aria-label="Bracket color key"><span><i className="is-pick" />Yellow: saved pick</span><span><i className="is-winner" />Aqua outline: official winner</span></div>
        <div className="worlds-bracket-archive-note"><strong>Why the smaller bracket looked different</strong><p>The Top 8 carryover kept the side Rob chose in each later matchup. When Shohei advanced from Markus&rsquo;s side, that carried path showed Shohei. This full bracket keeps Markus in the rounds Rob originally picked him.</p></div>
        <BracketRounds rounds={archiveRounds} roundPoints={archive.round_points} choices={archive.picks} resultNames={archiveResultNames} />
      </section>}
      <section className="worlds-public-bracket" id={archive ? "top-8-carryover-bracket" : "prediction-bracket"} aria-labelledby="prediction-bracket-heading">
        <header><div><span className="eyebrow">{archive ? "SAVED TOP 8 CARRYOVER" : "YOUR BRACKET"}</span><h2 id="prediction-bracket-heading">{archive ? "Leaderboard scoring view" : "Choose every winner"}</h2><p>{archive ? "This locked entry remains unchanged while official winners are recorded against it." : "Winners advance through your bracket automatically. Byes advance without asking you to make a pick."}</p></div><div><strong>{Object.keys(choices).length}/{event.field_size - 1}</strong><span>{archive ? "saved picks" : "matchups picked"}</span></div></header>
        {archive && <div className="worlds-bracket-legend" aria-label="Bracket color key"><span><i className="is-pick" />Yellow: saved pick</span><span><i className="is-winner" />Aqua outline: official winner</span></div>}
        {user === undefined || loading ? <p className="worlds-empty-state">Checking your DraftCenter account…</p> : !user ? <div className="worlds-account-gate"><div aria-hidden="true" className="worlds-account-lock">🔒</div><h3>Sign in to save a bracket.</h3><p>The official field is public. A free DraftCenter account is required to save, and everyone else's choices stay private until entries lock.</p><a className="secondary-button" href="/#member-access">Sign in or create an account</a></div> : <>
          <BracketRounds rounds={rounds} roundPoints={event.round_points} choices={choices} resultNames={resultNames} open={open} onChoose={choose} />
          <div className="worlds-save-row"><div>{event.status === "open" ? <p>{hub.my_entry ? `Saved as ${hub.my_entry.display_name}. Edits close ${localTime(event.locks_at)}.` : "Complete every played matchup, then save one bracket."}</p> : <p>Entries are locked. {hub.my_entry ? `Your score is ${hub.my_entry.score} of ${maximumScore} possible points.` : "No bracket was saved for this account."}</p>}{message && <p className="worlds-message" role="status">{message}</p>}</div><div className="worlds-bracket-save-actions"><PredictionBracketDownload disabled={!complete} label="Download my bracket" bracket={{ eventId, title: event.display_name, bracketLabel: "My bracket", displayName: hub.my_entry?.display_name || user.user_metadata?.display_name || "Trainer", rounds, roundPoints: event.round_points, choices, resultNames, score: hub.my_entry?.score, maximumScore, status: event.status }} />{myEntryPath && <Link className="quiet-button inline-link-button" href={myEntryPath}>My permanent page</Link>}<button className="primary-button" disabled={!open || busy || !complete} onClick={save}>{busy ? "Saving…" : hub.my_entry ? "Update bracket" : "Save bracket"}</button></div></div>
        </>}
      </section>
      <BracketLeaderboard
        capacity={event.bracket_capacity}
        entryCount={hub.entry_count}
        eventId={eventId}
        eventStatus={event.status}
        eventTitle={event.display_name}
        label={archive ? "TOP 8 CARRYOVER LEADERBOARD" : "BRACKET LEADERBOARD"}
        maximumScore={maximumScore}
        results={hub.results || []}
        roundPoints={event.round_points}
        slots={slots}
        standings={hub.standings || []}
      />
    </>}
  </main>;
}
