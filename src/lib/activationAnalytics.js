import { track } from "@vercel/analytics";

const STORAGE_PREFIX = "draftcenter:activation:v1";

const EVENT_NAMES = Object.freeze({
  commissioner_path_started: "Commissioner Path Started",
  practice_path_started: "Practice Path Started",
  league_created: "League Created",
  first_invite_copied: "First Invite Copied",
  draft_scheduled: "Draft Scheduled",
  draft_started: "Draft Started",
  draft_completed: "Draft Completed",
  first_result_recorded: "First Result Recorded",
  league_import_confirmed: "League Import Confirmed",
  showdown_result_confirmed: "Showdown Result Confirmed",
  season_completed: "Season Completed",
  home_daily_bracket_started: "Home Daily Bracket Started",
  home_daily_bracket_completed: "Home Daily Bracket Completed",
  home_mega_bracket_opened: "Home Mega Bracket Opened",
  home_mega_signin_prompt_viewed: "Home Mega Sign-in Prompt Viewed",
});

const ALLOWED_PROPERTIES = Object.freeze({
  source: new Set(["home", "dashboard", "setup", "schedule", "draft", "result", "import"]),
  practice: new Set(["yes", "no"]),
  draft_style: new Set(["snake", "budget-snake", "auction", "manual", "unknown"]),
  import_mode: new Set(["setup", "complete-rosters"]),
  stage: new Set(["created", "invited", "scheduled", "started", "completed", "first-result", "season-complete"]),
});

function safeProperties(properties = {}) {
  return Object.fromEntries(Object.entries(properties).flatMap(([key, rawValue]) => {
    const allowed = ALLOWED_PROPERTIES[key];
    const value = String(rawValue || "").trim().toLowerCase();
    return allowed?.has(value) ? [[key, value]] : [];
  }));
}

function dedupeKey(eventKey, leagueKey) {
  const safeLeagueKey = String(leagueKey || "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
  return safeLeagueKey ? `${STORAGE_PREFIX}:${eventKey}:${safeLeagueKey}` : "";
}

export function trackActivationEvent(eventKey, options = {}) {
  const name = EVENT_NAMES[eventKey];
  if (!name) return false;
  const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const key = options.oncePerLeague ? dedupeKey(eventKey, options.leagueKey) : "";
  if (key) {
    try { if (storage?.getItem?.(key)) return false; } catch {}
  }
  try {
    (options.trackImpl || track)(name, safeProperties(options.properties));
    if (key) {
      try { storage?.setItem?.(key, "1"); } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

export const ACTIVATION_ANALYTICS_CONTRACT = Object.freeze({
  events: Object.values(EVENT_NAMES),
  properties: Object.keys(ALLOWED_PROPERTIES),
  forbidden: ["user_id", "league_id", "email", "username", "team", "pokemon", "replay_url", "showdown_username", "raw_path"],
});
