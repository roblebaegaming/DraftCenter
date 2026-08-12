import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = path.join(ROOT, "src/data/worlds-2026-vgc-meta-options.json");
const MIGRATION_PATH = path.join(ROOT, "supabase/379-open-worlds-2026-vgc-meta-picks.sql");
const COMMUNITY_PATH = path.join(ROOT, "data/competitive/tournaments/limitless-vgc-2026-08-reg-mb.json");

const EVENT_ID = "2026-vgc-champion-team";
const NOTICE_URL = "https://champions-news.pokemon-home.com/en/page/776.html";
const ELIGIBLE_URL = "https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178066986988lmoqpm/en/pokemon.html";
const SOURCE_CHECKED_AT = "2026-08-11";
const EXPECTED_COUNT = 235;
const EXPECTED_SOURCE_SHA256 = "642fed0034500c778894e10ca33418cb06eabf9403136e8acce277047bccf4f6";

// Community observations never determine eligibility. Only unambiguous
// tournament keys are mapped to the official species/form option they describe.
const COMMUNITY_TO_OFFICIAL = Object.freeze({
  kingambit: "0983-000",
  garchomp: "0445-000",
  whimsicott: "0547-000",
  charizard: "0006-000",
  "charizard-mega-x": "0006-000",
  "charizard-mega-y": "0006-000",
  "staraptor-mega": "0398-000",
  staraptor: "0398-000",
  incineroar: "0727-000",
  sinistcha: "1013-000",
  sneasler: "0903-000",
  farigiraf: "0981-000",
  sylveon: "0700-000",
  "floette-mega": "0670-005",
  floette: "0670-005",
  archaludon: "1018-000",
  pelipper: "0279-000",
  grimmsnarl: "0861-000",
  milotic: "0350-000",
  gholdengo: "1000-000",
  "raichu-mega-x": "0026-000",
  "raichu-mega-y": "0026-000",
  raichu: "0026-000",
  "delphox-mega": "0655-000",
  delphox: "0655-000",
  "tyranitar-mega": "0248-000",
  tyranitar: "0248-000",
  excadrill: "0530-000",
  venusaur: "0003-000",
  "venusaur-mega": "0003-000",
  "swampert-mega": "0260-000",
  swampert: "0260-000",
  "arcanine-hisui": "0059-001",
  glimmora: "0970-000",
  "ninetales-alola": "0038-001",
  "froslass-mega": "0478-000",
  froslass: "0478-000",
  "aerodactyl-mega": "0142-000",
  aerodactyl: "0142-000",
  "metagross-mega": "0376-000",
  metagross: "0376-000",
  "scovillain-mega": "0952-000",
  scovillain: "0952-000",
  "kommo-o": "0784-000",
  maushold: "0925-000",
  "gengar-mega": "0094-000",
  gengar: "0094-000",
  "lycanroc-dusk": "0745-002",
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseOfficialRows(html) {
  const match = html.match(/<script>const pokemons = (\[.*?\]);const noPrefix/s);
  if (!match) throw new Error("The official eligible-Pokémon payload was not found.");
  const rows = JSON.parse(match[1]);
  if (rows.length !== EXPECTED_COUNT) throw new Error(`Expected ${EXPECTED_COUNT} official options, received ${rows.length}.`);
  if (sha256(JSON.stringify(rows)) !== EXPECTED_SOURCE_SHA256) {
    throw new Error("The official Regulation M-B list changed. Review the source before updating the pinned snapshot hash.");
  }
  const keys = new Set();
  const names = new Set();
  for (const [key, enabled, displayName] of rows) {
    if (!/^\d{4}-\d{3}$/.test(key) || enabled !== 1 || typeof displayName !== "string" || displayName.length < 2) {
      throw new Error(`Malformed official option: ${JSON.stringify([key, enabled, displayName])}`);
    }
    if (keys.has(key) || names.has(displayName)) throw new Error(`Duplicate official option: ${key} / ${displayName}`);
    keys.add(key);
    names.add(displayName);
  }
  return rows;
}

function buildCommunitySignals(eligibleKeys) {
  const artifact = JSON.parse(fs.readFileSync(COMMUNITY_PATH, "utf8"));
  const eventCount = artifact.events.length;
  const teamCount = artifact.events.reduce((sum, event) => sum + event.team_count, 0);
  if (eventCount !== 10 || teamCount !== 737) throw new Error("The pinned community cohort changed; review it before rebuilding VGC Meta Picks.");

  const totals = new Map();
  for (const event of artifact.events) {
    if (event.is_official || event.event_kind !== "online-community") throw new Error("The trend cohort must remain explicitly unofficial community data.");
    for (const team of event.teams) {
      for (const member of team.roster) {
        const officialKey = COMMUNITY_TO_OFFICIAL[member.pokemon_key];
        if (!officialKey) continue;
        if (!eligibleKeys.has(officialKey)) throw new Error(`Community mapping points outside the official pool: ${member.pokemon_key}`);
        const signal = totals.get(officialKey) || { teams: 0, topCutTeams: 0, finalists: 0, champions: 0 };
        signal.teams += 1;
        signal.topCutTeams += team.made_top_cut ? 1 : 0;
        signal.finalists += team.is_finalist ? 1 : 0;
        signal.champions += team.is_champion ? 1 : 0;
        totals.set(officialKey, signal);
      }
    }
  }

  const ranked = [...totals.entries()]
    .sort(([, left], [, right]) => right.teams - left.teams || right.topCutTeams - left.topCutTeams)
    .slice(0, 24);
  return {
    eventCount,
    teamCount,
    signals: new Map(ranked.map(([key, signal], index) => [key, { ...signal, rank: index + 1 }])),
  };
}

function buildSnapshot(rows) {
  const eligibleKeys = new Set(rows.map(([key]) => key));
  const trends = buildCommunitySignals(eligibleKeys);
  return {
    schemaVersion: 1,
    eventId: EVENT_ID,
    format: "Pokémon Champions Regulation M-B",
    status: "official-eligible-pool-reviewed",
    sourceCheckedAt: SOURCE_CHECKED_AT,
    source: {
      noticeUrl: NOTICE_URL,
      eligiblePokemonUrl: ELIGIBLE_URL,
      noticeUpdatedLabel: "Updated on August 5",
      officialPayloadSha256: EXPECTED_SOURCE_SHA256,
      optionCount: EXPECTED_COUNT,
    },
    communityTrendContext: {
      sourceName: "Limitless Tournament Platform",
      sourceDocumentationUrl: "https://docs.limitlesstcg.com/developer/tournaments",
      status: "unofficial-anonymous-community-observations",
      eventCount: trends.eventCount,
      teamCount: trends.teamCount,
      disclaimer: "Trending labels are not official Worlds odds and never determine eligibility.",
    },
    options: rows.map(([officialKey, , displayName], index) => {
      const [nationalDex, formIndex] = officialKey.split("-");
      const trend = trends.signals.get(officialKey) || null;
      return {
        optionKey: `pc-${officialKey}`,
        officialKey,
        displayName,
        nationalDex: Number(nationalDex),
        formIndex: Number(formIndex),
        sourceOrder: index + 1,
        ...(trend ? { communityTrend: trend } : {}),
      };
    }),
  };
}

function buildMigration(snapshot) {
  const rows = snapshot.options.map((option) => {
    const trend = option.communityTrend;
    const groupLabel = trend ? `Trending #${trend.rank} · community data` : "Regulation M-B";
    const metadata = {
      official_key: option.officialKey,
      national_dex: option.nationalDex,
      form_index: option.formIndex,
      source_kind: "official_regulation_m_b",
      ...(trend ? {
        community_trend_rank: trend.rank,
        community_team_count: trend.teams,
        community_top_cut_count: trend.topCutTeams,
        community_finalist_count: trend.finalists,
        community_champion_count: trend.champions,
        community_event_count: snapshot.communityTrendContext.eventCount,
        community_cohort_team_count: snapshot.communityTrendContext.teamCount,
        community_signal_status: snapshot.communityTrendContext.status,
      } : {}),
    };
    return `  (${sql(EVENT_ID)}, ${sql(option.optionKey)}, ${sql(option.displayName)}, ${sql(groupLabel)}, true, ${option.sourceOrder}, ${sql(ELIGIBLE_URL)}, ${sql(SOURCE_CHECKED_AT)}, ${sql(JSON.stringify(metadata))}::jsonb)`;
  }).join(",\n");

  return `-- Seed and open the reviewed official Regulation M-B option pool for
-- the 2026 VGC Worlds Meta Picks competition. Migration 378 must be applied
-- first. Community observations label a bounded Trending view but never add
-- options or determine eligibility.

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
    or v_event.discipline <> 'vgc'
    or v_event.prediction_type <> 'champion_roster'
    or v_event.status <> 'draft'
    or v_event.picks_required <> 6
    or v_event.result_size <> 6
    or v_event.requires_featured_pick
    or v_event.current_result_snapshot_id is not null then
    raise exception 'Migration 379 requires the untouched staged VGC Meta Picks event from migration 378.';
  end if;

  if exists (select 1 from public.worlds_meta_options where event_id = ${sql(EVENT_ID)})
     or exists (select 1 from public.worlds_meta_entries where event_id = ${sql(EVENT_ID)})
     or exists (select 1 from public.worlds_meta_result_snapshots where event_id = ${sql(EVENT_ID)}) then
    raise exception 'Migration 379 only opens a zero-option, zero-entry, zero-result event.';
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
  if (select count(*) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)}) <> ${EXPECTED_COUNT}
     or (select count(distinct option_key) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)}) <> ${EXPECTED_COUNT}
     or (select count(distinct source_order) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)}) <> ${EXPECTED_COUNT}
     or (select count(*) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)} and is_selectable) <> ${EXPECTED_COUNT} then
    raise exception 'The official Regulation M-B pool must contain exactly ${EXPECTED_COUNT} unique selectable options.';
  end if;

  if exists (
    select 1 from public.worlds_meta_options
    where event_id = ${sql(EVENT_ID)}
      and (source_url <> ${sql(ELIGIBLE_URL)} or source_checked_at <> ${sql(SOURCE_CHECKED_AT)}::date)
  ) then
    raise exception 'Every VGC Meta Picks option must retain the reviewed official source and check date.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = ${sql(EVENT_ID)} and metadata ? 'community_trend_rank') <> 24 then
    raise exception 'The bounded community Trending cohort must contain exactly 24 official options.';
  end if;
end;
$verify_pool$;

update public.worlds_meta_events
set status = 'open',
    option_source_url = ${sql(ELIGIBLE_URL)},
    source_checked_at = ${sql(SOURCE_CHECKED_AT)}::date,
    scoring_rules = scoring_rules || ${sql(JSON.stringify({
      option_pool_version: "regulation-m-b-2026-08-11",
      option_pool_count: EXPECTED_COUNT,
      option_pool_sha256: EXPECTED_SOURCE_SHA256,
      option_pool_notice_url: NOTICE_URL,
      community_trending_option_count: 24,
      community_trending_status: "unofficial-anonymous-community-observations",
    }))}::jsonb,
    updated_at = now()
where id = ${sql(EVENT_ID)};

do $verify_open$
begin
  if not exists (
    select 1 from public.worlds_meta_events
    where id = ${sql(EVENT_ID)}
      and status = 'open'
      and option_source_url = ${sql(ELIGIBLE_URL)}
      and (scoring_rules ->> 'option_pool_count')::integer = ${EXPECTED_COUNT}
  ) then
    raise exception 'The reviewed VGC Meta Picks event did not open with the pinned pool.';
  end if;
end;
$verify_open$;

commit;
`;
}

function validateExisting() {
  const snapshot = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  if (snapshot.options.length !== EXPECTED_COUNT || snapshot.source.officialPayloadSha256 !== EXPECTED_SOURCE_SHA256) {
    throw new Error("The committed VGC option snapshot does not match the pinned official source contract.");
  }
  const reconstructedOfficialRows = snapshot.options.map((option) => [option.officialKey, 1, option.displayName]);
  if (sha256(JSON.stringify(reconstructedOfficialRows)) !== EXPECTED_SOURCE_SHA256) {
    throw new Error("The committed VGC options do not reproduce the pinned official payload hash.");
  }
  const expectedSnapshot = buildSnapshot(reconstructedOfficialRows);
  if (JSON.stringify(snapshot) !== JSON.stringify(expectedSnapshot)) {
    throw new Error("The committed VGC option snapshot is not synchronized with its pinned sources.");
  }
  const expectedMigration = buildMigration(snapshot);
  const actualMigration = fs.readFileSync(MIGRATION_PATH, "utf8");
  if (actualMigration !== expectedMigration) throw new Error("Migration 379 is not synchronized with the committed VGC option snapshot.");
  console.log(`Verified ${snapshot.options.length} official VGC Meta Picks options and migration 379.`);
}

async function fetchOfficialSnapshot() {
  const response = await fetch(ELIGIBLE_URL, { headers: { "user-agent": "DraftCenter reviewed source snapshot" } });
  if (!response.ok) throw new Error(`Official eligible-Pokémon request failed with HTTP ${response.status}.`);
  return buildSnapshot(parseOfficialRows(await response.text()));
}

async function verifyOfficialSource() {
  const officialSnapshot = await fetchOfficialSnapshot();
  const committedSnapshot = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  if (JSON.stringify(officialSnapshot) !== JSON.stringify(committedSnapshot)) {
    throw new Error("The current official VGC source no longer matches the committed reviewed snapshot.");
  }
  validateExisting();
  console.log("Verified the current official Regulation M-B page against the committed snapshot.");
}

async function main() {
  if (process.argv.includes("--verify-source")) return verifyOfficialSource();
  if (process.argv.includes("--check")) return validateExisting();
  const snapshot = await fetchOfficialSnapshot();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  fs.writeFileSync(MIGRATION_PATH, buildMigration(snapshot), "utf8");
  console.log(`Wrote ${snapshot.options.length} official VGC options and migration 379.`);
}

await main();
