export const MULTI_POD_ROSTER_POLICY = "retain-regular-season-roster";
export const MULTI_POD_REPLACEMENT_POLICY = "inherit-source-league";
export const MULTI_POD_TIEBREAKERS = [
  "wins",
  "differential",
  "head-to-head",
  "game-win-percentage",
  "commissioner-draw",
];
export const MULTI_POD_CHAMPIONSHIP_FORMATS = ["single-elimination", "double-elimination"];
export const MULTI_POD_CHAMPIONSHIP_SEEDING = [
  "overall-record",
  "pod-finish-bands",
  "pod-finish-avoid-rematches",
];
export const MULTI_POD_RPCS = Object.freeze({
  createOrganization: "create_league_organization",
  updateOrganization: "update_league_organization",
  createSeason: "create_league_organization_season",
  createPlannedSeason: "create_planned_league_organization_season",
  attachPod: "attach_league_organization_pod",
  updatePodPlan: "update_league_organization_pod_plan",
  upsertManagerAssignment: "upsert_league_organization_manager_assignment",
  removeManagerAssignment: "remove_league_organization_manager_assignment",
  getPlanningWorkspace: "get_league_organization_planning_workspace",
  confirmPodRegulations: "confirm_league_organization_pod_regulations",
  launchSeason: "launch_league_organization_season",
  beginQualification: "begin_league_organization_qualification",
  lockPodStandings: "lock_league_organization_pod_standings",
  recordQualificationDraw: "record_league_organization_qualification_draw",
  finalizeQualification: "finalize_league_organization_qualification",
  cancelQualification: "cancel_league_organization_qualification",
  syncQualifierManager: "sync_league_organization_qualifier_manager",
  getQualificationWorkspace: "get_league_organization_qualification_workspace",
  createChampionship: "create_league_organization_championship",
  syncChampionshipManager: "sync_league_organization_championship_manager",
  getChampionshipWorkspace: "get_league_organization_championship_workspace",
  createAdministratorInvite: "create_league_organization_administrator_invite",
  previewAdministratorInvite: "preview_league_organization_administrator_invite",
  acceptAdministratorInvite: "accept_league_organization_administrator_invite",
  revokeAdministratorInvite: "revoke_league_organization_administrator_invite",
  removeAdministrator: "remove_league_organization_administrator",
  listMine: "list_my_league_organizations",
  getWorkspace: "get_league_organization_workspace",
  getPublicWorkspace: "get_public_league_organization_workspace",
});

const DEFAULT_TIEBREAKERS = ["wins", "differential", "head-to-head", "commissioner-draw"];
export const MIN_MULTI_POD_DIVISIONS = 2;
export const MAX_MULTI_POD_DIVISIONS = 32;

function integerInRange(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

export function createMultiPodOrganizationDraft({
  name,
  description = "",
  visibility = "private",
  imageUrl = "",
  brandColor = "#4fd1c5",
}) {
  const cleanName = String(name || "").trim();
  const cleanDescription = String(description || "");
  const cleanImageUrl = String(imageUrl || "").trim();
  const cleanBrandColor = String(brandColor || "").trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 120) throw new Error("Organization name must be between 2 and 120 characters.");
  if (cleanDescription.length > 4000) throw new Error("Organization description must be 4,000 characters or fewer.");
  if (!["private", "public"].includes(visibility)) throw new Error("Choose private or public organization visibility.");
  if (cleanImageUrl && (!cleanImageUrl.startsWith("https://") || cleanImageUrl.length > 2048)) throw new Error("Organization artwork must use a secure HTTPS URL.");
  if (!/^#[0-9a-f]{6}$/.test(cleanBrandColor)) throw new Error("Brand color must be a six-digit hex color.");
  return {
    name: cleanName,
    description: cleanDescription,
    visibility,
    imageUrl: cleanImageUrl || null,
    brandColor: cleanBrandColor,
  };
}

export function multiPodOrganizationUpdateRpcArguments(organizationId, expectedRevision, draft) {
  const cleanOrganizationId = String(organizationId || "").trim();
  if (!cleanOrganizationId) throw new Error("An organization is required.");
  const normalized = createMultiPodOrganizationDraft(draft);
  return {
    p_organization_id: cleanOrganizationId,
    p_expected_revision: integerInRange(expectedRevision, 0, Number.MAX_SAFE_INTEGER, "Organization revision"),
    p_name: normalized.name,
    p_description: normalized.description,
    p_visibility: normalized.visibility,
    p_image_url: normalized.imageUrl,
    p_brand_color: normalized.brandColor,
  };
}

export function multiPodAdministratorInviteUrl(origin, token) {
  const cleanOrigin = String(origin || "").replace(/\/$/, "");
  const cleanToken = String(token || "").trim();
  if (!/^https?:\/\//.test(cleanOrigin)) throw new Error("A valid site address is required.");
  if (!/^[0-9a-f]{48}$/.test(cleanToken)) throw new Error("The administrator invitation token is invalid.");
  return `${cleanOrigin}/organizations?administrator_invite=${cleanToken}`;
}

export function normalizeMultiPodQualificationRules(rules = {}) {
  const topPerPod = integerInRange(rules.topPerPod ?? 2, 1, 16, "Top qualifiers per pod");
  const wildcardSlots = integerInRange(rules.wildcardSlots ?? 0, 0, 32, "Wildcard slots");
  const tiebreakers = Array.isArray(rules.tiebreakers) && rules.tiebreakers.length
    ? rules.tiebreakers.map((value) => String(value).trim())
    : DEFAULT_TIEBREAKERS;

  if (new Set(tiebreakers).size !== tiebreakers.length) {
    throw new Error("Choose each tiebreaker only once.");
  }
  if (tiebreakers.length > 5 || tiebreakers.some((value) => !MULTI_POD_TIEBREAKERS.includes(value))) {
    throw new Error("Choose up to five supported tiebreakers.");
  }
  if (tiebreakers.includes("commissioner-draw") && tiebreakers.at(-1) !== "commissioner-draw") {
    throw new Error("Commissioner draw must be the final tiebreaker.");
  }

  return {
    topPerPod,
    wildcardSlots,
    tiebreakers,
  };
}

export function multiPodQualificationDrawRpcArguments(runId, expectedRevision, candidates) {
  const cleanRunId = String(runId || "").trim();
  if (!cleanRunId) throw new Error("A qualification review is required.");
  const candidateIds = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => String(candidate?.id || candidate || "").trim())
    .filter(Boolean);
  if (!candidateIds.length || new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("Order every unresolved team exactly once.");
  }
  return {
    p_run_id: cleanRunId,
    p_expected_revision: integerInRange(expectedRevision, 0, Number.MAX_SAFE_INTEGER, "Qualification revision"),
    p_candidate_ids: candidateIds,
  };
}

export function multiPodChampionshipRpcArguments(seasonId, expectedRevision, draft = {}) {
  const cleanSeasonId = String(seasonId || "").trim();
  if (!cleanSeasonId) throw new Error("A finalized organization season is required.");
  const format = String(draft.format || "single-elimination");
  const seedingPolicy = String(draft.seedingPolicy || "pod-finish-avoid-rematches");
  const visibility = String(draft.visibility || "public");
  if (!MULTI_POD_CHAMPIONSHIP_FORMATS.includes(format)) throw new Error("Choose single or double elimination.");
  if (!MULTI_POD_CHAMPIONSHIP_SEEDING.includes(seedingPolicy)) throw new Error("Choose a supported championship seeding policy.");
  if (!["public", "private"].includes(visibility)) throw new Error("Choose public or private championship visibility.");
  const bestOf = Number(draft.bestOf ?? 3);
  if (![1, 3].includes(bestOf)) throw new Error("Championship series must be best of 1 or best of 3.");
  return {
    p_season_id: cleanSeasonId,
    p_expected_season_revision: integerInRange(expectedRevision, 0, Number.MAX_SAFE_INTEGER, "Season revision"),
    p_format: format,
    p_seeding_policy: seedingPolicy,
    p_best_of: bestOf,
    p_visibility: visibility,
  };
}

export function createMultiPodSeasonDraft({ name, regulations = {}, qualificationRules = {} }) {
  const cleanName = String(name || "").trim();
  if (cleanName.length < 2 || cleanName.length > 120) {
    throw new Error("Season name must be between 2 and 120 characters.");
  }
  if (!regulations || Array.isArray(regulations) || typeof regulations !== "object") {
    throw new Error("Season regulations must be an object.");
  }

  return {
    name: cleanName,
    regulations: structuredClone(regulations),
    qualificationRules: normalizeMultiPodQualificationRules(qualificationRules),
    allowCrossPodSpeciesDuplicates: true,
    rosterPolicy: MULTI_POD_ROSTER_POLICY,
    replacementPolicy: MULTI_POD_REPLACEMENT_POLICY,
  };
}

export function multiPodSeasonRpcArguments(organizationId, draft) {
  const cleanOrganizationId = String(organizationId || "").trim();
  if (!cleanOrganizationId) throw new Error("An organization is required.");
  const normalized = createMultiPodSeasonDraft(draft);
  return {
    p_organization_id: cleanOrganizationId,
    p_name: normalized.name,
    p_regulations: normalized.regulations,
    p_top_per_pod: normalized.qualificationRules.topPerPod,
    p_wildcard_slots: normalized.qualificationRules.wildcardSlots,
    p_tiebreakers: normalized.qualificationRules.tiebreakers,
  };
}

export function defaultMultiPodDivisionLabel(index) {
  let value = Math.max(0, Math.trunc(Number(index) || 0));
  let suffix = "";
  do {
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return `Pod ${suffix}`;
}

export function resizeMultiPodDivisionPlan(current, requestedCount) {
  const numericCount = Math.trunc(Number(requestedCount));
  const count = Number.isFinite(numericCount)
    ? Math.min(MAX_MULTI_POD_DIVISIONS, Math.max(MIN_MULTI_POD_DIVISIONS, numericCount))
    : MIN_MULTI_POD_DIVISIONS;
  const existing = Array.isArray(current) ? current : [];
  return Array.from({ length: count }, (_, index) => ({
    label: String(existing[index]?.label || defaultMultiPodDivisionLabel(index)).trim() || defaultMultiPodDivisionLabel(index),
    draftStartsAt: String(existing[index]?.draftStartsAt || ""),
  }));
}

export function multiPodPlannedSeasonRpcArguments(organizationId, draft) {
  const base = multiPodSeasonRpcArguments(organizationId, draft);
  const divisions = resizeMultiPodDivisionPlan(draft?.divisions, draft?.divisions?.length);
  const normalizedLabels = divisions.map((division) => division.label.toLowerCase());
  if (new Set(normalizedLabels).size !== normalizedLabels.length) {
    throw new Error("Give every pod a unique label.");
  }
  return {
    ...base,
    p_divisions: divisions.map((division) => {
      const date = division.draftStartsAt ? new Date(division.draftStartsAt) : null;
      if (date && Number.isNaN(date.getTime())) throw new Error(`${division.label} has an invalid draft time.`);
      return {
        label: division.label,
        draft_starts_at: date ? date.toISOString() : null,
      };
    }),
  };
}

export function multiPodManagerAssignmentRpcArguments(seasonId, username, podId, availabilityNote = "") {
  const cleanSeasonId = String(seasonId || "").trim();
  const cleanUsername = String(username || "").trim();
  const cleanNote = String(availabilityNote || "").trim();
  if (!cleanSeasonId) throw new Error("A shared season is required.");
  if (!cleanUsername) throw new Error("Enter a DraftCenter username.");
  if (cleanNote.length > 500) throw new Error("Availability notes must be 500 characters or fewer.");
  return {
    p_season_id: cleanSeasonId,
    p_username: cleanUsername,
    p_pod_id: String(podId || "").trim() || null,
    p_availability_note: cleanNote,
  };
}

export function multiPodAttachmentRpcArguments({
  seasonId,
  leagueId,
  label,
  sortOrder,
  leagueSeasonNumber,
  qualificationSpots,
}) {
  const cleanSeasonId = String(seasonId || "").trim();
  const cleanLeagueId = String(leagueId || "").trim();
  const cleanLabel = String(label || "").trim();
  if (!cleanSeasonId || !cleanLeagueId) throw new Error("A season and source league are required.");
  if (!cleanLabel || cleanLabel.length > 80) throw new Error("Pod label must be between 1 and 80 characters.");
  return {
    p_season_id: cleanSeasonId,
    p_league_id: cleanLeagueId,
    p_label: cleanLabel,
    p_sort_order: integerInRange(sortOrder, 1, 64, "Pod order"),
    p_league_season_number: integerInRange(leagueSeasonNumber, 1, 1000, "League season number"),
    p_qualification_spots: qualificationSpots == null
      ? null
      : integerInRange(qualificationSpots, 1, 16, "Qualification spots"),
  };
}

export function createChampionshipQualifierSnapshot({
  podId,
  leagueId,
  teamKey,
  team,
  roster,
  sourceStateRevision,
  sourceStateRev,
}) {
  const cleanPodId = String(podId || "").trim();
  const cleanLeagueId = String(leagueId || "").trim();
  const numericTeamKey = integerInRange(teamKey, 0, 255, "Source team key");
  const snapshotRevision = integerInRange(sourceStateRevision, 0, Number.MAX_SAFE_INTEGER, "Source snapshot revision");
  const stateRev = integerInRange(sourceStateRev, 0, Number.MAX_SAFE_INTEGER, "Source state revision");

  if (!cleanPodId || !cleanLeagueId) throw new Error("A pod and source league are required.");
  if (!team || Array.isArray(team) || typeof team !== "object") throw new Error("A source team is required.");
  if (!Array.isArray(roster)) throw new Error("A source roster is required.");

  const displayName = String(team.name || `Team ${numericTeamKey + 1}`).trim();
  if (!displayName || displayName.length > 120) throw new Error("Team name must be between 1 and 120 characters.");

  return {
    podId: cleanPodId,
    sourceLeagueId: cleanLeagueId,
    sourceTeamKey: numericTeamKey,
    sourceTeamId: String(team.id ?? numericTeamKey),
    displayName,
    managerUserId: String(team.claimedByUserId || "").trim() || null,
    teamSnapshot: structuredClone(team),
    rosterSnapshot: structuredClone(roster),
    sourceStateRevision: snapshotRevision,
    sourceStateRev: stateRev,
  };
}
