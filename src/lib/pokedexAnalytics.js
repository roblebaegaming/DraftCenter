import { track } from "@vercel/analytics";

const EVENT_NAMES = Object.freeze({
  tracker_created: "Collector Tracker Created",
  inventory_opened: "Collector Inventory Opened",
  import_completed: "Collector Import Completed",
  restore_completed: "Collector Restore Completed",
  export_downloaded: "Collector Export Downloaded",
  workbook_downloaded: "Collector Workbook Downloaded",
  install_selected: "Collector Install Selected",
  install_completed: "Collector Install Completed",
  supporter_cta_selected: "Collector Support Selected",
  feedback_checklist_copied: "Collector Feedback Checklist Copied",
});

const ALLOWED_PROPERTIES = new Set(["kind", "count_bucket", "placement", "result"]);

export function pokedexCountBucket(value) {
  const count = Number(value) || 0;
  if (count <= 0) return "0";
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 250) return "51-250";
  if (count <= 1000) return "251-1000";
  return "1001+";
}

export function trackPokedexCollectorEvent(key, properties = {}) {
  const name = EVENT_NAMES[key];
  if (!name || typeof window === "undefined") return false;
  const safe = {};
  for (const [property, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(property)) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    safe[property] = typeof value === "string" ? value.slice(0, 40) : value;
  }
  try {
    track(name, safe);
    return true;
  } catch {
    return false;
  }
}

export const POKEDEX_COLLECTOR_ANALYTICS_CONTRACT = Object.freeze({
  events: Object.keys(EVENT_NAMES),
  properties: [...ALLOWED_PROPERTIES],
  forbidden: ["user_id", "tracker_id", "tracker_name", "pokemon", "species", "notes", "email", "filename", "file_content"],
});
