import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  CALENDAR_FEED_TOKEN_PATTERN,
  createCalendarFeedToken,
  hashCalendarFeedToken,
  normalizeCalendarTimeZone,
} from "../src/lib/calendarSubscription.js";
import { VGC_CALENDAR_EVENTS, VGC_CALENDAR_UPDATED_AT } from "../src/data/vgcCalendarEvents.js";
import { calendarMonthDays, calendarToIcs, dateKey, deriveLeagueEvents } from "../src/lib/pokemonCalendar.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the private calendar is available from the consolidated Tools menu", () => {
  const navigation = source("src/components/SiteQuickLinks.jsx");
  const page = source("src/app/calendar/page.js");
  assert.match(navigation, /<NavigationMenu active=\{toolsActive\} label="Tools">[\s\S]*?href="\/calendar"[^>]*>Calendar<\/a>/);
  assert.match(navigation, /navState\(pathname, "\/calendar"\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /<PokemonCalendar \/>/);
});

test("the maintained VGC schedule is complete, chronological, and source-linked", () => {
  assert.equal(VGC_CALENDAR_UPDATED_AT, "2026-08-12");
  assert.ok(VGC_CALENDAR_EVENTS.length >= 30);
  assert.equal(new Set(VGC_CALENDAR_EVENTS.map((event) => event.id)).size, VGC_CALENDAR_EVENTS.length);
  assert.deepEqual([...VGC_CALENDAR_EVENTS].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), VGC_CALENDAR_EVENTS);
  for (const event of VGC_CALENDAR_EVENTS) {
    assert.equal(event.source, "official-vgc");
    assert.equal(event.all_day, true);
    assert.match(event.source_url, /^https:\/\//);
    assert.ok(new Date(event.ends_at) >= new Date(event.starts_at), event.title);
    assert.match(event.event_type, /^vgc_(worlds|international|regional|special|online)$/);
  }
  assert.ok(VGC_CALENDAR_EVENTS.some((event) => event.id === "vgc-worlds-2026" && event.location.includes("San Francisco")));
  assert.ok(VGC_CALENDAR_EVENTS.some((event) => event.id === "vgc-baltimore-2027"));
  assert.ok(VGC_CALENDAR_EVENTS.some((event) => event.id === "vgc-laic-2027"));
  assert.ok(VGC_CALENDAR_EVENTS.some((event) => event.id === "vgc-euic-2027"));
  assert.ok(VGC_CALENDAR_EVENTS.some((event) => event.id === "vgc-naic-2027" && event.location.includes("Chicago")));
});

test("month grids keep dates under their real weekdays across DST and December 2026", () => {
  const november = calendarMonthDays(new Date(2026, 10, 1));
  assert.equal(new Set(november.map((day) => dateKey(day))).size, 42);
  assert.deepEqual(november.slice(0, 8).map((day) => dateKey(day)), [
    "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
    "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
  ]);

  const december = calendarMonthDays(new Date(2026, 11, 1));
  assert.deepEqual(december.slice(0, 7).map((day) => dateKey(day)), [
    "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02",
    "2026-12-03", "2026-12-04", "2026-12-05",
  ]);
  assert.equal(december.find((day) => dateKey(day) === "2026-12-04")?.getDay(), 5);
  assert.equal(december.find((day) => dateKey(day) === "2026-12-05")?.getDay(), 6);
  assert.equal(december.find((day) => dateKey(day) === "2026-12-06")?.getDay(), 0);
});

test("official VGC events remain read-only and can be filtered or exported", () => {
  const calendar = source("src/components/PokemonCalendar.jsx");
  assert.match(calendar, /source === "official-vgc"/);
  assert.match(calendar, /Show official VGC events/);
  assert.match(calendar, /Notable online competitions will appear here after Pokémon publishes confirmed dates/);
  assert.match(calendar, /eventOccursOnDate\(event, day\)/);
  assert.match(calendar, /calendarMonthDays\(cursor\)/);
  assert.match(calendar, /selected\.source === "personal" && <button className="quiet-button"/);
  assert.match(calendar, /calendarToIcs\(events/);
});

test("calendar migration isolates private reminders with owner-only RLS", () => {
  const migration = source("supabase/382-personal-pokemon-calendar.sql");
  const teamLinks = source("supabase/396-private-team-calendar-links-and-opponent-sets.sql");
  assert.match(migration, /create table if not exists public\.pokemon_calendar_events/);
  assert.match(migration, /alter table public\.pokemon_calendar_events enable row level security/);
  assert.match(migration, /revoke all on table public\.pokemon_calendar_events from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.pokemon_calendar_events to authenticated/);
  assert.ok((migration.match(/owner_id = auth\.uid\(\)/g) || []).length >= 4);
  assert.match(teamLinks, /add column personal_team_id uuid references public\.personal_teams\(id\) on delete set null/);
  assert.match(teamLinks, /alter table public\.pokemon_calendar_events force row level security/);
  assert.ok((teamLinks.match(/team\.id = personal_team_id and team\.owner_id = auth\.uid\(\)/g) || []).length >= 2);
});

test("calendar subscription tokens are unguessable, hash-only, and timezone validated", () => {
  const first = createCalendarFeedToken();
  const second = createCalendarFeedToken();
  assert.match(first, CALENDAR_FEED_TOKEN_PATTERN);
  assert.match(second, CALENDAR_FEED_TOKEN_PATTERN);
  assert.notEqual(first, second);
  assert.match(hashCalendarFeedToken(first), /^[0-9a-f]{64}$/);
  assert.notEqual(hashCalendarFeedToken(first), first);
  assert.equal(normalizeCalendarTimeZone("America/Los_Angeles"), "America/Los_Angeles");
  assert.equal(normalizeCalendarTimeZone("not/a-timezone"), "");
});

test("calendar subscriptions use secure server-only storage and a revocable public feed", () => {
  const migration = source("supabase/383-private-calendar-subscriptions.sql");
  const management = source("src/app/api/calendar/subscription/route.js");
  const feed = source("src/app/api/calendar/feed/[token]/route.js");
  const controls = source("src/components/CalendarSubscription.jsx");

  assert.match(migration, /token_hash text not null unique/);
  assert.doesNotMatch(migration, /\btoken text\b/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.pokemon_calendar_feed_tokens from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.pokemon_calendar_feed_tokens to service_role/);
  assert.doesNotMatch(migration, /grant [^;]+ to authenticated/);
  assert.match(management, /authenticateUser\(request, supabase\)/);
  assert.match(management, /hashCalendarFeedToken\(token\)/);
  assert.match(management, /feed_url:/);
  assert.match(feed, /X-Robots-Tag/);
  assert.match(feed, /text\/calendar; charset=utf-8/);
  assert.match(feed, /status: 404/);
  assert.match(feed, /if-none-match/);
  assert.match(controls, /DraftCenter never receives access to your Google account/);
  assert.match(controls, /calendar\/u\/0\/r\/settings\/addbyurl/);
  assert.match(controls, /Replace private link/);
  assert.match(controls, /Revoke/);
});

test("iCalendar output preserves all-day dates, folds long lines, and blocks field injection", () => {
  const calendar = calendarToIcs([{
    id: "safe-event",
    title: "Regional reminder\r\nX-EVIL: injected",
    starts_at: "2026-08-14T00:00:00.000Z",
    ends_at: "2026-08-16T00:00:00.000Z",
    calendar_start_date: "2026-08-14",
    calendar_end_date: "2026-08-16",
    all_day: true,
    notes: "A long note ".repeat(20),
    source_url: "javascript:alert(1)",
  }], { timeZone: "Pacific/Auckland" });

  assert.match(calendar, /METHOD:PUBLISH\r\n/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20260814\r\n/);
  assert.match(calendar, /DTEND;VALUE=DATE:20260817\r\n/);
  assert.match(calendar, /SUMMARY:Regional reminder\\nX-EVIL: injected/);
  assert.doesNotMatch(calendar, /\r\nX-EVIL: injected\r\n/);
  assert.doesNotMatch(calendar, /URL:javascript:/);
  for (const line of calendar.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `ICS line exceeds 75 bytes: ${line}`);
  }
});

test("derived league match times honor the league time zone on the server", () => {
  const memberships = [{ league: { id: "league-1", name: "Test League", slug: "test-league" } }];
  const snapshots = [{
    league_id: "league-1",
    state: {
      seasonNumber: 1,
      settings: {
        seasonStartsAt: "2026-08-10T07:00:00.000Z",
        leagueTimeZone: "America/Los_Angeles",
        matchDayOfWeek: 6,
        matchTime: "19:00",
      },
      teams: [{ name: "My Team", claimedByUserId: "user-1" }, { name: "Opponent" }],
      schedule: [[[0, 1]]],
    },
  }];
  const [match] = deriveLeagueEvents(memberships, snapshots, { id: "user-1" }, null, "https://www.draftcentral.gg", "UTC");
  assert.equal(match.starts_at, "2026-08-16T02:00:00.000Z");
  assert.equal(match.source_url, "https://www.draftcentral.gg/?league=test-league");
  assert.deepEqual({
    league_id: match.league_id,
    season_number: match.season_number,
    week_index: match.week_index,
    my_team_index: match.my_team_index,
    opponent_team_index: match.opponent_team_index,
  }, {
    league_id: "league-1",
    season_number: 1,
    week_index: 0,
    my_team_index: 0,
    opponent_team_index: 1,
  });
});
