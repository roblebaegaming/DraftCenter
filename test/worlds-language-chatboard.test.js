import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { worldsChatCopy } from "../src/lib/worldsChatI18n.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260820004814_worlds_language_chatboard.sql";
const indexMigrationPath = "supabase/migrations/20260820032602_index_worlds_chat_removed_by.sql";

test("the Worlds chat has localized rooms without splitting the shared event", () => {
  const component = source("src/components/WorldsChatBoard.jsx");
  const page = source("src/components/WorldsPickSixteen.jsx");
  const copy = source("src/lib/worldsChatI18n.js");

  assert.match(page, /<WorldsChatBoard eventId=\{eventId\} locale=\{locale\} user=\{user\}/);
  assert.match(page, /config\.key === "vgc" && <WorldsChatBoard/);
  assert.match(component, /p_event_id: eventId/);
  assert.match(component, /p_language_code: language/);
  assert.match(component, /REFRESH_INTERVAL_MS = 20_000/);
  assert.match(component, /maxLength=\{500\}/);
  assert.match(component, /href="\/#member-access"/);
  assert.match(component, /report_worlds_chat_message/);
  assert.match(component, /remove_my_worlds_chat_message/);
  assert.match(component, /<PublicCoachProfile identity=\{activeProfile\}/);

  for (const locale of ["en", "it", "es", "fr", "de", "ja", "ko"]) {
    const localized = worldsChatCopy(locale);
    assert.ok(localized.title.length > 5);
    assert.ok(localized.description.length > 20);
    assert.match(localized.description, locale === "ja" ? /同じ/ : locale === "ko" ? /같은/ : /same|stessa|misma|même|selben/i);
    assert.ok(localized.signInTitle.length > 10);
    assert.equal(localized.characters(12).includes("12/500"), true);
    assert.match(copy, new RegExp(`\\n  ${locale}: \\{`));
  }
});

test("migration 454 adds French without weakening the account-only chat boundary", () => {
  const migration = source("supabase/migrations/20260820180704_add_french_worlds_chat_room.sql");
  const regression = source("supabase/tests/454-french-worlds-chat-room-preview-regression.sql");

  assert.match(migration, /language_code in \('en', 'it', 'es', 'fr', 'de', 'ja', 'ko'\)/i);
  assert.equal((migration.match(/create or replace function public\.(?:get|create)_worlds_chat_/gi) || []).length, 2);
  assert.equal((migration.match(/security definer/gi) || []).length, 2);
  assert.equal((migration.match(/set search_path = ''/gi) || []).length, 2);
  assert.match(migration, /revoke all on function public\.get_worlds_chat_messages[\s\S]+from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.create_worlds_chat_message[\s\S]+to authenticated, service_role/i);
  assert.doesNotMatch(migration, /grant [^;]* on table public\.worlds_chat_messages to (?:anon|authenticated)/i);
  assert.match(regression, /French Worlds chat room did not round-trip correctly/);
  assert.match(regression, /French Worlds message leaked into the English room/);
  assert.match(regression, /Migration 454 weakened the account-only Worlds chat boundary/);
});

test("the Worlds chat migration keeps messages account-only and RPC-bounded", () => {
  const migration = source(migrationPath);
  const indexMigration = source(indexMigrationPath);
  const regression = source("supabase/tests/451-worlds-language-chatboard-preview-regression.sql");

  assert.match(migration, /create table public\.worlds_chat_messages/i);
  assert.match(migration, /create table public\.worlds_chat_reports/i);
  assert.match(migration, /language_code in \('en', 'it', 'es', 'de', 'ja', 'ko'\)/i);
  assert.match(migration, /char_length\(btrim\(body\)\) between 1 and 500/i);
  assert.match(migration, /worlds_chat_messages_room_page_idx[\s\S]+where removed_at is null/i);
  assert.match(indexMigration, /create index worlds_chat_messages_removed_by_idx[\s\S]+on public\.worlds_chat_messages \(removed_by\)/i);
  assert.match(migration, /alter table public\.worlds_chat_messages enable row level security/i);
  assert.match(migration, /alter table public\.worlds_chat_reports enable row level security/i);
  assert.match(migration, /revoke all on table public\.worlds_chat_messages from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.worlds_chat_messages to service_role/i);
  assert.doesNotMatch(migration, /grant [^;]* on table public\.worlds_chat_(?:messages|reports) to (?:anon|authenticated)/i);

  for (const name of ["get_worlds_chat_messages", "create_worlds_chat_message", "remove_my_worlds_chat_message", "report_worlds_chat_message"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}[\\s\\S]+to authenticated, service_role`, "i"));
  }
  assert.equal((migration.match(/security definer/gi) || []).length, 4);
  assert.equal((migration.match(/set search_path = ''/gi) || []).length, 4);
  assert.equal((migration.match(/v_user_id uuid := \(select auth\.uid\(\)\)/gi) || []).length, 4);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, />= 5[\s\S]+>= 100/);
  assert.doesNotMatch(migration, /'user_id', page\.user_id|'email'|'timezone'|'discord_user_id'/i);
  assert.match(regression, /Another language room leaked into the English chat/);
  assert.match(regression, /The chat RPC exposed a private profile or identity field/);
  assert.match(regression, /A different member removed someone else''s message/);
});

test("the Worlds chat is compact and responsive on the vertical prediction page", () => {
  const css = source("src/app/globals.css");
  assert.match(css, /\.worlds-chat-messages \{[^}]*max-height:410px[^}]*overflow-y:auto/);
  assert.match(css, /@media\(max-width:760px\)[^{]*\{[\s\S]*\.worlds-chat-messages \{ max-height:360px/);
  assert.match(css, /\.worlds-chat-message>p \{[^}]*white-space:pre-wrap/);
});
