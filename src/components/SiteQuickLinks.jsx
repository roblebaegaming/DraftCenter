"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function SiteQuickLinks() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, []);
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  }
  return <nav className="site-quick-links" aria-label="Account and resources"><a href="/my-teams">My Teams</a><a href="/resources">Resources</a><a href="/support">Support</a>{signedIn && <button type="button" onClick={signOut}>Sign out</button>}</nav>;
}
