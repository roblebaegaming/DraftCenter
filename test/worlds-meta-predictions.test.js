import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  filterWorldsMetaOptions,
  normalizeWorldsMetaScore,
  scoreWorldsMetaChampionRoster,
  scoreWorldsMetaDeckArchetypes,
  toggleWorldsMetaPick,
  WORLDS_META_EVENTS,
  WORLDS_META_ROSTER_POINTS,
  worldsMetaEntryIsLocked,
  worldsMetaPlacementPoints,
} from "../src/lib/worldsMeta.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("VGC and GO champion-team picks reward confidence order and an exact six", () => {
  const championTeam = ["one", "two", "three", "four", "five", "six"];
  assert.deepEqual(WORLDS_META_ROSTER_POINTS, [25, 20, 16, 13, 10, 8]);
  assert.equal(scoreWorldsMetaChampionRoster(championTeam, championTeam), 100);
  assert.equal(scoreWorldsMetaChampionRoster(["six", "five", "four", "three", "two", "one"], championTeam), 100);
  assert.equal(scoreWorldsMetaChampionRoster(["one", "two", "miss", "four", "other", "six"], championTeam), 66);
  assert.equal(scoreWorldsMetaChampionRoster(["miss", "two", "three", "four", "five", "six"], championTeam), 67);
});

test("TCG scores best archetype placement, doubles the Champion Deck, and normalizes to 100", () => {
  assert.deepEqual([1, 2, 4, 8, 16, 32, 64, 65].map(worldsMetaPlacementPoints), [30, 20, 12, 7, 4, 2, 1, 0]);
  const result = scoreWorldsMetaDeckArchetypes(
    ["champion", "runner-up", "top-four-a", "top-four-b", "top-eight"],
    "champion",
    { champion: 1, "runner-up": 2, "top-four-a": 3, "top-four-b": 4, "top-eight": 5 },
  );
  assert.deepEqual(result, { rawScore: 111, score: 100 });
  assert.equal(normalizeWorldsMetaScore(55.5, 111), 50);
  assert.deepEqual(scoreWorldsMetaDeckArchetypes(["runner-up"], "runner-up", { "runner-up": 2 }), { rawScore: 40, score: 36 });
});

test("Meta selection, search, and lock helpers fail safely", () => {
  const options = [
    { option_key: "mega-charizard-y", display_name: "Mega Charizard Y", group_label: "Fire" },
    { option_key: "n-zoroark", display_name: "N's Zoroark", group_label: "Stage 1" },
  ];
  assert.equal(filterWorldsMetaOptions(options, "charizard")[0].option_key, "mega-charizard-y");
  assert.equal(filterWorldsMetaOptions(options, "stage 1")[0].option_key, "n-zoroark");
  assert.deepEqual(toggleWorldsMetaPick(["one", "two"], "three", 2), {
    picks: ["one", "two"],
    error: "Your 2 spots are full. Remove one before adding another.",
  });
  const event = { status: "open", opens_at: "2026-08-12T07:00:00Z", locks_at: "2026-08-28T07:00:00Z" };
  assert.equal(worldsMetaEntryIsLocked(event, new Date("2026-08-20T12:00:00Z")), false);
  assert.equal(worldsMetaEntryIsLocked({ ...event, status: "draft" }, new Date("2026-08-20T12:00:00Z")), true);
  assert.equal(worldsMetaEntryIsLocked(event, new Date("2026-08-28T07:00:00Z")), true);
});

test("all disciplines have separate, prioritized Meta event contracts", () => {
  assert.equal(WORLDS_META_EVENTS.vgc.eventId, "2026-vgc-champion-team");
  assert.equal(WORLDS_META_EVENTS.tcg.eventId, "2026-tcg-champion-decks");
  assert.equal(WORLDS_META_EVENTS.go.eventId, "2026-go-champion-team");
  assert.equal(WORLDS_META_EVENTS.vgc.picksRequired, 6);
  assert.equal(WORLDS_META_EVENTS.tcg.picksRequired, 5);
  assert.equal(WORLDS_META_EVENTS.go.picksRequired, 6);
  assert.equal(WORLDS_META_EVENTS.tcg.requiresFeaturedPick, true);
});

test("the VGC pool is a pinned 235-option official Regulation M-B snapshot", () => {
  const snapshot = JSON.parse(source("src/data/worlds-2026-vgc-meta-options.json"));
  const optionKeys = snapshot.options.map((option) => option.optionKey);
  const officialKeys = snapshot.options.map((option) => option.officialKey);
  const sourceOrders = snapshot.options.map((option) => option.sourceOrder);
  const trending = snapshot.options.filter((option) => option.communityTrend);

  assert.equal(snapshot.eventId, "2026-vgc-champion-team");
  assert.equal(snapshot.status, "official-eligible-pool-reviewed");
  assert.equal(snapshot.source.optionCount, 235);
  assert.equal(snapshot.source.officialPayloadSha256, "642fed0034500c778894e10ca33418cb06eabf9403136e8acce277047bccf4f6");
  assert.match(snapshot.source.noticeUrl, /^https:\/\/champions-news\.pokemon-home\.com\//);
  assert.match(snapshot.source.eligiblePokemonUrl, /^https:\/\/web-view\.app\.pokemonchampions\.jp\//);
  assert.equal(snapshot.options.length, 235);
  assert.equal(new Set(optionKeys).size, 235);
  assert.equal(new Set(officialKeys).size, 235);
  assert.equal(new Set(sourceOrders).size, 235);
  assert.equal(snapshot.options[0].optionKey, "pc-0003-000");
  assert.equal(snapshot.options[0].officialKey, "0003-000");
  assert.equal(snapshot.options[0].displayName, "Venusaur");
  assert.equal(snapshot.options[0].sourceOrder, 1);
  assert.equal(snapshot.options.at(-1).optionKey, "pc-1019-000");
  assert.equal(snapshot.options.at(-1).displayName, "Hydrapple");
  assert.equal(snapshot.options.at(-1).sourceOrder, 235);
  assert.equal(snapshot.options.some((option) => option.displayName.startsWith("Mega ")), false);

  assert.equal(trending.length, 24);
  assert.deepEqual(trending.map((option) => option.communityTrend.rank).toSorted((a, b) => a - b), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(snapshot.communityTrendContext.status, "unofficial-anonymous-community-observations");
  assert.equal(snapshot.communityTrendContext.eventCount, 10);
  assert.equal(snapshot.communityTrendContext.teamCount, 737);
  assert.match(snapshot.communityTrendContext.disclaimer, /never determine eligibility/i);
});

test("the TCG taxonomy pins 49 concrete Pitch Black archetypes and stays fail-closed", () => {
  const snapshot = JSON.parse(source("src/data/worlds-2026-tcg-meta-options.json"));
  const optionKeys = snapshot.options.map((option) => option.optionKey);
  const displayNames = snapshot.options.map((option) => option.displayName);
  const trending = snapshot.options.filter((option) => option.communityTrendRank);

  assert.equal(snapshot.eventId, "2026-tcg-champion-decks");
  assert.equal(snapshot.status, "reviewed-taxonomy-awaiting-official-worlds-format");
  assert.match(snapshot.openingGate, /official 2026 Worlds source confirms the exact TCG format/i);
  assert.equal(snapshot.officialContext.rotationRule, "H, I, and J regulation marks");
  assert.equal(snapshot.officialContext.pitchBlackReleaseDate, "2026-07-17");
  assert.equal(snapshot.officialContext.worldsFormatStatus, "awaiting-exact-official-confirmation");
  assert.equal(snapshot.taxonomySource.sourcePayloadSha256, "1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8");
  assert.equal(snapshot.taxonomySource.sourceRowCount, 50);
  assert.equal(snapshot.taxonomySource.tournamentCount, 292);
  assert.equal(snapshot.taxonomySource.playerCount, 21000);
  assert.equal(snapshot.taxonomySource.matchCount, 47509);
  assert.equal(snapshot.options.length, 49);
  assert.equal(new Set(optionKeys).size, 49);
  assert.equal(new Set(displayNames).size, 49);
  assert.equal(snapshot.options[0].optionKey, "tcg-dragapult-ex");
  assert.equal(snapshot.options[0].displayName, "Dragapult");
  assert.equal(snapshot.options.at(-1).optionKey, "tcg-doublade-por");
  assert.equal(snapshot.options.at(-1).displayName, "Doublade");
  assert.equal(snapshot.options.some((option) => option.sourceSlug === "other"), false);
  assert.equal(snapshot.excludedSourceRows.length, 1);
  assert.equal(snapshot.excludedSourceRows[0].sourceSlug, "other");
  assert.match(snapshot.excludedSourceRows[0].reason, /unfair as one prediction option/i);
  assert.equal(trending.length, 12);
  assert.deepEqual(trending.map((option) => option.communityTrendRank), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.match(snapshot.taxonomySource.disclaimer, /does not confirm the official Worlds format/i);
});

test("migration 378 stages empty official-source pools and exposes only privacy-safe RPCs", () => {
  const migration = source("supabase/378-worlds-meta-prediction-infrastructure.sql");
  const preview = source("supabase/tests/378-worlds-meta-prediction-infrastructure-preview-regression.sql");
  assert.match(migration, /'2026-vgc-champion-team'[\s\S]+?'draft'[\s\S]+?'2026-tcg-champion-decks'[\s\S]+?'draft'[\s\S]+?'2026-go-champion-team'[\s\S]+?'draft'/i);
  assert.doesNotMatch(migration, /insert into public\.worlds_meta_options/i);
  assert.match(migration, /alter table public\.worlds_meta_entries enable row level security/i);
  assert.match(migration, /revoke all on table public\.worlds_meta_entries from public, anon, authenticated/i);
  assert.match(migration, /ranked\.user_id = auth\.uid\(\) or now\(\) >= \(select locks_at from selected_event\)/i);
  assert.doesNotMatch(migration, /'user_id', ranked\.user_id/i);
  assert.match(migration, /cardinality\(p_pick_keys\) <> v_event\.picks_required/i);
  assert.match(migration, /One or more picks are not in the reviewed option pool/i);
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/i);
  assert.match(migration, /p_confirmation_text <> 'FINALIZE WORLDS META'/i);
  assert.match(migration, /v_unlisted_champion := nullif\(btrim\(p_result_payload ->> 'unlisted_champion'\), ''\)/i);
  assert.match(migration, /An unlisted World Champion cannot also assign first place to a reviewed archetype/i);
  assert.match(migration, /worlds_meta_result_snapshots_immutable/i);
  assert.match(migration, /Worlds Meta Picks final snapshots are immutable/i);
  assert.match(migration, /grant execute on function public\.finalize_worlds_meta_result\(text, text, jsonb, text\) to service_role/i);
  assert.match(migration, /final_discipline_count/i);
  assert.match(migration, /discipline_count >= 2/i);
  assert.doesNotMatch(migration, /cron|scheduler|poll_interval|feed_url/i);
  assert.match(preview, /staged_event_rejected_entry/i);
  assert.match(preview, /other_entry_private_before_lock/i);
  assert.match(preview, /exact_roster_scores_100/i);
  assert.match(preview, /unlisted_champion_exclusive/i);
  assert.match(preview, /unlisted_champion_scores_known_placements/i);
  assert.match(preview, /fixtures_removed/i);
});

test("migration 379 opens only the pinned VGC pool and previews the real private save workflow", () => {
  const migration = source("supabase/379-open-worlds-2026-vgc-meta-picks.sql");
  const preview = source("supabase/tests/379-open-worlds-2026-vgc-meta-picks-preview-regression.sql");
  const optionRows = migration.match(/^\s*\('2026-vgc-champion-team', 'pc-[0-9-]+'/gm) || [];

  assert.equal(optionRows.length, 235);
  assert.match(migration, /requires the untouched staged VGC Meta Picks event from migration 378/i);
  assert.match(migration, /only opens a zero-option, zero-entry, zero-result event/i);
  assert.match(migration, /'pc-0003-000', 'Venusaur'/);
  assert.match(migration, /'pc-1019-000', 'Hydrapple'/);
  assert.match(migration, /official Regulation M-B pool must contain exactly 235 unique selectable options/i);
  assert.match(migration, /metadata \? 'community_trend_rank'\) <> 24/i);
  assert.match(migration, /set status = 'open'/i);
  assert.match(migration, /642fed0034500c778894e10ca33418cb06eabf9403136e8acce277047bccf4f6/);
  assert.doesNotMatch(migration, /on conflict/i);

  assert.match(preview, /own_entry_round_trip/i);
  assert.match(preview, /duplicate_pick_rejected/i);
  assert.match(preview, /unreviewed_pick_rejected/i);
  assert.match(preview, /featured_pick_rejected/i);
  assert.match(preview, /other_entry_private_before_lock/i);
  assert.match(preview, /fixtures_removed/i);
});

test("migration 380 seeds the TCG taxonomy but cannot open entries before official format confirmation", () => {
  const migration = source("supabase/380-seed-worlds-2026-tcg-meta-draft.sql");
  const preview = source("supabase/tests/380-seed-worlds-2026-tcg-meta-draft-preview-regression.sql");
  const optionRows = migration.match(/^\s*\('2026-tcg-champion-decks', 'tcg-[a-z0-9-]+'/gm) || [];

  assert.equal(optionRows.length, 49);
  assert.match(migration, /requires the untouched staged TCG Meta Picks event from migration 378/i);
  assert.match(migration, /only seeds a zero-option, zero-entry, zero-result TCG event/i);
  assert.match(migration, /'tcg-dragapult-ex', 'Dragapult'/);
  assert.match(migration, /'tcg-doublade-por', 'Doublade'/);
  assert.match(migration, /exactly 49 unique selectable archetypes/i);
  assert.match(migration, /metadata \? 'community_trend_rank'\) <> 12/i);
  assert.match(migration, /opening_gate.*awaiting-exact-official-worlds-format-confirmation/i);
  assert.match(migration, /status = 'draft'/i);
  assert.doesNotMatch(migration, /set status\s*=\s*'open'/i);
  assert.doesNotMatch(migration, /'tcg-other'/i);
  assert.doesNotMatch(migration, /on conflict/i);

  assert.match(preview, /draft_taxonomy_hub/i);
  assert.match(preview, /draft_event_rejected_entry/i);
  assert.match(preview, /no broad Other option/i);
  assert.match(preview, /fixtures_removed/i);
});

test("the Worlds prediction tabs mount the separate Meta challenge with safe staged copy", () => {
  const parent = source("src/components/WorldsPickSixteen.jsx");
  const component = source("src/components/WorldsMetaChallenge.jsx");
  assert.match(parent, /<WorldsMetaChallenge discipline=\{config\.key\} user=\{user\} \/>/);
  assert.match(parent, /href="#meta-picks">Predict the winning meta/);
  assert.match(component, /SEPARATE META COMPETITION/);
  assert.match(component, /This is separate from predicting the players/);
  assert.match(component, /No placeholder Pokémon or deck guesses are being treated as reviewed event options/);
  assert.match(component, /get_worlds_meta_hub/);
  assert.match(component, /save_worlds_meta_entry/);
  assert.match(component, /const draftDirtyRef = useRef\(false\)/);
  assert.match(component, /Move \$\{option\.display_name\} up/);
  assert.match(component, /Champion Deck ×2/);
  assert.match(component, /Trending is a starting point, not a prediction/);
  assert.match(component, /All reviewed \{options\.length\}/);
  assert.match(component, /Mega Evolutions are not separate options/);
  assert.match(component, /10 unofficial Limitless community events covering 737 teams/);
  assert.match(component, /21,000 deck classifications from 292 unofficial Limitless community tournaments/);
  assert.match(component, /The 49-archetype Pitch Black taxonomy is reviewed and frozen/);
  assert.match(component, /If a true rogue deck outside the frozen pool wins/);
  assert.match(component, /Reviewed pool required/);
  assert.match(component, /Automation disabled/);
});
