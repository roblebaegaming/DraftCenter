"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { loadPokemonArtwork } from "./LeagueHub";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function BracketPokemon({ name, onChoose, disabled }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let alive = true;
    loadPokemonArtwork(name).then((next) => { if (alive) setImage(next); });
    return () => { alive = false; };
  }, [name]);
  return <button type="button" className="daily-bracket-pokemon" disabled={disabled} onClick={() => onChoose(name)}>
    {image ? <img src={image} alt="" /> : <span className="daily-game-art-placeholder" />}
    <strong>{name}</strong>
  </button>;
}

function matchupFor(pokemon, winners, index) {
  if (index < 4) return [pokemon[index * 2], pokemon[index * 2 + 1]];
  if (index < 6) return [winners[(index - 4) * 2], winners[(index - 4) * 2 + 1]];
  return [winners[4], winners[5]];
}

function downloadBracket(bracket, winners) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext("2d");
  context.fillStyle = "#10121C";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#FFD23F";
  context.font = "bold 44px sans-serif";
  context.fillText("DRAFTCENTER DAILY DRAFT BRACKET", 54, 66);
  context.fillStyle = "#9A9FBD";
  context.font = "22px sans-serif";
  context.fillText(new Date(`${bracket.game_date}T12:00:00`).toLocaleDateString(), 56, 104);
  const labels = ["QUARTERFINALS", "SEMIFINALS", "CHAMPION"];
  [70, 475, 890].forEach((x, index) => {
    context.fillStyle = index === 2 ? "#FFD23F" : "#4FD1C5";
    context.font = "bold 22px sans-serif";
    context.fillText(labels[index], x, 155);
  });
  context.font = "20px sans-serif";
  bracket.pokemon.forEach((name, index) => {
    context.fillStyle = winners[index >> 1] === name ? "#FFD23F" : "#EDEBFA";
    context.fillText(name, 70, 205 + index * 52);
  });
  winners.slice(0, 4).forEach((name, index) => {
    context.fillStyle = winners[4 + (index >> 1)] === name ? "#FFD23F" : "#EDEBFA";
    context.fillText(name, 475, 235 + index * 104);
  });
  context.fillStyle = "#FFD23F";
  context.font = "bold 34px sans-serif";
  context.fillText(winners[6], 890, 315);
  context.fillStyle = "#9A9FBD";
  context.font = "18px sans-serif";
  context.fillText("My community favorite today", 890, 350);
  const link = document.createElement("a");
  link.download = `draftcenter-daily-bracket-${bracket.game_date}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function DailyBracket({ bracket, signedIn, onSaved }) {
  const saved = bracket?.selected_winners?.length === 7 ? bracket.selected_winners : [];
  const [winners, setWinners] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setWinners(saved), [bracket?.id, bracket?.selected_winners?.join("|")]);
  if (!bracket) return null;
  if (!signedIn) return <section className="explore-card daily-game-card"><span className="eyebrow">DAILY DRAFT BRACKET</span><h2>Eight Pokémon. One community favorite.</h2><div className="daily-game-locked"><div className="locked-poll-preview" aria-hidden="true"><span /><span /><span /></div><strong>Sign in to complete today’s bracket and reveal community results.</strong><a className="secondary-button" href="/">Sign in</a></div></section>;
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
        <button type="button" className="quiet-button" onClick={() => setWinners([])}>Play again</button>
      </div>
    </div>}
    {message && <p className="hub-message">{message}</p>}
    <DailyGameDiscussion type="bracket" gameId={bracket.id} signedIn={signedIn} />
  </section>;
}

function DailyQuiz({ quiz, signedIn, onSaved }) {
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!quiz) return null;
  if (!signedIn) return <section className="explore-card daily-game-card"><span className="eyebrow">DAILY POKÉMON QUIZ</span><h2>{quiz.prompt}</h2><div className="daily-game-locked"><div className="locked-poll-preview" aria-hidden="true"><span /><span /><span /></div><strong>Sign in to answer today’s quiz and reveal community results.</strong><a className="secondary-button" href="/">Sign in</a></div></section>;
  async function submit(event) {
    event.preventDefault();
    if (!signedIn) return setMessage("Sign in to submit today’s quiz.");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_daily_quiz_answer", {
      p_quiz_id: quiz.id,
      p_answer: answer,
      p_local_date: localDateKey(),
      p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else onSaved(data);
  }
  return <section className="explore-card daily-game-card daily-quiz-card">
    <div className="daily-quiz-heading"><span className="eyebrow">DAILY POKÉMON QUIZ</span><span className={`quiz-difficulty ${quiz.difficulty}`}>{quiz.difficulty}</span></div>
    <h2>{quiz.prompt}</h2>
    {!quiz.answered ? <form onSubmit={submit}>
      <div className="daily-quiz-input"><input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type your answer" maxLength={60} /><button className="primary-button" disabled={busy || !answer.trim()}>{busy ? "Checking…" : "Submit"}</button></div>
      <button type="button" className="quiet-button" onClick={() => setShowHint((current) => !current)}>{showHint ? "Hide hint" : "Show hint"}</button>
      {showHint && <p className="muted">{quiz.hint}</p>}
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
  return <div className="daily-game-discussion">
    <h3>Community discussion</h3>
    <form onSubmit={post}><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={replyTo ? "Write a reply…" : "Add a comment…"} maxLength={1000} /><div>{replyTo && <button type="button" className="text-button" onClick={() => setReplyTo(null)}>Cancel reply</button>}<button className="quiet-button" disabled={!body.trim()}>Post</button></div></form>
    {roots.map((comment) => <article key={comment.id}><strong>{comment.display_name || comment.username || "Coach"}</strong><p>{comment.body}</p><div><button type="button" className={comment.upvoted_by_me ? "comment-upvote active" : "comment-upvote"} onClick={() => upvote(comment.id, comment.upvoted_by_me)}>▲ Upvote {comment.upvotes}</button><button type="button" className="text-button" onClick={() => setReplyTo(comment.id)}>Reply</button></div>{comments.filter((reply) => reply.parent_comment_id === comment.id).sort((a, b) => b.upvotes - a.upvotes).map((reply) => <aside key={reply.id}><strong>{reply.display_name || reply.username || "Coach"}</strong><p>{reply.body}</p><button type="button" className={reply.upvoted_by_me ? "comment-upvote active" : "comment-upvote"} onClick={() => upvote(reply.id, reply.upvoted_by_me)}>▲ Upvote {reply.upvotes}</button></aside>)}</article>)}
    {message && <p className="hub-message">{message}</p>}
  </div>;
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
    ]).then(([todayResult, previousResult]) => {
      const { data, error } = todayResult;
      if (error) setMessage(error.message);
      else setGames(data);
      if (!previousResult.error) setPrevious(previousResult.data);
    });
  }, [date]);
  if (message) return <section className="explore-card"><p className="hub-message">{message}</p></section>;
  if (!games) return <section className="explore-card"><p className="muted">Loading today’s community games…</p></section>;
  async function saved(next){setGames(next);if(!signedIn)return;const supabase=createClient();const {data}=await supabase.rpc("refresh_my_account_badges");setBadgeEvents(data?.events||[]);}
  async function dismissBadge(){const event=badgeEvents[0];const supabase=createClient();await supabase.rpc("mark_badge_events_seen",{p_event_ids:[event.id]});setBadgeEvents((current)=>current.slice(1));}
  return <>
    {badgeEvents.length>0&&<div className="badge-award-backdrop"><section className="badge-award-popup"><div className="badge-confetti">✦ ★ ✧ ★ ✦</div><span className="eyebrow">BADGE EARNED</span><div className="badge-award-icon">{badgeEvents[0].icon}</div><h2>{badgeEvents[0].subject?`${badgeEvents[0].subject} ${badgeEvents[0].name}`:badgeEvents[0].name}</h2><p>{badgeEvents[0].description}</p><button className="primary-button" onClick={dismissBadge}>{badgeEvents.length>1?`Next badge (${badgeEvents.length-1} more)`:"Awesome!"}</button><small>Your badge now appears in Profile.</small></section></div>}
    <DailyBracket bracket={games.bracket} signedIn={signedIn} onSaved={saved} />
    <DailyQuiz quiz={games.quiz} signedIn={signedIn} onSaved={saved} />
    {previous?.bracket && previous?.quiz && <section className="explore-card daily-history-card">
      <span className="eyebrow">YESTERDAY’S DAILY THREE</span><h2>Yesterday’s community results</h2>
      <div className="daily-history-grid">
        <article><h3>Draft Bracket</h3>{previous.bracket.champions?.length ? <><strong>{previous.bracket.champions[0].pokemon}</strong><p>Won {previous.bracket.champions[0].wins} completed bracket{previous.bracket.champions[0].wins === 1 ? "" : "s"}.</p><h4>Championship finishes</h4><ol>{previous.bracket.champions.slice(0, 5).map((row) => <li key={row.pokemon}><span>{row.pokemon}</span><b>{row.wins}</b></li>)}</ol><h4>Head-to-head wins by round</h4><ol>{(previous.bracket.matchup_results || []).slice().sort((a, b) => b.round - a.round || b.votes - a.votes).slice(0, 8).map((row, index) => <li key={`${row.round}-${row.winner}-${row.loser}-${index}`}><span>{row.winner} over {row.loser} <small>R{row.round}</small></span><b>{row.votes}</b></li>)}</ol></> : <p className="muted">No completed brackets yesterday.</p>}</article>
        <article><h3>Pokémon Quiz</h3><strong>{previous.quiz.correct_percent ?? 0}% correct</strong><p>Accepted answer{previous.quiz.correct_answers?.length === 1 ? "" : "s"}: {(previous.quiz.correct_answers || []).join(", ")}</p><ol>{(previous.quiz.top_answers || []).slice(0, 5).map((row) => <li key={row.answer}><span>{row.answer}</span><b>{row.count}</b></li>)}</ol></article>
      </div>
    </section>}
  </>;
}
