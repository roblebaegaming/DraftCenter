const KNOWN_EVENT_PATHS = Object.freeze({
  "victory-road-san-francisco-2026": "/worlds/2026/vgc/victory-road-to-san-francisco",
});

const EVENT_ID_PATTERN = /^[a-z0-9-]{3,80}$/;
const ENTRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPredictionBracketEventId(value) {
  return EVENT_ID_PATTERN.test(String(value || ""));
}

export function isPredictionBracketEntryId(value) {
  return ENTRY_ID_PATTERN.test(String(value || ""));
}

export function predictionBracketEventPath(eventId) {
  const normalized = String(eventId || "");
  if (!isPredictionBracketEventId(normalized)) throw new Error("Invalid prediction bracket event ID.");
  return KNOWN_EVENT_PATHS[normalized] || `/tournaments/predictions/${encodeURIComponent(normalized)}`;
}

export function predictionBracketEntryPath(eventId, entryId) {
  const normalizedEntryId = String(entryId || "").toLowerCase();
  if (!isPredictionBracketEntryId(normalizedEntryId)) throw new Error("Invalid prediction bracket entry ID.");
  return `${predictionBracketEventPath(eventId)}/entries/${normalizedEntryId}`;
}
