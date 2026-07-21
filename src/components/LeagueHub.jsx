"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

const field = { padding: 11, borderRadius: 8, border: "1px solid #46517c", background: "#080c1c", color: "#fff" };

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 72);
}

export default function LeagueHub({ user, onOpenLeague }) {
  const [supabase] = useState(() => createClient());
  const [leagues, setLeagues] = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadLeagues() {
    setLoading(true);
    const [{ data, error }, { data: publicData, error: publicError }] = await Promise.all([
      supabase
      .from("league_memberships")
      .select("id, role, league:leagues(id, name, slug, season_label, status, updated_at)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
      supabase.from("leagues").select("id, name, slug, description, season_label, status").eq("is_public", true).order("updated_at", { ascending: false }).limit(8),
    ]);
    setLoading(false);
    if (error || publicError) return setMessage((error || publicError).message);
    setLeagues((data || []).filter((row) => row.league));
    setPublicLeagues(publicData || []);
  }

  useEffect(() => { loadLeagues(); }, []);

  async function createLeague(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const slug = `${slugify(cleanName)}-${Math.random().toString(36).slice(2, 7)}`;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_league", {
      p_name: cleanName,
      p_slug: slug,
      p_description: "",
      p_season_label: season,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    onOpenLeague({ id: data, name: cleanName, slug, season_label: season, role: "commissioner" });
  }

  async function joinPublicLeague(league) {
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("join_public_league", { p_slug: league.slug });
    setBusy(false);
    if (error) return setMessage(error.message);
    onOpenLeague({ ...league, id: data, role: "viewer" });
  }

  return (
    <main style={{ minHeight: "100vh", padding: "42px max(20px, calc((100vw - 1060px) / 2))", background: "radial-gradient(circle at top, #1d2857, #080b18 60%)" }}>
      <div style={{ color: "#ffd23f", fontSize: 13, fontWeight: 800, letterSpacing: 1.5 }}>DRAFTCENTER</div>
      <h1 style={{ margin: "10px 0 4px", fontSize: 34 }}>Find your next league.</h1>
      <p style={{ margin: "0 0 28px", color: "#b8c0e6" }}>Discover public leagues, follow community standings, or create a home for your own competition.</p>
      <section style={{ padding: 22, marginBottom: 24, border: "1px solid #2a3157", borderRadius: 14, background: "#11162b" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}><h2 style={{ marginTop: 0 }}>Explore public leagues</h2><span style={{ color: "#82aaff", fontSize: 13 }}>Leaderboards coming soon</span></div>
        {!loading && publicLeagues.length === 0 && <p style={{ color: "#b8c0e6" }}>There are no public leagues to join yet. Ask a commissioner for a private invite, or start the first one.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {publicLeagues.map((league) => <article key={league.id} style={{ border: "1px solid #34406a", borderRadius: 10, padding: 15, background: "#181f3a" }}><strong>{league.name}</strong><p style={{ minHeight: 36, color: "#aeb7dc", fontSize: 13 }}>{league.description || league.season_label || "Open league"}</p><button disabled={busy} onClick={() => joinPublicLeague(league)} style={{ cursor: "pointer", border: 0, borderRadius: 7, background: "#4fd1c5", color: "#081615", fontWeight: 800, padding: "8px 10px" }}>Join league</button></article>)}
        </div>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)", gap: 24, alignItems: "start" }}>
        <section style={{ padding: 22, border: "1px solid #2a3157", borderRadius: 14, background: "#11162b" }}>
          <h2 style={{ marginTop: 0 }}>Your leagues</h2>
          {loading && <p style={{ color: "#b8c0e6" }}>Loading leagues…</p>}
          {!loading && leagues.length === 0 && <p style={{ color: "#b8c0e6" }}>No leagues yet. Create your first one to begin.</p>}
          <div style={{ display: "grid", gap: 10 }}>
            {leagues.map(({ league, role }) => (
              <button key={league.id} onClick={() => onOpenLeague({ ...league, role })} style={{ textAlign: "left", cursor: "pointer", color: "#fff", background: "#181f3a", border: "1px solid #34406a", borderRadius: 10, padding: 15 }}>
                <strong>{league.name}</strong><br />
                <span style={{ color: "#aeb7dc", fontSize: 13 }}>{league.season_label || "New season"} · {role.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        </section>
        <section style={{ padding: 22, border: "1px solid #2a3157", borderRadius: 14, background: "#11162b" }}>
          <h2 style={{ marginTop: 0 }}>Create a league</h2>
          <p style={{ color: "#aeb7dc", fontSize: 13, lineHeight: 1.4 }}>Starting a league? You will be its commissioner and can configure it your way.</p>
          <form onSubmit={createLeague} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>League name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} style={field} placeholder="Kanto Cup" /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Season label <input value={season} onChange={(e) => setSeason(e.target.value)} style={field} placeholder="Season 1" /></label>
            {message && <p style={{ margin: 0, color: "#ffd66b", fontSize: 13 }}>{message}</p>}
            <button disabled={busy} style={{ cursor: busy ? "wait" : "pointer", border: 0, borderRadius: 8, background: "#ffd23f", color: "#161207", fontWeight: 800, padding: 12 }}>{busy ? "Creating…" : "Create league"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
