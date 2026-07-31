"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function SiteQuickLinks() {
  const [signedIn, setSignedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    async function updateSession(session) { setSignedIn(Boolean(session)); setIsOwner(false); if (!session) return; const response = await fetch("/api/operations/access", { headers: { Authorization: `Bearer ${session.access_token}` } }); setIsOwner(response.ok); }
    supabase.auth.getSession().then(({ data }) => updateSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => updateSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  }
  return <nav className="site-quick-links" aria-label="Account and resources">{isOwner && <><a href="/operations">Operations</a><a href="/operations/daily-three">Daily Three</a></>}<a href="/my-teams">My Teams</a><a href="/manuals">Help</a><a href="/resources">Resources</a><a href="/support">Support</a>{signedIn && <button type="button" onClick={signOut}>Sign out</button>}</nav>;
}
