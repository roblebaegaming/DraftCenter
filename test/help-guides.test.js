import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("commissioners get a prominent Help path beside Commissioner Tools", () => {
  const league = source("src/components/PokemonDraftLeague.jsx");
  assert.match(league, /href="\/manuals\/commissioner"/);
  assert.match(league, />\s*HELP\s*</);
  assert.match(league, /COMMISSIONER TOOLS/);
  assert.doesNotMatch(league, /LEAGUE TOOLS/);
});

test("commissioner manual uses current product labels and explains direct support", () => {
  const content = source("src/lib/manualContent.js");
  const page = source("src/app/manuals/[role]/page.js");
  assert.doesNotMatch(content, /League Tools/);
  assert.match(content, /Commissioner Tools/);
  assert.match(content, /yellow Help button/);
  assert.match(page, /Get help with this league/);
  assert.match(page, /Create support request/);
  assert.match(page, /id="before-draft-day"/);
});

test("financial support is not mislabeled as product help", () => {
  const navigation = source("src/components/SiteQuickLinks.jsx");
  const footer = source("src/components/SiteLegalFooter.jsx");
  assert.match(navigation, /href="\/manuals"[^>]*>Help<\/a>/);
  assert.doesNotMatch(navigation, /href="\/(resources|support)"/);
  assert.match(footer, /href="\/resources">Resources/);
  assert.match(footer, /href="\/support">Support/);
  assert.doesNotMatch(footer, /href="\/(leagues|my-teams)"/);
});

test("global navigation separates account actions, tools, and reference links", () => {
  const navigation = source("src/components/SiteQuickLinks.jsx");
  const footer = source("src/components/SiteLegalFooter.jsx");
  const css = source("src/app/globals.css");
  const header = navigation.slice(navigation.indexOf('<header className="site-global-header">'), navigation.indexOf("</header>"));
  for (const label of ["Draft Leagues", "Mega Bracket", "Bracket Studio", "Pokémon", "Community", "🌎 Worlds Predictions", "Team Lab", "Profile", "Sign out"]) assert.match(header, new RegExp(`>${label}<`));
  for (const label of ["Games", "Tools"]) assert.match(header, new RegExp(`label="${label}"`));
  assert.match(header, /accountName/);
  assert.match(header, /<NavigationMenu active=\{gamesActive\} label="Games">/);
  assert.match(header, /href="\/worlds\/2026">🌎 Worlds Predictions<\/a>/);
  assert.doesNotMatch(header, /href="\/tournaments\/predictions"|>Picks</);
  assert.match(header, /signedIn && <a href="\/trainer-dex"/);
  assert.match(header, /isOwner && <a href="\/operations"/);
  assert.match(header, /href="\/operations\/predictions">Publish predictions/);
  assert.match(header, /className="site-mobile-only" label="More"/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /\.site-primary-links>\.site-mobile-only\s*\{\s*display:\s*none;/);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.site-global-header\s*\{\s*backdrop-filter:\s*none;/);
  assert.match(css, /\.site-primary-links>\.site-nav-menu>div\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*8px;[\s\S]*?left:\s*8px;/);
  assert.doesNotMatch(navigation, /site-quick-links/);
  for (const group of ["Explore", "DraftCenter", "Policies"]) assert.match(footer, new RegExp(`<h2>${group}</h2>`));
});
