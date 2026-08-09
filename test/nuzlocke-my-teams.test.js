import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = source("supabase/365-private-nuzlocke-my-teams-runs.sql");
const lab = source("src/components/NuzlockeLab.jsx");
const myTeams = source("src/components/PersonalTeams.jsx");
const imageExport = source("src/lib/nuzlockeRunCardImage.js");

test("Nuzlocke Run Cards extend owner-only My Teams storage without widening access", () => {
  assert.match(migration, /add column if not exists nuzlocke_run jsonb/);
  assert.match(migration, /workspace_type in \('weekly', 'tournament', 'nuzlocke'\)/);
  assert.match(migration, /workspace_type = 'nuzlocke'\s+and not is_public/);
  assert.match(migration, /jsonb_array_length\(nuzlocke_run -> 'team'\) between 1 and 251/);
  assert.match(migration, /octet_length\(nuzlocke_run::text\) <= 500000/);
  assert.match(migration, /where id = v_id and owner_id = auth\.uid\(\)/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /case when v_workspace_type = 'nuzlocke' then false/);
  assert.match(migration, /relation\.relrowsecurity/);
  assert.match(migration, /has_table_privilege\('anon', 'public\.personal_teams', 'SELECT'\)/);
  assert.match(migration, /cmd in \('SELECT', 'INSERT', 'UPDATE', 'DELETE'\)/);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete).*anon/i);
  assert.doesNotMatch(migration, /disable row level security/i);
});

test("the public builder saves normalized private Run Cards through the signed-in owner session", () => {
  assert.match(lab, /supabase\.auth\.getUser\(\)/);
  assert.match(lab, /owner_id: profileUser\.id/);
  assert.match(lab, /workspace_type: "nuzlocke"/);
  assert.match(lab, /is_public: false/);
  assert.match(lab, /nuzlocke_run: \{ \.\.\.normalizedResult/);
  assert.match(lab, /from\("personal_teams"\)\.insert\(payload\)/);
  assert.match(lab, /Save to My Teams/);
  assert.doesNotMatch(lab, /service_role/);
});

test("My Teams restores and presents Nuzlocke encounters as a distinct private Run Card", () => {
  assert.match(myTeams, /workspace_type === "nuzlocke"/);
  assert.match(myTeams, /nuzlocke_run:team\.workspace_type==="nuzlocke"\?team\.nuzlocke_run:null/);
  assert.match(myTeams, /personal-nuzlocke-grid/);
  assert.match(myTeams, /Open run/);
  assert.match(myTeams, /Generated encounter roster/);
  assert.match(myTeams, /nuzlocke\?false:Boolean\(form\.is_public\)/);
});

test("the team download is a visual PNG Run Card with bounded trusted artwork", () => {
  assert.match(imageExport, /canvas\.toBlob/);
  assert.match(imageExport, /"image\/png"/);
  assert.match(imageExport, /raw\.githubusercontent\.com/);
  assert.match(imageExport, /COLUMN_COUNT = 3/);
  assert.match(imageExport, /drawCard/);
  assert.match(imageExport, /artwork_url/);
  assert.match(imageExport, /Team code:/);
});
