import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/249-cache-public-explore-aggregates.sql", import.meta.url), "utf8");
const claimMigration = readFileSync(new URL("../supabase/250-narrow-autonomous-claim-reconciliation.sql", import.meta.url), "utf8");
const leagueHub = readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");
const draftLeague = readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");

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

test("automatic claim reconciliation prefilters indexed, locally due candidates", () => {
  assert.match(claimMigration, /create index if not exists league_state_snapshots_auto_claim_candidates_idx/u);
  assert.match(claimMigration, /join pg_catalog\.pg_timezone_names/u);
  assert.match(claimMigration, /extract\(dow from local_clock\.local_now\)/u);
  assert.match(claimMigration, /local_clock\.local_now::time >=/u);
  assert.match(claimMigration, /league_claim_due_context\(v_snapshot\.state, v_now\)/u);
  assert.match(claimMigration, /grant execute on function public\.reconcile_autonomous_league_claims\(\)[\s\S]*to service_role/u);
});

test("league-page fallback reads pause while hidden and reject overlap", () => {
  assert.match(draftLeague, /async function pull\(force = false\)/u);
  assert.match(draftLeague, /document\.visibilityState !== "visible"\) \|\| inFlight/u);
  assert.match(draftLeague, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/u);
  assert.match(draftLeague, /document\.removeEventListener\("visibilitychange", refreshWhenVisible\)/u);
  assert.match(draftLeague, /setInterval\(refresh, 3000\)/u);
  assert.match(draftLeague, /setInterval\(refresh, 2500\)/u);
  assert.doesNotMatch(draftLeague, /setInterval\(refreshLiveSnakeDraft, 3000\)/u);
  assert.doesNotMatch(draftLeague, /setInterval\(refreshLiveAuction, 2500\)/u);
});

test("live snake refresh caches the league Pokemon pool per draft session", () => {
  assert.match(draftLeague, /liveDraftPokemonCacheRef/u);
  assert.match(draftLeague, /loadCachedLiveDraftPokemon\(live\.session\.id\)/u);
  assert.doesNotMatch(draftLeague, /Promise\.all\(\[\s*supabase\.rpc\("get_live_snake_draft"[\s\S]*loadAllLeaguePokemon/u);
  assert.match(draftLeague, /for \(const pick of live\.picks \|\| \[\]\) drafted\.add/u);
});
