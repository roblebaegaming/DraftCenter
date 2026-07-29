import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { authCallbackUrl, safeAuthNextPath } from "../src/lib/auth-redirect.js";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Discord sign-in uses a dedicated Supabase Auth callback", async () => {
  const [authGate, callback, profileConnection] = await Promise.all([
    readSource("../src/components/AuthGate.jsx"),
    readSource("../src/app/auth/callback/route.js"),
    readSource("../src/app/api/discord/oauth/start/route.js"),
  ]);

  assert.match(authGate, /signInWithOAuth\(\{provider:'discord'/);
  assert.match(authGate, /redirectTo:authCallbackUrl\(window\.location\.origin\)/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(profileConnection, /discord_oauth_states/);
  assert.doesNotMatch(profileConnection, /signInWithOAuth/);
});

test("authentication callback destinations stay on the DraftCenter origin", () => {
  assert.equal(safeAuthNextPath("/"), "/");
  assert.equal(safeAuthNextPath("/?league=test-cup"), "/?league=test-cup");
  assert.equal(safeAuthNextPath("https://attacker.example"), "/");
  assert.equal(safeAuthNextPath("//attacker.example"), "/");
  assert.equal(authCallbackUrl("https://draftcenter.example", "/?league=test-cup"), "https://draftcenter.example/auth/callback?next=%2F%3Fleague%3Dtest-cup");
});

test("email sign-in, sign-out, and Discord notification connection remain available", async () => {
  const authGate = await readSource("../src/components/AuthGate.jsx");
  assert.match(authGate, /signInWithPassword/);
  assert.match(authGate, /signUp/);
  assert.match(authGate, /supabase\.auth\.signOut\(\)/);
  assert.match(authGate, /\/api\/discord\/oauth\/start/);
  assert.match(authGate, /Connecting Discord notifications remains a separate profile setting/);
});
