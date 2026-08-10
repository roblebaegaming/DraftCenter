import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  filterWorldsCompetitors,
  normalizeWorldsDisciplineScore,
  toggleWorldsPick,
  WORLDS_OVERALL_POINTS_PER_DISCIPLINE,
  WORLDS_2026_PICK_COUNT,
  WORLDS_2026_SCORING,
  WORLDS_VGC_MAX_RAW_SCORE,
  worldsEntryIsLocked,
} from "../src/lib/worlds2026.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const roster = JSON.parse(source("src/data/worlds-2026-vgc-masters.json"));
const normalizedRoster = roster.competitors.map((competitor) => ({
  displayName: competitor.name,
  countryCode: competitor.countryCode,
  qualificationRegion: competitor.region,
  qualificationPath: competitor.qualification,
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
  assert.equal(WORLDS_VGC_MAX_RAW_SCORE, 164);
  assert.equal(normalizeWorldsDisciplineScore(164, WORLDS_VGC_MAX_RAW_SCORE), 100);
  assert.equal(normalizeWorldsDisciplineScore(82, WORLDS_VGC_MAX_RAW_SCORE), 50);
  assert.equal(normalizeWorldsDisciplineScore(999, WORLDS_VGC_MAX_RAW_SCORE), 100);
  assert.equal(normalizeWorldsDisciplineScore(0, WORLDS_VGC_MAX_RAW_SCORE), 0);
  assert.equal(normalizeWorldsDisciplineScore(30, 0), 0);
});

test("roster search handles names, accents, countries, regions, and qualification paths", () => {
  assert.ok(filterWorldsCompetitors(normalizedRoster, "alex gomez").some(({ displayName }) => displayName === "Àlex Gómez"));
  assert.ok(filterWorldsCompetitors(normalizedRoster, "regional champion").length > 20);
  assert.ok(filterWorldsCompetitors(normalizedRoster, "KOR", "South Korea").length > 0);
  assert.equal(filterWorldsCompetitors(normalizedRoster, "KOR", "Japan").length, 0);
});

test("Pick 16 selection prevents a seventeenth competitor", () => {
  let picks = [];
  for (let index = 0; index < WORLDS_2026_PICK_COUNT; index += 1) {
    picks = toggleWorldsPick(picks, `player-${index}`).picks;
  }
  const full = toggleWorldsPick(picks, "player-16");
  assert.equal(full.picks.length, WORLDS_2026_PICK_COUNT);
  assert.match(full.error, /16 spots are full/);
  assert.equal(toggleWorldsPick(picks, "player-0").picks.length, 15);
});

test("entry locking respects status, open time, and the published deadline", () => {
  const event = { status: "open", opens_at: "2026-08-10T07:00:00Z", locks_at: "2026-08-28T07:00:00Z" };
  assert.equal(worldsEntryIsLocked(event, new Date("2026-08-20T12:00:00Z")), false);
  assert.equal(worldsEntryIsLocked(event, new Date("2026-08-28T07:00:00Z")), true);
  assert.equal(worldsEntryIsLocked({ ...event, status: "locked" }, new Date("2026-08-20T12:00:00Z")), true);
});

test("the database contract keeps entries private before lock and browser writes inside an authenticated RPC", () => {
  const schema = source("supabase/369-worlds-pick-sixteen.sql");
  const seed = source("supabase/370-seed-worlds-2026-vgc-masters-roster.sql");
  const preview = source("supabase/tests/369-worlds-pick-sixteen-preview-regression.sql");
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
  assert.match(schema, /Choose one Ace Pick from your 16 competitors/i);
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
});

test("the Worlds page defers bracket predictions until official pairings exist", () => {
  const page = source("src/components/WorldsPickSixteen.jsx");
  assert.match(page, /Waiting for the official Worlds bracket/);
  assert.match(page, /will not invent seeds or matchups/);
  assert.match(page, /Your choices stay private until entries lock/);
  assert.match(page, /Junior- and Senior-Division qualifiers are excluded/);
  assert.match(page, /does not collect or infer private age data/);
  assert.match(page, /Where this invite list comes from/);
  assert.match(page, /Try Giovanni Cischke, Luca Ceribelli, or Wolfe Glick/);
  assert.doesNotMatch(page, /Try Wolfe, JPN, Regional Champion/);
  assert.match(page, /compiled from Victory Road&apos;s 2026 World Championships invite tracker for VGC Masters/);
  assert.match(page, /This is an invite-earned list, not a confirmed attendance or registration list/);
  assert.match(page, /href=\{rosterSource\.sourceUrl\}/);
  assert.match(page, /Choose one Ace Pick whose placement points count twice/);
  assert.match(page, /Sign in to build your Worlds prediction/);
  assert.match(page, /Like DraftCenter&apos;s Daily Games/);
  assert.match(page, /disabled=\{!user \|\| locked \|\| unavailable\}/);
  assert.match(page, /if \(!user \|\| locked/);
  assert.match(page, /name="worlds-ace"/);
  assert.match(page, /p_ace_slug: ace/);
});

test("the Worlds overview separates competition and overall leaderboards", () => {
  const hub = source("src/components/WorldsPredictionsHub.jsx");
  const nav = source("src/components/WorldsDisciplineNav.jsx");
  const overviewPage = source("src/app/worlds/2026/page.js");
  const vgcPage = source("src/app/worlds/2026/vgc/page.js");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");
  for (const label of ["Overall", "VGC", "TCG", "Pokémon GO", "Pokémon UNITE"]) assert.match(hub, new RegExp(`label: "${label}"`));
  assert.match(hub, /<h1>2026 Pokémon Worlds Predictions<\/h1>/);
  assert.match(hub, /Pokémon World Championships 2026: dates, games, and predictions/);
  assert.match(hub, /When and where is Pokémon Worlds 2026\?/);
  assert.match(hub, /Which games are at Pokémon Worlds\?/);
  assert.match(hub, /How do the VGC predictions work\?/);
  assert.match(hub, /Every competition is worth up to 100 points/);
  assert.match(hub, /Moscone Center · Championship Sunday at Chase Center/);
  assert.match(hub, /Opens after two competitions score/);
  assert.match(hub, /Missing an entry earns zero for that game/);
  assert.match(hub, /get_worlds_pick_hub/);
  assert.match(nav, /href: "\/worlds\/2026\/vgc"/);
  assert.match(nav, /href: "\/worlds\/2026\/tcg"/);
  assert.match(overviewPage, /WorldsPredictionsHub/);
  assert.match(overviewPage, /pageTitle = "2026 Pokémon World Championships Predictions"/);
  assert.match(overviewPage, /"@type": "CollectionPage"/);
  assert.match(overviewPage, /"@type": "SportsEvent"/);
  assert.match(overviewPage, /"@type": "ItemList"/);
  assert.match(overviewPage, /"@type": "BreadcrumbList"/);
  assert.match(overviewPage, /openGraph:/);
  assert.match(overviewPage, /twitter:/);
  assert.match(overviewPage, /canonical: "\/worlds\/2026"/);
  assert.match(vgcPage, /pageTitle = "2026 Pokémon Worlds VGC Predictions"/);
  assert.match(vgcPage, /canonical: "\/worlds\/2026\/vgc"/);
  assert.match(vgcPage, /eventAttendanceMode: "https:\/\/schema\.org\/OfflineEventAttendanceMode"/);
  assert.match(vgcPage, /sport: "Pokémon Video Game Championships \(VGC\)"/);
  assert.match(vgcPage, /sameAs: "https:\/\/worlds\.pokemon\.com\/en-us"/);
  assert.match(vgcPage, /name: "Chase Center — Championship Sunday"/);
  assert.match(sitemap, /WORLDS_2026_LAST_MODIFIED/);
  assert.match(sitemap, /\["\/worlds\/2026\/vgc", "daily", 0\.9\]/);
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

test("the TCG setup stays Masters-only and fail-closed while its roster is audited", () => {
  const registry = JSON.parse(source("src/data/worlds-2026-tcg-masters-sources.json"));
  const component = source("src/components/WorldsTcgPickSixteenSetup.jsx");
  const page = source("src/app/worlds/2026/tcg/page.js");
  assert.equal(registry.division, "Masters");
  assert.equal(registry.ageScope, "official-masters-division-not-age-verified");
  assert.equal(registry.rosterReady, false);
  assert.equal(registry.qualificationRules.championshipPointSlots.reduce((total, zone) => total + zone.slots, 0), 425);
  assert.deepEqual(registry.separatePrograms.map((item) => item.program), ["Japan", "South Korea", "Mainland China", "Asia-Pacific"]);
  assert.match(component, /Champion: 30 points\. Ace Pick: ×2\./);
  assert.match(component, /Junior and Senior competitors stay out of this pool/);
  assert.match(component, /no competitor cards, picks, or saved entries will appear/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
  assert.doesNotMatch(component, /save_worlds_pick_entry/);
});

test("the roster builder fails closed on Junior or Senior source rows", () => {
  const builder = source("scripts/build-worlds-2026-roster.mjs");
  assert.match(builder, /YOUTH_DIVISION_MARKER/);
  assert.match(builder, /This pool is Masters-only/);
  assert.match(builder, /division: "Masters"/);
  assert.match(builder, /value\.replace\([\s\S]+#x\[0-9a-f\]\+/);
  assert.doesNotMatch(builder, /replaceAll\("&amp;"/);
});
