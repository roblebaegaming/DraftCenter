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

function classedNavState(pathname, href, className) {
  const state = navState(pathname, href);
  return { ...state, className: `${className}${state.className ? ` ${state.className}` : ""}` };
}

function anyCurrentPage(pathname, hrefs) {
  return hrefs.some((href) => currentPage(pathname, href));
}

function NavigationMenu({ active, children, className = "", label }) {
  return <details className={`site-nav-menu${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}>
    <summary>{label}</summary>
    <div>{children}</div>
  </details>;
}

export default function SiteQuickLinks() {
  const pathname = usePathname();
  const { accountName, isOwner, signedIn, signOut: signOutAccount } = usePlatformAccount();
  const product = productForPathname(pathname);
  const worldsActive = currentPage(pathname, "/worlds/2026") || /^\/(it|es|de|ja|ko)\/worlds\/2026(?:\/|$)/.test(pathname);
  const gamesActive = worldsActive || anyCurrentPage(pathname, ["/resources/daily-games", "/tournaments", "/nuzlocke", "/tools/mega-bracket"]);
  const toolsActive = anyCurrentPage(pathname, ["/team-lab", "/tools/bracket-builder", "/calendar", "/trainer-dex", "/pokedex-tracker", "/operations"]);

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
          <a href="/?view=dashboard" aria-label="DraftCenter Home" {...classedNavState(pathname, "/", "site-mobile-only")}><span>Home</span></a>
          <a href="/leagues" aria-label="Draft Leagues" {...navState(pathname, "/leagues")}><span className="site-nav-label-wide">Draft Leagues</span><span className="site-nav-label-compact" aria-hidden="true">Leagues</span></a>
          <NavigationMenu active={gamesActive} label="Games">
            <a className={worldsActive ? "is-active" : ""} href="/worlds/2026">🌎 Worlds Predictions</a>
            <a href="/tournaments" {...navState(pathname, "/tournaments")}>Tournaments</a>
            <a href="/resources/daily-games" {...navState(pathname, "/resources/daily-games")}>Daily Games</a>
            <a href="/nuzlocke" {...navState(pathname, "/nuzlocke")}>Nuzlockes</a>
            <a href="/tools/mega-bracket" {...navState(pathname, "/tools/mega-bracket")}>Mega Bracket</a>
          </NavigationMenu>
          <NavigationMenu active={toolsActive} label="Tools">
            <a href="/team-lab" {...navState(pathname, "/team-lab")}>Team Lab</a>
            <a href="/team-lab/teams" {...navState(pathname, "/team-lab/teams")}>My Teams</a>
            <a href="/tools/bracket-builder" {...navState(pathname, "/tools/bracket-builder")}>Bracket Studio</a>
            <a href="/calendar" {...navState(pathname, "/calendar")}>Calendar</a>
            {signedIn && <a href="/trainer-dex" {...navState(pathname, "/trainer-dex")}>Trainer Dex</a>}
            {signedIn && <a href="/pokedex-tracker" {...navState(pathname, "/pokedex-tracker")}>Dex Tracker</a>}
            {isOwner && <a href="/operations" {...navState(pathname, "/operations")}>Operations</a>}
          </NavigationMenu>
          <a href="/pokemon" aria-label="Pokémon" {...classedNavState(pathname, "/pokemon", "site-desktop-only")}>Pokémon</a>
          <a href="/explore" aria-label="Community" {...classedNavState(pathname, "/explore", "site-desktop-only")}>Community</a>
          <NavigationMenu active={anyCurrentPage(pathname, ["/pokemon", "/explore", "/organizations", "/manuals"])} className="site-mobile-only" label="More">
            <a href="/pokemon" {...navState(pathname, "/pokemon")}>Pokémon</a>
            <a href="/explore" {...navState(pathname, "/explore")}>Community</a>
            <a href="/organizations" {...navState(pathname, "/organizations")}>Organizations</a>
            <a href="/manuals" {...navState(pathname, "/manuals")}>Help</a>
          </NavigationMenu>
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
  </>;
}
