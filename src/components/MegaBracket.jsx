"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import draftLabCatalog from "../data/draft-lab-catalog.json";
import { loadPokemonArtwork } from "./LeagueHub";
import { createClient } from "../lib/supabase/client";
import {
  evaluateMegaBracket,
  MEGA_BRACKET_CATALOG_VERSION,
  MEGA_BRACKET_TOP_64_CHOICE,
  top64BracketFromRounds,
} from "../lib/megaBracket";
import {
  downloadMegaBracketCanvas,
  renderMegaBracketCanvas,
  renderMegaChampionCanvas,
} from "../lib/megaBracketImage";

const CATALOG_NAMES = draftLabCatalog.pokemon.map((pokemon) => pokemon.name);
const LOCAL_PREFIX = "draftcenter:mega-bracket:";

function winnersKey(values) {
  return (values || []).join("\u001f");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function MegaPokemon({ name, onChoose, disabled }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    setImage("");
    loadPokemonArtwork(name).then((next) => { if (active) setImage(next); });
    return () => { active = false; };
  }, [name]);
  return <button type="button" className="mega-bracket-pokemon" disabled={disabled} onClick={() => onChoose(name)}>
    <span className="mega-bracket-art">{image ? <img src={image} alt="" onError={() => setImage("")} /> : <i aria-hidden="true">?</i>}</span>
    <strong>{name}</strong>
    <small>Advance {name}</small>
  </button>;
}

function ProgressRail({ progress }) {
  const milestones = [
    [138, "Top 1,024"], [650, "Top 512"], [906, "Top 256"], [1034, "Top 128"],
    [1098, "Top 64"], [1130, "Top 32"], [1146, "Sweet 16"], [1154, "Elite Eight"],
    [1158, "Final Four"], [1161, "Champion"],
  ];
  return <div className="mega-progress-rail" aria-label="Mega Bracket milestones">
    {milestones.map(([choice, label]) => <span key={choice} className={progress.choicesCompleted >= choice ? "reached" : ""}>
      <i /> <b>{label}</b><small>{choice.toLocaleString()}</small>
    </span>)}
  </div>;
}

function Top64Reveal({ progress }) {
  const bracket = top64BracketFromRounds(progress.rounds);
  if (!bracket.regions.length) return null;
  return <section className="mega-top64" aria-labelledby="mega-top64-title">
    <div className="mega-section-heading"><div><span className="eyebrow">CHAMPIONSHIP BRACKET</span><h2 id="mega-top64-title">Your Top 64</h2></div><p>The Road to 64 is complete. These four regions now decide your champion.</p></div>
    <div className="mega-region-grid">{bracket.regions.map((region) => <article key={region.id}>
      <header><span>REGION {region.id}</span><strong>{region.champion || `${region.entrants.length} contenders`}</strong></header>
      <ol>{region.entrants.map((name, index) => <li key={name} className={region.champion === name ? "region-champion" : ""}><b>{index + 1}</b><span>{name}</span></li>)}</ol>
    </article>)}</div>
    {bracket.finalFour.length > 0 && <div className="mega-final-four"><span>FINAL FOUR</span>{bracket.finalFour.map((name) => <strong key={name}>{name}</strong>)}</div>}
  </section>;
}

function AttemptHistory({ history, onOpen }) {
  if (!history.length) return null;
  return <section className="mega-history" aria-labelledby="mega-history-title">
    <div className="mega-section-heading"><div><span className="eyebrow">SAVED FOREVER</span><h2 id="mega-history-title">Completed Mega Brackets</h2></div><p>Every completed attempt stays in your private history.</p></div>
    <div>{history.map((item, index) => <button type="button" key={item.id} onClick={() => onOpen(item.id)}>
      <span>#{history.length - index}</span><div><strong>{item.champion}</strong><small>Completed {formatDate(item.completed_at)}</small></div><b>Open bracket <span aria-hidden="true">&rarr;</span></b>
    </button>)}</div>
  </section>;
}

export default function MegaBracket() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [history, setHistory] = useState([]);
  const [winners, setWinners] = useState([]);
  const [message, setMessage] = useState("");
  const [saveLabel, setSaveLabel] = useState("");
  const [viewingHistory, setViewingHistory] = useState(false);
  const latestWinnersRef = useRef([]);
  const attemptRef = useRef(null);
  const viewingHistoryRef = useRef(false);
  const saveRef = useRef({ inFlight: false, queued: false, blocked: false, revision: 0, savedKey: "" });

  const progress = useMemo(() => {
    if (!attempt?.entrants) return null;
    try { return evaluateMegaBracket(attempt.entrants, winners); }
    catch { return null; }
  }, [attempt?.entrants, winners]);

  const storeLocal = useCallback((id, nextWinners, revision) => {
    try {
      localStorage.setItem(`${LOCAL_PREFIX}${id}`, JSON.stringify({ id, winners: nextWinners, revision, updatedAt: Date.now() }));
    } catch {}
  }, []);

  const openAttempt = useCallback((payload, fromHistory = false) => {
    if (!payload) return;
    let nextWinners = payload.winners || [];
    if (!fromHistory && payload.status === "active") {
      try {
        const local = JSON.parse(localStorage.getItem(`${LOCAL_PREFIX}${payload.id}`) || "null");
        if (local?.revision === payload.revision && Array.isArray(local.winners)) {
          evaluateMegaBracket(payload.entrants, local.winners);
          nextWinners = local.winners;
        }
      } catch {}
    }
    saveRef.current = { inFlight: false, queued: false, blocked: false, revision: payload.revision, savedKey: winnersKey(payload.winners) };
    latestWinnersRef.current = nextWinners;
    attemptRef.current = payload;
    setAttempt(payload);
    setWinners(nextWinners);
    viewingHistoryRef.current = fromHistory || payload.status === "completed";
    setViewingHistory(viewingHistoryRef.current);
    setSaveLabel(payload.status === "active" && nextWinners.length !== (payload.winners || []).length ? "Recovered browser progress" : "");
    setMessage("");
  }, []);

  const loadHub = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_mega_brackets");
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    setHistory(data?.completed || []);
    if (data?.active) openAttempt(data.active, false);
    else if (!viewingHistoryRef.current) { setAttempt(null); setWinners([]); }
    setLoading(false);
  }, [openAttempt, supabase]);

  useEffect(() => {
    let active = true;
    async function setSession(session) {
      if (!active) return;
      setUser(session?.user || null);
      if (session?.user) await loadHub();
      else { setLoading(false); setAttempt(null); setHistory([]); }
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { setSession(session); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadHub, supabase]);

  const persistProgress = useCallback(async (requestedWinners = null) => {
    const activeAttempt = attemptRef.current;
    if (!activeAttempt || activeAttempt.status !== "active" || saveRef.current.blocked) return;
    if (saveRef.current.inFlight) { saveRef.current.queued = true; return; }
    const snapshot = requestedWinners || [...latestWinnersRef.current];
    if (winnersKey(snapshot) === saveRef.current.savedKey) return;
    saveRef.current.inFlight = true;
    setSaveLabel("Saving…");
    const { data, error } = await supabase.rpc("save_mega_bracket_progress", {
      p_attempt_id: activeAttempt.id,
      p_expected_revision: saveRef.current.revision,
      p_winners: snapshot,
    });
    if (error) {
      saveRef.current.blocked = true;
      setSaveLabel("Not synced");
      setMessage("Your latest choices remain saved in this browser. Refresh the saved attempt before retrying the cross-device save.");
    } else {
      saveRef.current.revision = data.revision;
      saveRef.current.savedKey = winnersKey(data.winners);
      attemptRef.current = { ...data, winners: latestWinnersRef.current };
      setAttempt((current) => ({ ...data, winners: current?.id === data.id ? latestWinnersRef.current : data.winners }));
      storeLocal(data.id, latestWinnersRef.current, data.revision);
      setSaveLabel(data.status === "completed" ? "Completed and saved" : "Saved across devices");
      if (data.status === "completed") {
        viewingHistoryRef.current = true;
        setViewingHistory(true);
        setHistory((current) => [{ id: data.id, champion: data.champion, top_64: data.top_64, created_at: data.created_at, completed_at: data.completed_at }, ...current.filter((item) => item.id !== data.id)]);
      }
    }
    saveRef.current.inFlight = false;
    if (!error && data.status !== "completed" && (saveRef.current.queued || winnersKey(latestWinnersRef.current) !== saveRef.current.savedKey)) {
      saveRef.current.queued = false;
      window.setTimeout(() => persistProgress([...latestWinnersRef.current]), 150);
    }
  }, [storeLocal, supabase]);

  useEffect(() => {
    latestWinnersRef.current = winners;
    if (!attempt || attempt.status !== "active" || viewingHistory) return undefined;
    storeLocal(attempt.id, winners, saveRef.current.revision);
    if (winnersKey(winners) === saveRef.current.savedKey || saveRef.current.blocked) return undefined;
    const timer = window.setTimeout(() => persistProgress([...winners]), 900);
    return () => window.clearTimeout(timer);
  }, [attempt, persistProgress, storeLocal, viewingHistory, winners]);

  async function startAttempt() {
    setMessage("");
    setLoading(true);
    const { data, error } = await supabase.rpc("create_mega_bracket_attempt", {
      p_catalog: CATALOG_NAMES,
      p_catalog_version: MEGA_BRACKET_CATALOG_VERSION,
    });
    setLoading(false);
    if (error) return setMessage(error.message);
    openAttempt(data, false);
  }

  function choose(name) {
    if (!progress?.nextMatch || viewingHistory) return;
    setWinners((current) => {
      const currentProgress = evaluateMegaBracket(attempt.entrants, current);
      if (![currentProgress.nextMatch.left, currentProgress.nextMatch.right].includes(name)) return current;
      return [...current, name];
    });
    setSaveLabel("Saved in this browser");
  }

  function undo() {
    if (!winners.length || viewingHistory) return;
    setWinners((current) => current.slice(0, -1));
    setSaveLabel("Saved in this browser");
  }

  async function refreshAndRetry() {
    const localWinners = [...latestWinnersRef.current];
    setMessage("");
    setSaveLabel("Checking saved progress…");
    const { data, error } = await supabase.rpc("get_my_mega_bracket_attempt", { p_attempt_id: attempt.id });
    if (error) { setSaveLabel("Not synced"); return setMessage(error.message); }
    try { evaluateMegaBracket(data.entrants, localWinners); }
    catch { openAttempt(data, false); return setMessage("The authoritative saved bracket was restored because the browser copy no longer followed its matchups."); }
    attemptRef.current = data;
    saveRef.current = { inFlight: false, queued: false, blocked: false, revision: data.revision, savedKey: winnersKey(data.winners) };
    setAttempt({ ...data, winners: localWinners });
    setWinners(localWinners);
    if (winnersKey(localWinners) === saveRef.current.savedKey) {
      storeLocal(data.id, localWinners, data.revision);
      setSaveLabel("Saved across devices");
      return;
    }
    await persistProgress(localWinners);
  }

  async function abandonAttempt() {
    if (!window.confirm("Restart this Mega Bracket? This unfinished attempt will close, but completed brackets stay in your history.")) return;
    const { error } = await supabase.rpc("abandon_mega_bracket_attempt", {
      p_attempt_id: attempt.id,
      p_expected_revision: saveRef.current.revision,
    });
    if (error) return setMessage(error.message);
    try { localStorage.removeItem(`${LOCAL_PREFIX}${attempt.id}`); } catch {}
    viewingHistoryRef.current = false;
    setAttempt(null); setWinners([]); setViewingHistory(false); setSaveLabel("");
  }

  async function openHistory(id) {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_mega_bracket_attempt", { p_attempt_id: id });
    setLoading(false);
    if (error) return setMessage(error.message);
    openAttempt(data, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function downloadFullBracket() {
    try {
      const canvas = renderMegaBracketCanvas({ ...attempt, winners });
      downloadMegaBracketCanvas(canvas, `draftcenter-mega-bracket-top-64-${attempt.id.slice(0, 8)}.png`);
    } catch (error) { setMessage(error.message); }
  }

  function downloadChampion() {
    try {
      const canvas = renderMegaChampionCanvas({ ...attempt, winners });
      downloadMegaBracketCanvas(canvas, `draftcenter-mega-bracket-champion-${attempt.champion || progress.champion}.png`);
    } catch (error) { setMessage(error.message); }
  }

  const canStartAnother = progress?.complete && attempt?.status === "completed";

  return <main className="mega-bracket-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/?view=dashboard">DraftCenter home</a><a className="quiet-button" href="/resources/daily-games">Daily Games</a><a className="quiet-button" href="/tools/team-builder">Draft Lab</a></nav>
    <header className="mega-bracket-hero">
      <div><span className="eyebrow">THE FULL DEX CHALLENGE</span><h1>Mega Bracket</h1><p>Choose between every supported Pokémon and form until only your champion remains. Your 1,161 choices save as you go, and the final 64 become a shareable tournament bracket.</p></div>
      <div className="mega-hero-stat"><strong>1,162</strong><span>Pokémon & forms</span><b>1,161 choices · unlimited attempts</b></div>
    </header>

    {user === undefined || loading ? <section className="mega-state-card"><span className="eyebrow">LOADING</span><h2>Preparing Mega Bracket…</h2></section> : !user ? <section className="mega-state-card mega-signin">
      <div><span className="eyebrow">FREE FULL CHALLENGE</span><h2>Make every choice once—and resume anywhere.</h2><p>A DraftCenter account keeps this massive bracket private and synced across devices. Completed attempts remain saved, and there is no attempt limit during this launch period.</p></div>
      <a className="primary-button inline-link-button" href="/#member-access">Sign in to begin</a>
    </section> : !attempt ? <>
      <section className="mega-state-card mega-start">
        <div><span className="eyebrow">READY WHEN YOU ARE</span><h2>Start your Full Dex Challenge</h2><p>The draw is randomized once, then frozen. Work in short sessions, close the page whenever you want, and return to the exact next matchup.</p></div>
        <button className="primary-button" type="button" onClick={startAttempt}>Generate my Mega Bracket</button>
      </section>
      <section className="mega-how"><article><strong>1</strong><h3>Road to 64</h3><p>Make one clear head-to-head choice at a time while the field falls from 1,162 to 64.</p></article><article><strong>2</strong><h3>Championship bracket</h3><p>Your Top 64 split into four regions and advance through a March-style bracket.</p></article><article><strong>3</strong><h3>Share the result</h3><p>Download the complete Top 64 bracket and a social champion card.</p></article></section>
      <AttemptHistory history={history} onOpen={openHistory} />
    </> : progress && <>
      <section className="mega-workspace">
        <div className="mega-workspace-heading">
          <div><span className="eyebrow">{viewingHistory ? "COMPLETED MEGA BRACKET" : progress.phase === "top_64" ? "CHAMPIONSHIP BRACKET" : "ROAD TO 64"}</span><h2>{progress.complete ? `${progress.champion} stands alone` : progress.roundLabel}</h2><p>{progress.complete ? "1,161 choices later, your Full Dex champion is decided." : `Match ${progress.matchNumber.toLocaleString()} of ${progress.matchCount.toLocaleString()} in this round.`}</p></div>
          <div className="mega-save-state"><strong>{progress.choicesCompleted.toLocaleString()} / 1,161</strong><span>{viewingHistory ? formatDate(attempt.completed_at) : saveLabel || "Ready"}</span></div>
        </div>
        <div className="mega-progress"><span style={{ width: `${progress.percent}%` }} /></div>
        <div className="mega-progress-summary"><span><b>{progress.survivors.toLocaleString()}</b> still alive</span><span><b>{progress.choicesRemaining.toLocaleString()}</b> choices left</span></div>

        {!progress.complete && <>
          <div className="mega-matchup" aria-live="polite">
            <MegaPokemon name={progress.nextMatch.left} onChoose={choose} disabled={viewingHistory} />
            <div><span>{progress.roundLabel}</span><b>VS</b><small>Choose who advances</small></div>
            <MegaPokemon name={progress.nextMatch.right} onChoose={choose} disabled={viewingHistory} />
          </div>
          {!viewingHistory && <div className="mega-actions"><button className="quiet-button" type="button" disabled={!winners.length} onClick={undo}>Undo last choice</button>{saveRef.current.blocked && <button className="secondary-button" type="button" onClick={refreshAndRetry}>Refresh & retry save</button>}<button className="quiet-button danger" type="button" onClick={abandonAttempt}>Restart bracket</button></div>}
        </>}

        {progress.complete && <div className="mega-champion"><span>MY MEGA BRACKET CHAMPION</span><strong>{progress.champion}</strong><p>Chosen from 1,162 Pokémon and forms.</p><div><button className="primary-button" type="button" onClick={downloadChampion}>Download champion card</button><button className="secondary-button" type="button" onClick={downloadFullBracket}>Download full Top 64</button>{canStartAnother && <button className="quiet-button" type="button" onClick={() => { viewingHistoryRef.current = false; setAttempt(null); setWinners([]); setViewingHistory(false); }}>Start another attempt</button>}</div></div>}
        {message && <p className="hub-message" role="status">{message}</p>}
      </section>
      <ProgressRail progress={progress} />
      {progress.choicesCompleted >= MEGA_BRACKET_TOP_64_CHOICE && <><Top64Reveal progress={progress} /><div className="mega-download-row"><div><strong>Your full bracket is ready to share.</strong><span>The high-resolution image includes all 64 qualifiers and their paths toward your champion.</span></div><button className="secondary-button" type="button" onClick={downloadFullBracket}>Download Top 64 bracket</button></div></>}
      {viewingHistory && <div className="mega-return"><button className="quiet-button" type="button" onClick={() => { viewingHistoryRef.current = false; setAttempt(null); setWinners([]); setViewingHistory(false); loadHub(); }}>Back to current challenge</button></div>}
      <AttemptHistory history={history.filter((item) => item.id !== attempt.id)} onOpen={openHistory} />
    </>}

    <section className="mega-about"><span className="eyebrow">WHY 1,161 CHOICES?</span><h2>Every elimination belongs to you</h2><p>A single-elimination bracket with 1,162 entrants needs exactly 1,161 decisions. The opening 138 play-ins create a clean field of 1,024; the remaining rounds narrow it to a recognizable Top 64 and, eventually, one personal champion.</p><p>Mega Bracket uses DraftCenter’s supported full-dex catalogue, including distinct battle-relevant forms and Mega Evolutions. Purely cosmetic appearances are not treated as separate competitors.</p></section>
  </main>;
}
