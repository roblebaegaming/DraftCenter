import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import {
  buildMegaBracketPool,
  buildMegaBracketRecap,
  evaluateMegaBracket,
  MEGA_BRACKET_CATALOG_HASH,
  MEGA_BRACKET_ENTRANT_COUNT,
  MEGA_BRACKET_TOP_64_CHOICE,
  MEGA_BRACKET_TOTAL_CHOICES,
  megaBracketFormatLabel,
  megaBracketMilestones,
  top64BracketFromRounds,
} from "../src/lib/megaBracket.js";
import { pokemonArtworkCandidates, pokemonArtworkSlug, resolvePokemonArtwork } from "../src/lib/pokemonArtwork.js";
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

function chooseLeftFor(field, count = field.length - 1) {
  const winners = [];
  while (winners.length < count) {
    const progress = evaluateMegaBracket(field, winners);
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
  assert.ok(bracket.regions.every((region) => region.rounds.map((round) => round.matches.length).join(",") === "8,0,0,0"));
});

test("a completed bracket produces one champion and Final Four", () => {
  const progress = evaluateMegaBracket(entrants, chooseLeftThrough());
  assert.equal(progress.complete, true);
  assert.equal(progress.choicesCompleted, MEGA_BRACKET_TOTAL_CHOICES);
  assert.equal(progress.finalFour.length, 4);
  assert.equal(progress.champion, progress.top64[0]);
  const bracket = top64BracketFromRounds(progress.rounds);
  assert.deepEqual(bracket.regions[0].rounds.map((round) => round.matches.length), [8, 4, 2, 1]);
  assert.equal(bracket.finalFourMatches.length, 2);
  assert.equal(bracket.championshipMatch.winner, progress.champion);
});

test("type, generation, and Mega Evolution fields keep the frozen catalogue order", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/draft-lab-catalog.json", import.meta.url), "utf8")).pokemon;
  assert.equal(buildMegaBracketPool(catalog, { scope: "type", filter: "water" }).length, 168);
  assert.equal(buildMegaBracketPool(catalog, { scope: "type", filter: "ice" }).length, 59);
  assert.equal(buildMegaBracketPool(catalog, { scope: "generation", filter: "5" }).length, 157);
  assert.equal(buildMegaBracketPool(catalog, { scope: "mega" }).length, 75);
  assert.equal(megaBracketFormatLabel({ bracket_scope: "type", bracket_filter: "water" }), "Water-type");
  assert.equal(megaBracketFormatLabel({ bracket_scope: "generation", bracket_filter: "5" }), "Generation 5");
  assert.equal(megaBracketFormatLabel({ bracket_scope: "mega" }), "Mega Evolutions");
});

test("every themed server pool hash matches the exact ordered client field", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/draft-lab-catalog.json", import.meta.url), "utf8")).pokemon;
  const sql = fs.readFileSync(new URL("../supabase/407-mega-bracket-variety.sql", import.meta.url), "utf8");
  const cases = [
    ["mega", null],
    ...["bug", "dark", "dragon", "electric", "fairy", "fighting", "fire", "flying", "ghost", "grass", "ground", "ice", "normal", "poison", "psychic", "rock", "steel", "water"].map((type) => ["type", type]),
    ...Array.from({ length: 9 }, (_, index) => ["generation", String(index + 1)]),
  ];
  for (const [scope, filter] of cases) {
    const pool = buildMegaBracketPool(catalog, { scope, filter });
    const hash = crypto.createHash("sha256").update(pool.map((entry) => entry.name).join("\n")).digest("hex");
    assert.ok(sql.includes(`when '${scope}:${filter || ""}' then '${pool.length}:${hash}'`), `${scope}:${filter || ""} should match the migration hash`);
  }
});

test("variable fields use one elimination per entrant and still reveal a Top 64 when available", () => {
  const largeField = Array.from({ length: 98 }, (_, index) => `Fire ${index + 1}`);
  const atTop64 = evaluateMegaBracket(largeField, chooseLeftFor(largeField, 34));
  assert.equal(atTop64.totalChoices, 97);
  assert.equal(atTop64.choicesCompleted, 34);
  assert.equal(atTop64.phase, "top_64");
  assert.equal(atTop64.top64.length, 64);
  assert.equal(top64BracketFromRounds(atTop64.rounds).regions.length, 4);

  const quickField = largeField.slice(0, 64);
  const quickStart = evaluateMegaBracket(quickField, []);
  assert.equal(quickStart.phase, "top_64");
  assert.equal(quickStart.totalChoices, 63);
  assert.equal(quickStart.top64.length, 64);
});

test("a complete 59-entry Ice bracket stays compact and still produces a Final Four recap", () => {
  const field = Array.from({ length: 59 }, (_, index) => `Ice ${index + 1}`);
  const start = evaluateMegaBracket(field, []);
  assert.equal(start.phase, "compact");
  assert.equal(start.totalChoices, 58);
  assert.equal(start.top64.length, 59);
  const complete = evaluateMegaBracket(field, chooseLeftFor(field));
  assert.equal(complete.complete, true);
  assert.equal(complete.finalFour.length, 4);
  assert.equal(top64BracketFromRounds(complete.rounds).regions.length, 0);
  assert.deepEqual(megaBracketMilestones(59).map((item) => item.survivors), [32, 16, 8, 4, 2, 1]);
});

test("completed brackets produce a private recap from the frozen catalogue", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/draft-lab-catalog.json", import.meta.url), "utf8"));
  const progress = evaluateMegaBracket(entrants, chooseLeftThrough());
  const syntheticCatalog = entrants.map((name, index) => ({ name, t1: index % 2 ? "water" : "fire", t2: null, gen: index % 9 + 1, bst: 300 + index % 400 }));
  const recap = buildMegaBracketRecap(progress, syntheticCatalog);
  assert.ok(recap.favoriteType.count > 0);
  assert.ok(recap.topGeneration.count > 0);
  assert.equal(recap.finalFour.length, 4);
  assert.equal(recap.championPath.length, 6);
  assert.ok(recap.lowestBstTop64.bst >= 300);
  assert.equal(buildMegaBracketRecap({ complete: false }, catalog.pokemon), null);
});

test("every previously missing artwork name has a reviewed PokeAPI candidate", () => {
  assert.equal(pokemonArtworkSlug("Flabébé"), "flabebe");
  const expected = new Map([
    ["Calyrex-Ice Rider", "calyrex-ice"],
    ["Calyrex-Shadow Rider", "calyrex-shadow"],
    ["Flabébé", "flabebe"],
    ["Paldean Tauros (Fire)", "tauros-paldea-blaze-breed"],
    ["Paldean Tauros (Water)", "tauros-paldea-aqua-breed"],
    ["Primal Groudon", "groudon-primal"],
    ["Primal Kyogre", "kyogre-primal"],
  ]);
  for (const [name, apiName] of expected) assert.ok(pokemonArtworkCandidates(name).includes(apiName), `${name} should try ${apiName}`);
  assert.ok(pokemonArtworkCandidates("Mega Barbaracle").includes("barbaracle"), "unavailable exact forms should fall back to base-species artwork");
});

test("generic species names fall back to the official default variety", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.endsWith("/pokemon/deoxys")) return { ok: false };
    if (value.endsWith("/pokemon-species/deoxys")) {
      return { ok: true, json: async () => ({ varieties: [{ is_default: true, pokemon: { name: "deoxys-normal" } }] }) };
    }
    if (value.endsWith("/pokemon/deoxys-normal")) {
      return { ok: true, json: async () => ({ sprites: { other: { home: { front_default: "https://example.test/deoxys.png" } } } }) };
    }
    throw new Error(`Unexpected artwork request: ${value}`);
  };
  try {
    assert.deepEqual(await resolvePokemonArtwork("Deoxys"), {
      url: "https://example.test/deoxys.png",
      apiName: "deoxys-normal",
      isFallback: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the Top 64 and champion exports render at their promised resolutions", async () => {
  const clickedDownloads = [];
  let artworkDraws = 0;
  const context = {
    beginPath() {},
    roundRect() {},
    fill() {},
    stroke() {},
    fillRect() {},
    fillText() {},
    drawImage() { artworkDraws += 1; },
    measureText(value) { return { width: String(value).length * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  const originalWindow = globalThis.window;
  globalThis.window = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  globalThis.Image = class MockImage {
    constructor() { this.naturalWidth = 200; this.naturalHeight = 200; }
    set src(_value) { queueMicrotask(() => this.onload?.()); }
  };
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
    const artwork = async () => "https://example.test/pokemon.png";
    const bracketCanvas = await renderMegaBracketCanvas(attempt, artwork);
    const championCanvas = await renderMegaChampionCanvas(attempt, artwork);
    assert.deepEqual([bracketCanvas.width, bracketCanvas.height], [3200, 2050]);
    assert.deepEqual([championCanvas.width, championCanvas.height], [1080, 1350]);
    downloadMegaBracketCanvas(championCanvas, "mega-bracket-champion.png");
    assert.deepEqual(clickedDownloads, [{
      download: "mega-bracket-champion.png",
      href: "data:image/png;base64,preview",
    }]);
    assert.ok(artworkDraws >= 10, "the Final Four and champion should be drawn into both exports");
  } finally {
    globalThis.document = originalDocument;
    globalThis.Image = originalImage;
    globalThis.window = originalWindow;
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

test("the variety migration preserves private RPCs and validates every themed field", () => {
  const sql = fs.readFileSync(new URL("../supabase/407-mega-bracket-variety.sql", import.meta.url), "utf8");
  const previewRegression = fs.readFileSync(new URL("../supabase/tests/407-mega-bracket-variety-preview-regression.sql", import.meta.url), "utf8");
  assert.match(sql, /bracket_scope in \('full_dex', 'type', 'generation', 'mega'\)/);
  assert.match(sql, /selection_mode in \('favorite', 'worst'\)/);
  assert.match(sql, /entry_limit is null or entry_limit = 64/);
  assert.match(sql, /jsonb_array_length\(catalog_snapshot\) between 2 and 1162/);
  assert.match(sql, /The selected Mega Bracket field changed/);
  assert.match(sql, /type:ice/);
  assert.match(sql, /grant execute on function public\.create_mega_bracket_attempt\(jsonb, text, jsonb, text, text, text, integer\) to authenticated, service_role/);
  assert.match(previewRegression, /quick_64_worst_completed/);
  assert.match(previewRegression, /compact_ice_completed/);
  assert.match(previewRegression, /cross_user_read_denied/);
});

test("Mega Bracket is an indexable product with honest catalogue and saving copy", () => {
  const page = fs.readFileSync(new URL("../src/app/tools/mega-bracket/page.js", import.meta.url), "utf8");
  const component = fs.readFileSync(new URL("../src/components/MegaBracket.jsx", import.meta.url), "utf8");
  const sitemap = fs.readFileSync(new URL("../src/app/sitemap.js", import.meta.url), "utf8");
  const llms = fs.readFileSync(new URL("../src/app/llms.txt/route.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(page, /canonical: "\/tools\/mega-bracket"/);
  assert.match(page, /"@type": "WebApplication"/);
  assert.match(component, /Full Dex, type, generation, or Mega Evolution bracket/);
  assert.match(component, /Purely cosmetic appearances are not treated as separate competitors/);
  assert.match(component, /unlimited attempts/);
  assert.doesNotMatch(component, /session goal/i);
  assert.match(component, /savedKey: winnersKey\(payload\.winners\)/);
  assert.match(component, /winnersKey\(snapshot\) === saveRef\.current\.savedKey/);
  assert.match(component, /Pick \{selectionMode === "worst" \? "the worse Pokémon" : "who advances"\} directly in the live bracket/);
  assert.match(component, /Pick the worst/);
  assert.match(component, /Quick 64/);
  assert.match(component, /mega-milestone-dialog/);
  assert.match(component, /Your bracket by the numbers/);
  assert.match(component, /Final Four artwork/);
  assert.match(css, /@media\(max-width:420px\) \{ \.mega-recap-grid \{ grid-template-columns: 1fr; \} \}/);
  assert.match(sitemap, /\["\/tools\/mega-bracket", "weekly", 0\.9\]/);
  assert.match(llms, /Replayable Pokémon Mega Brackets/);
});
