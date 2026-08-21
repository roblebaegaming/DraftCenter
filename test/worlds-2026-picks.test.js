import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildWorldsChampionOdds,
  filterWorldsCompetitors,
  formatWorldsAverageFinish,
  normalizeWorldsDisciplineScore,
  toggleWorldsPick,
  WORLDS_2026_ODDS_CAP,
  WORLDS_2026_ODDS_WEIGHTS,
  WORLDS_2026_POINTS_URL,
  WORLDS_OVERALL_POINTS_PER_DISCIPLINE,
  WORLDS_2026_PICK_COUNT,
  WORLDS_2026_SCORING,
  WORLDS_VGC_MAX_RAW_SCORE,
  worldsEntryIsLocked,
} from "../src/lib/worlds2026.js";
import {
  WORLDS_LANGUAGES,
  worldsCopy,
  worldsQualificationLabel,
  worldsRegionLabel,
  worldsServerError,
} from "../src/lib/worlds2026I18n.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const roster = JSON.parse(source("src/data/worlds-2026-vgc-masters.json"));
const normalizedRoster = roster.competitors.map((competitor) => ({
  slug: competitor.slug,
  displayName: competitor.name,
  countryCode: competitor.countryCode,
  qualificationRegion: competitor.region,
  qualificationPath: competitor.qualification,
  seasonResults: competitor.seasonResults || "",
  pickCount: 0,
  aceCount: 0,
}));

test("the Worlds pick pool is a complete, unique Masters invite snapshot", () => {
  assert.equal(roster.eventId, "2026-vgc-masters");
  assert.equal(roster.division, "Masters");
  assert.equal(roster.ageScope, "official-masters-division-not-age-verified");
  assert.equal(roster.status, "invite-earned-not-attendance-confirmed");
  assert.match(roster.sourceUrl, /^https:\/\//);
  assert.equal(roster.competitors.length, 438);
  assert.equal(new Set(roster.competitors.map(({ slug }) => slug)).size, 438);
  assert.ok(roster.competitors.every(({ division }) => division === "Masters"));
  assert.ok(roster.competitors.filter(({ seasonResults }) => seasonResults && seasonResults !== "–").length > 400);

  const regionCounts = Object.fromEntries([...new Set(roster.competitors.map(({ region }) => region))]
    .map((region) => [region, roster.competitors.filter((competitor) => competitor.region === region).length]));
  assert.deepEqual(regionCounts, {
    "North America": 98,
    Europe: 93,
    "Latin America": 68,
    Oceania: 23,
    "Middle East & South Africa": 6,
    Japan: 66,
    "South Korea": 16,
    "Asia-Pacific": 68,
  });
});

test("the scoring curve is progressive, includes Top 64, and caps at 30", () => {
  assert.deepEqual(WORLDS_2026_SCORING, [
    ["World Champion", 30],
    ["Runner-up", 20],
    ["Top 4", 12],
    ["Top 8", 7],
    ["Top 16", 4],
    ["Top 32", 2],
    ["Top 64", 1],
  ]);
});

test("overall standings give each competition an equal 100-point share", () => {
  assert.equal(WORLDS_OVERALL_POINTS_PER_DISCIPLINE, 100);
  assert.equal(WORLDS_VGC_MAX_RAW_SCORE, 140);
  assert.equal(normalizeWorldsDisciplineScore(140, WORLDS_VGC_MAX_RAW_SCORE), 100);
  assert.equal(normalizeWorldsDisciplineScore(70, WORLDS_VGC_MAX_RAW_SCORE), 50);
  assert.equal(normalizeWorldsDisciplineScore(999, WORLDS_VGC_MAX_RAW_SCORE), 100);
  assert.equal(normalizeWorldsDisciplineScore(0, WORLDS_VGC_MAX_RAW_SCORE), 0);
  assert.equal(normalizeWorldsDisciplineScore(30, 0), 0);
});

test("final average finishes use a compact, consistent leaderboard format", () => {
  assert.equal(formatWorldsAverageFinish(3.5), "3.5");
  assert.equal(formatWorldsAverageFinish("3.333"), "3.33");
  assert.equal(formatWorldsAverageFinish(10), "10.0");
  assert.equal(formatWorldsAverageFinish(null), "");
});

test("roster search handles names, accents, countries, regions, and qualification paths", () => {
  assert.ok(filterWorldsCompetitors(normalizedRoster, "alex gomez").some(({ displayName }) => displayName === "Àlex Gómez"));
  assert.ok(filterWorldsCompetitors(normalizedRoster, "regional champion").length > 20);
  assert.ok(filterWorldsCompetitors(normalizedRoster, "KOR", "South Korea").length > 0);
  assert.equal(filterWorldsCompetitors(normalizedRoster, "KOR", "Japan").length, 0);
});

test("Pick 10 selection prevents an eleventh competitor", () => {
  let picks = [];
  for (let index = 0; index < WORLDS_2026_PICK_COUNT; index += 1) {
    picks = toggleWorldsPick(picks, `player-${index}`).picks;
  }
  const full = toggleWorldsPick(picks, "player-10");
  assert.equal(full.picks.length, WORLDS_2026_PICK_COUNT);
  assert.match(full.error, /10 spots are full/);
  assert.equal(toggleWorldsPick(picks, "player-0").picks.length, 9);
});

test("entry locking respects status, open time, and the published deadline", () => {
  const event = { status: "open", opens_at: "2026-08-10T07:00:00Z", locks_at: "2026-08-28T07:00:00Z" };
  assert.equal(worldsEntryIsLocked(event, new Date("2026-08-20T12:00:00Z")), false);
  assert.equal(worldsEntryIsLocked(event, new Date("2026-08-28T07:00:00Z")), true);
  assert.equal(worldsEntryIsLocked({ ...event, status: "locked" }, new Date("2026-08-20T12:00:00Z")), true);
});

test("the pre-event champion model totals 100 percent and caps all 438 invitees at five percent", () => {
  const odds = buildWorldsChampionOdds(normalizedRoster);
  const probabilityTotal = odds.reduce((sum, competitor) => sum + competitor.probability, 0);
  assert.equal(odds.length, 438);
  assert.ok(Math.abs(probabilityTotal - 1) < 1e-10);
  assert.ok(odds.every(({ probability }) => probability <= WORLDS_2026_ODDS_CAP + Number.EPSILON));
  assert.ok(odds.find(({ slug }) => slug === "wolfe-glick").worldsTitles > 0);
  assert.ok(Math.abs(Object.values(WORLDS_2026_ODDS_WEIGHTS).reduce((sum, weight) => sum + weight, 0) - 1) < 1e-10);
});

test("the public Worlds odds card keeps the probabilities and omits methodology and player summaries", () => {
  const component = source("src/components/WorldsChampionOdds.jsx");
  assert.match(component, /Top 10 Worlds Champion Odds/);
  assert.match(component, /worlds-odds-value/);
  assert.doesNotMatch(component, /WORLDS_2026_ODDS_WEIGHTS/);
  assert.doesNotMatch(component, /worlds-odds-method/);
  assert.doesNotMatch(component, /competitor\.seasonWins|copy\.wins/);
});

test("community support changes the model only when privacy-gated aggregates are supplied", () => {
  const field = Array.from({ length: 30 }, (_, index) => ({
    slug: `competitor-${index}`,
    displayName: `Competitor ${index}`,
    qualificationPath: "Invite earned",
    seasonResults: "",
    pickCount: index === 0 ? 8 : 0,
    aceCount: index === 0 ? 4 : 0,
  }));
  const privateOdds = buildWorldsChampionOdds(field, 0);
  assert.equal(privateOdds.find(({ slug }) => slug === "competitor-0").signals.community, 0.5);
  const publicOdds = buildWorldsChampionOdds(field, 25);
  const supported = publicOdds.find(({ slug }) => slug === "competitor-0");
  const baseline = publicOdds.find(({ slug }) => slug === "competitor-1");
  assert.ok(supported.probability > baseline.probability);
  assert.ok(supported.signals.community < 1);
});

test("the database contract keeps entries private before lock and browser writes inside an authenticated RPC", () => {
  const schema = source("supabase/369-worlds-pick-sixteen.sql");
  const pickTen = source("supabase/373-worlds-pick-ten-and-champion-label.sql");
  const seed = source("supabase/370-seed-worlds-2026-vgc-masters-roster.sql");
  const preview = source("supabase/tests/369-worlds-pick-sixteen-preview-regression.sql");
  const pickTenPreview = source("supabase/tests/373-worlds-pick-ten-and-champion-preview-regression.sql");
  const finalTiebreakers = source("supabase/375-worlds-pick-ten-final-tiebreakers.sql");
  const finalTiebreakersPreview = source("supabase/tests/375-worlds-pick-ten-final-tiebreakers-preview-regression.sql");
  const popularity = source("supabase/413-worlds-champion-odds-popularity.sql");
  const popularityPreview = source("supabase/tests/413-worlds-champion-odds-popularity-preview-regression.sql");
  assert.match(schema, /alter table public\.worlds_pick_entries enable row level security/i);
  assert.match(schema, /revoke all on table public\.worlds_pick_entries from public, anon, authenticated/i);
  assert.match(schema, /create or replace function public\.save_worlds_pick_entry[\s\S]+security definer[\s\S]+set search_path = public/i);
  assert.match(schema, /ranked\.user_id = auth\.uid\(\) or now\(\) >= \(select locks_at from selected_event\)/i);
  assert.match(schema, /cardinality\(p_pick_slugs\) <> v_event\.picks_required/i);
  assert.match(schema, /division text not null check \(division = 'Masters'\)/i);
  assert.match(schema, /Only Masters Division Worlds entries are supported/i);
  assert.match(schema, /score_points between 0 and 30/i);
  assert.match(schema, /ace_slug text not null check \(ace_slug = any\(pick_slugs\)\)/i);
  assert.match(schema, /selected\.slug = entry\.ace_slug then 2 else 1/i);
  assert.match(pickTen, /lock table public\.worlds_pick_entries in access exclusive mode/i);
  assert.match(pickTen, /where event_id = '2026-vgc-masters'[\s\S]+Cannot change the 2026 VGC Masters format after an entry has been saved/i);
  assert.match(pickTen, /Expected the 2026 VGC Masters event to require 16 picks/i);
  assert.match(pickTen, /v_status <> 'open' or now\(\) >= v_locks_at/i);
  assert.match(pickTen, /display_name = '2026 VGC Worlds Pick 10'[\s\S]+picks_required = 10/i);
  assert.match(pickTen, /'maximum_raw_score', 140/i);
  assert.match(pickTen, /'selection_label', 'Your Champion'/i);
  assert.match(pickTen, /Choose Your Champion from your % selected competitors/i);
  assert.match(pickTen, /check \(cardinality\(pick_slugs\) between 1 and 64\)/i);
  assert.doesNotMatch(pickTen, /delete from public\.worlds_pick_entries/i);
  assert.match(schema, /grant execute on function public\.save_worlds_pick_entry\(text, text\[\], text\) to authenticated/i);
  assert.equal((seed.match(/\('2026-vgc-masters'/g) || []).length, 438);
  for (const [index, competitor] of roster.competitors.entries()) {
    const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const rowStart = `('2026-vgc-masters', ${sql(competitor.slug)}, ${sql(competitor.name)}, ${sql(competitor.countryCode)}, ${sql(competitor.region)}, ${sql(competitor.qualification)}, ${index + 1},`;
    assert.ok(seed.includes(rowStart), `seed row ${index + 1} must match ${competitor.slug}`);
  }
  assert.match(preview, /browser_direct_table_access_denied/);
  assert.match(preview, /other_entry_private_before_lock/);
  assert.match(preview, /ace_scoring_doubled/);
  assert.match(preview, /fixtures_removed/);
  assert.match(pickTenPreview, /picks_required = 10/i);
  assert.match(pickTenPreview, /invalid_champion_denied/i);
  assert.match(pickTenPreview, /champion_scoring_doubled/i);
  assert.match(pickTenPreview, /fixtures_removed/i);
  assert.match(finalTiebreakers, /top_six_average_finish asc nulls last[\s\S]+all_ten_average_finish asc nulls last/i);
  assert.match(finalTiebreakers, /source\.state = 'final'/i);
  assert.match(finalTiebreakers, /Final results are missing placements for one or more saved Pick 10 selections/i);
  assert.match(finalTiebreakers, /placement\."placing" = 9999 then snapshot\.row_count \+ 1/i);
  assert.match(finalTiebreakersPreview, /Provisional standings must not apply final tiebreakers/i);
  assert.match(finalTiebreakersPreview, /Finalization did not fail closed when a saved pick lacked a placement/i);
  assert.match(finalTiebreakersPreview, /all_ten_average_finish.*34\.70/s);
  assert.match(popularity, /create or replace function public\.get_worlds_pick_popularity/i);
  assert.match(popularity, /security definer[\s\S]+set search_path = public, pg_temp/i);
  assert.match(popularity, /cross join lateral unnest\(entry\.pick_slugs\)/i);
  assert.match(popularity, /count\(\*\) >= 25 or now\(\) >= \(select locks_at from selected_event\)/i);
  assert.match(popularity, /case when sample\.sample_ready then coalesce\(popularity\.pick_count, 0\) else 0 end/i);
  assert.match(popularity, /grant execute on function public\.get_worlds_pick_popularity\(text\) to anon, authenticated/i);
  assert.doesNotMatch(popularity, /entry\.user_id|jsonb_build_object\([^)]*user_id/i);
  assert.match(popularityPreview, /Popularity leaked aggregate support or identity below the 25-entry threshold/);
  assert.match(popularityPreview, /Locked events must expose aggregate popularity even below 25 entries/);
});

test("the Worlds page defers bracket predictions until official pairings exist", () => {
  const page = source("src/components/WorldsPickSixteen.jsx");
  assert.match(page, /The Top Cut prediction room is ready/);
  assert.match(page, /No seeds or matchups are invented in advance/);
  assert.match(page, /Your choices stay private until entries lock/);
  assert.match(page, /Masters Division only — Senior and Junior Division qualifiers are excluded\./);
  assert.doesNotMatch(page, /Masters is not an adult-only guarantee/);
  assert.match(page, /Where this invite list comes from/);
  assert.match(page, /Try Giovanni Cischke, Luca Ceribelli, or Wolfe Glick/);
  assert.doesNotMatch(page, /Try Wolfe, JPN, Regional Champion/);
  assert.match(page, /Victory Road&apos;s 2026 World Championships invite tracker for VGC Masters brings together invite earners/);
  assert.match(page, /This is an invite-earned list, not a confirmed attendance or registration list/);
  assert.match(page, /href=\{rosterSource\.sourceUrl\}/);
  assert.match(page, /Choose Your Champion, whose placement points count twice/);
  assert.match(page, /Sign in to build your Worlds prediction/);
  assert.match(page, /Like DraftCenter&apos;s Daily Games/);
  assert.match(page, /disabled=\{!user \|\| locked \|\| unavailable\}/);
  assert.match(page, /if \(!user \|\| locked/);
  assert.match(page, /name="worlds-ace"/);
  assert.match(page, /p_ace_slug: ace/);
  assert.match(page, /get_worlds_pick_popularity/);
  assert.match(page, /<WorldsChampionOdds/);
  assert.match(WORLDS_2026_POINTS_URL, /^https:\/\/www\.pokemon\.com\//);
  assert.match(page, /Your Champion ×2/);
  assert.match(page, /const draftDirtyRef = useRef\(false\)/);
  assert.match(page, /if \(hydrateEntry \|\| !draftDirtyRef\.current\)/);
  assert.match(page, /setInterval\(\(\) => \{ if \(active\) loadHub\(supabase\); \}, 120_000\)/);
  assert.match(page, /loadHub\(supabase, \{ hydrateEntry: true \}\)/);
  assert.match(page, /if \(next\.picks !== selected\) draftDirtyRef\.current = true/);
  assert.match(page, /disabled=\{busy \|\| locked \|\| selected\.length !== pickCount \|\| !ace \|\| !hub\}/);
  assert.match(page, /Choose all 10 and Your Champion to save your entry/);
  assert.match(page, /Lower average finish among your six best-finishing picks/);
  assert.match(page, /Lower average finish across all 10 picks/);
  assert.match(page, /If both averages are also equal, the entries share a rank/);
  assert.doesNotMatch(page, /Every deep run matters/);
  assert.doesNotMatch(page, /Ace Pick/);
});

test("the Worlds overview separates competition and overall leaderboards", () => {
  const hub = source("src/components/WorldsPredictionsHub.jsx");
  const predictionPage = source("src/components/WorldsPickSixteen.jsx");
  const nav = source("src/components/WorldsDisciplineNav.jsx");
  const overviewPage = source("src/app/worlds/2026/page.js");
  const vgcPage = source("src/app/worlds/2026/vgc/page.js");
  const tcgPage = source("src/app/worlds/2026/tcg/page.js");
  const goPage = source("src/app/worlds/2026/go/page.js");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");
  for (const label of ["Overall", "VGC", "TCG", "Pokémon GO", "Pokémon UNITE"]) assert.match(hub, new RegExp(`label: "${label}"`));
  assert.match(hub, /<h1>2026 Pokémon Worlds Predictions<\/h1>/);
  assert.match(hub, /<h2 id="worlds-competition-heading">Worlds Home<\/h2>/);
  assert.match(hub, /Picks open/);
  assert.match(nav, /label: "Worlds Home"/);
  assert.equal((nav.match(/status: "Not Live"/g) || []).length, 1);
  assert.equal((nav.match(/status: "Picks open"/g) || []).length, 3);
  assert.equal((hub.match(/<span className="worlds-status-pill">Not Live<\/span>/g) || []).length, 1);
  assert.equal((hub.match(/<span className="worlds-status-pill">Picks open<\/span>/g) || []).length, 3);
  assert.doesNotMatch(`${nav}\n${hub}`, /In build|Source audit|Roster pending|Teams pending/i);
  assert.doesNotMatch(hub, /One Worlds home\. A leaderboard for every game\./);
  assert.doesNotMatch(hub, /See (TCG|GO|UNITE) progress/);
  assert.match(hub, /Pokémon World Championships 2026: dates, games, and predictions/);
  assert.match(hub, /When and where is Pokémon Worlds 2026\?/);
  assert.match(hub, /Which games are at Pokémon Worlds\?/);
  assert.match(hub, /How do the VGC predictions work\?/);
  assert.match(hub, /Every competition is worth up to 100 points/);
  assert.match(hub, /Moscone Center · Championship Sunday at Chase Center/);
  assert.match(hub, /The combined table appears when at least two games have official scored results\./);
  assert.doesNotMatch(hub, /VGC will not be labeled an overall contest by itself/);
  assert.match(hub, /Missing an entry earns zero for that game/);
  assert.match(hub, /get_worlds_pick_hub/);
  assert.match(hub, /get_worlds_meta_hub/);
  assert.match(hub, /get_worlds_result_status/);
  assert.match(hub, /saved \$\{total === 1 \? "entry" : "entries"\} total/);
  assert.match(hub, /label="Player Pick 10"/);
  assert.match(hub, /label="Pokémon Team Picks"/);
  assert.match(hub, /label="Deck Picks"/);
  assert.match(hub, /label="Trainer Pick 10"/);
  assert.match(hub, /href="\/worlds\/2026\/vgc#pick-ten"/);
  assert.match(hub, /href="\/worlds\/2026\/vgc#meta-picks"/);
  assert.match(hub, /href="\/worlds\/2026\/tcg#pick-ten"/);
  assert.match(hub, /href="\/worlds\/2026\/tcg#meta-picks"/);
  for (const discipline of ["vgc", "tcg", "go"]) {
    assert.ok(
      hub.indexOf(`href="/worlds/2026/${discipline}#meta-picks"`) < hub.indexOf(`href="/worlds/2026/${discipline}#pick-ten"`),
      `${discipline} should show its team or deck prediction before Pick 10`,
    );
  }
  assert.match(hub, /useState\("vgc"\)/);
  assert.doesNotMatch(hub, /useState\("overall"\)/);
  assert.match(hub, /activeLeaderboard === "vgc" \? <div className="worlds-future-leaderboard"/);
  assert.match(hub, /Loading VGC leaderboard…/);
  assert.match(hub, /VGC leaderboard unavailable/);
  assert.match(predictionPage, /<div className="worlds-hero-actions">\s*<a className="quiet-button" href="#meta-picks">[\s\S]+?<a className="primary-button inline-link-button" href=/);
  assert.match(predictionPage, /<nav aria-label=\{copy\.guide\.title\}>\s*<a className="quiet-button" href="#meta-picks">[\s\S]+?<a className="primary-button inline-link-button" href="#qualified-players">/);
  assert.match(predictionPage, /Predict the winning meta/);
  for (const locale of ["it", "es", "fr", "de", "ja", "ko"]) {
    const localized = worldsCopy(locale);
    assert.ok(localized.hero.meta.length > 3, `${locale} needs a localized team-prediction action`);
  }
  for (const locale of ["en", "it", "es", "fr", "de", "ja", "ko"]) {
    const localized = worldsCopy(locale);
    assert.ok(localized.guide.pokemon.length > 3, `${locale} needs a localized Pokémon action`);
    assert.ok(localized.guide.players.length > 3, `${locale} needs a localized player action`);
  }
  assert.match(hub, /Two separate games live here: predict the Masters players/);
  assert.match(hub, /Not open yet/);
  assert.match(hub, /Live — provisional/);
  assert.match(hub, /Live standings are unofficial/);
  assert.match(nav, /href: "\/worlds\/2026\/vgc"/);
  assert.match(nav, /href: "\/worlds\/2026\/tcg"/);
  assert.match(overviewPage, /WorldsPredictionsHub/);
  assert.match(overviewPage, /pageTitle = "2026 Pokémon World Championships Predictions"/);
  assert.match(overviewPage, /"@type": "CollectionPage"/);
  assert.match(overviewPage, /"@type": "ItemList"/);
  assert.match(overviewPage, /"@type": "BreadcrumbList"/);
  for (const page of [overviewPage, vgcPage, tcgPage, goPage]) {
    assert.match(page, /"@type": "Thing"/);
    assert.doesNotMatch(page, /"@type": "(?:Sports)?Event"/);
    assert.doesNotMatch(page, /#event/);
  }
  assert.match(overviewPage, /openGraph:/);
  assert.match(overviewPage, /twitter:/);
  assert.match(overviewPage, /canonical: "\/worlds\/2026"/);
  assert.match(vgcPage, /pageTitle = "2026 Pokémon Worlds VGC Predictions & Champion Odds"/);
  assert.match(vgcPage, /canonical: "\/worlds\/2026\/vgc"/);
  assert.match(vgcPage, /predict six Pokémon for the winning team/);
  assert.match(vgcPage, /sameAs: "https:\/\/worlds\.pokemon\.com\/en-us"/);
  assert.match(tcgPage, /pageTitle = "2026 Pokémon Worlds TCG Predictions"/);
  assert.match(tcgPage, /canonical: "\/worlds\/2026\/tcg"/);
  assert.match(tcgPage, /official Pokémon Worlds 2026 TCG Masters qualifiers/);
  assert.match(sitemap, /WORLDS_2026_LAST_MODIFIED/);
  assert.match(sitemap, /\["\/worlds\/2026\/vgc", "daily", 0\.9\]/);
  assert.match(sitemap, /\["\/worlds\/2026\/tcg", "daily", 0\.9\]/);
  assert.match(llms, /2026 Pokémon World Championships Predictions/);
  assert.match(llms, /invite-earned list rather than confirmed registration or attendance/);
});

test("the VGC event card names both 2026 Worlds venues", () => {
  const component = source("src/components/WorldsPickSixteen.jsx");
  assert.match(component, /<h1>2026 Pokémon Worlds VGC predictions<\/h1>/);
  assert.match(component, /Pokémon Worlds VGC Masters invitee list/);
  assert.match(component, /Moscone Center · Championship Sunday at Chase Center/);
  assert.doesNotMatch(component, /<p>Moscone Center · San Francisco<\/p>/);
});

test("the Italian Worlds route localizes the current Pick 10 experience without splitting competition data", () => {
  const italianPage = source("src/app/it/worlds/2026/page.js");
  const englishPage = source("src/app/worlds/2026/vgc/page.js");
  const component = source("src/components/WorldsPickSixteen.jsx");
  const competitionConfig = source("src/lib/worldsFutureSetup.js");
  const meta = source("src/components/WorldsMetaChallenge.jsx");
  const translations = source("src/lib/worlds2026I18n.js");
  const sitemap = source("src/app/sitemap.js");

  assert.match(italianPage, /locale="it"/);
  assert.match(italianPage, /canonical: "\/it\/worlds\/2026"/);
  assert.match(italianPage, /inLanguage: "it-IT"/);
  assert.match(italianPage, /translationOfWork/);
  assert.match(italianPage, /worlds-2026-vgc-masters\.json/);
  assert.match(englishPage, /worlds-2026-vgc-masters\.json/);
  assert.match(italianPage, /WorldsPickSixteen discipline="vgc" rosterSource=\{roster\} locale="it"/);
  assert.match(englishPage, /WorldsPickSixteen discipline="vgc" rosterSource=\{roster\}/);
  assert.match(competitionConfig, /vgc:[\s\S]*?eventId: "2026-vgc-masters"/);
  assert.match(component, /const eventId = config\.eventId/);
  assert.match(englishPage, /languages: \{ en: "\/worlds\/2026\/vgc", it: "\/it\/worlds\/2026"/);
  assert.match(sitemap, /\["\/it\/worlds\/2026", "daily", 0\.9\]/);
  assert.match(component, /navigator\.languages/);
  assert.match(component, /draftcenter-worlds-language-offer-dismissed/);
  assert.match(component, /document\.documentElement\.lang = copy\.documentLanguage/);
  assert.match(component, /document\.documentElement\.lang = previousLanguage \|\| "en"/);
  assert.doesNotMatch(component, /location\.(?:assign|replace)|window\.location\s*=/);
  assert.match(component, /WorldsMetaChallenge discipline=\{config\.key\} user=\{user\} locale=\{locale\}/);
  assert.match(meta, /locale = "en"/);
  assert.match(translations, /Worlds predictions in your language/);

  const copy = worldsCopy("it");
  assert.equal(copy.documentLanguage, "it");
  assert.match(copy.hero.title, /Pronostici VGC/);
  assert.match(copy.pick.title, /Pick 10/);
  assert.match(copy.pick.champion, /Campione ×2/);
  assert.match(copy.save.finish, /tutti e 10/);
  assert.equal(copy.status.withdrawn, "Ritirato");
  assert.equal(copy.scoring.placements[0], "Campione del mondo");
  assert.match(copy.errors.spotsFull(10), /tutti i 10 posti/);
  assert.match(worldsServerError("Sign in to save a Worlds entry.", "it"), /Accedi/);
  assert.match(worldsServerError("Choose exactly 10 competitors.", "it"), /esattamente 10 giocatori/);
  assert.match(worldsServerError("Each competitor can be chosen only once.", "it"), /una sola volta/);
  assert.match(worldsServerError("Choose Your Champion from your 10 selected competitors.", "it"), /Campione/);
  assert.match(worldsServerError("unexpected provider detail", "it"), /Non è stato possibile salvare/);

  const regions = [...new Set(roster.competitors.map(({ region }) => region))];
  const qualifications = [...new Set(roster.competitors.map(({ qualification }) => qualification))];
  assert.equal(qualifications.length, 52);
  assert.deepEqual(regions.map((region) => worldsRegionLabel(region, "it")).sort(), [
    "America Latina", "Asia-Pacifico", "Corea del Sud", "Europa", "Giappone", "Medio Oriente e Sudafrica", "Nord America", "Oceania",
  ]);
  assert.ok(qualifications.every((qualification) => worldsQualificationLabel(qualification, "it") !== qualification));

  const localizedRoster = normalizedRoster.map((competitor) => ({
    ...competitor,
    qualificationRegion: worldsRegionLabel(competitor.qualificationRegion, "it"),
    qualificationPath: worldsQualificationLabel(competitor.qualificationPath, "it"),
  }));
  assert.ok(filterWorldsCompetitors(localizedRoster, "campione regionale").length > 20);
  assert.ok(filterWorldsCompetitors(localizedRoster, "KOR", "Corea del Sud").length > 0);
});

test("Worlds leaderboard names open bounded, scrollable coach profiles", () => {
  const component = source("src/components/WorldsPickSixteen.jsx");
  const profile = source("src/components/PublicCoachProfile.jsx");
  const css = source("src/app/globals.css");
  const migration = source("supabase/migrations/20260819025045_worlds_shared_competition_profiles.sql");

  assert.match(component, /CoachProfileButton/);
  assert.match(component, /setActiveProfile\(entry\.profile/);
  assert.match(component, /<PublicCoachProfile profile=\{activeProfile\} locale=\{locale\}/);
  assert.match(profile, /Sei Pokémon preferiti/);
  assert.match(profile, /Medaglie/);
  assert.match(profile, /role="dialog" aria-modal="true"/);
  assert.match(profile, /event\.key === "Escape"/);
  assert.match(css, /\.public-profile-modal[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/);

  for (const field of ["username", "display_name", "avatar_url", "favorite_pokemon", "badges"]) {
    assert.match(migration, new RegExp(`'${field}'`));
  }
  assert.match(migration, /profile\.favorite_pokemon\[1:6\]/);
  assert.match(migration, /progress\.tier > 0/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /grant execute on function public\.get_worlds_pick_hub\(text\) to anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /'user_id'|'email'/);
});

test("the Spanish Worlds route localizes Pick 10, odds, Meta Picks, roster labels, and errors", () => {
  const spanishPage = source("src/app/es/worlds/2026/page.js");
  const englishPage = source("src/app/worlds/2026/vgc/page.js");
  const component = source("src/components/WorldsPickSixteen.jsx");
  const meta = source("src/components/WorldsMetaChallenge.jsx");
  const odds = source("src/components/WorldsChampionOdds.jsx");
  const nav = source("src/components/WorldsDisciplineNav.jsx");
  const sitemap = source("src/app/sitemap.js");

  assert.match(spanishPage, /locale="es"/);
  assert.match(spanishPage, /canonical: "\/es\/worlds\/2026"/);
  assert.match(spanishPage, /inLanguage: "es-ES"/);
  assert.match(spanishPage, /translationOfWork/);
  assert.match(spanishPage, /WorldsPickSixteen discipline="vgc" rosterSource=\{roster\} locale="es"/);
  assert.match(englishPage, /es: "\/es\/worlds\/2026"/);
  assert.match(sitemap, /\["\/es\/worlds\/2026", "daily", 0\.9\]/);
  assert.match(component, /Object\.entries\(WORLDS_LANGUAGES\)/);
  assert.match(component, /document\.documentElement\.lang = copy\.documentLanguage/);
  assert.match(meta, /worldsCopy\(locale\)\.meta/);
  assert.match(odds, /es: \{/);
  assert.match(nav, /const spanishLabels/);

  const copy = worldsCopy("es");
  assert.equal(copy.documentLanguage, "es");
  assert.equal(copy.locale, "es-ES");
  assert.match(copy.hero.title, /Pronósticos de VGC/);
  assert.match(copy.pick.champion, /Campeón ×2/);
  assert.match(copy.save.finish, /10 jugadores/);
  assert.equal(copy.status.withdrawn, "Retirado");
  assert.equal(copy.scoring.placements[0], "Campeón del mundo");
  assert.match(copy.meta.title, /Campeón del mundo/);
  assert.match(copy.errors.spotsFull(10), /10 puestos/);
  assert.match(worldsServerError("Sign in to save a Worlds entry.", "es"), /Inicia sesión/);
  assert.match(worldsServerError("Choose exactly 10 competitors.", "es"), /exactamente 10 jugadores/);
  assert.match(worldsServerError("Each competitor can be chosen only once.", "es"), /una vez/);
  assert.match(worldsServerError("Choose Your Champion from your 10 selected competitors.", "es"), /Campeón/);
  assert.match(worldsServerError("unexpected provider detail", "es"), /No se ha podido guardar/);

  const regions = [...new Set(roster.competitors.map(({ region }) => region))];
  const qualifications = [...new Set(roster.competitors.map(({ qualification }) => qualification))];
  assert.deepEqual(regions.map((region) => worldsRegionLabel(region, "es")).sort(), [
    "Asia-Pacífico", "Corea del Sur", "Europa", "Japón", "Latinoamérica", "Norteamérica", "Oceanía", "Oriente Medio y Sudáfrica",
  ]);
  assert.ok(qualifications.every((qualification) => worldsQualificationLabel(qualification, "es") !== qualification));

  const localizedRoster = normalizedRoster.map((competitor) => ({
    ...competitor,
    modelQualificationPath: competitor.qualificationPath,
    qualificationRegion: worldsRegionLabel(competitor.qualificationRegion, "es"),
    qualificationPath: worldsQualificationLabel(competitor.qualificationPath, "es"),
  }));
  assert.ok(filterWorldsCompetitors(localizedRoster, "campeón regional").length > 20);
  assert.ok(filterWorldsCompetitors(localizedRoster, "KOR", "Corea del Sur").length > 0);
  const englishOdds = new Map(buildWorldsChampionOdds(normalizedRoster).map((entry) => [entry.slug, entry.probability]));
  assert.ok(buildWorldsChampionOdds(localizedRoster).every((entry) => Math.abs(entry.probability - englishOdds.get(entry.slug)) < 1e-12));
});

test("French, German, Japanese, and Korean Worlds routes share the VGC competitions and expose all seven languages", () => {
  const component = source("src/components/WorldsPickSixteen.jsx");
  const quickLinks = source("src/components/SiteQuickLinks.jsx");
  const css = source("src/app/globals.css");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");
  const odds = source("src/components/WorldsChampionOdds.jsx");
  const profile = source("src/components/PublicCoachProfile.jsx");

  assert.deepEqual(Object.keys(WORLDS_LANGUAGES), ["en", "it", "es", "fr", "de", "ja", "ko"]);
  assert.match(component, /className="worlds-start-guide"/);
  assert.match(component, /href="#qualified-players"/);
  assert.match(component, /href="#meta-picks"/);
  assert.match(quickLinks, /<NavigationMenu active=\{gamesActive\} label="Games">/);
  assert.match(quickLinks, /href="\/worlds\/2026">🌎 Worlds Predictions<\/a>/);
  assert.doesNotMatch(quickLinks, /href="\/tournaments\/predictions"|>Picks<\/span>/);
  assert.match(quickLinks, /const worldsActive = currentPage/);
  assert.match(css, /\.site-primary-links>\.site-nav-menu\.is-active>summary/);
  assert.doesNotMatch(quickLinks, /site-primary-worlds-link|site-worlds-link/);

  for (const locale of ["fr", "de", "ja", "ko"]) {
    const page = source(`src/app/${locale}/worlds/2026/page.js`);
    assert.match(page, new RegExp(`locale="${locale}"`));
    assert.match(page, new RegExp(`canonical: "/${locale}/worlds/2026"`));
    assert.match(page, /worlds-2026-vgc-masters\.json/);
    assert.match(page, /WorldsPickSixteen discipline="vgc" rosterSource=\{roster\}/);
    assert.match(sitemap, new RegExp(`\\["/${locale}/worlds/2026", "daily", 0\\.9\\]`));
    assert.match(llms, new RegExp(`draftcentral\\.gg/${locale}/worlds/2026`));
    assert.match(odds, new RegExp(`\\n  ${locale}: \\{`));
    assert.match(profile, new RegExp(`\\n  ${locale}: \\{`));

    const copy = worldsCopy(locale);
    assert.equal(copy.documentLanguage, locale);
    assert.match(copy.guide.body, /10|10人|10명/);
    assert.ok(copy.meta.title.length > 5);
    assert.ok(worldsServerError("Each competitor can be chosen only once.", locale).length > 5);
    assert.ok([...new Set(roster.competitors.map(({ qualification }) => qualification))]
      .every((qualification) => worldsQualificationLabel(qualification, locale) !== qualification));
    assert.ok([...new Set(roster.competitors.map(({ region }) => region))]
      .every((region) => worldsRegionLabel(region, locale) !== region || ["Europe", "Japan"].includes(region)));
  }

  const french = worldsCopy("fr");
  assert.match(french.meta.order, /feuille d’équipe/);
  assert.match(french.meta.trendBody, /feuilles d’équipe anonymisées/);
  assert.match(french.meta.reviewedPool, /Liste d’options vérifiée/);
  assert.doesNotMatch([
    french.leaderboard.finalBody,
    french.bracket.body,
    french.scoring.note,
    french.meta.intro,
    french.meta.order,
    french.meta.trendBody,
    french.meta.safety.join(" "),
    french.meta.errors.reviewing,
  ].join(" "), /team sheets?|propriétaire|groupe d’options/i);
});

test("the official TCG Masters qualifier pool is complete, unique, and release-ready", () => {
  const registry = JSON.parse(source("src/data/worlds-2026-tcg-masters-sources.json"));
  const cpSnapshot = JSON.parse(source("src/data/worlds-2026-tcg-masters-cp.json"));
  const directSnapshot = JSON.parse(source("src/data/worlds-2026-tcg-masters-direct-invites.json"));
  const page = source("src/app/worlds/2026/tcg/page.js");
  const migration = source("supabase/376-open-worlds-2026-tcg-masters-pick-ten.sql");
  const preview = source("supabase/tests/376-open-worlds-2026-tcg-masters-pick-ten-preview-regression.sql");
  assert.equal(registry.division, "Masters");
  assert.equal(registry.ageScope, "official-masters-division-not-age-verified");
  assert.equal(registry.rosterReady, true);
  assert.equal(registry.status, "invite-earned-not-attendance-confirmed");
  assert.equal(registry.sourceUrl, "https://worlds.pokemon.com/en-us/about/qualified/");
  assert.equal(registry.officialQualifiedList.rawMastersRows, 882);
  assert.equal(registry.officialQualifiedList.duplicateRowsExcluded, 2);
  assert.equal(registry.officialQualifiedList.deduplicatedMastersCompetitors, 880);
  assert.equal(registry.competitors.length, 880);
  assert.equal(new Set(registry.competitors.map((competitor) => competitor.slug)).size, 880);
  assert.equal(new Set(registry.competitors.map((competitor) => competitor.sourceOrder)).size, 880);
  assert.equal(registry.competitors.every((competitor) => competitor.division === "Masters"), true);
  assert.equal(registry.competitors.every((competitor) => competitor.attendanceStatus === "invite_earned"), true);
  assert.equal(registry.competitors.every((competitor) => /^[A-Z]{3}$/.test(competitor.countryCode)), true);
  assert.deepEqual(registry.officialQualifiedList.regionCounts, {
    Japan: 146,
    "North America": 155,
    Indonesia: 13,
    "Middle East & South Africa": 12,
    "Latin America": 135,
    Oceania: 23,
    Europe: 148,
    Thailand: 12,
    Taiwan: 44,
    "Chinese Mainland": 105,
    "South Korea": 20,
    Singapore: 14,
    Philippines: 12,
    "Hong Kong": 28,
    Malaysia: 13,
  });
  assert.equal(registry.qualificationRules.championshipPointSlots.reduce((total, zone) => total + zone.slots, 0), 425);
  assert.equal(registry.leaderboard.capturedMastersRows, 425);
  assert.equal(registry.directInviteAudit.uniqueInviteEarners, 45);
  assert.equal(registry.directInviteAudit.exactOfficialIdentityMatches, 36);
  assert.equal(registry.directInviteAudit.reviewedOfficialNameVariants, 7);
  assert.equal(registry.directInviteAudit.notCorroboratedByOfficialQualifiedList, 2);
  assert.equal(cpSnapshot.competitors.length, 425);
  assert.equal(new Set(cpSnapshot.competitors.map((competitor) => competitor.slug)).size, 425);
  assert.deepEqual(Object.values(cpSnapshot.expectedRegionCounts), [135, 135, 125, 20, 10]);
  assert.equal(directSnapshot.records.length, 45);
  assert.equal(directSnapshot.records.filter((competitor) => competitor.cpCompetitorSlug).length, 33);
  assert.equal(directSnapshot.records.filter((competitor) => !competitor.cpCompetitorSlug).length, 12);
  assert.equal(directSnapshot.records.every((competitor) => competitor.division === "Masters"), true);
  assert.equal(directSnapshot.records.every((competitor) => /^[A-Z]{3}$/.test(competitor.countryCode)), true);
  assert.equal(registry.predictionDesign.pickCount, 10);
  assert.equal(registry.predictionDesign.selectionLabel, "Your Champion");
  assert.equal(registry.predictionDesign.selectionMultiplier, 2);
  assert.equal(registry.tournamentRules.status, "official-format-and-qualified-list-published-registration-and-pairings-not-published");
  assert.equal(registry.tournamentRules.maximumSwissDays, 2);
  assert.equal(registry.tournamentRules.legalRegulationMarks, "H and onward");
  assert.match(page, /WorldsPickSixteen discipline="tcg" rosterSource=\{roster\}/);
  assert.match(page, /pageTitle = "2026 Pokémon Worlds TCG Predictions"/);
  assert.match(page, /openGraph:/);
  assert.match(page, /twitter:/);
  assert.doesNotMatch(page, /robots: \{ index: false/);
  assert.equal((migration.match(/\('2026-tcg-masters'/g) || []).length, 880);
  for (const competitor of registry.competitors) {
    const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const row = `('2026-tcg-masters', ${sql(competitor.slug)}, ${sql(competitor.name)}, ${sql(competitor.countryCode)}, ${sql(competitor.region)}, ${sql(competitor.qualification)}, 'invite_earned', true, ${competitor.sourceOrder},`;
    assert.ok(migration.includes(row), `migration row must match ${competitor.slug}`);
  }
  assert.match(migration, /status = 'open'/);
  assert.match(migration, /The TCG result source must remain disabled and unconfigured/);
  assert.match(migration, /Direct Worlds table reads must remain revoked/);
  assert.match(migration, /Opening the TCG pool must not create prediction entries/);
  assert.doesNotMatch(migration, /delete from public\.worlds_pick_entries/i);
  assert.match(preview, /Another member could see a private TCG entry before lock/);
  assert.match(preview, /Choose exactly 10 competitors/);
  assert.match(preview, /Temporary TCG Preview entries did not clean up/);
});

test("the roster builder fails closed on Junior or Senior source rows", () => {
  const builder = source("scripts/build-worlds-2026-roster.mjs");
  assert.match(builder, /YOUTH_DIVISION_MARKER/);
  assert.match(builder, /This pool is Masters-only/);
  assert.match(builder, /division: "Masters"/);
  assert.match(builder, /value\.replace\([\s\S]+#x\[0-9a-f\]\+/);
  assert.doesNotMatch(builder, /replaceAll\("&amp;"/);
});
