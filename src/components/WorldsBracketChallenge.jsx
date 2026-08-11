"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { WORLDS_2026_EVENT_ID } from "../lib/worlds2026";
import {
  buildWorldsBracketRounds,
  chooseWorldsBracketWinner,
  worldsBracketEntryIsComplete,
} from "../lib/worldsBracket";
import WorldsDisciplineNav from "./WorldsDisciplineNav";

function pacificTime(value) {
  if (!value) return "To be announced";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function statusCopy(status) {
  return ({
    waiting_for_official_bracket: ["Ready for the official field", "DraftCenter is prepared, but no names, seeds, or matchups will appear until an owner checks the published Top Cut."],
    scheduled: ["Official bracket published", "The field is ready. Entries will open at the reviewed time below."],
    open: ["Bracket entries are open", "Pick every matchup winner and save before the first-match deadline."],
    locked: ["Bracket entries are locked", "Predictions are public now. Scoring starts when reviewed match winners are recorded."],
    scoring: ["Top Cut scoring is live", "Scores update automatically as reviewed official match winners advance."],
    final: ["Top Cut results are final", "The complete official bracket is locked and the community leaderboard is final."],
  })[status] || ["Waiting for the official bracket", "No prediction entries are open yet."];
}

export default function WorldsBracketChallenge() {
  const [hub, setHub] = useState(null);
  const [user, setUser] = useState(undefined);
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load(supabase) {
    const { data, error } = await supabase.rpc("get_worlds_bracket_hub", { p_event_id: WORLDS_2026_EVENT_ID });
    if (error || !data) {
      setHub({ event: { status: "waiting_for_official_bracket", revision: 0 }, slots: [], results: [], standings: [], entry_count: 0, my_entry: null });
    } else {
      setHub(data);
      setChoices(data.my_entry?.picks || {});
    }
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
    const refresh = setInterval(() => { if (active) load(supabase); }, 120_000);
    return () => { active = false; clearInterval(refresh); listener.subscription.unsubscribe(); };
  }, []);

  const event = hub?.event || { status: "waiting_for_official_bracket", revision: 0 };
  const slots = hub?.slots || [];
  const rounds = useMemo(() => event.bracket_size ? buildWorldsBracketRounds({ size: event.bracket_size, slots, choices, results: hub?.results || [] }) : [], [choices, event.bracket_size, hub?.results, slots]);
  const complete = event.bracket_size ? worldsBracketEntryIsComplete({ size: event.bracket_size, slots, choices }) : false;
  const open = event.status === "open" && user;
  const [statusTitle, statusDetail] = statusCopy(event.status);
  const maximumScore = event.bracket_size ? Object.entries(event.round_points || {}).reduce((total, [round, points]) => total + (event.bracket_size / (2 ** Number(round))) * Number(points), 0) : 0;

  function choose(round, match, winnerSlug) {
    if (!open) return;
    setChoices(chooseWorldsBracketWinner({ size: event.bracket_size, slots, choices, round, match, winnerSlug }));
    setMessage("");
  }

  async function save() {
    setMessage("");
    if (!user) return setMessage("Sign in before saving your bracket.");
    if (!complete) return setMessage("Pick a winner in every matchup first.");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("save_worlds_bracket_entry", { p_event_id: WORLDS_2026_EVENT_ID, p_picks: choices });
    if (error) setMessage(error.message || "Your bracket could not be saved.");
    else {
      await load(supabase);
      setMessage("Your Top Cut bracket is saved. You can revise it until entries lock.");
    }
    setBusy(false);
  }

  return <main className="worlds-shell worlds-bracket-shell">
    <WorldsDisciplineNav current="vgc" />
    <section className="worlds-hero worlds-top-cut-hero">
      <div>
        <span className="eyebrow">VGC MASTERS · TOP CUT</span>
        <h1>2026 Pokémon Worlds Top Cut bracket challenge</h1>
        <p>Build a complete elimination bracket from the real VGC Masters pairings once Pokémon publishes them. DraftCenter will never invent the field just to open entries early.</p>
        <div className="worlds-hero-actions"><Link className="primary-button inline-link-button" href="#top-cut-bracket">{event.status === "open" ? "Build my bracket" : "See bracket status"}</Link><Link className="quiet-button" href="/worlds/2026/vgc">Play VGC Pick 10</Link></div>
      </div>
      <aside className={`worlds-event-card worlds-top-cut-status is-${event.status}`}>
        <span>TOP CUT STATUS</span><strong>{statusTitle}</strong><p>{statusDetail}</p>
        <dl><div><dt>Official field</dt><dd>{event.bracket_size ? `Top ${event.bracket_size}` : "Not announced"}</dd></div><div><dt>Entries open</dt><dd>{pacificTime(event.opens_at)}</dd></div><div><dt>Entry lock</dt><dd>{pacificTime(event.locks_at)}</dd></div></dl>
      </aside>
    </section>

    {!event.revision ? <section className="worlds-bracket-waiting" id="top-cut-bracket">
      <span className="eyebrow">FAIL-CLOSED BY DESIGN</span><h2>The prediction room is built. The bracket is not.</h2>
      <p>The 2026 competitor information currently does not publish the VGC Masters Top Cut size or pairings. When the official bracket appears, the owner can load the exact names and matchups, set a deadline before play begins, and open entries without a new code release.</p>
      <div><article><strong>1</strong><span>Owner verifies the official Masters field and source.</span></article><article><strong>2</strong><span>DraftCenter validates every name, slot, seed, and deadline.</span></article><article><strong>3</strong><span>Members complete private brackets before lock.</span></article><article><strong>4</strong><span>Reviewed winners score every entry automatically.</span></article></div>
      <a className="quiet-button" href="https://worlds.pokemon.com/en-us/competitors/" target="_blank" rel="noreferrer">Official competitor information ↗</a>
    </section> : <>
      <section className="worlds-bracket-source-bar"><div><span className="eyebrow">REVIEWED OFFICIAL FIELD</span><strong>Top {event.bracket_size} · revision {event.revision}</strong><small>Source checked {pacificTime(event.source_checked_at)}</small></div><a href={event.official_bracket_url} target="_blank" rel="noreferrer">View official bracket ↗</a></section>

      <section className="worlds-public-bracket" id="top-cut-bracket" aria-labelledby="top-cut-bracket-heading">
        <header><div><span className="eyebrow">YOUR PREDICTION</span><h2 id="top-cut-bracket-heading">Choose every winner</h2><p>Later rounds follow your own picks. Changing an earlier winner clears any downstream choice that no longer fits.</p></div><div><strong>{Object.keys(choices).length}/{event.bracket_size - 1}</strong><span>matchups picked</span></div></header>
        {user === undefined || loading ? <p className="worlds-empty-state">Checking your DraftCenter account…</p> : !user ? <div className="worlds-account-gate"><div aria-hidden="true" className="worlds-account-lock">🔒</div><h3>Sign in to make a Top Cut bracket.</h3><p>The official field is public. Saving or editing a prediction requires a free DraftCenter account, and everyone else&apos;s choices remain private until lock.</p><a className="secondary-button" href="/#member-access">Sign in or create an account</a></div> : <>
          <div className="worlds-bracket-rounds" style={{ "--worlds-bracket-rounds": rounds.length }}>{rounds.map((round, roundIndex) => <section key={roundIndex} aria-label={`Round ${roundIndex + 1}`}>
            <header><span>Round {roundIndex + 1}</span><strong>{event.round_points[String(roundIndex + 1)]} pts each</strong></header>
            <div>{round.map((match) => <article key={match.key} className={match.result ? "has-result" : ""}>
              <small>Match {match.match}</small>
              {[match.a, match.b].map((competitor, sideIndex) => competitor ? <button type="button" key={competitor.slug} aria-pressed={match.pickedSlug === competitor.slug} disabled={!open} className={`${match.pickedSlug === competitor.slug ? "is-picked" : ""}${match.result?.winner_slug === competitor.slug ? " is-result-winner" : ""}`} onClick={() => choose(match.round, match.match, competitor.slug)}><span>{competitor.sourceSeed ? `#${competitor.sourceSeed}` : sideIndex === 0 ? "A" : "B"}</span><strong>{competitor.displayName}</strong><small>{competitor.countryCode}</small></button> : <div className="worlds-bracket-tbd" key={sideIndex}>Winner to be picked</div>)}
              {match.result && <p>{choices[match.key] === match.result.winner_slug ? "Correct pick" : choices[match.key] ? "Result recorded" : "No saved pick"}</p>}
            </article>)}</div>
          </section>)}</div>
          <div className="worlds-save-row"><div>{event.status === "open" ? <p>{hub.my_entry ? `Saved as ${hub.my_entry.display_name}. Edits stay open until ${pacificTime(event.locks_at)}.` : "Complete every round, then save one bracket."}</p> : <p>Entries are locked. {hub.my_entry ? `Your score is ${hub.my_entry.score} of ${maximumScore} possible points.` : "No bracket was saved for this account."}</p>}{message && <p className="worlds-message" role="status">{message}</p>}</div><button className="primary-button" disabled={!open || busy || !complete} onClick={save}>{busy ? "Saving…" : hub.my_entry ? "Update bracket" : "Save bracket"}</button></div>
        </>}
      </section>

      <section className="worlds-bracket-leaderboard"><header><div><span className="eyebrow">TOP CUT LEADERBOARD</span><h2>{hub.entry_count || 0} brackets</h2></div><p>Maximum score: <strong>{maximumScore} points</strong></p></header>{hub.standings?.length ? <div>{hub.standings.map((entry, index) => <details key={`${entry.display_name}-${index}`} className={entry.is_me ? "is-me" : ""}><summary><span>#{entry.rank}</span><strong>{entry.display_name}</strong><b>{entry.score} pts</b></summary><p>{entry.picks ? Object.entries(entry.picks).map(([key, slug]) => `${key}: ${slots.find((slot) => slot.competitor_slug === slug)?.display_name || slug}`).join(" · ") : "This bracket stays private until entries lock."}</p></details>)}</div> : <p className="worlds-empty-state">No Top Cut brackets have been saved yet.</p>}</section>
    </>}
  </main>;
}
