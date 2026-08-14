import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = source("supabase/365-private-nuzlocke-my-teams-runs.sql");
const lab = source("src/components/NuzlockeLab.jsx");
const myTeams = source("src/components/PersonalTeams.jsx");
const imageExport = source("src/lib/nuzlockeRunCardImage.js");
const tracker = source("src/components/NuzlockeRunTracker.jsx");

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
  assert.match(lab, /Save tracker to My Teams/);
  assert.match(lab, /\.update\(payload\)\.eq\("id", savedProfileTeamId\)\.eq\("owner_id", profileUser\.id\)/);
  assert.match(lab, /\/nuzlocke\?run=\$\{data\.id\}/);
  assert.match(lab, /browserTrackerId\(seed, team\)/);
  assert.doesNotMatch(lab, /service_role/);
});

test("My Teams restores and presents Nuzlocke encounters as a distinct private Run Card", () => {
  assert.match(myTeams, /workspace_type === "nuzlocke"/);
  assert.match(myTeams, /nuzlocke_run:team\.workspace_type==="nuzlocke"\?team\.nuzlocke_run:null/);
  assert.match(myTeams, /personal-nuzlocke-grid/);
  assert.match(myTeams, /Open tracker/);
  assert.match(myTeams, /Tracked encounter roster/);
  assert.match(myTeams, /locations recorded/);
  assert.match(myTeams, /nuzlocke\?false:Boolean\(form\.is_public\)/);
});

test("the progress download is a visual PNG Run Card with bounded trusted artwork", () => {
  assert.match(imageExport, /canvas\.toBlob/);
  assert.match(imageExport, /"image\/png"/);
  assert.match(imageExport, /raw\.githubusercontent\.com/);
  assert.match(imageExport, /COLUMN_COUNT = 3/);
  assert.match(imageExport, /drawCard/);
  assert.match(imageExport, /artwork_url/);
  assert.match(imageExport, /trackerSummary\.recorded/);
  assert.match(imageExport, /trackerSummary\.deceased/);
  assert.doesNotMatch(imageExport, /Team code:/);
});

test("the tracker covers route state, species clause, milestones, and bounded notes", () => {
  assert.match(tracker, /NUZLOCKE_ENCOUNTER_STATUSES/);
  assert.match(tracker, /findNuzlockeSpeciesConflicts/);
  assert.match(tracker, /Run milestones/);
  assert.match(tracker, /Level caps are planning notes/);
  assert.match(tracker, /maxLength=\{5000\}/);
  assert.match(tracker, /appendNuzlockeHistory/);
});
