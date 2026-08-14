"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import draftLabCatalog from "../data/draft-lab-catalog.json";
import { loadPokemonArtwork } from "../lib/pokemonArtwork";
import { createClient } from "../lib/supabase/client";
import {
  buildMegaBracketRecap,
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
const MILESTONES = [
  [138, "Top 1,024"], [650, "Top 512"], [906, "Top 256"], [1034, "Top 128"],
  [1098, "Top 64"], [1130, "Top 32"], [1146, "Sweet 16"], [1154, "Elite Eight"],
  [1158, "Final Four"], [1160, "Championship Match"], [1161, "Champion"],
].map(([choice, label]) => ({ choice, label }));
const REGION_COLORS = ["#4fd1c5", "#82aaff", "#f4b860", "#c792ea"];
const ROUND_MATCH_COUNTS = { top64: 8, top32: 4, sweet16: 2, elite8: 1 };

function winnersKey(values) {
  return (values || []).join("\u001f");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PokemonArtwork({ name, className = "", showFallbackLabel = false }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    setImage("");
    loadPokemonArtwork(name).then((next) => { if (active) setImage(next); });
    return () => { active = false; };
  }, [name]);
  return <span className={`mega-pokemon-artwork ${className}`.trim()}>{image
    ? <img src={image} alt="" onError={() => setImage("")} />
    : <i aria-hidden="true">{String(name || "?").slice(0, 1)}</i>}{showFallbackLabel && !image ? <small>Artwork unavailable</small> : null}</span>;
}

function MegaPokemon({ name, onChoose, disabled }) {
  return <button type="button" className="mega-bracket-pokemon" disabled={disabled} onClick={() => onChoose(name)}>
    <PokemonArtwork name={name} className="mega-bracket-art" showFallbackLabel />
    <strong>{name}</strong>
    <small>Advance {name}</small>
  </button>;
}

function ProgressRail({ progress }) {
  return <div className="mega-progress-rail" aria-label="Mega Bracket milestones">
    {MILESTONES.map(({ choice, label }) => <span key={choice} className={progress.choicesCompleted >= choice ? "reached" : ""}>
      <i /> <b>{label}</b><small>{choice.toLocaleString()}</small>
    </span>)}
  </div>;
}

function sameMatch(match, nextMatch) {
  return Boolean(match?.left && match?.right && nextMatch
    && ((match.left === nextMatch.left && match.right === nextMatch.right)
      || (match.left === nextMatch.right && match.right === nextMatch.left)));
}

function BracketSlot({ name, match, active, onChoose, showArtwork }) {
  const winner = match?.winner === name;
  const loser = Boolean(match?.winner && match.winner !== name);
  const content = <>{showArtwork && name ? <PokemonArtwork name={name} className="mega-bracket-slot-art" /> : null}<span className="mega-bracket-slot-name">{name || "Awaiting winner"}</span>{winner ? <b>ADV</b> : null}</>;
  if (active && name) return <button type="button" className="mega-bracket-slot is-pick" onClick={() => onChoose(name)}>{content}</button>;
  return <div className={`mega-bracket-slot ${winner ? "is-winner" : ""} ${loser ? "is-out" : ""} ${!name ? "is-empty" : ""}`.trim()}>{content}</div>;
}

function BracketMatch({ match, nextMatch, onChoose, showArtwork = false }) {
  const active = sameMatch(match, nextMatch);
  return <article className={`mega-visual-match ${active ? "is-active" : ""} ${match?.winner ? "is-decided" : ""}`.trim()}>
    <BracketSlot name={match?.left} match={match} active={active} onChoose={onChoose} showArtwork={showArtwork || active} />
    <BracketSlot name={match?.right} match={match} active={active} onChoose={onChoose} showArtwork={showArtwork || active} />
  </article>;
}

function RegionBracket({ region, progress, onChoose }) {
  return <div className="mega-visual-bracket" style={{ "--region-accent": REGION_COLORS[region.id - 1] }}>
    {region.rounds.map((round, roundIndex) => {
      const expected = ROUND_MATCH_COUNTS[round.key];
      const matches = Array.from({ length: expected }, (_, index) => round.matches[index] || null);
      const span = 2 ** (roundIndex + 1);
      return <section className={`mega-visual-round round-${roundIndex}`} key={round.key}>
        <header><span>{round.label}</span><small>{expected} match{expected === 1 ? "" : "es"}</small></header>
        <div>{matches.map((match, index) => <div className="mega-visual-match-cell" style={{ gridRow: `${index * span + 1} / span ${span}` }} key={`${round.key}-${index}`}><BracketMatch match={match} nextMatch={progress.nextMatch} onChoose={onChoose} /></div>)}</div>
      </section>;
    })}
  </div>;
}

function regionSurvivorCount(region) {
  let survivors = region.entrants.length;
  for (const round of region.rounds) {
    if (!round.matches.length) break;
    survivors = round.matches.reduce((total, match) => total + (match.winner ? 1 : 2), 0);
    if (round.matches.some((match) => !match.winner)) break;
  }
  return Math.max(region.champion ? 1 : 0, survivors);
}

function FinalFourBracket({ bracket, progress, onChoose }) {
  if (bracket.finalFour.length < 4) return null;
  return <section className="mega-finals" aria-labelledby="mega-finals-title">
    <div><span className="eyebrow">FINAL FOUR</span><h3 id="mega-finals-title">The last two rounds</h3></div>
    <div className="mega-finals-board">
      <section><span>SEMIFINALS</span>{Array.from({ length: 2 }, (_, index) => <BracketMatch key={index} match={bracket.finalFourMatches[index] || null} nextMatch={progress.nextMatch} onChoose={onChoose} showArtwork />)}</section>
      <i aria-hidden="true">›</i>
      <section><span>CHAMPIONSHIP</span><BracketMatch match={bracket.championshipMatch} nextMatch={progress.nextMatch} onChoose={onChoose} showArtwork /></section>
      <i aria-hidden="true">›</i>
      <section className="mega-finals-winner"><span>CHAMPION</span>{bracket.champion ? <><PokemonArtwork name={bracket.champion} /><strong>{bracket.champion}</strong></> : <small>One more winner</small>}</section>
    </div>
  </section>;
}

function Top64Reveal({ progress, onChoose, sectionRef }) {
  const bracket = top64BracketFromRounds(progress.rounds);
  const currentRegion = bracket.regions.find((region) => [progress.nextMatch?.left, progress.nextMatch?.right].some((name) => region.entrants.includes(name)))?.id || 1;
  const [regionId, setRegionId] = useState(currentRegion);
  useEffect(() => { if (currentRegion) setRegionId(currentRegion); }, [currentRegion]);
  if (!bracket.regions.length) return null;
  const selected = bracket.regions.find((region) => region.id === regionId) || bracket.regions[0];
  return <section ref={sectionRef} className="mega-top64" aria-labelledby="mega-top64-title">
    <div className="mega-section-heading"><div><span className="eyebrow">CHAMPIONSHIP BRACKET</span><h2 id="mega-top64-title">Your Top 64</h2></div><p>Pick directly in the live bracket. Completed matchups stay in place as every region moves toward the Final Four.</p></div>
    <div className="mega-region-tabs" aria-label="Top 64 regions">{bracket.regions.map((region) => <button type="button" aria-pressed={region.id === selected.id} key={region.id} onClick={() => setRegionId(region.id)} style={{ "--region-accent": REGION_COLORS[region.id - 1] }}><span>Region {region.id}</span><strong>{region.champion || `${regionSurvivorCount(region)} left`}</strong></button>)}</div>
    <p className="mega-bracket-swipe-note">Swipe sideways to see every round.</p>
    <RegionBracket region={selected} progress={progress} onChoose={onChoose} />
    <FinalFourBracket bracket={bracket} progress={progress} onChoose={onChoose} />
  </section>;
}

function BracketRecap({ progress, recap, onCopy }) {
  if (!recap) return null;
  const favoriteType = recap.favoriteType?.type ? `${recap.favoriteType.type[0].toUpperCase()}${recap.favoriteType.type.slice(1)}` : "—";
  return <section className="mega-recap" aria-labelledby="mega-recap-title">
    <div className="mega-section-heading"><div><span className="eyebrow">YOUR RESULTS</span><h2 id="mega-recap-title">Your bracket by the numbers</h2></div><button type="button" className="secondary-button" onClick={onCopy}>Copy my result</button></div>
    <div className="mega-recap-grid">
      <article><span>WINNING TYPE</span><strong>{favoriteType}</strong><p>{recap.favoriteType ? `${recap.favoriteType.count.toLocaleString()} of your winning picks had this type.` : "Type data was unavailable."}</p></article>
      <article><span>BIGGEST GENERATION</span><strong>{recap.topGeneration ? `Generation ${recap.topGeneration.generation}` : "—"}</strong><p>{recap.topGeneration ? `${recap.topGeneration.count} of your Top 64 came from this generation.` : "Generation data was unavailable."}</p></article>
      <article><span>TOP 64 UNDERDOG</span><strong>{recap.lowestBstTop64?.name || "—"}</strong><p>{recap.lowestBstTop64 ? `${recap.lowestBstTop64.bst} base-stat total and still made your Top 64.` : "Base-stat data was unavailable."}</p></article>
      <article><span>CHAMPION'S ROAD</span><strong>{recap.championPath.length} wins</strong><p>{recap.championPath.length ? `Beat ${recap.championPath.join(" → ")}.` : "The final path was unavailable."}</p></article>
    </div>
    <div className="mega-recap-final-four"><span>YOUR FINAL FOUR</span><div>{recap.finalFour.map((name) => <article key={name} className={name === progress.champion ? "is-champion" : ""}><PokemonArtwork name={name} /><strong>{name}</strong></article>)}</div></div>
  </section>;
}

function MilestoneDialog({ milestone, onClose, onOpenBracket }) {
  const actionRef = useRef(null);
  useEffect(() => {
    if (!milestone) return undefined;
    actionRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") { event.preventDefault(); actionRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [milestone, onClose]);
  if (!milestone) return null;
  const isTop64 = milestone.choice === MEGA_BRACKET_TOP_64_CHOICE;
  const isChampion = milestone.choice === 1161;
  return <div className="mega-milestone-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="mega-milestone-dialog" role="dialog" aria-modal="true" aria-labelledby="mega-milestone-title" aria-describedby="mega-milestone-description">
      <span className="eyebrow">{isChampion ? "BRACKET COMPLETE" : "ROUND COMPLETE"}</span>
      {isChampion && milestone.champion ? <PokemonArtwork name={milestone.champion} /> : <div className="mega-milestone-number">{milestone.survivors.toLocaleString()}</div>}
      <h2 id="mega-milestone-title">{isChampion ? `${milestone.champion} wins` : `You made the ${milestone.label}`}</h2>
      <p id="mega-milestone-description">{isTop64 ? "Your four-region bracket is ready. From here, you can make every pick directly in the bracket." : isChampion ? "Your recap, Final Four, champion artwork, and share downloads are ready." : `${milestone.survivors.toLocaleString()} Pokémon remain.`}</p>
      <div>{isTop64 ? <button ref={actionRef} type="button" className="primary-button" onClick={onOpenBracket}>Open my Top 64</button> : <button ref={actionRef} type="button" className="primary-button" onClick={onClose}>{isChampion ? "See my results" : "Continue"}</button>}</div>
    </section>
  </div>;
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
  const [milestone, setMilestone] = useState(null);
  const [exporting, setExporting] = useState(false);
  const latestWinnersRef = useRef([]);
  const attemptRef = useRef(null);
  const viewingHistoryRef = useRef(false);
  const top64Ref = useRef(null);
  const saveRef = useRef({ inFlight: false, queued: false, blocked: false, revision: 0, savedKey: "" });

  const progress = useMemo(() => {
    if (!attempt?.entrants) return null;
    try { return evaluateMegaBracket(attempt.entrants, winners); }
    catch { return null; }
  }, [attempt?.entrants, winners]);
  const recap = useMemo(() => progress?.complete ? buildMegaBracketRecap(progress, draftLabCatalog.pokemon) : null, [progress]);

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
    if (!attempt?.entrants || viewingHistory) return;
    const currentWinners = [...latestWinnersRef.current];
    const currentProgress = evaluateMegaBracket(attempt.entrants, currentWinners);
    if (!currentProgress.nextMatch || ![currentProgress.nextMatch.left, currentProgress.nextMatch.right].includes(name)) return;
    const nextWinners = [...currentWinners, name];
    const nextProgress = evaluateMegaBracket(attempt.entrants, nextWinners);
    latestWinnersRef.current = nextWinners;
    setWinners(nextWinners);
    const reached = MILESTONES.find((item) => item.choice === nextProgress.choicesCompleted);
    if (reached) setMilestone({ ...reached, survivors: nextProgress.survivors, champion: nextProgress.champion });
    setSaveLabel("Saved in this browser");
  }

  function undo() {
    if (!latestWinnersRef.current.length || viewingHistory) return;
    const nextWinners = latestWinnersRef.current.slice(0, -1);
    latestWinnersRef.current = nextWinners;
    setWinners(nextWinners);
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

  async function downloadFullBracket() {
    if (exporting) return;
    setExporting(true);
    try {
      const canvas = await renderMegaBracketCanvas({ ...attempt, winners });
      downloadMegaBracketCanvas(canvas, `draftcenter-mega-bracket-top-64-${attempt.id.slice(0, 8)}.png`);
    } catch (error) { setMessage(error.message); }
    finally { setExporting(false); }
  }

  async function downloadChampion() {
    if (exporting) return;
    setExporting(true);
    try {
      const canvas = await renderMegaChampionCanvas({ ...attempt, winners });
      downloadMegaBracketCanvas(canvas, `draftcenter-mega-bracket-champion-${attempt.champion || progress.champion}.png`);
    } catch (error) { setMessage(error.message); }
    finally { setExporting(false); }
  }

  async function copyBracketResult() {
    if (!progress?.complete || !recap) return;
    const favorite = recap.favoriteType?.type ? `${recap.favoriteType.type[0].toUpperCase()}${recap.favoriteType.type.slice(1)}` : "unknown";
    const text = `My Full Dex Mega Bracket champion is ${progress.champion}. My most-picked type was ${favorite}, and my Final Four were ${recap.finalFour.join(", ")}.`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Your Mega Bracket result was copied.");
    } catch {
      setMessage("Copy was blocked by the browser. Your bracket downloads are still available below.");
    }
  }

  function openTop64FromMilestone() {
    setMilestone(null);
    window.setTimeout(() => top64Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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

        {progress.phase === "top_64" && <Top64Reveal progress={progress} onChoose={choose} sectionRef={top64Ref} />}

        {!progress.complete && progress.phase !== "top_64" && <>
          <div className="mega-matchup" aria-live="polite">
            <MegaPokemon name={progress.nextMatch.left} onChoose={choose} disabled={viewingHistory} />
            <div><span>{progress.roundLabel}</span><b>VS</b><small>Choose who advances</small></div>
            <MegaPokemon name={progress.nextMatch.right} onChoose={choose} disabled={viewingHistory} />
          </div>
          {!viewingHistory && <div className="mega-actions"><button className="quiet-button" type="button" disabled={!winners.length} onClick={undo}>Undo last choice</button>{saveRef.current.blocked && <button className="secondary-button" type="button" onClick={refreshAndRetry}>Refresh & retry save</button>}<button className="quiet-button danger" type="button" onClick={abandonAttempt}>Restart bracket</button></div>}
        </>}

        {!progress.complete && progress.phase === "top_64" && !viewingHistory && <div className="mega-actions"><button className="quiet-button" type="button" disabled={!winners.length} onClick={undo}>Undo last choice</button>{saveRef.current.blocked && <button className="secondary-button" type="button" onClick={refreshAndRetry}>Refresh & retry save</button>}<button className="quiet-button danger" type="button" onClick={abandonAttempt}>Restart bracket</button></div>}

        {progress.complete && <div className="mega-champion"><span>MY MEGA BRACKET CHAMPION</span><PokemonArtwork name={progress.champion} className="mega-champion-art" showFallbackLabel /><strong>{progress.champion}</strong><p>Chosen from 1,162 Pokémon and forms.</p><div><button className="primary-button" type="button" disabled={exporting} onClick={downloadChampion}>{exporting ? "Preparing artwork…" : "Download champion card"}</button><button className="secondary-button" type="button" disabled={exporting} onClick={downloadFullBracket}>Download full Top 64</button>{canStartAnother && <button className="quiet-button" type="button" onClick={() => { viewingHistoryRef.current = false; setAttempt(null); setWinners([]); setViewingHistory(false); }}>Start another attempt</button>}</div></div>}
        {message && <p className="hub-message" role="status">{message}</p>}
      </section>
      <ProgressRail progress={progress} />
      {progress.complete && <BracketRecap progress={progress} recap={recap} onCopy={copyBracketResult} />}
      {progress.choicesCompleted >= MEGA_BRACKET_TOP_64_CHOICE && <div className="mega-download-row"><div><strong>{progress.complete ? "Your full bracket is ready to share." : "Your Top 64 bracket is ready."}</strong><span>{progress.complete ? "The high-resolution image includes all 64 qualifiers, Final Four artwork, and the path to your champion." : "Download the current bracket now, or finish the challenge to add Final Four artwork and your champion."}</span></div><button className="secondary-button" type="button" disabled={exporting} onClick={downloadFullBracket}>{exporting ? "Preparing artwork…" : "Download Top 64 bracket"}</button></div>}
      {viewingHistory && <div className="mega-return"><button className="quiet-button" type="button" onClick={() => { viewingHistoryRef.current = false; setAttempt(null); setWinners([]); setViewingHistory(false); loadHub(); }}>Back to current challenge</button></div>}
      <AttemptHistory history={history.filter((item) => item.id !== attempt.id)} onOpen={openHistory} />
    </>}

    <section className="mega-about"><span className="eyebrow">WHY 1,161 CHOICES?</span><h2>Every elimination belongs to you</h2><p>A single-elimination bracket with 1,162 entrants needs exactly 1,161 decisions. The opening 138 play-ins create a clean field of 1,024; the remaining rounds narrow it to a recognizable Top 64 and, eventually, one personal champion.</p><p>Mega Bracket uses DraftCenter’s supported full-dex catalogue, including distinct battle-relevant forms and Mega Evolutions. Purely cosmetic appearances are not treated as separate competitors.</p></section>
    <MilestoneDialog milestone={milestone} onClose={() => setMilestone(null)} onOpenBracket={openTop64FromMilestone} />
  </main>;
}
