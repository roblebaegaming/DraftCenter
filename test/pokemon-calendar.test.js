import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { VGC_CALENDAR_EVENTS, VGC_CALENDAR_UPDATED_AT } from "../src/data/vgcCalendarEvents.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the private calendar has a standalone global navigation button", () => {
  const navigation = source("src/components/SiteQuickLinks.jsx");
  const page = source("src/app/calendar/page.js");
  assert.match(navigation, /href="\/calendar" aria-label="Calendar"/);
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

test("official VGC events remain read-only and can be filtered or exported", () => {
  const calendar = source("src/components/PokemonCalendar.jsx");
  assert.match(calendar, /source === "official-vgc"/);
  assert.match(calendar, /Show official VGC events/);
  assert.match(calendar, /Notable online competitions will appear here after Pokémon publishes confirmed dates/);
  assert.match(calendar, /eventOccursOnDate\(event, day\)/);
  assert.match(calendar, /selected\.source === "personal" && <button className="quiet-button"/);
  assert.match(calendar, /icsStamp\(event\.ends_at, event\.all_day, event\.all_day\)/);
});

test("calendar migration isolates private reminders with owner-only RLS", () => {
  const migration = source("supabase/382-personal-pokemon-calendar.sql");
  assert.match(migration, /create table if not exists public\.pokemon_calendar_events/);
  assert.match(migration, /alter table public\.pokemon_calendar_events enable row level security/);
  assert.match(migration, /revoke all on table public\.pokemon_calendar_events from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.pokemon_calendar_events to authenticated/);
  assert.ok((migration.match(/owner_id = auth\.uid\(\)/g) || []).length >= 4);
});
