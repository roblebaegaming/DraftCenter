"use client";

import { usePathname } from "next/navigation";
import { productForPathname } from "../platform/products";
import { usePlatformAccount } from "../platform/usePlatformAccount";
import ProductAppNavigation from "./ProductAppNavigation";

function currentPage(pathname, href) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function navState(pathname, href) {
  return currentPage(pathname, href) ? { className: "is-active", "aria-current": "page" } : {};
}

export default function SiteQuickLinks() {
  const pathname = usePathname();
  const { accountName, isOwner, signedIn, signOut: signOutAccount } = usePlatformAccount();
  const product = productForPathname(pathname);

  async function signOut() {
    await signOutAccount();
    window.location.assign("/");
  }

  function openProfile(event) {
    if (window.location.pathname !== "/") return;
    event.preventDefault();
    window.dispatchEvent(new Event("draftcenter:open-profile"));
  }

  async function signOutOfProduct() {
    await signOutAccount();
    window.location.assign(product?.homePath || "/");
  }

  if (product) {
    return <ProductAppNavigation accountName={accountName} isOwner={isOwner} onSignOut={signOutOfProduct} pathname={pathname} product={product} signedIn={signedIn} />;
  }

  return <>
    <header className="site-global-header">
      <div className="site-global-header-inner">
        <a className={`site-brand-link site-draft-home${pathname === "/" ? " is-active" : ""}`} href="/?view=dashboard" aria-label="DraftCenter Home" aria-current={pathname === "/" ? "page" : undefined}>
          <img src="/draftcenter-logo.png" alt="" />
          <span className="draft-home-label-wide">DraftCenter Home</span>
          <span className="draft-home-label-compact" aria-hidden="true">Home</span>
        </a>
        <nav className="site-primary-links" aria-label="Primary navigation">
          <a href="/tools/mega-bracket" {...navState(pathname, "/tools/mega-bracket")}>Mega Bracket</a>
          <a href="/pokemon" {...navState(pathname, "/pokemon")}>Pokémon</a>
          <a href="/explore" {...navState(pathname, "/explore")}>Community</a>
          <a href="/tournaments/predictions" {...navState(pathname, "/tournaments/predictions")}>Predictions</a>
        </nav>
        <div className="site-global-account">
          {signedIn ? <>
            {isOwner ? <details className="site-owner-menu">
              <summary>{accountName}</summary>
              <div><a href="/operations/predictions">Publish predictions</a></div>
              <div><a href="/operations/daily-three">Daily Games</a></div>
            </details> : <span className="site-account-name">{accountName}</span>}
            <a href="/?profile=open" onClick={openProfile}>Profile</a>
            <button type="button" onClick={signOut}>Sign out</button>
          </> : <a href="/#member-access">Sign in</a>}
        </div>
      </div>
    </header>
    <nav className={`site-quick-links${signedIn ? " has-tracker-link" : ""}${isOwner ? " has-owner-link" : ""}`} aria-label="Tools and resources">
      <a href="/resources/daily-games" aria-label="Daily Games" {...navState(pathname, "/resources/daily-games")}><span className="quick-label-wide">Daily Games</span><span className="quick-label-compact">Daily</span></a>
      <a href="/team-lab" aria-label="Team Lab" {...navState(pathname, "/team-lab")}><span className="quick-label-wide">Team Lab</span><span className="quick-label-compact">Lab</span></a>
      <a href="/nuzlocke" aria-label="Nuzlockes" {...navState(pathname, "/nuzlocke")}><span className="quick-label-wide">Nuzlockes</span><span className="quick-label-compact">Nuz</span></a>
      <a href="/tournaments" aria-label="Tournaments" {...navState(pathname, "/tournaments")}><span className="quick-label-wide">Tournaments</span><span className="quick-label-compact">Cups</span></a>
      <a href="/calendar" aria-label="Calendar" {...navState(pathname, "/calendar")}><span className="quick-label-wide">Calendar</span><span className="quick-label-compact">Cal</span></a>
      {signedIn && <a href="/trainer-dex" aria-label="Trainer Dex" {...navState(pathname, "/trainer-dex")}><span className="quick-label-wide">Trainer Dex</span><span className="quick-label-compact">Dex</span></a>}
      {signedIn && <a href="/pokedex-tracker" aria-label="Pokédex Tracker" {...navState(pathname, "/pokedex-tracker")}><span className="quick-label-wide">Dex Tracker</span><span className="quick-label-compact">Track</span></a>}
      {isOwner && <a href="/operations" aria-label="Operations" {...navState(pathname, "/operations")}><span className="quick-label-wide">Operations</span><span className="quick-label-compact">Ops</span></a>}
      <a href="/team-lab/teams" aria-label="My Teams" {...navState(pathname, "/team-lab/teams")}><span className="quick-label-wide">My Teams</span><span className="quick-label-compact">Teams</span></a>
      {!signedIn && <a href="/manuals" aria-label="Help" {...navState(pathname, "/manuals")}><span className="quick-label-wide">Help</span><span className="quick-label-compact">Help</span></a>}
    </nav>
  </>;
}
