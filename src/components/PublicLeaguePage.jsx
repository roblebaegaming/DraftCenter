"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function PublicLeaguePage() {
  const { slug } = useParams(); const [data, setData] = useState(null); const [message, setMessage] = useState("");
  useEffect(() => { if (!slug) return; createClient().rpc("get_public_league", { p_slug: slug }).then(({ data: result, error }) => { if (error) setMessage(error.message); else if (!result?.league) setMessage("This league is private or no longer available."); else setData(result); }); }, [slug]);
  return <main className="explore-shell"><header className="explore-hero"><div className="public-page-nav"><a className="quiet-button" href="/explore">Explore</a><a className="quiet-button" href="/">DraftCenter home</a></div>{!data && !message && <p className="muted">Loading public league...</p>}{message && <p className="hub-message">{message}</p>}{data?.league && <><span className="eyebrow">PUBLIC LEAGUE</span>{data.league.image_url && <img className="public-league-hero-image" src={data.league.image_url} alt="" />}<h1>{data.league.name}</h1><p>{data.league.description || data.league.season_label || "Public DraftCenter league"}</p><span className="league-status">{data.league.league_visibility === "open" ? "Open to managers" : "Public to watch"}{data.draft?.status ? ` · Draft ${data.draft.status}` : ""}</span></>}</header>{data?.league && <section className="explore-card"><h2>Official draft board</h2>{data.picks?.length ? <div className="public-pick-list">{data.picks.map((pick) => <div key={pick.pick_number}><b>#{pick.pick_number}</b><strong>{pick.pokemon}</strong><span>{pick.team}{pick.round_number ? ` · Round ${pick.round_number}` : ""}</span></div>)}</div> : <p className="muted">The commissioner has not started the public draft board yet.</p>}</section>}</main>;
}
