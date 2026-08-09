"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { ShareButton } from "./SocialSharing";

function computePublicStandings(state) {
  const rows = (state?.teams || []).map((team, id) => ({ id, name: team.name, logoUrl: team.logoUrl, w: 0, l: 0, differential: 0 }));
  Object.entries(state?.matchResults || {}).forEach(([key, result]) => {
    const [week, match] = key.split("-").map(Number);
    const pair = state?.schedule?.[week]?.[match];
    if (!pair || !result) return;
    const [a, b] = pair;
    const gamesA = Number(result.gamesA) || 0; const gamesB = Number(result.gamesB) || 0;
    if (gamesA > gamesB) { rows[a].w += 1; rows[b].l += 1; }
    if (gamesB > gamesA) { rows[b].w += 1; rows[a].l += 1; }
    const differential = (Number(result.monsAliveA) || 0) - (Number(result.monsAliveB) || 0);
    rows[a].differential += differential;
    rows[b].differential -= differential;
  });
  return rows.sort((a, b) => (b.w - a.w) || (a.l - b.l) || (b.differential - a.differential));
}

function publicPlayoffTeamIndexes(playoffs) {
  const indexes = new Set();
  function visit(value, key = "") {
    if (Array.isArray(value)) {
      if (key === "seeds") value.forEach((entry) => { if (Number.isInteger(entry)) indexes.add(entry); });
      value.forEach((entry) => visit(entry));
      return;
    }
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  }
  visit(playoffs);
  return [...indexes];
}

export default function PublicLeaguePage() {
  const { slug } = useParams();
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [predictionMessage, setPredictionMessage] = useState("");
  useEffect(() => {
    if (!slug) return;
    supabase.rpc("get_public_league", { p_slug: slug }).then(({ data: result, error }) => {
      if (error) setMessage(error.message);
      else if (!result?.league) setMessage("This league is private or no longer available.");
      else setData(result);
    });
  }, [slug, supabase]);
  const standings = useMemo(() => computePublicStandings(data?.state), [data]);
  async function predict(matchKey, teamIndex) {
    setPredictionMessage("");
    const { error } = await supabase.rpc("save_public_match_prediction", { p_slug: slug, p_match_key: matchKey, p_team_index: teamIndex });
    setPredictionMessage(error ? error.message : "Prediction saved.");
  }
  const playoffTeams = publicPlayoffTeamIndexes(data?.state?.playoffs).map((teamIndex) => data?.state?.teams?.[teamIndex]).filter(Boolean);
  return <main className="explore-shell">
    <header className="explore-hero"><div className="public-page-nav"><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/">DraftCenter Home</a></div>
      {!data && !message && <p className="muted">Loading public league...</p>}{message && <p className="hub-message">{message}</p>}
      {data?.league && <><span className="eyebrow">{data.league.league_visibility === "open" ? "OPEN TO JOIN" : "PUBLIC TO WATCH"}</span>{data.league.image_url && <img className="public-league-hero-image" src={data.league.image_url} alt="" />}<h1>{data.league.name}</h1><p>{data.league.description || data.league.season_label || "Public DraftCenter league"}</p><ShareButton title={data.league.name} text={`Follow ${data.league.name} standings, predictions, draft board, and playoffs on DraftCenter.`} /></>}
    </header>
    {data?.league && <>
      <section className="explore-card"><h2>Standings</h2><div className="public-pick-list">{standings.map((team, index) => <div key={team.id}><b>#{index + 1}</b><strong>{team.name}</strong><span>{team.w}-{team.l} · Diff {team.differential >= 0 ? "+" : ""}{team.differential}</span></div>)}</div></section>
      <section className="explore-card"><h2>Predictions</h2>{predictionMessage && <p className="hub-message">{predictionMessage}</p>}{data.state?.schedule?.length ? data.state.schedule.map((week, weekIndex) => <div key={weekIndex} className="mb-5"><h3>Week {weekIndex + 1}</h3><div className="public-pick-list">{week.map(([a, b], matchIndex) => { const key = `${weekIndex}-${matchIndex}`; const result = data.state.matchResults?.[key]; return <div key={key}><strong>{data.state.teams?.[a]?.name} vs. {data.state.teams?.[b]?.name}</strong>{result ? <span>Final {result.gamesA}-{result.gamesB}</span> : <span><button className="text-button" onClick={() => predict(key, a)}>Pick {data.state.teams?.[a]?.name}</button> · <button className="text-button" onClick={() => predict(key, b)}>Pick {data.state.teams?.[b]?.name}</button></span>}</div>; })}</div></div>) : <p className="muted">Predictions will open when matchups are published.</p>}</section>
      <section className="explore-card"><h2>Official draft board</h2>{data.picks?.length ? <div className="public-pick-list">{data.picks.map((pick) => <div key={pick.pick_number}><b>#{pick.pick_number}</b><strong>{pick.pokemon}</strong><span>{pick.team}{pick.round_number ? ` · Round ${pick.round_number}` : ""}</span></div>)}</div> : <p className="muted">The commissioner has not started the public draft board yet.</p>}</section>
      <section className="explore-card"><h2>Playoffs</h2>{data.state?.playoffs ? <><p className="muted">The playoff bracket is published.</p>{playoffTeams.length > 0 && <div className="public-pick-list">{playoffTeams.map((team, index) => <div key={team.id ?? team.name}><b>#{index + 1}</b><strong>{team.name}</strong><span>Playoff field</span></div>)}</div>}</> : <p className="muted">The playoff bracket has not been published yet.</p>}</section>
    </>}
  </main>;
}
