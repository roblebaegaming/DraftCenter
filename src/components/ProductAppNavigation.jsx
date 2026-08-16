"use client";

import { pathMatchesPrefix } from "../platform/products";

function linkState(pathname, href) {
  if (!href.startsWith("/") || href.includes("#")) return {};
  const path = href.split(/[?#]/, 1)[0];
  return pathMatchesPrefix(pathname, path) ? { className: "is-active", "aria-current": "page" } : {};
}

export default function ProductAppNavigation({ accountName, isOwner, onSignOut, pathname, product, signedIn }) {
  return <header className={`product-app-header is-${product.id}`}>
    <div className="product-app-header-inner">
      <a className="product-app-brand" href={product.homePath} aria-label={`${product.name} home`}>
        <img src={product.icon} alt="" />
        <span><small>{product.eyebrow}</small><strong>{product.name}</strong></span>
      </a>
      <nav className="product-app-links" aria-label={`${product.name} navigation`} style={{ "--product-nav-items": product.navigation.length }}>
        {product.navigation.map((item) => <a key={item.href} href={item.href} {...linkState(pathname, item.href)}>
          <span className="product-link-wide">{item.label}</span>
          <span className="product-link-compact" aria-hidden="true">{item.compactLabel}</span>
        </a>)}
      </nav>
      <div className="product-app-account">
        <a className="product-app-switch" href="/?view=dashboard" aria-label="Switch to DraftCenter">DraftCenter</a>
        {signedIn ? <>
          <span className="product-account-name">{accountName}</span>
          <a href="/?profile=open">Profile</a>
          {isOwner && <a href="/operations">Operations</a>}
          <button type="button" onClick={onSignOut}>Sign out</button>
        </> : <a href="/#member-access">Sign in</a>}
      </div>
    </div>
  </header>;
}
