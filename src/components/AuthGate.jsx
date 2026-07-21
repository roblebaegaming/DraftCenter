"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import LeagueHub from "./LeagueHub";
import PokemonDraftLeague from "./PokemonDraftLeague";

const panelStyle = {
  width: "min(430px, calc(100vw - 32px))",
  padding: 28,
  borderRadius: 16,
  border: "1px solid #2a3157",
  background: "#11162b",
  boxShadow: "0 20px 70px rgba(0, 0, 0, .38)",
};

export default function AuthGate() {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeLeague, setActiveLeague] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = mode === "sign_up"
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "sign_up" && !result.data.session) {
      setMessage("Check your email to confirm your account, then return here and sign in.");
    }
  }

  if (session === undefined) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading DraftCenter…</main>;
  }

  if (session) {
    if (!activeLeague) {
      return (
        <>
          <div style={{ position: "fixed", zIndex: 50, right: 14, top: 12, display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <span style={{ color: "#b8c0e6" }}>{session.user.email}</span>
            <button onClick={() => supabase.auth.signOut()} style={{ cursor: "pointer", border: "1px solid #4b557c", borderRadius: 7, background: "#171d36", color: "#fff", padding: "6px 9px" }}>Sign out</button>
          </div>
          <LeagueHub user={session.user} onOpenLeague={setActiveLeague} />
        </>
      );
    }
    return (
      <>
        <div style={{ position: "fixed", zIndex: 50, right: 14, top: 12, display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <button onClick={() => setActiveLeague(null)} style={{ cursor: "pointer", border: "1px solid #4b557c", borderRadius: 7, background: "#171d36", color: "#fff", padding: "6px 9px" }}>My Leagues</button>
          <span style={{ color: "#b8c0e6" }}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ cursor: "pointer", border: "1px solid #4b557c", borderRadius: 7, background: "#171d36", color: "#fff", padding: "6px 9px" }}>Sign out</button>
        </div>
        <PokemonDraftLeague leagueId={activeLeague.id} />
      </>
    );
  }

  const signingUp = mode === "sign_up";
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "radial-gradient(circle at top, #1d2857, #080b18 55%)" }}>
      <section style={panelStyle}>
        <div style={{ color: "#ffd23f", fontSize: 13, fontWeight: 800, letterSpacing: 1.5 }}>DRAFTCENTER</div>
        <h1 style={{ margin: "10px 0 6px", fontSize: 27 }}>{signingUp ? "Create your account" : "Welcome back"}</h1>
        <p style={{ margin: "0 0 22px", color: "#aeb7dc", lineHeight: 1.45 }}>Sign in to create, join, and manage Pokémon Draft Leagues.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 13 }}>
          <label style={{ display: "grid", gap: 6, color: "#dce3ff", fontSize: 13 }}>Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" style={{ padding: 11, borderRadius: 8, border: "1px solid #46517c", background: "#080c1c", color: "#fff" }} />
          </label>
          <label style={{ display: "grid", gap: 6, color: "#dce3ff", fontSize: 13 }}>Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} autoComplete={signingUp ? "new-password" : "current-password"} style={{ padding: 11, borderRadius: 8, border: "1px solid #46517c", background: "#080c1c", color: "#fff" }} />
          </label>
          {message && <p style={{ margin: 0, color: "#ffd66b", fontSize: 13 }}>{message}</p>}
          <button disabled={busy} style={{ cursor: busy ? "wait" : "pointer", border: 0, borderRadius: 8, background: "#ffd23f", color: "#161207", fontWeight: 800, padding: 12 }}>
            {busy ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <button onClick={() => { setMode(signingUp ? "sign_in" : "sign_up"); setMessage(""); }} style={{ marginTop: 16, cursor: "pointer", background: "none", border: 0, color: "#82aaff", padding: 0 }}>
          {signingUp ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </section>
    </main>
  );
}
