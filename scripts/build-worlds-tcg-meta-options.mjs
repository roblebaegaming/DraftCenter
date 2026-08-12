import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const OUTPUT_PATH = path.join(ROOT, "src/data/worlds-2026-tcg-meta-options.json");
const MIGRATION_PATH = path.join(ROOT, "supabase/380-seed-worlds-2026-tcg-meta-draft.sql");

const EVENT_ID = "2026-tcg-champion-decks";
const SOURCE_CHECKED_AT = "2026-08-11";
const OFFICIAL_ROTATION_URL = "https://community.pokemon.com/en-us/discussion/23170/letter-to-the-community-march-19-2026";
const OFFICIAL_PITCH_BLACK_URL = "https://www.pokemon.com/us/news/the-pokemon-tcg-mega-evolution-pitch-black-expansion-is-available-now";
const OFFICIAL_WORLDS_URL = "https://worlds.pokemon.com/en-us/competitors/";
const LIMITLESS_URL = "https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1";
const EXPECTED_SOURCE_ROW_COUNT = 50;
const EXPECTED_OPTION_COUNT = 49;
const EXPECTED_TRENDING_COUNT = 12;
const EXPECTED_TOURNAMENT_COUNT = 292;
const EXPECTED_PLAYER_COUNT = 21000;
const EXPECTED_MATCH_COUNT = 47509;
const EXPECTED_SOURCE_SHA256 = "1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const HTML_ENTITIES = Object.freeze({
  "&amp;": "&",
  "&#039;": "'",
  "&quot;": '"',
  "&ndash;": "\u2013",
});

export function decodeHtml(value) {
  return value.replace(/&(?:amp|#039|quot|ndash);/g, (entity) => HTML_ENTITIES[entity]);
}

function parseSource(html) {
  if (!/<option data-set="PBL" data-rotation="2026" selected>Pitch Black<\/option>/.test(html)) {
    throw new Error("The Limitless source is not pinned to the 2026 Pitch Black Standard format.");
  }
  if (!/<input[^>]+id="combine-variants"[^>]+checked/.test(html)) {
    throw new Error("The Limitless source is not combining related deck variants.");
  }

  const summary = html.match(/<p>([\d,]+) tournaments, ([\d,]+) players, ([\d,]+) matches<\/p>/);
  if (!summary) throw new Error("The Limitless cohort summary was not found.");

  const rows = [...html.matchAll(/<tr data-share="([^"]+)" data-winrate="([^"]+)"><td>(\d+)<\/td><td>[\s\S]*?<\/td><td><a href="([^"]+)">([^<]+)<\/a><\/td><td class="landscape-only">(\d+)<\/td><td>([^<]+)<\/td><td class="landscape-only"><a[^>]*>(\d+) - (\d+) - (\d+)<\/a><\/td><td><a[^>]*>([^<]+)%<\/a><\/td><\/tr>/g)]
    .map((match) => ({
      sourceRank: Number(match[3]),
      sourceSlug: match[4].match(/\/decks\/([^?]+)/)?.[1] || "",
      displayName: decodeHtml(match[5]),
      deckCount: Number(match[6]),
      sharePct: Number((Number(match[1]) * 100).toFixed(4)),
      wins: Number(match[8]),
      losses: Number(match[9]),
      ties: Number(match[10]),
      winRatePct: Number((Number(match[2]) * 100).toFixed(4)),
    }));

  const payload = {
    tournamentCount: Number(summary[1].replaceAll(",", "")),
    playerCount: Number(summary[2].replaceAll(",", "")),
    matchCount: Number(summary[3].replaceAll(",", "")),
    rows,
  };

  if (rows.length !== EXPECTED_SOURCE_ROW_COUNT
      || payload.tournamentCount !== EXPECTED_TOURNAMENT_COUNT
      || payload.playerCount !== EXPECTED_PLAYER_COUNT
      || payload.matchCount !== EXPECTED_MATCH_COUNT) {
    throw new Error("The pinned Limitless Pitch Black cohort changed. Review it before updating the TCG taxonomy.");
  }
  if (sha256(JSON.stringify(payload)) !== EXPECTED_SOURCE_SHA256) {
    throw new Error("The Limitless Pitch Black archetype rows changed. Review the taxonomy before replacing the pinned hash.");
  }

  const ranks = new Set();
  const slugs = new Set();
  for (const row of rows) {
    if (!Number.isInteger(row.sourceRank) || row.sourceRank < 1 || !/^[a-z0-9-]+$/.test(row.sourceSlug)
        || !row.displayName || !Number.isInteger(row.deckCount) || row.deckCount < 1) {
      throw new Error(`Malformed Limitless archetype row: ${JSON.stringify(row)}`);
    }
    if (ranks.has(row.sourceRank) || slugs.has(row.sourceSlug)) {
      throw new Error(`Duplicate Limitless archetype rank or slug: ${row.sourceRank} / ${row.sourceSlug}`);
    }
    ranks.add(row.sourceRank);
    slugs.add(row.sourceSlug);
  }

  return payload;
}

function buildSnapshot(payload) {
  const excluded = payload.rows.filter((row) => row.sourceSlug === "other");
  if (excluded.length !== 1 || excluded[0].displayName !== "Other") {
    throw new Error("The broad Limitless Other bucket must be excluded exactly once.");
  }
  const concreteRows = payload.rows.filter((row) => row.sourceSlug !== "other");
  if (concreteRows.length !== EXPECTED_OPTION_COUNT) throw new Error("Expected 49 concrete TCG archetypes.");

  return {
    schemaVersion: 1,
    eventId: EVENT_ID,
    format: "2026 Standard candidate: H/I/J through Pitch Black",
    status: "reviewed-taxonomy-awaiting-official-worlds-format",
    sourceCheckedAt: SOURCE_CHECKED_AT,
    openingGate: "Keep draft-locked until an official 2026 Worlds source confirms the exact TCG format and Pitch Black eligibility.",
    officialContext: {
      rotationUrl: OFFICIAL_ROTATION_URL,
      rotationRule: "H, I, and J regulation marks",
      pitchBlackUrl: OFFICIAL_PITCH_BLACK_URL,
      pitchBlackReleaseDate: "2026-07-17",
      worldsCompetitorUrl: OFFICIAL_WORLDS_URL,
      worldsFormatStatus: "awaiting-exact-official-confirmation",
    },
    taxonomySource: {
      url: LIMITLESS_URL,
      name: "Limitless Tournament Platform combined archetypes",
      status: "unofficial-community-tournament-observations",
      sourcePayloadSha256: EXPECTED_SOURCE_SHA256,
      sourceRowCount: payload.rows.length,
      tournamentCount: payload.tournamentCount,
      playerCount: payload.playerCount,
      matchCount: payload.matchCount,
      concreteSharePct: Number(concreteRows.reduce((sum, row) => sum + row.sharePct, 0).toFixed(4)),
      disclaimer: "Community metagame data supports browsing and taxonomy only; it does not confirm the official Worlds format or predict the winner.",
    },
    excludedSourceRows: excluded.map((row) => ({
      ...row,
      reason: "The broad Other bucket combines unrelated rogue decks and would be unfair as one prediction option.",
    })),
    options: concreteRows.map((row, index) => ({
      optionKey: `tcg-${row.sourceSlug}`,
      sourceSlug: row.sourceSlug,
      displayName: row.displayName,
      sourceRank: row.sourceRank,
      sourceOrder: index + 1,
      deckCount: row.deckCount,
      sharePct: row.sharePct,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      winRatePct: row.winRatePct,
      ...(index < EXPECTED_TRENDING_COUNT ? { communityTrendRank: index + 1 } : {}),
    })),
  };
}

function buildMigration(snapshot) {
  const rows = snapshot.options.map((option) => {
    const groupLabel = option.communityTrendRank
      ? `Trending #${option.communityTrendRank} · current community data`
      : "Pitch Black community field";
    const metadata = {
      taxonomy_key: option.sourceSlug,
      source_rank: option.sourceRank,
      deck_count: option.deckCount,
      share_pct: option.sharePct,
      wins: option.wins,
      losses: option.losses,
      ties: option.ties,
      win_rate_pct: option.winRatePct,
      source_kind: "limitless-combined-archetype",
      ...(option.communityTrendRank ? { community_trend_rank: option.communityTrendRank } : {}),
    };
    return `  (${sql(EVENT_ID)}, ${sql(option.optionKey)}, ${sql(option.displayName)}, ${sql(groupLabel)}, true, ${option.sourceOrder}, ${sql(LIMITLESS_URL)}, ${sql(SOURCE_CHECKED_AT)}, ${sql(JSON.stringify(metadata))}::jsonb)`;
  }).join(",\n");

  return `-- Seed the reviewed 2026 TCG Worlds Meta Picks archetype taxonomy.
-- Migration 378 must be applied first. This migration deliberately leaves the
-- event in draft until an exact official Worlds format source confirms that
-- the Pitch Black Standard pool is eligible. It does not open entries.

begin;

lock table public.worlds_meta_events in row exclusive mode;
lock table public.worlds_meta_options in share row exclusive mode;
lock table public.worlds_meta_entries in share row exclusive mode;

do $preflight$
declare
  v_event public.worlds_meta_events%rowtype;
begin
  select * into v_event
  from public.worlds_meta_events
  where id = ${sql(EVENT_ID)};

  if not found
    or v_event.discipline <> 'tcg'
    or v_event.prediction_type <> 'deck_archetype'
    or v_event.status <> 'draft'
    or v_event.picks_required <> 5
    or v_event.result_size <> 64
    or not v_event.requires_featured_pick
    or v_event.current_result_snapshot_id is not null then
    raise exception 'Migration 380 requires the untouched staged TCG Meta Picks event from migration 378.';
  end if;

  if exists (select 1 from public.worlds_meta_options where event_id = ${sql(EVENT_ID)})
     or exists (select 1 from public.worlds_meta_entries where event_id = ${sql(EVENT_ID)})
     or exists (select 1 from public.worlds_meta_result_snapshots where event_id = ${sql(EVENT_ID)}) then
    raise exception 'Migration 380 only seeds a zero-option, zero-entry, zero-result TCG event.';
  end if;
end;
$preflight$;

insert into public.worlds_meta_options (
  event_id, option_key, display_name, group_label, is_selectable, source_order,
  source_url, source_checked_at, metadata
) values
${rows};

do $verify_pool$
begin
  if (select count(*) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)}) <> ${EXPECTED_OPTION_COUNT}
     or (select count(distinct option_key) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)}) <> ${EXPECTED_OPTION_COUNT}
     or (select count(distinct source_order) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)}) <> ${EXPECTED_OPTION_COUNT}
     or (select count(*) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)} and is_selectable) <> ${EXPECTED_OPTION_COUNT} then
    raise exception 'The reviewed TCG taxonomy must contain exactly ${EXPECTED_OPTION_COUNT} unique selectable archetypes.';
  end if;

  if exists (
    select 1 from public.worlds_meta_options
    where event_id = ${sql(EVENT_ID)}
      and (source_url <> ${sql(LIMITLESS_URL)} or source_checked_at <> ${sql(SOURCE_CHECKED_AT)}::date)
  ) then
    raise exception 'Every TCG Meta Picks option must retain the reviewed taxonomy source and check date.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)} and metadata ? 'community_trend_rank') <> ${EXPECTED_TRENDING_COUNT} then
    raise exception 'The beginner TCG Trending cohort must contain exactly ${EXPECTED_TRENDING_COUNT} archetypes.';
  end if;
end;
$verify_pool$;

update public.worlds_meta_events
set option_source_url = ${sql(LIMITLESS_URL)},
    source_checked_at = ${sql(SOURCE_CHECKED_AT)}::date,
    scoring_rules = scoring_rules || ${sql(JSON.stringify({
      taxonomy_version: "pitch-black-combined-2026-08-11",
      taxonomy_option_count: EXPECTED_OPTION_COUNT,
      taxonomy_source_row_count: EXPECTED_SOURCE_ROW_COUNT,
      taxonomy_source_sha256: EXPECTED_SOURCE_SHA256,
      community_trending_option_count: EXPECTED_TRENDING_COUNT,
      community_tournament_count: EXPECTED_TOURNAMENT_COUNT,
      community_player_count: EXPECTED_PLAYER_COUNT,
      community_match_count: EXPECTED_MATCH_COUNT,
      community_status: "unofficial-community-tournament-observations",
      opening_gate: "awaiting-exact-official-worlds-format-confirmation",
      official_rotation_url: OFFICIAL_ROTATION_URL,
      official_pitch_black_url: OFFICIAL_PITCH_BLACK_URL,
      official_worlds_competitor_url: OFFICIAL_WORLDS_URL,
    }))}::jsonb,
    updated_at = now()
where id = ${sql(EVENT_ID)};

do $verify_draft$
begin
  if not exists (
    select 1 from public.worlds_meta_events
    where id = ${sql(EVENT_ID)}
      and status = 'draft'
      and option_source_url = ${sql(LIMITLESS_URL)}
      and (scoring_rules ->> 'taxonomy_option_count')::integer = ${EXPECTED_OPTION_COUNT}
      and scoring_rules ->> 'opening_gate' = 'awaiting-exact-official-worlds-format-confirmation'
  ) then
    raise exception 'The reviewed TCG taxonomy did not remain safely draft-locked.';
  end if;
end;
$verify_draft$;

commit;
`;
}

function reconstructPayload(snapshot) {
  const optionRows = snapshot.options.map((option) => ({
    sourceRank: option.sourceRank,
    sourceSlug: option.sourceSlug,
    displayName: option.displayName,
    deckCount: option.deckCount,
    sharePct: option.sharePct,
    wins: option.wins,
    losses: option.losses,
    ties: option.ties,
    winRatePct: option.winRatePct,
  }));
  const excludedRows = snapshot.excludedSourceRows.map(({ reason, ...row }) => row);
  return {
    tournamentCount: snapshot.taxonomySource.tournamentCount,
    playerCount: snapshot.taxonomySource.playerCount,
    matchCount: snapshot.taxonomySource.matchCount,
    rows: [...optionRows, ...excludedRows].sort((left, right) => left.sourceRank - right.sourceRank),
  };
}

function validateExisting() {
  const snapshot = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  const payload = reconstructPayload(snapshot);
  if (snapshot.options.length !== EXPECTED_OPTION_COUNT
      || snapshot.taxonomySource.sourcePayloadSha256 !== EXPECTED_SOURCE_SHA256
      || sha256(JSON.stringify(payload)) !== EXPECTED_SOURCE_SHA256) {
    throw new Error("The committed TCG taxonomy does not reproduce the pinned Limitless source payload.");
  }
  const expectedSnapshot = buildSnapshot(payload);
  if (JSON.stringify(snapshot) !== JSON.stringify(expectedSnapshot)) {
    throw new Error("The committed TCG taxonomy snapshot is not synchronized with its pinned source.");
  }
  const expectedMigration = buildMigration(snapshot);
  const actualMigration = fs.readFileSync(MIGRATION_PATH, "utf8");
  if (actualMigration !== expectedMigration) throw new Error("Migration 380 is not synchronized with the committed TCG taxonomy snapshot.");
  console.log(`Verified ${snapshot.options.length} concrete TCG archetypes and draft migration 380.`);
}

async function fetchSourceSnapshot() {
  const response = await fetch(LIMITLESS_URL, { headers: { "user-agent": "DraftCenter reviewed TCG taxonomy snapshot" } });
  if (!response.ok) throw new Error(`Limitless TCG request failed with HTTP ${response.status}.`);
  return buildSnapshot(parseSource(await response.text()));
}

async function verifyCurrentSource() {
  const sourceSnapshot = await fetchSourceSnapshot();
  const committedSnapshot = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  if (JSON.stringify(sourceSnapshot) !== JSON.stringify(committedSnapshot)) {
    throw new Error("The current Limitless TCG source no longer matches the committed reviewed taxonomy.");
  }
  validateExisting();
  console.log("Verified the current Pitch Black community field against the committed TCG taxonomy.");
}

async function main() {
  if (process.argv.includes("--verify-source")) return verifyCurrentSource();
  if (process.argv.includes("--check")) return validateExisting();
  const snapshot = await fetchSourceSnapshot();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  fs.writeFileSync(MIGRATION_PATH, buildMigration(snapshot), "utf8");
  console.log(`Wrote ${snapshot.options.length} concrete TCG archetypes and draft migration 380.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
