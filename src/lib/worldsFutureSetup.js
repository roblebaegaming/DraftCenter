const HTTPS_URL = /^https:\/\/[^\s]+$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE = /^[A-Z]{3}$/;

export const WORLDS_PICK_DISCIPLINES = Object.freeze({
  vgc: Object.freeze({
    key: "vgc",
    eventId: "2026-vgc-masters",
    gameLabel: "VGC",
    fullGameLabel: "Pokémon VGC",
    division: "Masters",
    entryUnit: "individual",
    entrySingular: "competitor",
    entryPlural: "competitors",
    rosterHeading: "VGC Masters invitee list",
    maximumRawScore: 140,
    pickCount: 10,
  }),
  tcg: Object.freeze({
    key: "tcg",
    eventId: "2026-tcg-masters",
    gameLabel: "TCG",
    fullGameLabel: "Pokémon TCG",
    division: "Masters",
    entryUnit: "individual",
    entrySingular: "competitor",
    entryPlural: "competitors",
    rosterHeading: "TCG Masters qualified competitors",
    maximumRawScore: 140,
    pickCount: 10,
    expectedBaseCount: 425,
  }),
  go: Object.freeze({
    key: "go",
    eventId: "2026-pokemon-go",
    gameLabel: "Pokémon GO",
    fullGameLabel: "Pokémon GO",
    division: "Open",
    entryUnit: "individual",
    entrySingular: "Trainer",
    entryPlural: "Trainers",
    rosterHeading: "Pokémon GO registered Trainer roster",
    maximumRawScore: 140,
    pickCount: 10,
    expectedBaseCount: 220,
  }),
});

export const WORLDS_UNITE_SETUP = Object.freeze({
  key: "unite",
  eventId: "2026-pokemon-unite",
  gameLabel: "Pokémon UNITE",
  entryUnit: "team",
  modeledQualificationAwards: 15,
});

function blankIndividual(index) {
  return {
    source_order: index,
    slug: "",
    display_name: "",
    country_code: "",
    qualification_region: "",
    qualification_path: "",
    attendance_status: "confirmed",
    aliases: [],
  };
}

function blankTeam(index) {
  return {
    source_order: index,
    slug: "",
    display_name: "",
    qualification_path: "",
    region: "",
    organization_aliases: [],
    registered_players: [],
    registration_status: "unverified",
  };
}

export function buildWorldsRosterSetupTemplate(disciplineKey, size) {
  const discipline = WORLDS_PICK_DISCIPLINES[disciplineKey];
  if (!discipline || disciplineKey === "vgc") throw new Error("Choose the TCG or Pokémon GO roster workspace.");
  const count = Number(size ?? discipline.expectedBaseCount);
  if (!Number.isInteger(count) || count < 1 || count > 600) throw new Error("Roster size must be a whole number from 1 through 600.");
  return {
    schema_version: 1,
    event_id: discipline.eventId,
    discipline: discipline.key,
    entry_unit: discipline.entryUnit,
    division: discipline.division,
    roster_status: "draft",
    official_source_url: "",
    source_checked_at: "",
    opens_at: "",
    locks_at: "",
    picks_required: discipline.pickCount,
    selection_label: "Your Champion",
    selection_multiplier: 2,
    competitors: Array.from({ length: count }, (_, index) => blankIndividual(index + 1)),
  };
}

export function buildWorldsUniteSetupTemplate(size = WORLDS_UNITE_SETUP.modeledQualificationAwards) {
  const count = Number(size);
  if (!Number.isInteger(count) || count < 1 || count > 64) throw new Error("Team count must be a whole number from 1 through 64.");
  return {
    schema_version: 1,
    event_id: WORLDS_UNITE_SETUP.eventId,
    discipline: WORLDS_UNITE_SETUP.key,
    entry_unit: WORLDS_UNITE_SETUP.entryUnit,
    roster_status: "draft",
    tournament_status: "waiting_for_official_groups",
    official_roster_url: "",
    official_structure_url: "",
    source_checked_at: "",
    opens_at: "",
    locks_at: "",
    teams: Array.from({ length: count }, (_, index) => blankTeam(index + 1)),
    groups: [],
    elimination_matches: [],
    round_points: {},
  };
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The setup file must contain one JSON object.");
}

function validateHttpsOrBlank(value, label) {
  if (value && !HTTPS_URL.test(String(value))) throw new Error(`${label} must be a public HTTPS URL.`);
}

function validateTimestampOrBlank(value, label) {
  if (value && !Number.isFinite(Date.parse(String(value)))) throw new Error(`${label} must be a valid date and time.`);
}

function uniqueNonBlank(values, label) {
  const present = values.filter(Boolean);
  if (new Set(present).size !== present.length) throw new Error(`${label} must be unique.`);
}

export function validateWorldsRosterSetupDraft(value, disciplineKey) {
  requireObject(value);
  const discipline = WORLDS_PICK_DISCIPLINES[disciplineKey];
  if (!discipline || disciplineKey === "vgc") throw new Error("Choose the TCG or Pokémon GO roster workspace.");
  if (value.schema_version !== 1 || value.event_id !== discipline.eventId || value.discipline !== discipline.key || value.entry_unit !== "individual") {
    throw new Error(`This is not a ${discipline.gameLabel} roster setup file.`);
  }
  if (value.roster_status !== "draft") throw new Error("A setup draft cannot mark the roster ready or open.");
  if (value.picks_required !== 10 || value.selection_label !== "Your Champion" || value.selection_multiplier !== 2) {
    throw new Error("The setup must preserve Pick 10 and Your Champion ×2.");
  }
  validateHttpsOrBlank(value.official_source_url, "Official roster source");
  validateTimestampOrBlank(value.source_checked_at, "Source review time");
  validateTimestampOrBlank(value.opens_at, "Entry opening time");
  validateTimestampOrBlank(value.locks_at, "Entry lock time");
  if (!Array.isArray(value.competitors) || value.competitors.length < 1 || value.competitors.length > 600) {
    throw new Error("The roster draft must contain 1 through 600 competitor slots.");
  }
  const slugs = [];
  const orders = [];
  let completed = 0;
  value.competitors.forEach((competitor, index) => {
    requireObject(competitor);
    if (!Number.isInteger(competitor.source_order) || competitor.source_order < 1) throw new Error(`Roster row ${index + 1} needs a positive source order.`);
    orders.push(competitor.source_order);
    const fields = [competitor.slug, competitor.display_name, competitor.country_code, competitor.qualification_region, competitor.qualification_path];
    const hasAny = fields.some((field) => String(field || "").trim());
    if (!hasAny) return;
    if (fields.some((field) => !String(field || "").trim())) throw new Error(`Roster row ${index + 1} is only partially completed.`);
    if (!SLUG.test(competitor.slug)) throw new Error(`Roster row ${index + 1} has an invalid slug.`);
    if (!COUNTRY_CODE.test(competitor.country_code)) throw new Error(`Roster row ${index + 1} needs a three-letter country code.`);
    if (!["invite_earned", "confirmed", "withdrawn", "declined"].includes(competitor.attendance_status)) throw new Error(`Roster row ${index + 1} has an unsupported attendance status.`);
    if (!Array.isArray(competitor.aliases) || competitor.aliases.some((alias) => !String(alias || "").trim())) throw new Error(`Roster row ${index + 1} has an invalid alias list.`);
    slugs.push(competitor.slug);
    completed += 1;
  });
  uniqueNonBlank(slugs, "Competitor slugs");
  uniqueNonBlank(orders, "Source orders");
  return { eventId: discipline.eventId, slots: value.competitors.length, completed, readyToReview: completed === value.competitors.length };
}

export function validateWorldsUniteSetupDraft(value) {
  requireObject(value);
  if (value.schema_version !== 1 || value.event_id !== WORLDS_UNITE_SETUP.eventId || value.discipline !== "unite" || value.entry_unit !== "team") {
    throw new Error("This is not a Pokémon UNITE team setup file.");
  }
  if (value.roster_status !== "draft" || !["waiting_for_official_groups", "official_structure_review"].includes(value.tournament_status)) {
    throw new Error("The UNITE setup must remain a draft in official-source review.");
  }
  validateHttpsOrBlank(value.official_roster_url, "Official roster source");
  validateHttpsOrBlank(value.official_structure_url, "Official tournament source");
  validateTimestampOrBlank(value.source_checked_at, "Source review time");
  validateTimestampOrBlank(value.opens_at, "Entry opening time");
  validateTimestampOrBlank(value.locks_at, "Entry lock time");
  if (!Array.isArray(value.teams) || value.teams.length < 1 || value.teams.length > 64) throw new Error("The UNITE draft must contain 1 through 64 team slots.");
  if (!Array.isArray(value.groups) || !Array.isArray(value.elimination_matches)) throw new Error("Groups and elimination matches must be arrays.");
  const slugs = [];
  const orders = [];
  let completed = 0;
  value.teams.forEach((team, index) => {
    requireObject(team);
    if (!Number.isInteger(team.source_order) || team.source_order < 1) throw new Error(`Team row ${index + 1} needs a positive source order.`);
    orders.push(team.source_order);
    const fields = [team.slug, team.display_name, team.qualification_path, team.region];
    const hasAny = fields.some((field) => String(field || "").trim());
    if (!hasAny) return;
    if (fields.some((field) => !String(field || "").trim())) throw new Error(`Team row ${index + 1} is only partially completed.`);
    if (!SLUG.test(team.slug)) throw new Error(`Team row ${index + 1} has an invalid slug.`);
    if (!Array.isArray(team.organization_aliases) || team.organization_aliases.some((alias) => !String(alias || "").trim())) throw new Error(`Team row ${index + 1} has an invalid organization alias list.`);
    if (!Array.isArray(team.registered_players)) throw new Error(`Team row ${index + 1} has an invalid registered-player list.`);
    if (!["unverified", "confirmed", "withdrawn", "replacement_pending"].includes(team.registration_status)) throw new Error(`Team row ${index + 1} has an unsupported registration status.`);
    slugs.push(team.slug);
    completed += 1;
  });
  uniqueNonBlank(slugs, "Team slugs");
  uniqueNonBlank(orders, "Source orders");
  const hasStructure = value.groups.length > 0 || value.elimination_matches.length > 0;
  if (hasStructure && (!value.official_structure_url || !value.source_checked_at || value.tournament_status !== "official_structure_review")) {
    throw new Error("Do not invent UNITE groups or pairings; record the official source, review time, and official_structure_review status first.");
  }
  const completedSlugs = new Set(slugs);
  const groupNames = [];
  const groupSlugs = [];
  const groupedTeams = [];
  const groupSizes = new Map();
  value.groups.forEach((group, index) => {
    requireObject(group);
    if (!String(group.name || "").trim()) throw new Error(`Group ${index + 1} needs an official name.`);
    if (!SLUG.test(String(group.slug || ""))) throw new Error(`Group ${index + 1} needs a stable slug.`);
    if (!Array.isArray(group.team_slugs) || group.team_slugs.length < 2 || group.team_slugs.length > 32) throw new Error(`Group ${index + 1} needs 2 through 32 reviewed teams.`);
    if (group.team_slugs.some((slug) => !completedSlugs.has(slug))) throw new Error(`Group ${index + 1} references a team outside the reviewed roster.`);
    uniqueNonBlank(group.team_slugs, `Teams in group ${index + 1}`);
    groupNames.push(group.name.trim());
    groupSlugs.push(group.slug);
    groupSizes.set(group.slug, group.team_slugs.length);
    groupedTeams.push(...group.team_slugs);
  });
  uniqueNonBlank(groupNames, "Group names");
  uniqueNonBlank(groupSlugs, "Group slugs");
  uniqueNonBlank(groupedTeams, "Teams across groups");
  const matchKeys = [];
  const matchReferences = [];
  value.elimination_matches.forEach((match, index) => {
    requireObject(match);
    if (!Number.isInteger(match.round_number) || match.round_number < 1 || match.round_number > 6) throw new Error(`Elimination match ${index + 1} has an invalid round.`);
    if (!Number.isInteger(match.match_number) || match.match_number < 1 || match.match_number > 32) throw new Error(`Elimination match ${index + 1} has an invalid match number.`);
    const sideReferences = [];
    for (const side of [match.side_a, match.side_b]) {
      const reference = String(side || "").trim();
      const directTeam = completedSlugs.has(reference);
      const groupMatch = reference.match(/^group:([a-z0-9-]+):([1-9][0-9]*)$/);
      const winnerMatch = reference.match(/^winner:r([1-6]):m([1-9]|[12][0-9]|3[0-2])$/);
      const groupReference = Boolean(groupMatch && groupSizes.has(groupMatch[1]) && Number(groupMatch[2]) <= groupSizes.get(groupMatch[1]));
      const winnerReference = Boolean(winnerMatch);
      if (!directTeam && !groupReference && !winnerReference) throw new Error(`Elimination match ${index + 1} has an invalid participant reference.`);
      if (winnerReference) {
        const priorRound = Number(winnerMatch[1]);
        if (priorRound >= match.round_number) throw new Error(`Elimination match ${index + 1} references a winner from the same or a later round.`);
        matchReferences.push({ index, key: `${winnerMatch[1]}:${winnerMatch[2]}` });
      }
      sideReferences.push(reference);
    }
    if (sideReferences[0] === sideReferences[1]) throw new Error(`Elimination match ${index + 1} cannot use the same participant twice.`);
    matchKeys.push(`${match.round_number}:${match.match_number}`);
  });
  uniqueNonBlank(matchKeys, "Elimination match keys");
  const knownMatchKeys = new Set(matchKeys);
  matchReferences.forEach(({ index, key }) => {
    if (!knownMatchKeys.has(key)) throw new Error(`Elimination match ${index + 1} references a winner from a match that is not in the reviewed structure.`);
  });
  if (!value.round_points || typeof value.round_points !== "object" || Array.isArray(value.round_points)) throw new Error("UNITE round points must be an object.");
  for (const [round, points] of Object.entries(value.round_points)) {
    if (!/^[1-6]$/.test(round) || !Number.isInteger(points) || points < 1 || points > 1000) throw new Error("UNITE round points must use rounds 1 through 6 and positive whole-number values.");
  }
  return {
    eventId: WORLDS_UNITE_SETUP.eventId,
    slots: value.teams.length,
    completed,
    groups: value.groups.length,
    matches: value.elimination_matches.length,
    readyForStructureReview: completed === value.teams.length,
  };
}

export function downloadJsonFile(filename, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
