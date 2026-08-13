export const NUZLOCKE_TRACKER_VERSION = 1;

export const NUZLOCKE_ENCOUNTER_STATUSES = Object.freeze([
  { value: "not-encountered", label: "Not encountered" },
  { value: "caught", label: "Caught" },
  { value: "active", label: "Active team" },
  { value: "boxed", label: "Boxed" },
  { value: "missed", label: "Missed" },
  { value: "deceased", label: "Deceased" },
]);

export const NUZLOCKE_RUN_STATES = Object.freeze([
  { value: "active", label: "Run in progress" },
  { value: "completed", label: "Run completed" },
  { value: "failed", label: "Run ended" },
]);

export const NUZLOCKE_MILESTONE_KINDS = Object.freeze([
  { value: "badge", label: "Badge" },
  { value: "boss", label: "Boss" },
  { value: "other", label: "Other" },
]);

const STATUS_VALUES = new Set(NUZLOCKE_ENCOUNTER_STATUSES.map((item) => item.value));
const RUN_STATE_VALUES = new Set(NUZLOCKE_RUN_STATES.map((item) => item.value));
const MILESTONE_KIND_VALUES = new Set(NUZLOCKE_MILESTONE_KINDS.map((item) => item.value));
const CAUGHT_STATUSES = new Set(["caught", "active", "boxed", "deceased"]);

const cleanInline = (value, maxLength) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maxLength);

const cleanEditableInline = (value, maxLength) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .slice(0, maxLength);

const cleanEditableNotes = (value, maxLength) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
  .slice(0, maxLength);

const cleanLevelCap = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 100 ? number : null;
};

const safeTimestamp = (value) => {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
};

export function nuzlockeEncounterKey(entry, index = 0) {
  const areaKey = cleanInline(entry?.area_key, 160);
  return areaKey || `encounter-${index + 1}`;
}

export function nuzlockeSpeciesFamilyKey(entry) {
  return cleanInline(entry?.species_family, 120).toLowerCase()
    || (Number.isInteger(Number(entry?.encounter_pokemon_id)) ? `pokemon-${Number(entry.encounter_pokemon_id)}` : "")
    || (Number.isInteger(Number(entry?.pokemon_id)) ? `pokemon-${Number(entry.pokemon_id)}` : "");
}

function normalizeEncounterProgress(value, entry, index) {
  const status = STATUS_VALUES.has(value?.status) ? value.status : "not-encountered";
  return {
    area_key: nuzlockeEncounterKey(entry, index),
    status,
    nickname: cleanEditableInline(value?.nickname, 40),
    notes: cleanEditableNotes(value?.notes, 500),
  };
}

function normalizeMilestone(value, index) {
  if (!value || typeof value !== "object") return null;
  const name = cleanInline(value.name, 80);
  if (!name) return null;
  return {
    id: cleanInline(value.id, 80) || `milestone-${index + 1}`,
    kind: MILESTONE_KIND_VALUES.has(value.kind) ? value.kind : "badge",
    name,
    level_cap: cleanLevelCap(value.level_cap),
    completed: value.completed === true,
    notes: cleanEditableNotes(value.notes, 300),
  };
}

function normalizeHistoryEvent(value, index) {
  if (!value || typeof value !== "object") return null;
  const label = cleanInline(value.label, 180);
  const at = safeTimestamp(value.at);
  if (!label || !at) return null;
  return {
    id: cleanInline(value.id, 80) || `history-${index + 1}`,
    at,
    type: cleanInline(value.type, 40) || "update",
    label,
  };
}

export function normalizeNuzlockeTracker(value, team = []) {
  const source = value && typeof value === "object" ? value : {};
  const savedByArea = new Map(
    (Array.isArray(source.encounters) ? source.encounters : [])
      .filter((item) => item && typeof item === "object")
      .map((item) => [cleanInline(item.area_key, 160), item]),
  );
  const encounters = (Array.isArray(team) ? team : []).slice(0, 251)
    .map((entry, index) => normalizeEncounterProgress(savedByArea.get(nuzlockeEncounterKey(entry, index)), entry, index));
  const milestones = (Array.isArray(source.milestones) ? source.milestones : [])
    .slice(0, 32)
    .map(normalizeMilestone)
    .filter(Boolean);
  const history = (Array.isArray(source.history) ? source.history : [])
    .slice(-100)
    .map(normalizeHistoryEvent)
    .filter(Boolean);

  return {
    version: NUZLOCKE_TRACKER_VERSION,
    run_state: RUN_STATE_VALUES.has(source.run_state) ? source.run_state : "active",
    encounters,
    milestones,
    notes: cleanEditableNotes(source.notes, 5000),
    history,
    updated_at: safeTimestamp(source.updated_at),
  };
}

export function summarizeNuzlockeTracker(tracker, team = []) {
  const normalized = normalizeNuzlockeTracker(tracker, team);
  const counts = Object.fromEntries(NUZLOCKE_ENCOUNTER_STATUSES.map((item) => [item.value, 0]));
  normalized.encounters.forEach((entry) => { counts[entry.status] += 1; });
  const recorded = normalized.encounters.length - counts["not-encountered"];
  const caught = counts.caught + counts.active + counts.boxed + counts.deceased;
  const living = counts.caught + counts.active + counts.boxed;
  const milestonesCompleted = normalized.milestones.filter((item) => item.completed).length;
  return {
    total: normalized.encounters.length,
    recorded,
    percent: normalized.encounters.length ? Math.round((recorded / normalized.encounters.length) * 100) : 0,
    caught,
    living,
    missed: counts.missed,
    deceased: counts.deceased,
    active: counts.active,
    boxed: counts.boxed,
    milestonesCompleted,
    milestonesTotal: normalized.milestones.length,
    counts,
  };
}

export function findNuzlockeSpeciesConflicts(tracker, team = []) {
  const normalized = normalizeNuzlockeTracker(tracker, team);
  const families = new Map();
  normalized.encounters.forEach((progress, index) => {
    if (!CAUGHT_STATUSES.has(progress.status)) return;
    const family = nuzlockeSpeciesFamilyKey(team[index]);
    if (!family) return;
    const entries = families.get(family) || [];
    entries.push({ index, entry: team[index], progress });
    families.set(family, entries);
  });
  return [...families.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([family, entries]) => ({ family, entries }));
}

export function appendNuzlockeHistory(tracker, event) {
  const current = tracker && typeof tracker === "object" ? tracker : {};
  const label = cleanInline(event?.label, 180);
  if (!label) return current;
  const nextEvent = {
    id: cleanInline(event?.id, 80) || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: safeTimestamp(event?.at) || new Date().toISOString(),
    type: cleanInline(event?.type, 40) || "update",
    label,
  };
  return { ...current, history: [...(Array.isArray(current.history) ? current.history : []), nextEvent].slice(-100) };
}

export function nuzlockeEncounterStatusLabel(value) {
  return NUZLOCKE_ENCOUNTER_STATUSES.find((item) => item.value === value)?.label || "Not encountered";
}
