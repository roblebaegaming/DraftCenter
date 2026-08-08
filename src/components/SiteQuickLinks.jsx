"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../lib/supabase/client";

function currentPage(pathname, href) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function navState(pathname, href) {
  return currentPage(pathname, href) ? { className: "is-active", "aria-current": "page" } : {};
}

export default function SiteQuickLinks() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let requestVersion = 0;

    async function updateSession(session) {
      if (!active) return;
      const version = ++requestVersion;
      if (!session) {
        setSignedIn(false);
        setIsOwner(false);
        setUsername("");
        return;
      }

      setSignedIn(true);
      const [profileResult, accessResponse] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle(),
        fetch("/api/operations/access", { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null),
      ]);
      if (!active || version !== requestVersion) return;
      setUsername(profileResult.data?.username || "");
      setIsOwner(Boolean(accessResponse?.ok));
    }

    supabase.auth.getSession().then(({ data }) => updateSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => updateSession(session));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  function openProfile(event) {
    if (window.location.pathname !== "/") return;
    event.preventDefault();
    window.dispatchEvent(new Event("draftcenter:open-profile"));
  }

  const accountName = username ? `@${username}` : "Account";

  return <>
    <header className="site-global-header">
      <div className="site-global-header-inner">
        <a className="site-brand-link" href="/" aria-label="DraftCenter home">
          <img src="/draftcenter-logo.png" alt="" />
          <span>DraftCenter</span>
        </a>
        <nav className="site-primary-links" aria-label="Primary navigation">
          <a href="/pokemon" {...navState(pathname, "/pokemon")}>Pokémon</a>
          <a href="/explore" {...navState(pathname, "/explore")}>Community</a>
        </nav>
        <div className="site-global-account">
          {signedIn ? <>
            {isOwner ? <details className="site-owner-menu">
              <summary>{accountName}</summary>
              <div><a href="/operations/daily-three">Daily Three</a></div>
            </details> : <span className="site-account-name">{accountName}</span>}
            <a href="/?profile=open" onClick={openProfile}>Profile</a>
            <button type="button" onClick={signOut}>Sign out</button>
          </> : <a href="/#member-access">Sign in</a>}
        </div>
      </div>
    </header>
    <nav className={`site-quick-links${isOwner ? " has-owner-link" : ""}`} aria-label="Tools and resources">
      <a href="/resources/daily-games" aria-label="Daily Games" {...navState(pathname, "/resources/daily-games")}><span className="quick-label-wide">Daily Games</span><span className="quick-label-compact">Daily</span></a>
      <a href="/nuzlocke" aria-label="Nuzlockes" {...navState(pathname, "/nuzlocke")}><span className="quick-label-wide">Nuzlockes</span><span className="quick-label-compact">Nuzlocke</span></a>
      <a href="/tournaments" aria-label="Tournaments" {...navState(pathname, "/tournaments")}><span className="quick-label-wide">Tournaments</span><span className="quick-label-compact">Events</span></a>
      {signedIn && <a href="/trainer-dex" aria-label="Trainer Dex" {...navState(pathname, "/trainer-dex")}><span className="quick-label-wide">Trainer Dex</span><span className="quick-label-compact">Dex</span></a>}
      {isOwner && <a href="/operations" aria-label="Operations" {...navState(pathname, "/operations")}><span className="quick-label-wide">Operations</span><span className="quick-label-compact">Ops</span></a>}
      <a href="/my-teams" aria-label="My Teams" {...navState(pathname, "/my-teams")}><span className="quick-label-wide">My Teams</span><span className="quick-label-compact">Teams</span></a>
      {!signedIn && <a href="/manuals" aria-label="Help" {...navState(pathname, "/manuals")}><span className="quick-label-wide">Help</span><span className="quick-label-compact">Help</span></a>}
    </nav>
  </>;
}
