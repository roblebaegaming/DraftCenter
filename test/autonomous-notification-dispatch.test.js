import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/239-autonomous-notification-dispatch.sql", import.meta.url),
  "utf8",
);
const vercel = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);
const leagueHub = fs.readFileSync(
  new URL("../src/components/LeagueHub.jsx", import.meta.url),
  "utf8",
);
const draftLeague = fs.readFileSync(
  new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url),
  "utf8",
);

test("autonomous notification dispatch is browser independent and secret protected", () => {
  assert.match(migration, /create extension if not exists pg_cron/i);
  assert.match(migration, /create extension if not exists pg_net/i);
  assert.match(migration, /vault\.decrypted_secrets/i);
  assert.match(migration, /draftcenter_notification_dispatch_url/i);
  assert.match(migration, /draftcenter_notification_cron_secret/i);
  assert.match(migration, /draftcenter_vercel_automation_bypass_secret/i);
  assert.match(migration, /'Authorization', 'Bearer ' \|\| v_secret/i);
  assert.match(migration, /'x-vercel-protection-bypass', v_bypass_secret/i);
  assert.match(migration, /'\* \* \* \* \*'/i);
  assert.match(migration, /revoke all on function public\.invoke_notification_dispatch\(\) from public, anon, authenticated/i);
});

test("migration stays inert until both encrypted secrets exist", () => {
  assert.match(migration, /if v_has_url and v_has_secret then/i);
  assert.match(migration, /Vault secrets are missing; the autonomous notification dispatcher was not scheduled/i);
});

test("production Vercel cron runs the dispatcher every minute", () => {
  assert.deepEqual(vercel.crons, [
    { path: "/api/notifications/dispatch", schedule: "* * * * *" },
  ]);
});

test("signed-in browser tabs do not duplicate the scheduled dispatcher", () => {
  assert.doesNotMatch(leagueHub, /fetch\(["']\/api\/notifications\/dispatch/);
  assert.doesNotMatch(draftLeague, /fetch\(["']\/api\/notifications\/dispatch/);
});
