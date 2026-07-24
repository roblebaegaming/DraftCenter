"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { loadPokemonArtwork } from "./LeagueHub";
import { POLL_POKEMON_NAMES } from "./PokemonDraftLeague";
import { ShareButton } from "./SocialSharing";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function addChampionRankings(supabase, data) {
  if (!data?.bracket?.id) return data;
  const { data: champions, error } = await supabase.rpc("get_daily_bracket_champion_rankings", {
    p_bracket_id: data.bracket.id,
  });
  if (error) return data;
  return { ...data, bracket: { ...data.bracket, champions: champions || [] } };
}

function BracketPokemon({ name, onChoose, disabled }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let alive = true;
    loadPokemonArtwork(name).then((next) => { if (alive) setImage(next); });
    return () => { alive = false; };
  }, [name]);
  return <button type="button" className="daily-bracket-pokemon" disabled={disabled} onClick={() => onChoose(name)}>
    {image ? <img src={image} alt="" onError={() => setImage("")} /> : <span className="daily-game-art-placeholder" />}
    <strong>{name}</strong>
  </button>;
}

function cleanCommunityText(value) {
  return String(value || "")
    // Repair common UTF-8-as-Windows-1252 sequences anywhere in a sentence,
    // rather than only repairing the exact word "Pokémon".
    .replaceAll("\u00c3\u00a9", "\u00e9")
    .replaceAll("\u00c3\u0089", "\u00c9")
    .replaceAll("\u00c3\u00a1", "\u00e1")
    .replaceAll("\u00c3\u00ad", "\u00ed")
    .replaceAll("\u00c3\u00b3", "\u00f3")
    .replaceAll("\u00c3\u00ba", "\u00fa")
    .replaceAll("\u00c3\u00b1", "\u00f1")
    .replaceAll("PokÃ©mon", "Pokémon")
    .replaceAll("PokÃ‰mon", "POKÉMON")
    .replaceAll("â€™", "’")
    .replaceAll("â€œ", "“")
    .replaceAll("â€", "”")
    .replaceAll("â€“", "–")
    .replaceAll("â€”", "—")
    .replaceAll("â€¦", "…");
}

function QuizPokemonChoice({ name, onChoose }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let alive = true;
    loadPokemonArtwork(name).then((next) => { if (alive) setImage(next); });
    return () => { alive = false; };
  }, [name]);
  return <button type="button" className="daily-quiz-pokemon-choice" onClick={() => onChoose(name)}>
    {image ? <img src={image} alt="" onError={() => setImage("")} /> : <span className="daily-game-art-placeholder" />}
    <strong>{name}</strong>
  </button>;
}

function matchupFor(pokemon, winners, index) {
  if (index < 4) return [pokemon[index * 2], pokemon[index * 2 + 1]];
  if (index < 6) return [winners[(index - 4) * 2], winners[(index - 4) * 2 + 1]];
  return [winners[4], winners[5]];
}

function PreviousBracket({ previous }) {
  if (!previous) return null;
  return <details className="daily-previous"><summary>View yesterday’s bracket results</summary>
    {previous.champions?.length ? <div className="daily-previous-content daily-bracket-previous-content"><div className="daily-previous-winner"><span>Community champion</span><strong>{previous.champions[0].pokemon}</strong><small>{previous.champions[0].wins} bracket win{previous.champions[0].wins === 1 ? "" : "s"} · SF {previous.champions[0].semifinal_percent ?? 0}% · QF {previous.champions[0].quarterfinal_percent ?? 0}%</small></div><div className="daily-previous-columns"><section><h4>Top champions</h4><ol>{previous.champions.slice(0, 5).map((row) => <li key={row.pokemon}><span>{row.pokemon}<small>SF {row.semifinal_percent ?? 0}% · QF {row.quarterfinal_percent ?? 0}%</small></span><b>{row.wins}</b></li>)}</ol></section><section><h4>Head-to-head</h4><ol>{(previous.matchup_results || []).slice().sort((a, b) => b.round - a.round || b.votes - a.votes).slice(0, 8).map((row, index) => <li key={`${row.round}-${row.winner}-${row.loser}-${index}`}><span>{row.winner} over {row.loser} <small>R{row.round}</small></span><b>{row.votes}</b></li>)}</ol></section></div><p className="daily-tiebreak-note">Ties use semifinal percentage, then quarterfinal percentage.</p></div> : <p className="muted">No completed brackets yesterday.</p>}
  </details>;
}

function PreviousQuiz({ previous }) {
  if (!previous) return null;
  return <details className="daily-previous"><summary>View yesterday’s quiz results</summary>
    <div className="daily-previous-content"><strong>{previous.correct_percent ?? 0}% correct</strong><p>Accepted answer{previous.correct_answers?.length === 1 ? "" : "s"}: {(previous.correct_answers || []).join(", ")}</p><h4>Top answers</h4><ol>{(previous.top_answers || []).slice(0, 5).map((row) => <li key={row.answer}><span>{row.answer}</span><b>{row.count}</b></li>)}</ol></div>
  </details>;
}

function CommunityBracketResults({ bracket, winners }) {
  const [view, setView] = useState("rounds");
  const completed = Number(bracket.completed_brackets) || 0;
  const champions = bracket.champions || [];
  const results = bracket.matchup_results || [];
  const matchupRows = winners.map((choice, index) => {
    const [left, right] = matchupFor(bracket.pokemon, winners, index);
    const votesFor = (name, opponent) => results
      .filter((row) => row.winner?.toLowerCase() === name?.toLowerCase() && row.loser?.toLowerCase() === opponent?.toLowerCase())
      .reduce((total, row) => total + (Number(row.votes) || 0), 0);
    const leftVotes = votesFor(left, right);
    const rightVotes = votesFor(right, left);
    const total = leftVotes + rightVotes;
    const choiceVotes = choice === left ? leftVotes : rightVotes;
    const crowdChoice = leftVotes === rightVotes ? "Tie" : leftVotes > rightVotes ? left : right;
    return {
      round: index < 4 ? "Quarterfinal" : index < 6 ? "Semifinal" : "Final",
      choice, opponent: choice === left ? right : left,
      percent: total ? Math.round(100 * choiceVotes / total) : 0,
      agreed: crowdChoice === choice,
      crowdChoice,
      total,
    };
  });
  const agreements = matchupRows.filter((row) => row.agreed).length;
  const championRow = champions.find((row) => row.pokemon === winners[6]);
  const championPercent = completed && championRow ? Math.round(100 * championRow.wins / completed) : 0;
  const championRank = champions.findIndex((row) => row.pokemon === winners[6]) + 1;
  const boldestPick = matchupRows.filter((row) => row.total).slice().sort((a, b) => a.percent - b.percent)[0];
  const rounds = [
    ["Quarterfinals", matchupRows.slice(0, 4)],
    ["Semifinals", matchupRows.slice(4, 6)],
    ["Final", matchupRows.slice(6, 7)],
  ];
  return <section className="community-bracket-results">
    <div className="community-results-heading"><div><span className="eyebrow">COMMUNITY RESULTS</span><h3>Your bracket vs. the community</h3></div><strong>{completed} completed today</strong></div>
    <div className="community-result-summary">
      <article><small>CROWD MATCH</small><strong>{agreements}<span>/7</span></strong><p>of your picks matched the majority</p></article>
      <article><small>YOUR CHAMPION</small><strong>{winners[6]}</strong><p>{championRow ? `${championPercent}% chose it${championRank ? ` · #${championRank} overall` : ""}` : "You chose today’s first champion"}</p></article>
      <article><small>BOLDEST PICK</small><strong>{boldestPick?.choice || winners[6]}</strong><p>{boldestPick ? `Only ${boldestPick.percent}% made this pick` : "More comparisons appear as brackets finish"}</p></article>
    </div>
    <div className="community-result-tabs"><button type="button" className={view === "rounds" ? "active" : ""} onClick={() => setView("rounds")}>Round by round</button><button type="button" className={view === "champions" ? "active" : ""} onClick={() => setView("champions")}>Champion leaderboard</button></div>
    {view === "rounds" && <div className="community-round-results">{rounds.map(([label, rows]) => <section key={label}>
      <h4>{label}</h4>
      {rows.map((row, index) => <article key={`${label}-${row.choice}-${index}`} className={row.agreed ? "agreed" : ""}>
        <div><strong>{row.choice}</strong><small>over {row.opponent}</small></div>
        <b>{row.total ? `${row.percent}%` : "FIRST"}</b>
        <span>{row.crowdChoice === "Tie" ? "Community tie" : row.agreed ? "With the crowd" : `Crowd: ${row.crowdChoice}`}</span>
      </article>)}
    </section>)}</div>}
    {view === "champions" && <div className="community-champion-results">{champions.length ? champions.slice(0, 8).map((row, index) => {
      const percent = completed ? Math.round(100 * row.wins / completed) : 0;
      return <article key={row.pokemon} className={row.pokemon === winners[6] ? "my-champion" : ""}><b>#{index + 1}</b><strong>{row.pokemon}{row.pokemon === winners[6] ? " · Your champion" : ""}</strong><span>{percent}% · {row.wins} final win{row.wins === 1 ? "" : "s"} · SF {row.semifinal_percent ?? 0}% · QF {row.quarterfinal_percent ?? 0}%</span><i><span style={{ width: `${percent}%` }} /></i></article>;
    }) : <p className="muted">Your bracket is the first completed community result today.</p>}</div>}
  </section>;
}

async function canvasImage(source) {
  if (!source) return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

async function canvasPokemonArtwork(name) {
  try {
    const source = await loadPokemonArtwork(name);
    return await canvasImage(source);
  } catch {
    return null;
  }
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

async function downloadBracket(bracket, winners) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext("2d");
  const uniquePokemon = [...new Set(bracket.pokemon)];
  const [artworkEntries, draftCenterLogo] = await Promise.all([
    Promise.all(uniquePokemon.map(async (name) => [name, await canvasPokemonArtwork(name)])),
    canvasImage("/draftcenter-logo.png"),
  ]);
  const artwork = Object.fromEntries(artworkEntries);

  const background = context.createLinearGradient(0, 0, 1200, 675);
  background.addColorStop(0, "#0b1024");
  background.addColorStop(0.55, "#121936");
  background.addColorStop(1, "#09101f");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(79, 209, 197, 0.08)";
  context.beginPath();
  context.arc(1080, 80, 270, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255, 210, 63, 0.06)";
  context.beginPath();
  context.arc(115, 650, 260, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#FFD23F";
  context.fillRect(48, 34, 7, 58);
  if (draftCenterLogo) context.drawImage(draftCenterLogo, 70, 33, 60, 60);
  context.fillStyle = "#FFD23F";
  context.font = "900 34px Arial, sans-serif";
  context.fillText("DRAFTCENTER", draftCenterLogo ? 145 : 72, 61);
  context.fillStyle = "#F6F7FF";
  context.font = "700 25px Arial, sans-serif";
  context.fillText("DAILY DRAFT BRACKET", draftCenterLogo ? 145 : 72, 91);
  context.fillStyle = "#9FA8CD";
  context.font = "18px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText(new Date(`${bracket.game_date}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }), 1150, 61);
  context.fillText("MY PICKS", 1150, 88);
  context.textAlign = "left";

  const labels = ["QUARTERFINALS", "SEMIFINALS", "CHAMPION"];
  [58, 438, 818].forEach((x, index) => {
    context.fillStyle = index === 2 ? "#FFD23F" : "#4FD1C5";
    context.font = "800 17px Arial, sans-serif";
    context.fillText(labels[index], x, 132);
  });

  const drawPokemon = (name, x, y, winner = false, champion = false) => {
    const width = champion ? 326 : 286;
    const height = champion ? 116 : 54;
    roundedRect(context, x, y, width, height, champion ? 20 : 12);
    context.fillStyle = champion ? "rgba(255, 210, 63, 0.13)" : winner ? "rgba(79, 209, 197, 0.12)" : "rgba(25, 32, 62, 0.96)";
    context.fill();
    context.strokeStyle = champion ? "#FFD23F" : winner ? "#4FD1C5" : "#303B68";
    context.lineWidth = champion ? 3 : 1.5;
    context.stroke();
    const image = artwork[name];
    const imageSize = champion ? 92 : 46;
    if (image) context.drawImage(image, x + (champion ? 13 : 7), y + (height - imageSize) / 2, imageSize, imageSize);
    context.fillStyle = champion ? "#FFD23F" : winner ? "#FFFFFF" : "#D7DCF3";
    context.font = `${champion ? "800 27px" : "700 17px"} Arial, sans-serif`;
    context.fillText(name, x + (champion ? 119 : 61), y + (champion ? 52 : 33));
    if (champion) {
      context.fillStyle = "#AEB6D8";
      context.font = "15px Arial, sans-serif";
      context.fillText("TODAY'S COMMUNITY FAVORITE", x + 119, y + 79);
    }
  };

  const qfY = [143, 199, 273, 329, 403, 459, 533, 589];
  const sfY = [171, 301, 431, 561];
  const finalY = [246, 534];
  const qfX = 58, sfX = 438, finalX = 818;

  context.strokeStyle = "#394772";
  context.lineWidth = 2;
  const connectPair = (fromX, width, y1, y2, toX, toY) => {
    const startX = fromX + width;
    const middleX = startX + (toX - startX) / 2;
    context.beginPath();
    context.moveTo(startX, y1 + 27);
    context.lineTo(middleX, y1 + 27);
    context.lineTo(middleX, y2 + 27);
    context.lineTo(startX, y2 + 27);
    context.moveTo(middleX, toY + 27);
    context.lineTo(toX, toY + 27);
    context.stroke();
  };
  connectPair(qfX, 286, qfY[0], qfY[1], sfX, sfY[0]);
  connectPair(qfX, 286, qfY[2], qfY[3], sfX, sfY[1]);
  connectPair(qfX, 286, qfY[4], qfY[5], sfX, sfY[2]);
  connectPair(qfX, 286, qfY[6], qfY[7], sfX, sfY[3]);
  connectPair(sfX, 286, sfY[0], sfY[1], finalX, finalY[0]);
  connectPair(sfX, 286, sfY[2], sfY[3], finalX, finalY[1]);

  bracket.pokemon.forEach((name, index) => drawPokemon(name, qfX, qfY[index], winners[index >> 1] === name));
  winners.slice(0, 4).forEach((name, index) => drawPokemon(name, sfX, sfY[index], winners[4 + (index >> 1)] === name));
  winners.slice(4, 6).forEach((name, index) => drawPokemon(name, finalX, finalY[index], winners[6] === name));

  context.fillStyle = "#52618D";
  context.fillRect(987, 355, 2, 72);
  drawPokemon(winners[6], 818, 390, true, true);
  context.fillStyle = "#7F89AC";
  context.font = "14px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("draftcentral.gg • Share your bracket", 982, 650);
  context.textAlign = "left";

  const link = document.createElement("a");
  link.download = `draftcenter-daily-bracket-${bracket.game_date}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function DailyBracket({ bracket, previous, signedIn, onSaved }) {
  const saved = bracket?.selected_winners?.length === 7 ? bracket.selected_winners : [];
  const [winners, setWinners] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setWinners(saved), [bracket?.id, bracket?.selected_winners?.join("|")]);
  if (!bracket) return null;
  if (!signedIn) return <section className="explore-card daily-game-card"><span className="eyebrow">DAILY DRAFT BRACKET</span><h2>Eight Pokémon. One community favorite.</h2><div className="daily-game-locked"><div className="locked-poll-preview" aria-hidden="true"><span /><span /><span /></div><strong>Sign in to complete today’s bracket and reveal community results.</strong><a className="secondary-button" href="/">Sign in</a></div><PreviousBracket previous={previous} /></section>;
  const complete = winners.length === 7;
  const matchup = !complete ? matchupFor(bracket.pokemon, winners, winners.length) : null;
  const roundLabel = winners.length < 4 ? `Quarterfinal ${winners.length + 1} of 4` : winners.length < 6 ? `Semifinal ${winners.length - 3} of 2` : "Championship";
  async function choose(name) {
    const next = [...winners, name];
    setWinners(next);
    if (next.length !== 7 || !signedIn) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_daily_draft_bracket", {
      p_bracket_id: bracket.id,
      p_winners: next,
      p_local_date: localDateKey(),
      p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else onSaved(data);
  }
  return <section className="explore-card daily-game-card daily-bracket-card">
    <span className="eyebrow">DAILY DRAFT BRACKET</span>
    <h2>Choose today’s community favorite</h2>
    <p className="muted">Make seven head-to-head choices through an eight-Pokémon bracket. Each matchup helps build community preference records for future Pokédex entries.</p>
    {!complete && matchup?.every(Boolean) && <>
      <strong className="daily-round-label">{roundLabel}</strong>
      <div className="daily-bracket-matchup">
        <BracketPokemon name={matchup[0]} onChoose={choose} disabled={busy} />
        <b>VS</b>
        <BracketPokemon name={matchup[1]} onChoose={choose} disabled={busy} />
      </div>
      {winners.length > 0 && <button type="button" className="quiet-button" onClick={() => setWinners((current) => current.slice(0, -1))}>Undo last choice</button>}
    </>}
    {complete && <div className="daily-bracket-complete">
      <span>Today’s champion</span>
      <BracketPokemon name={winners[6]} onChoose={() => {}} disabled />
      <p>{bracket.completed_brackets || 0} completed community bracket{bracket.completed_brackets === 1 ? "" : "s"}</p>
      <div className="daily-game-actions">
        <button type="button" className="primary-button" onClick={() => downloadBracket(bracket, winners)}>Download my bracket</button>
        <ShareButton title="My DraftCenter Daily Draft Bracket" text={`My ${bracket.game_date} Daily Draft Bracket champion is ${winners[6]}.`} url="https://www.draftcentral.gg/explore" />
        <button type="button" className="quiet-button" onClick={() => setWinners([])}>Redo my bracket</button>
      </div>
      <small className="muted">Redoing lets you revise today’s choices. Your saved bracket remains recorded until you complete the replacement, and only your latest completed bracket counts toward community preference data.</small>
      <CommunityBracketResults bracket={bracket} winners={winners} />
    </div>}
    {message && <p className="hub-message">{message}</p>}
    <DailyGameDiscussion type="bracket" gameId={bracket.id} signedIn={signedIn} />
    <PreviousBracket previous={previous} />
  </section>;
}

function DailyQuiz({ quiz, previous, signedIn, onSaved }) {
  const [answer, setAnswer] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!quiz) return null;
  if (!signedIn) return <section className="explore-card daily-game-card"><span className="eyebrow">DAILY POKÉMON QUIZ</span><h2>{cleanCommunityText(quiz.prompt)}</h2><div className="daily-game-locked"><div className="locked-poll-preview" aria-hidden="true"><span /><span /><span /></div><strong>Sign in to answer today’s quiz and reveal community results.</strong><a className="secondary-button" href="/">Sign in</a></div><PreviousQuiz previous={previous} /></section>;
  const pokemonMatches = answer.trim()
    ? POLL_POKEMON_NAMES.filter((name) => name.toLowerCase().includes(answer.trim().toLowerCase())).slice(0, 8)
    : POLL_POKEMON_NAMES.slice(0, 8);
  async function submit(event) {
    event.preventDefault();
    if (!signedIn) return setMessage("Sign in to submit today’s quiz.");
    const selectedPokemon = POLL_POKEMON_NAMES.find((name) => name.toLowerCase() === answer.trim().toLowerCase());
    if (!selectedPokemon) return setMessage("Choose a Pokémon from the matching choices before submitting.");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_daily_quiz_answer", {
      p_quiz_id: quiz.id,
      p_answer: selectedPokemon,
      p_local_date: localDateKey(),
      p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else onSaved(data);
  }
  return <section className="explore-card daily-game-card daily-quiz-card">
    <div className="daily-quiz-heading"><span className="eyebrow">DAILY POKÉMON QUIZ</span><span className={`quiz-difficulty ${quiz.difficulty}`}>{quiz.difficulty}</span></div>
    <h2>{cleanCommunityText(quiz.prompt)}</h2>
    {!quiz.answered ? <form onSubmit={submit}>
      <div className="daily-quiz-input"><input value={answer} onFocus={() => setPickerOpen(true)} onChange={(event) => { setAnswer(event.target.value); setPickerOpen(true); }} placeholder="Search for a Pokémon" maxLength={60} autoComplete="off" /><button className="primary-button" disabled={busy || !POLL_POKEMON_NAMES.some((name) => name.toLowerCase() === answer.trim().toLowerCase())}>{busy ? "Checking…" : "Submit"}</button></div>
      {pickerOpen && <div className="daily-quiz-pokemon-picker">
        {pokemonMatches.length ? pokemonMatches.map((name) => <QuizPokemonChoice key={name} name={name} onChoose={(selected) => { setAnswer(selected); setPickerOpen(false); }} />) : <p className="muted">No matching Pokémon found. Try another spelling.</p>}
      </div>}
    </form> : <div className="daily-quiz-results">
      <strong style={{ color: quiz.selected_correct ? "#4FD1C5" : "#F0555A" }}>{quiz.selected_correct ? "Correct!" : "Not quite."}</strong>
      <p>Your answer: {quiz.selected_answer}</p>
      {!quiz.selected_correct && <p>Accepted answer{quiz.correct_answers?.length === 1 ? "" : "s"}: <b>{(quiz.correct_answers || []).join(", ")}</b></p>}
      <p><b>{quiz.correct_percent}%</b> of {quiz.total_answers} player{quiz.total_answers === 1 ? "" : "s"} answered correctly.</p>
      <h3>Top five answers</h3>
      <ol>{(quiz.top_answers || []).map((row) => <li key={row.answer}><span>{row.answer}</span><b>{row.count}</b></li>)}</ol>
    </div>}
    {message && <p className="hub-message">{message}</p>}
    <DailyGameDiscussion type="quiz" gameId={quiz.id} signedIn={signedIn} />
    <PreviousQuiz previous={previous} />
  </section>;
}

function DailyGameDiscussion({ type, gameId, signedIn }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [message, setMessage] = useState("");
  async function load() {
    if (!signedIn || !gameId) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_daily_game_comments", { p_game_type: type, p_game_id: gameId, p_limit: 100 });
    if (error) setMessage(error.message); else setComments(data || []);
  }
  useEffect(() => { load(); }, [type, gameId, signedIn]);
  async function post(event) {
    event.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.rpc("create_daily_game_comment", { p_game_type: type, p_game_id: gameId, p_body: body, p_parent_comment_id: replyTo });
    if (error) return setMessage(error.message);
    setBody(""); setReplyTo(null); load();
  }
  async function upvote(id, alreadyUpvoted) {
    if (alreadyUpvoted) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("upvote_daily_game_comment", { p_comment_id: id });
    if (error) return setMessage(error.message);
    load();
  }
  const roots = comments.filter((comment) => !comment.parent_comment_id).sort((a, b) => b.upvotes - a.upvotes || new Date(a.created_at) - new Date(b.created_at));
  const renderComment = (comment) => <article key={comment.id}><strong>{comment.display_name || comment.username || "Coach"}</strong><p>{comment.body}</p><div><button type="button" className={comment.upvoted_by_me ? "comment-upvote active" : "comment-upvote"} onClick={() => upvote(comment.id, comment.upvoted_by_me)}>▲ Upvote {comment.upvotes}</button><button type="button" className="text-button" onClick={() => setReplyTo(comment.id)}>Reply</button></div>{comments.filter((reply) => reply.parent_comment_id === comment.id).sort((a, b) => b.upvotes - a.upvotes).map((reply) => <aside key={reply.id}><strong>{reply.display_name || reply.username || "Coach"}</strong><p>{reply.body}</p><button type="button" className={reply.upvoted_by_me ? "comment-upvote active" : "comment-upvote"} onClick={() => upvote(reply.id, reply.upvoted_by_me)}>▲ Upvote {reply.upvotes}</button></aside>)}</article>;
  return <details className="daily-game-discussion">
    <summary><span>Community discussion</span><small>{comments.length} comment{comments.length === 1 ? "" : "s"}</small></summary>
    <div className="daily-game-discussion-body">
      <form onSubmit={post}><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={replyTo ? "Write a reply…" : "Add a comment…"} maxLength={1000} /><div>{replyTo && <button type="button" className="text-button" onClick={() => setReplyTo(null)}>Cancel reply</button>}<button className="quiet-button" disabled={!body.trim()}>Post</button></div></form>
      {roots.slice(0, 3).map(renderComment)}
      {roots.length > 3 && <details className="daily-discussion-more"><summary>Read {roots.length - 3} more comment{roots.length - 3 === 1 ? "" : "s"}</summary><div>{roots.slice(3).map(renderComment)}</div></details>}
      {message && <p className="hub-message">{message}</p>}
    </div>
  </details>;
}

export default function DailyCommunityGames({ signedIn }) {
  const [games, setGames] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [badgeEvents, setBadgeEvents] = useState([]);
  const [message, setMessage] = useState("");
  const date = useMemo(() => localDateKey(), []);
  useEffect(() => {
    const supabase = createClient();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    Promise.all([
      supabase.rpc("get_daily_community_games", { p_local_date: date }),
      supabase.rpc("get_daily_community_games", { p_local_date: localDateKey(yesterday) }),
    ]).then(async ([todayResult, previousResult]) => {
      const { data, error } = todayResult;
      if (error) setMessage(error.message);
      else setGames(await addChampionRankings(supabase, data));
      if (!previousResult.error) setPrevious(await addChampionRankings(supabase, previousResult.data));
    });
  }, [date]);
  useEffect(() => {
    if (!signedIn || window.location.pathname !== "/explore") return;
    const supabase = createClient();
    supabase.rpc("refresh_my_daily_three_badges").then(({ data }) => setBadgeEvents(data?.events || []));
  }, [signedIn]);
  if (message) return <section className="explore-card"><p className="hub-message">{message}</p></section>;
  if (!games) return <section className="explore-card"><p className="muted">Loading today’s community games…</p></section>;
  async function saved(next){const supabase=createClient();setGames(await addChampionRankings(supabase,next));if(!signedIn)return;const {data,error}=await supabase.rpc("refresh_my_daily_three_badges");if(error)setMessage(error.message);else if(window.location.pathname==="/explore")setBadgeEvents(data?.events||[]);else window.dispatchEvent(new CustomEvent("draftcenter:badge-events",{detail:data?.events||[]}));}
  async function dismissBadge(){const event=badgeEvents[0];const supabase=createClient();await supabase.rpc("mark_badge_events_seen",{p_event_ids:[event.id]});setBadgeEvents((current)=>current.slice(1));}
  return <>
    {badgeEvents.length>0&&<div className="badge-award-backdrop"><section className="badge-award-popup"><div className="badge-confetti">✦ ★ ✧ ★ ✦</div><span className="eyebrow">BADGE EARNED</span><div className="badge-award-icon">{badgeEvents[0].icon}</div><h2>{badgeEvents[0].subject?`${badgeEvents[0].subject} ${badgeEvents[0].name}`:badgeEvents[0].name}</h2><p>{badgeEvents[0].description}</p><button className="primary-button" onClick={dismissBadge}>{badgeEvents.length>1?`Next badge (${badgeEvents.length-1} more)`:"Awesome!"}</button><small>Your badge now appears in Profile.</small></section></div>}
    <DailyBracket bracket={games.bracket} previous={previous?.bracket} signedIn={signedIn} onSaved={saved} />
    <DailyQuiz quiz={games.quiz} previous={previous?.quiz} signedIn={signedIn} onSaved={saved} />
  </>;
}
