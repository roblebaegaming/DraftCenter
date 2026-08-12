import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  filterWorldsCompetitors,
  formatWorldsAverageFinish,
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

test("the database contract keeps entries private before lock and browser writes inside an authenticated RPC", () => {
  const schema = source("supabase/369-worlds-pick-sixteen.sql");
  const pickTen = source("supabase/373-worlds-pick-ten-and-champion-label.sql");
  const seed = source("supabase/370-seed-worlds-2026-vgc-masters-roster.sql");
  const preview = source("supabase/tests/369-worlds-pick-sixteen-preview-regression.sql");
  const pickTenPreview = source("supabase/tests/373-worlds-pick-ten-and-champion-preview-regression.sql");
  const finalTiebreakers = source("supabase/375-worlds-pick-ten-final-tiebreakers.sql");
  const finalTiebreakersPreview = source("supabase/tests/375-worlds-pick-ten-final-tiebreakers-preview-regression.sql");
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
  const nav = source("src/components/WorldsDisciplineNav.jsx");
  const overviewPage = source("src/app/worlds/2026/page.js");
  const vgcPage = source("src/app/worlds/2026/vgc/page.js");
  const tcgPage = source("src/app/worlds/2026/tcg/page.js");
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
  assert.match(hub, /get_worlds_result_status/);
  assert.match(hub, /Live — provisional/);
  assert.match(hub, /Live standings are unofficial/);
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
  assert.match(vgcPage, /pick 10 qualified players, name Your Champion/);
  assert.match(vgcPage, /eventAttendanceMode: "https:\/\/schema\.org\/OfflineEventAttendanceMode"/);
  assert.match(vgcPage, /sport: "Pokémon Video Game Championships \(VGC\)"/);
  assert.match(vgcPage, /sameAs: "https:\/\/worlds\.pokemon\.com\/en-us"/);
  assert.match(vgcPage, /name: "Chase Center — Championship Sunday"/);
  assert.match(tcgPage, /pageTitle = "2026 Pokémon Worlds TCG Predictions"/);
  assert.match(tcgPage, /canonical: "\/worlds\/2026\/tcg"/);
  assert.match(tcgPage, /official Pokémon Worlds 2026 TCG Masters qualifiers/);
  assert.match(tcgPage, /sport: "Pokémon Trading Card Game"/);
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
