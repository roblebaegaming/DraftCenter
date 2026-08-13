import crypto from "node:crypto";

import { VGC_CALENDAR_EVENTS } from "../data/vgcCalendarEvents.js";
import { calendarToIcs, deriveLeagueEvents } from "./pokemonCalendar.js";

export const CALENDAR_FEED_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createCalendarFeedToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashCalendarFeedToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function normalizeCalendarTimeZone(value) {
  const timeZone = String(value || "UTC").trim();
  if (!timeZone || timeZone.length > 80) return "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "";
  }
}

export function draftCenterSiteUrl() {
  const configured = String(process.env.DRAFTCENTER_SITE_URL || "https://www.draftcentral.gg").trim();
  try {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported DraftCenter site protocol.");
    return url.toString().replace(/\/$/, "");
  } catch {
    return "https://www.draftcentral.gg";
  }
}

function requireResult(result, label) {
  if (result.error) {
    const error = new Error(`${label} could not be loaded.`);
    error.code = result.error.code;
    throw error;
  }
  return result.data;
}

export async function loadCalendarEventsForOwner(supabase, ownerId, siteUrl = draftCenterSiteUrl(), timeZone = "UTC") {
  const [profileResult, personalResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", ownerId).maybeSingle(),
    supabase.from("pokemon_calendar_events").select("*").eq("owner_id", ownerId).order("starts_at").limit(2000),
    supabase.from("league_memberships").select("role, league:leagues(id,name,slug,season_label,draft_starts_at)").eq("user_id", ownerId).limit(500),
  ]);
  const profile = requireResult(profileResult, "Calendar profile");
  const personalEvents = requireResult(personalResult, "Private calendar events") || [];
  const memberships = (requireResult(membershipResult, "League memberships") || []).filter((row) => row.league);
  const leagueIds = memberships.map((row) => row.league.id);
  const snapshotResult = leagueIds.length
    ? await supabase.from("league_state_snapshots").select("league_id,state").in("league_id", leagueIds).limit(500)
    : { data: [], error: null };
  const snapshots = requireResult(snapshotResult, "League calendar dates") || [];
  const leagueEvents = deriveLeagueEvents(memberships, snapshots, { id: ownerId }, profile, siteUrl, timeZone);
  return [
    ...leagueEvents,
    ...personalEvents.map((event) => ({ ...event, source: "personal" })),
    ...VGC_CALENDAR_EVENTS,
  ].sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
}

export async function privateCalendarFeed(supabase, ownerId, { timeZone = "UTC", siteUrl = draftCenterSiteUrl() } = {}) {
  const events = await loadCalendarEventsForOwner(supabase, ownerId, siteUrl, timeZone);
  return calendarToIcs(events, { timeZone });
}
