import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import {
  evaluateMegaBracket,
  MEGA_BRACKET_CATALOG_HASH,
  MEGA_BRACKET_ENTRANT_COUNT,
  MEGA_BRACKET_TOP_64_CHOICE,
  MEGA_BRACKET_TOTAL_CHOICES,
  top64BracketFromRounds,
} from "../src/lib/megaBracket.js";
import {
  downloadMegaBracketCanvas,
  renderMegaBracketCanvas,
  renderMegaChampionCanvas,
} from "../src/lib/megaBracketImage.js";

const entrants = Array.from({ length: MEGA_BRACKET_ENTRANT_COUNT }, (_, index) => `Pokémon ${index + 1}`);

test("the frozen Full Dex catalogue matches the server hash contract", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/draft-lab-catalog.json", import.meta.url), "utf8"));
  const names = catalog.pokemon.map((pokemon) => pokemon.name);
  assert.equal(names.length, MEGA_BRACKET_ENTRANT_COUNT);
  assert.equal(new Set(names).size, MEGA_BRACKET_ENTRANT_COUNT);
  assert.deepEqual(names, [...names].sort((left, right) => left.localeCompare(right)));
  assert.equal(crypto.createHash("sha256").update(names.join("\n")).digest("hex"), MEGA_BRACKET_CATALOG_HASH);
});

function chooseLeftThrough(count = MEGA_BRACKET_TOTAL_CHOICES) {
  const winners = [];
  while (winners.length < count) {
    const progress = evaluateMegaBracket(entrants, winners);
    winners.push(progress.nextMatch.left);
  }
  return winners;
}

test("the Full Dex challenge starts with 138 play-ins and always needs 1,161 choices", () => {
  const progress = evaluateMegaBracket(entrants, []);
  assert.equal(progress.totalChoices, 1161);
  assert.equal(progress.roundLabel, "Play-in round");
  assert.equal(progress.matchCount, 138);
  assert.deepEqual(progress.nextMatch, { left: "Pokémon 1", right: "Pokémon 2" });

  const afterPlayIns = evaluateMegaBracket(entrants, chooseLeftThrough(138));
  assert.equal(afterPlayIns.roundLabel, "Round of 1,024");
  assert.equal(afterPlayIns.survivors, 1024);
});

test("choice 1,098 reveals a stable four-region Top 64", () => {
  const progress = evaluateMegaBracket(entrants, chooseLeftThrough(MEGA_BRACKET_TOP_64_CHOICE));
  assert.equal(progress.phase, "top_64");
  assert.equal(progress.top64.length, 64);
  assert.equal(progress.roundLabel, "Round of 64");
  const bracket = top64BracketFromRounds(progress.rounds);
  assert.equal(bracket.regions.length, 4);
  assert.ok(bracket.regions.every((region) => region.entrants.length === 16));
});

test("a completed bracket produces one champion and Final Four", () => {
  const progress = evaluateMegaBracket(entrants, chooseLeftThrough());
  assert.equal(progress.complete, true);
  assert.equal(progress.choicesCompleted, MEGA_BRACKET_TOTAL_CHOICES);
  assert.equal(progress.finalFour.length, 4);
  assert.equal(progress.champion, progress.top64[0]);
});

test("the Top 64 and champion exports render at their promised resolutions", () => {
  const clickedDownloads = [];
  const context = {
    beginPath() {},
    roundRect() {},
    fill() {},
    stroke() {},
    fillRect() {},
    fillText() {},
    measureText(value) { return { width: String(value).length * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => context,
          toDataURL: () => "data:image/png;base64,preview",
        };
      }
      if (tagName === "a") {
        return {
          download: "",
          href: "",
          click() { clickedDownloads.push({ download: this.download, href: this.href }); },
        };
      }
      throw new Error(`Unexpected element: ${tagName}`);
    },
  };

  try {
    const attempt = { entrants, winners: chooseLeftThrough() };
    const bracketCanvas = renderMegaBracketCanvas(attempt);
    const championCanvas = renderMegaChampionCanvas(attempt);
    assert.deepEqual([bracketCanvas.width, bracketCanvas.height], [3200, 2050]);
    assert.deepEqual([championCanvas.width, championCanvas.height], [1080, 1350]);
    downloadMegaBracketCanvas(championCanvas, "mega-bracket-champion.png");
    assert.deepEqual(clickedDownloads, [{
      download: "mega-bracket-champion.png",
      href: "data:image/png;base64,preview",
    }]);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("a winner outside its current matchup is rejected", () => {
  assert.throws(() => evaluateMegaBracket(entrants, ["Pokémon 3"]), /does not belong/);
});

test("the migration keeps attempts private and validates the frozen catalogue", () => {
  const sql = fs.readFileSync(new URL("../supabase/389-full-dex-mega-brackets.sql", import.meta.url), "utf8");
  const previewRegression = fs.readFileSync(new URL("../supabase/tests/389-full-dex-mega-bracket-preview-regression.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.mega_bracket_attempts from public, anon, authenticated/);
  assert.match(sql, /acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36/);
  assert.match(sql, /p_expected_revision/);
  assert.match(sql, /That Mega Bracket changed in another session/);
  assert.match(sql, /on conflict \(user_id\) where status = 'active' do nothing/);
  assert.match(sql, /jsonb_array_length\(p_catalog\) <> 1162/);
  assert.match(sql, /cardinality\(v_winners\) > 1161/);
  assert.match(sql, /grant execute on function public\.create_mega_bracket_attempt/);
  assert.match(previewRegression, /v_stale_revision_denied/);
  assert.match(previewRegression, /jsonb_array_length\(v_payload -> 'top_64'\) <> 64/);
  assert.match(previewRegression, /v_cross_user_denied/);
});

test("Mega Bracket is an indexable product with honest catalogue and saving copy", () => {
  const page = fs.readFileSync(new URL("../src/app/tools/mega-bracket/page.js", import.meta.url), "utf8");
  const component = fs.readFileSync(new URL("../src/components/MegaBracket.jsx", import.meta.url), "utf8");
  const sitemap = fs.readFileSync(new URL("../src/app/sitemap.js", import.meta.url), "utf8");
  const llms = fs.readFileSync(new URL("../src/app/llms.txt/route.js", import.meta.url), "utf8");
  assert.match(page, /canonical: "\/tools\/mega-bracket"/);
  assert.match(page, /"@type": "WebApplication"/);
  assert.match(component, /1,162 Pokémon and forms/);
  assert.match(component, /Purely cosmetic appearances are not treated as separate competitors/);
  assert.match(component, /unlimited attempts/);
  assert.doesNotMatch(component, /session goal/i);
  assert.match(component, /savedKey: winnersKey\(payload\.winners\)/);
  assert.match(component, /winnersKey\(snapshot\) === saveRef\.current\.savedKey/);
  assert.match(sitemap, /\["\/tools\/mega-bracket", "weekly", 0\.9\]/);
  assert.match(llms, /Mega Bracket Full Dex Challenge/);
});
