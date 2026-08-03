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
  assert.match(navigation, /href="\/manuals">Help/);
  assert.match(navigation, /href="\/support">Support DraftCenter/);
});
