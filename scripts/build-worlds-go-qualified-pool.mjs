import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_PAGE_URL = "https://worlds.pokemon.com/en-us/about/qualified/";
const SOURCE_CHECKED_AT = "2026-08-11";
const EXPECTED_COMPONENT_LAST_MODIFIED_AT = "2026-08-04T22:48:33.838Z";
const EXPECTED_RAW_ROWS = 370;
const EXPECTED_UNIQUE_COMPETITORS = 369;

const countryCode3 = Object.freeze({
  AR: "ARG", AU: "AUS", BE: "BEL", BR: "BRA", CA: "CAN", CH: "CHE", CL: "CHL",
  CN: "CHN", CO: "COL", CZ: "CZE", DE: "DEU", ES: "ESP", FR: "FRA", GB: "GBR",
  HK: "HKG", ID: "IDN", IL: "ISR", IN: "IND", IT: "ITA", JP: "JPN", KR: "KOR",
  MX: "MEX", NL: "NLD", NO: "NOR", NZ: "NZL", PE: "PER", PH: "PHL", PL: "POL",
  PT: "PRT", SA: "SAU", SE: "SWE", SG: "SGP", SV: "SLV", TH: "THA", TW: "TWN",
  US: "USA", ZA: "ZAF",
});

const regionLabels = Object.freeze({
  NA: "North America",
  EU: "Europe",
  LATAM: "Latin America",
  Oceania: "Oceania",
  Middle_East: "Middle East & South Africa",
  Japan: "Japan",
  South_Korea: "South Korea",
  Chinese_Mainland: "Chinese Mainland",
  India: "India",
  Indonesia: "Indonesia",
  Thailand: "Thailand",
  Taiwan: "Taiwan",
  Singapore: "Singapore",
  Philippines: "Philippines",
  Hong_Kong: "Hong Kong",
});

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeIdentity(value) {
  return value.normalize("NFKC").replace(/[\u2000-\u200D\u202F\u2060\uFEFF]/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

function slugify(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const rawSnapshotPath = path.join(repositoryRoot, "src", "data", "worlds-2026-go-qualified-raw.json");
const registryPath = path.join(repositoryRoot, "src", "data", "worlds-2026-go-sources.json");
const migrationPath = path.join(repositoryRoot, "supabase", "377-open-worlds-2026-pokemon-go-pick-ten.sql");

const snapshot = JSON.parse(await fs.readFile(rawSnapshotPath, "utf8"));
requireValue(snapshot.sourceUrl === OFFICIAL_PAGE_URL, "The reviewed GO snapshot source URL changed.");
requireValue(snapshot.sourceCheckedAt === SOURCE_CHECKED_AT, "The reviewed GO snapshot date changed.");
requireValue(snapshot.componentLastModifiedAt === EXPECTED_COMPONENT_LAST_MODIFIED_AT, `Official component changed at ${snapshot.componentLastModifiedAt || "an unknown time"}; review the source before regenerating.`);
requireValue(snapshot.game === "GO" && Array.isArray(snapshot.rows), "The reviewed GO snapshot is malformed.");
const rawRows = snapshot.rows;
requireValue(rawRows.length === EXPECTED_RAW_ROWS, `Expected ${EXPECTED_RAW_ROWS} GO rows, received ${rawRows.length}.`);

const identityGroups = new Map();
for (const [index, row] of rawRows.entries()) {
  const displayName = String(row.displayName || "").replace(/\s+/g, " ").trim();
  requireValue(displayName && row.countryCode && row.region, `Official GO row ${index + 1} is incomplete.`);
  const key = `${normalizeIdentity(displayName)}\u0000${row.countryCode}`;
  const group = identityGroups.get(key) || [];
  group.push({ index, displayName, row });
  identityGroups.set(key, group);
}

const duplicateGroups = [...identityGroups.values()].filter((group) => group.length > 1);
requireValue(duplicateGroups.length === 1, `Expected one reviewed GO duplicate identity, received ${duplicateGroups.length}.`);
requireValue(
  duplicateGroups[0].every(({ displayName, row }) => normalizeIdentity(displayName) === "yuki kishida" && row.countryCode === "JP")
    && duplicateGroups[0].length === 2,
  "The official GO duplicate identity changed; review it before regenerating.",
);

const seenIdentities = new Set();
const competitors = [];
for (const [index, row] of rawRows.entries()) {
  const sourceDisplayName = String(row.displayName || "").replace(/\s+/g, " ").trim();
  const identity = `${normalizeIdentity(sourceDisplayName)}\u0000${row.countryCode}`;
  if (seenIdentities.has(identity)) continue;
  seenIdentities.add(identity);

  const group = identityGroups.get(identity);
  const name = normalizeIdentity(sourceDisplayName) === "yuki kishida" ? "Yuki Kishida" : sourceDisplayName;
  const country = countryCode3[row.countryCode];
  const region = row.region;
  requireValue(country, `GO row ${index + 1} uses unmapped country ${row.countryCode}.`);
  requireValue(Object.values(regionLabels).includes(region), `GO row ${index + 1} uses unmapped region ${row.region}.`);
  const slug = slugify(name);
  requireValue(slug, `GO row ${index + 1} did not produce a slug.`);

  competitors.push({
    slug,
    name,
    countryCode: country,
    countryCode2: row.countryCode,
    region,
    division: "Open",
    qualification: "2026 World Championships invitation earned",
    attendanceStatus: "invite_earned",
    sourceOrder: competitors.length + 1,
    ...(group.length > 1 || name !== sourceDisplayName ? { sourceDisplayName } : {}),
  });
}

requireValue(competitors.length === EXPECTED_UNIQUE_COMPETITORS, `Expected ${EXPECTED_UNIQUE_COMPETITORS} unique GO competitors, received ${competitors.length}.`);
requireValue(new Set(competitors.map(({ slug }) => slug)).size === competitors.length, "GO competitor slugs are not unique.");
requireValue(new Set(competitors.map(({ sourceOrder }) => sourceOrder)).size === competitors.length, "GO source orders are not unique.");

const regionCounts = Object.fromEntries([...new Set(competitors.map(({ region }) => region))].map((region) => [
  region,
  competitors.filter((competitor) => competitor.region === region).length,
]));

const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
Object.assign(registry, {
  division: "Open",
  rosterStatus: "official-qualified-list-reviewed",
  rosterReady: true,
  predictionStatus: "open",
  sourceCheckedAt: SOURCE_CHECKED_AT,
  competitorPage: {
    url: OFFICIAL_PAGE_URL,
    status: "official-qualified-identities-published-registration-and-pools-pending",
  },
  predictionDesign: {
    entryUnit: "individual",
    status: "pick-10-with-your-champion-open",
    pickCount: 10,
    selectionLabel: "Your Champion",
    selectionMultiplier: 2,
    doNotAssume: [
      "Do not label the qualified-competitor list as confirmed registration or attendance.",
      "Do not infer private age or treat the open competition as an adult-only guarantee.",
      "Do not treat the empty organizer shell as a final pool assignment or pairing source.",
    ],
  },
  sourceUrl: OFFICIAL_PAGE_URL,
  status: "invite-earned-not-attendance-confirmed",
  officialQualifiedList: {
    url: OFFICIAL_PAGE_URL,
    pageDescription: snapshot.pageDescription,
    componentLastModifiedAt: snapshot.componentLastModifiedAt,
    rawGoRows: rawRows.length,
    duplicateRowsExcluded: rawRows.length - competitors.length,
    deduplicatedGoCompetitors: competitors.length,
    regionCounts,
    duplicateSourceIdentities: [{
      nameVariants: duplicateGroups[0].map(({ displayName }) => displayName),
      countryCode: "JPN",
      kept: "Yuki Kishida",
    }],
  },
  competitors,
});

registry.tournamentRules.worldsStructureStatus = "official-phase-structure-and-qualified-list-published-registration-pools-and-pairings-pending";
registry.tournamentRules.unpublished = [
  "final registered Trainer roster",
  "pool assignments",
  "pairings",
  "exact match schedule",
];
registry.sources = [
  { label: "Official 2026 Worlds qualified competitors", url: OFFICIAL_PAGE_URL },
  ...registry.sources.filter((source) => source.url !== OFFICIAL_PAGE_URL),
];

await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

const insertRows = competitors.map((competitor) => `  (${[
  "2026-pokemon-go",
  competitor.slug,
  competitor.name,
  competitor.countryCode,
  competitor.region,
  competitor.qualification,
  competitor.attendanceStatus,
].map(sql).join(", ")}, true, ${competitor.sourceOrder}, ${sql(OFFICIAL_PAGE_URL)}, ${sql(SOURCE_CHECKED_AT)})`).join(",\n");

const migration = `-- Publish the reviewed official 2026 Pokémon GO qualified-competitor pool and open Pick 10.
-- The source records earned invitations, not confirmed registration, attendance, or pool assignments.

begin;

lock table public.worlds_pick_events in row exclusive mode;
lock table public.worlds_pick_competitors in row exclusive mode;

do $preflight$
begin
  if (select count(*) from public.worlds_pick_events where id = '2026-pokemon-go') <> 1 then
    raise exception 'Expected exactly one staged 2026 Pokémon GO event.';
  end if;

  if exists (
    select 1 from public.worlds_pick_events
    where id = '2026-pokemon-go'
      and (status <> 'draft' or discipline <> 'go' or entry_unit <> 'individual'
        or division <> 'Open' or picks_required <> 10
        or locks_at <> '2026-08-28T07:00:00Z'::timestamptz)
  ) then
    raise exception 'The staged 2026 Pokémon GO contract changed; review it before opening entries.';
  end if;

  if exists (select 1 from public.worlds_pick_competitors where event_id = '2026-pokemon-go') then
    raise exception 'Pokémon GO competitors already exist; reconcile them before applying migration 377.';
  end if;

  if exists (select 1 from public.worlds_pick_entries where event_id = '2026-pokemon-go') then
    raise exception 'Pokémon GO entries already exist; migration 377 only opens a zero-entry event.';
  end if;

  if (select count(*) from public.worlds_result_sources where event_id = '2026-pokemon-go') <> 1
     or exists (
       select 1 from public.worlds_result_sources
       where event_id = '2026-pokemon-go'
         and (enabled or state <> 'disabled' or feed_url is not null or external_event_id is not null)
     ) then
    raise exception 'The Pokémon GO result source must remain disabled and unconfigured.';
  end if;

  if has_table_privilege('anon', 'public.worlds_pick_competitors', 'select')
     or has_table_privilege('authenticated', 'public.worlds_pick_entries', 'select') then
    raise exception 'Direct Worlds table reads must remain revoked.';
  end if;

  if not has_function_privilege('anon', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_worlds_pick_entry(text,text[],text)', 'execute') then
    raise exception 'The Worlds Pick 10 RPC grants are incomplete.';
  end if;
end;
$preflight$;

insert into public.worlds_pick_competitors (
  event_id, slug, display_name, country_code, qualification_region,
  qualification_path, attendance_status, is_selectable, source_order,
  source_url, source_checked_at
) values
${insertRows};

update public.worlds_pick_events
set display_name = '2026 Pokémon GO Worlds Pick 10',
    status = 'open',
    roster_source_url = '${OFFICIAL_PAGE_URL}',
    roster_checked_at = '${SOURCE_CHECKED_AT}',
    updated_at = now()
where id = '2026-pokemon-go';

do $postflight$
begin
  if (select count(*) from public.worlds_pick_competitors where event_id = '2026-pokemon-go') <> ${EXPECTED_UNIQUE_COMPETITORS}
     or (select count(distinct slug) from public.worlds_pick_competitors where event_id = '2026-pokemon-go') <> ${EXPECTED_UNIQUE_COMPETITORS}
     or (select count(distinct source_order) from public.worlds_pick_competitors where event_id = '2026-pokemon-go') <> ${EXPECTED_UNIQUE_COMPETITORS} then
    raise exception 'The reviewed Pokémon GO pool must contain ${EXPECTED_UNIQUE_COMPETITORS} unique competitors and source orders.';
  end if;

  if exists (
    select 1 from public.worlds_pick_competitors
    where event_id = '2026-pokemon-go'
      and (attendance_status <> 'invite_earned' or not is_selectable or score_points <> 0
        or source_url <> '${OFFICIAL_PAGE_URL}'
        or source_checked_at <> '${SOURCE_CHECKED_AT}')
  ) then
    raise exception 'The Pokémon GO pool contains an unexpected status, score, or source.';
  end if;

  if not exists (
    select 1 from public.worlds_pick_events
    where id = '2026-pokemon-go'
      and status = 'open'
      and roster_source_url = '${OFFICIAL_PAGE_URL}'
      and roster_checked_at = '${SOURCE_CHECKED_AT}'
  ) then
    raise exception 'The 2026 Pokémon GO event did not open on the reviewed roster.';
  end if;

  if exists (select 1 from public.worlds_pick_entries where event_id = '2026-pokemon-go') then
    raise exception 'Opening the Pokémon GO pool must not create prediction entries.';
  end if;

  if exists (
    select 1 from public.worlds_result_sources
    where event_id = '2026-pokemon-go'
      and (enabled or state <> 'disabled' or feed_url is not null or external_event_id is not null)
  ) then
    raise exception 'Opening Pokémon GO Pick 10 must not enable results polling.';
  end if;
end;
$postflight$;

commit;
`;

await fs.writeFile(migrationPath, migration, "utf8");

console.log(JSON.stringify({
  source: OFFICIAL_PAGE_URL,
  componentLastModifiedAt: snapshot.componentLastModifiedAt,
  rawRows: rawRows.length,
  excludedDuplicateRows: rawRows.length - competitors.length,
  competitors: competitors.length,
  regionCounts,
  registryPath,
  migrationPath,
}, null, 2));
