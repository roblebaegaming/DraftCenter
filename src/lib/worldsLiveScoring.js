export const WORLDS_RESULTS_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const WORLDS_RESULTS_PARSER_VERSION = "pokedata-vgc-masters-v1";

const ISO_TWO_TO_THREE = Object.freeze({
  AR: "ARG", AU: "AUS", AT: "AUT", BE: "BEL", BR: "BRA", CA: "CAN", CH: "CHE",
  CL: "CHL", CN: "CHN", CO: "COL", CR: "CRI", DE: "DEU", DK: "DNK", DO: "DOM",
  DZ: "DZA", EC: "ECU", ES: "ESP", FI: "FIN", FR: "FRA", GB: "GBR",
  UK: "GBR", HK: "HKG", IN: "IND", IE: "IRL", IL: "ISR", IT: "ITA",
  JM: "JAM", JP: "JPN", KR: "KOR", MA: "MAR", MX: "MEX", MY: "MYS",
  NL: "NLD", NZ: "NZL", PE: "PER", PH: "PHL", PL: "POL", PR: "PRI",
  PT: "PRT", SG: "SGP", TH: "THA", TW: "TWN", US: "USA", UY: "URY",
  VE: "VEN", VI: "VIR", VN: "VNM", ZA: "ZAF",
});

export class WorldsResultImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorldsResultImportError";
    this.code = code;
  }
}

export function worldsPlacementPoints(placing) {
  if (!Number.isInteger(placing) || placing < 1) return 0;
  if (placing === 1) return 30;
  if (placing === 2) return 20;
  if (placing <= 4) return 12;
  if (placing <= 8) return 7;
  if (placing <= 16) return 4;
  if (placing <= 32) return 2;
  if (placing <= 64) return 1;
  return 0;
}

export function normalizeWorldsSourceName(value) {
  return String(value || "").normalize("NFC").trim().replace(/\s+/g, " ");
}

export function worldsSourceNameKey(value) {
  return normalizeWorldsSourceName(value).toLocaleLowerCase("en-US");
}

function suggestionNameKey(value) {
  return normalizeWorldsSourceName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US");
}

export function sourceCountryToRosterCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  return ISO_TWO_TO_THREE[code] || "";
}

export function parsePokeDataIdentity(value) {
  const raw = normalizeWorldsSourceName(value);
  const match = raw.match(/^(.*?)\s+\[([A-Za-z]{2,3})\]$/u);
  if (!match) throw new WorldsResultImportError("schema_drift", "A standings row does not contain a reviewed name and country identity.");
  const sourceName = normalizeWorldsSourceName(match[1]);
  const sourceCountryCode = match[2].toUpperCase();
  if (sourceName.length < 2 || sourceName.length > 120 || !/^[A-Z]{2,3}$/.test(sourceCountryCode)) {
    throw new WorldsResultImportError("schema_drift", "A standings row contains an unsupported name or country identity.");
  }
  return {
    source_name: sourceName,
    source_name_key: worldsSourceNameKey(sourceName),
    source_country_code: sourceCountryCode,
  };
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function parseRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorldsResultImportError("schema_drift", "A standings row is missing its record.");
  }
  const record = { wins: value.wins, losses: value.losses, ties: value.ties };
  if (!Object.values(record).every(nonnegativeInteger)) {
    throw new WorldsResultImportError("schema_drift", "A standings row contains an invalid record.");
  }
  return record;
}

export function parsePokeDataStandings(payload, { minimumRows = 1, maximumRows = 4096 } = {}) {
  if (!Array.isArray(payload)) {
    throw new WorldsResultImportError("schema_drift", "The standings payload is not an array.");
  }
  if (payload.length === 0) {
    throw new WorldsResultImportError("empty_payload", "The standings payload is empty.");
  }
  if (payload.length < minimumRows || payload.length > maximumRows) {
    throw new WorldsResultImportError("row_count_out_of_bounds", "The standings row count is outside the reviewed bounds.");
  }

  const identities = new Set();
  const rows = payload.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new WorldsResultImportError("schema_drift", "A standings row is not an object.");
    }
    if (!Number.isInteger(item.placing) || item.placing < 1 || item.placing > 9999) {
      throw new WorldsResultImportError("schema_drift", "A standings row contains an invalid placing.");
    }
    if (!item.rounds || typeof item.rounds !== "object" || Array.isArray(item.rounds)) {
      throw new WorldsResultImportError("schema_drift", "A standings row is missing its rounds object.");
    }
    const identity = parsePokeDataIdentity(item.name);
    const identityKey = `${identity.source_name_key}\u0000${identity.source_country_code}`;
    if (identities.has(identityKey)) {
      throw new WorldsResultImportError("duplicate_source_identity", "The standings payload contains a duplicate source identity.");
    }
    identities.add(identityKey);
    return {
      ...identity,
      placing: item.placing,
      score_points: worldsPlacementPoints(item.placing),
      record: parseRecord(item.record),
    };
  });

  return rows.sort((left, right) => left.placing - right.placing || left.source_name.localeCompare(right.source_name));
}

function identityKey(nameKey, countryCode) {
  return `${nameKey}\u0000${countryCode}`;
}

export function matchWorldsResultRows(rows, { aliases = [], competitors = [] } = {}) {
  const aliasesByIdentity = new Map();
  for (const alias of aliases.filter((item) => !item.revoked_at)) {
    const key = identityKey(alias.source_name_key, alias.source_country_code);
    const values = aliasesByIdentity.get(key) || [];
    values.push(alias);
    aliasesByIdentity.set(key, values);
  }

  const competitorsBySlug = new Map(competitors.map((competitor) => [competitor.slug, competitor]));
  const suggestions = new Map();
  for (const competitor of competitors) {
    const key = identityKey(suggestionNameKey(competitor.display_name), competitor.country_code);
    const values = suggestions.get(key) || [];
    values.push(competitor.slug);
    suggestions.set(key, values);
  }

  const matched = [];
  const issues = [];
  for (const row of rows) {
    const aliasesForRow = aliasesByIdentity.get(identityKey(row.source_name_key, row.source_country_code)) || [];
    const validAliases = aliasesForRow.filter((alias) => competitorsBySlug.has(alias.competitor_slug));
    if (validAliases.length === 1 && aliasesForRow.length === 1) {
      matched.push({ row, alias: validAliases[0], competitor_slug: validAliases[0].competitor_slug });
      continue;
    }

    const rosterCountry = sourceCountryToRosterCode(row.source_country_code);
    const suggested = suggestions.get(identityKey(suggestionNameKey(row.source_name), rosterCountry)) || [];
    issues.push({
      ...row,
      issue_code: aliasesForRow.length ? "ambiguous" : "unmatched",
      suggested_competitor_slug: suggested.length === 1 ? suggested[0] : null,
      suggestion_reason: suggested.length === 1 ? "exact_name_country" : null,
    });
  }

  const matchesByCompetitor = new Map();
  for (const item of matched) {
    const values = matchesByCompetitor.get(item.competitor_slug) || [];
    values.push(item);
    matchesByCompetitor.set(item.competitor_slug, values);
  }
  for (const values of matchesByCompetitor.values()) {
    if (values.length < 2) continue;
    for (const item of values) {
      issues.push({
        ...item.row,
        issue_code: "duplicate_target",
        suggested_competitor_slug: item.competitor_slug,
        suggestion_reason: "multiple_source_rows_target_one_competitor",
      });
    }
  }

  const duplicateIdentities = new Set(issues.filter((issue) => issue.issue_code === "duplicate_target")
    .map((issue) => identityKey(issue.source_name_key, issue.source_country_code)));
  const safeMatched = matched.filter((item) => !duplicateIdentities.has(identityKey(item.row.source_name_key, item.row.source_country_code)));
  const blockingIssues = issues.filter((issue) => issue.issue_code !== "unmatched" || issue.score_points > 0);

  return { matched: safeMatched, issues, blockingIssues };
}

export function validatePokeDataFeedUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new WorldsResultImportError("invalid_feed_url", "Enter the exact approved PokeData Masters JSON URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) {
    throw new WorldsResultImportError("invalid_feed_url", "The PokeData feed URL must be a plain HTTPS URL without credentials, a query, or a fragment.");
  }
  if (!new Set(["pokedata.ovh", "www.pokedata.ovh"]).has(url.hostname.toLowerCase())) {
    throw new WorldsResultImportError("invalid_feed_url", "The feed URL must use the approved PokeData host.");
  }
  const match = url.pathname.match(/^\/standingsVGC\/(\d{7})\/masters\/(\d{7})_Masters\.json$/);
  if (!match || match[1] !== match[2]) {
    throw new WorldsResultImportError("invalid_feed_url", "The feed URL must identify one exact PokeData Masters JSON download.");
  }
  return { url: url.toString(), externalEventId: match[1] };
}
