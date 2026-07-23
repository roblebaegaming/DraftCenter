"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

function pollRows(poll) {
  if (!poll) return [];
  return poll.answer_type === "pokemon"
    ? Object.entries(poll.counts || {}).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    : (poll.options || []).map((option) => ({ label: option.label, count: poll.counts?.[option.key] || 0 })).sort((a, b) => b.count - a.count);
}

function PollResults({ poll }) {
  return <div className="public-poll-results">{pollRows(poll).map((row) => {
    const percent = poll.total_votes ? Math.round(row.count / poll.total_votes * 100) : 0;
    return <div key={row.label}><div><strong>{row.label}</strong><span>{percent}%</span></div><i><span style={{ width: `${percent}%` }} /></i></div>;
  })}</div>;
}

function Ranking({ title, items, render, empty }) {
  return <section className="explore-card"><h2>{title}</h2>{items?.length ? <ol className="explore-ranking">{items.slice(0, 10).map((item, index) => <li key={`${item.pokemon}-${index}`}><b>{index + 1}</b>{render(item)}</li>)}</ol> : <p className="muted">{empty}</p>}</section>;
}

export default function PublicExplore() {
  const [data, setData] = useState(null);
  const [pollHistory, setPollHistory] = useState([]);
  const [trends, setTrends] = useState(null);
  const [marketTrends, setMarketTrends] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.rpc("get_public_explore"),
      supabase.rpc("get_public_poll_history", { p_limit: 12 }),
      supabase.rpc("get_public_draft_trends"),
      supabase.rpc("get_public_market_trends"),
    ]).then(([exploreResult, historyResult, trendResult, marketResult]) => {
      if (exploreResult.error) setMessage(exploreResult.error.message);
      else setData(exploreResult.data);
      if (!historyResult.error) setPollHistory(historyResult.data || []);
      if (!trendResult.error) setTrends(trendResult.data);
      if (!marketResult.error) setMarketTrends(marketResult.data);
    });
  }, []);
  const signedIn = Boolean(data?.signed_in);
  return <main className="explore-shell">
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button" href="/">DraftCenter home</a><a className="quiet-button" href="/pokemon">Pokémon</a></div>
      <span className="eyebrow">EXPLORE DRAFTCENTER</span>
      <h1>Pokémon, leagues, and community trends.</h1>
      <p>{signedIn ? "See what DraftCenter coaches are voting for, favoriting, and drafting." : "Explore public leagues and completed community polls. Create an account to vote, comment, and reveal today's results."}</p>
      <div className="explore-actions"><a className="primary-button" href="/pokemon">Explore Pokémon</a><a className="secondary-button" href="/">{signedIn ? "Your DraftCenter home" : "Create an account"}</a></div>
    </header>
    {message && <p className="hub-message">{message}</p>}
    {!data && !message && <p className="muted">Loading public DraftCenter data...</p>}
    {data && <div className="explore-grid">
      <section className="explore-card explore-poll">
        <span className="eyebrow">POLL OF THE DAY</span>
        <h2>{data.poll?.question || "Today's poll is on its way."}</h2>
        {data.poll && signedIn && <><p className="muted">{data.poll.total_votes || 0} community vote{data.poll.total_votes === 1 ? "" : "s"}.{data.poll.selected_key ? " Your vote is included." : " Vote from your DraftCenter home."}</p><PollResults poll={data.poll} /></>}
        {data.poll && !signedIn && <div className="locked-current-poll"><div className="locked-poll-preview" aria-hidden="true"><span /><span /><span /></div><strong>Create an account to reveal today’s answers and percentages.</strong><a className="secondary-button" href="/">Create an account</a></div>}
      </section>
      <section className="explore-card">
        <span className="eyebrow">PUBLIC LEAGUES</span><h2>Watch or join a league</h2>
        {data.leagues?.length ? <div className="public-explore-leagues">{data.leagues.slice(0, 6).map((league) => <article key={league.id}>{league.image_url && <img src={league.image_url} alt="" />}<div><strong>{league.name}</strong><p>{league.description || league.season_label || "Public DraftCenter league"}</p><span>{league.league_visibility === "open" ? "Open to managers" : "Public to watch"}</span><a className="public-league-link" href={`/league/${league.slug}`}>View league →</a></div></article>)}</div> : <p className="muted">No public leagues have been listed yet.</p>}
      </section>
      {pollHistory.length > 0 && <section className="explore-card completed-polls-card"><span className="eyebrow">PAST POLLS</span><h2>Completed community results</h2><div className="completed-poll-list">{pollHistory.map((poll) => <details key={poll.id}><summary><span>{new Date(`${poll.poll_date}T12:00:00`).toLocaleDateString()}</span><strong>{poll.question}</strong></summary><p className="muted">{poll.total_votes} final vote{poll.total_votes === 1 ? "" : "s"}</p><PollResults poll={poll} /></details>)}</div></section>}
      <Ranking title="Most drafted this week" items={trends?.weekly_drafted} empty="Weekly rankings will appear after public non-practice drafts make picks." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.drafts} draft{item.drafts === 1 ? "" : "s"} in the last 7 days</small></span>} />
      <Ranking title="Biggest risers" items={marketTrends?.risers} empty="Risers appear after two full weeks of public draft activity." render={(item) => <span><strong>{item.pokemon}</strong><small>+{item.change} drafts · {item.current_drafts} this week</small></span>} />
      <Ranking title="Biggest fallers" items={marketTrends?.fallers} empty="Fallers appear after two full weeks of public draft activity." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.change} drafts · {item.current_drafts} this week</small></span>} />
      <Ranking title="Highest public-league win rates" items={trends?.win_rates} empty="Win rates appear after Pokémon teams complete at least two confirmed public matches." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.win_rate}% · {item.wins}-{item.games - item.wins} across {item.games} matches</small></span>} />
      <Ranking title="Community Pokémon popularity" items={data.popularity} empty="Favorite-six rankings will appear as coaches build profile teams." render={(item) => <span><strong>{item.pokemon}</strong><small>{item.favorites} favorite team{item.favorites === 1 ? "" : "s"}</small></span>} />
      <Ranking title="Community ADP" items={data.adp} empty="ADP begins to form after public drafts or completed practice drafts." render={(item) => <span><strong>{item.pokemon}</strong><small>ADP {item.average_pick} · {item.drafts} draft pick{item.drafts === 1 ? "" : "s"}</small></span>} />
    </div>}
  </main>;
}
