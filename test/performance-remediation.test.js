import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/249-cache-public-explore-aggregates.sql", import.meta.url), "utf8");
const leagueHub = readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");

test("Explore cache keeps caller-specific poll state outside the shared payload", () => {
  const sharedPayload = migration.match(/v_shared := jsonb_build_object\(([\s\S]*?)\n\s*\);/u)?.[1] || "";
  assert.match(sharedPayload, /'leagues'/u);
  assert.match(sharedPayload, /'popularity'/u);
  assert.match(sharedPayload, /'adp'/u);
  assert.doesNotMatch(sharedPayload, /signed_in|selected_key|counts/u);
  assert.match(migration, /'selected_key'[\s\S]*auth\.uid\(\)/u);
});

test("uncached Explore aggregate and cache table are not exposed to API roles", () => {
  assert.match(migration, /revoke execute on function public\.get_public_explore_uncached\(\)[\s\S]*from public, anon, authenticated/u);
  assert.match(migration, /alter table public\.public_explore_cache enable row level security/u);
  assert.match(migration, /revoke all on table public\.public_explore_cache[\s\S]*from public, anon, authenticated/u);
});

test("League Hub uses a visibility-gated one-minute fallback refresh", () => {
  assert.match(leagueHub, /LEAGUE_HUB_FALLBACK_REFRESH_MS = 60000/u);
  assert.match(leagueHub, /document\.visibilityState !== "visible"/u);
  assert.match(leagueHub, /document\.addEventListener\("visibilitychange"/u);
  assert.match(leagueHub, /document\.removeEventListener\("visibilitychange"/u);
  assert.doesNotMatch(leagueHub, /setInterval\(\(\) => loadLeagues\(true\), 5000\)/u);
});
