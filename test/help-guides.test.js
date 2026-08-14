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
  assert.match(navigation, /href="\/manuals"[^>]*>[\s\S]*?quick-label-wide">Help/);
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
  const quickLinks = navigation.slice(navigation.indexOf('<nav className={`site-quick-links'));

  for (const label of ["Mega Bracket", "Pokémon", "Community", "Worlds Predictions", "Profile", "Sign out"]) assert.match(header, new RegExp(`>${label}<`));
  assert.doesNotMatch(header, />Team Lab</);
  assert.match(header, /accountName/);
  assert.match(header, /href="\/worlds\/2026"/);
  assert.match(quickLinks, /href="\/tools\/team-builder"[^>]*>[\s\S]*?quick-label-wide">Team Lab<\/span>/);
  assert.doesNotMatch(quickLinks, /href="\/worlds\/2026"/);
  assert.doesNotMatch(quickLinks, /Sign out/);
  assert.match(quickLinks, /signedIn && <a href="\/trainer-dex"/);
  assert.match(quickLinks, /isOwner && <a href="\/operations"/);
  assert.match(quickLinks, /!signedIn && <a href="\/manuals"/);
  assert.match(css, /grid-template-columns:\s*repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css, /\.site-primary-links\s*\{[^}]*grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.site-quick-links\.has-owner-link\s*\{\s*grid-template-columns:\s*repeat\(8,minmax\(0,1fr\)\)/);
  for (const group of ["Explore", "DraftCenter", "Policies"]) assert.match(footer, new RegExp(`<h2>${group}</h2>`));
});
