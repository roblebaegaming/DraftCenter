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

const inputStyle = {
  padding: 11,
  borderRadius: 8,
  border: "1px solid #46517c",
  background: "#080c1c",
  color: "#fff",
};

export default function AuthGate() {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeLeague, setActiveLeague] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setMode("reset_password");
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    if (mode === "forgot_password") {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setBusy(false);
      setMessage(result.error ? result.error.message : "If that email has an account, a password-reset link is on its way. Check your inbox and spam folder.");
      return;
    }

    if (mode === "reset_password") {
      if (password !== confirmPassword) {
        setBusy(false);
        setMessage("The two passwords do not match.");
        return;
      }
      const result = await supabase.auth.updateUser({ password });
      setBusy(false);
      setMessage(result.error ? result.error.message : "Password updated. You are now signed in.");
      return;
    }

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
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading DraftCenter...</main>;
  }

  if (session && mode !== "reset_password") {
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
  const recovering = mode === "forgot_password";
  const resetting = mode === "reset_password";
  const title = resetting ? "Choose a new password" : recovering ? "Reset your password" : signingUp ? "Create your account" : "Welcome back";
  const description = resetting
    ? "Enter and confirm a new password for your DraftCenter account."
    : recovering
      ? "Enter your email and we will send a password-reset link."
      : "Sign in to create, join, and manage Pokemon Draft Leagues.";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "radial-gradient(circle at top, #1d2857, #080b18 55%)" }}>
      <section style={panelStyle}>
        <div style={{ color: "#ffd23f", fontSize: 13, fontWeight: 800, letterSpacing: 1.5 }}>DRAFTCENTER</div>
        <h1 style={{ margin: "10px 0 6px", fontSize: 27 }}>{title}</h1>
        <p style={{ margin: "0 0 22px", color: "#aeb7dc", lineHeight: 1.45 }}>{description}</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 13 }}>
          {!resetting && <label style={{ display: "grid", gap: 6, color: "#dce3ff", fontSize: 13 }}>Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" style={inputStyle} />
          </label>}
          {!recovering && <label style={{ display: "grid", gap: 6, color: "#dce3ff", fontSize: 13 }}>{resetting ? "New password" : "Password"}
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} autoComplete={signingUp || resetting ? "new-password" : "current-password"} style={inputStyle} />
          </label>}
          {resetting && <label style={{ display: "grid", gap: 6, color: "#dce3ff", fontSize: 13 }}>Confirm new password
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required minLength={6} autoComplete="new-password" style={inputStyle} />
          </label>}
          {message && <p style={{ margin: 0, color: "#ffd66b", fontSize: 13 }}>{message}</p>}
          <button disabled={busy} style={{ cursor: busy ? "wait" : "pointer", border: 0, borderRadius: 8, background: "#ffd23f", color: "#161207", fontWeight: 800, padding: 12 }}>
            {busy ? "Please wait..." : resetting ? "Update password" : recovering ? "Email reset link" : signingUp ? "Create account" : "Sign in"}
          </button>
        </form>
        {recovering ? (
          <button onClick={() => changeMode("sign_in")} style={{ marginTop: 16, cursor: "pointer", background: "none", border: 0, color: "#82aaff", padding: 0 }}>Back to sign in</button>
        ) : !resetting && (
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {!signingUp && <button onClick={() => changeMode("forgot_password")} style={{ cursor: "pointer", background: "none", border: 0, color: "#82aaff", padding: 0, textAlign: "left" }}>Forgot password?</button>}
            <button onClick={() => changeMode(signingUp ? "sign_in" : "sign_up")} style={{ cursor: "pointer", background: "none", border: 0, color: "#82aaff", padding: 0, textAlign: "left" }}>
              {signingUp ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
