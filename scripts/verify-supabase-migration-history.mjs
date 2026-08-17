import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseRoot = path.join(repositoryRoot, "supabase");
const migrationsRoot = path.join(supabaseRoot, "migrations");
const baselineName = "20260726010406_remote_schema.sql";
const baselineSha256 = "95c39101d3bb55a3186b8c5234bac305d99239696dcf00bf57f3f3cd07c6d1b8";
const firstMirrorDate = new Date("2026-07-26T01:04:07.000Z");
const personalTeamsBridgeName = "20260726010644_364_revoke_legacy_personal_teams_anon.sql";
const requiredReconciliationNames = [
  personalTeamsBridgeName,
  "20260817064000_414_restore_private_match_availability.sql",
  "20260817064001_415_restore_structured_monitoring_and_tester_feedback.sql",
  "20260817064002_416_restore_match_availability_owner_repair.sql",
  "20260817064003_417_restore_match_scheduling_and_reminders.sql",
  "20260817064004_418_restore_legacy_operational_tables.sql",
  "20260817064005_419_normalize_production_function_definitions.sql",
  "20260817064006_420_normalize_production_privileges.sql",
  "20260817064007_421_restore_prebaseline_reference_rows.sql",
];

function normalizedSha256(filePath) {
  const contents = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(contents, "utf8").digest("hex");
}

function timestamp(date) {
  return date.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

const legacyFiles = fs
  .readdirSync(supabaseRoot)
  .map((name) => ({ name, match: name.match(/^(\d+)-.*\.sql$/) }))
  .filter(({ match }) => match && Number(match[1]) >= 204)
  .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));

const migrationFiles = fs
  .readdirSync(migrationsRoot)
  .filter((name) => name.endsWith(".sql"))
  .sort();

assert.equal(migrationFiles[0], baselineName, "The Production baseline must be the first standard migration.");
assert.equal(
  normalizedSha256(path.join(migrationsRoot, baselineName)),
  baselineSha256,
  "The checked-in baseline no longer matches the normalized Production remote_schema migration.",
);

for (const [index, legacy] of legacyFiles.entries()) {
  const humanNumber = Number(legacy.match[1]);
  const bridgeOffset = humanNumber >= 365 ? 1000 : 0;
  const mirrorDate = new Date(firstMirrorDate.getTime() + index * 1000 + bridgeOffset);
  const expectedName = `${timestamp(mirrorDate)}_${path.basename(legacy.name, ".sql").replaceAll("-", "_")}.sql`;
  const migrationPath = path.join(migrationsRoot, expectedName);

  assert.ok(fs.existsSync(migrationPath), `Missing standard migration mirror for ${legacy.name}: ${expectedName}`);
  assert.equal(
    normalizedSha256(path.join(supabaseRoot, legacy.name)),
    normalizedSha256(migrationPath),
    `Standard migration ${expectedName} differs from ${legacy.name}.`,
  );
}

const personalTeamsBridge = fs.readFileSync(path.join(migrationsRoot, personalTeamsBridgeName), "utf8");
assert.match(personalTeamsBridge, /revoke all on table public\.personal_teams from anon;/i);
assert.match(personalTeamsBridge, /grant select, insert, update, delete on table public\.personal_teams to authenticated;/i);

for (const name of requiredReconciliationNames) {
  assert.ok(fs.existsSync(path.join(migrationsRoot, name)), `Missing required reconciliation migration: ${name}`);
}

const referenceRecovery = fs.readFileSync(
  path.join(migrationsRoot, "20260817064007_421_restore_prebaseline_reference_rows.sql"),
  "utf8",
);
assert.match(referenceRecovery, /badge reference catalog must contain 17 rows/i);
assert.match(referenceRecovery, /game-version reference catalog must contain 33 rows/i);

const versions = migrationFiles.map((name) => {
  const match = name.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  assert.ok(match, `Invalid standard migration filename: ${name}`);
  return match[1];
});

assert.equal(new Set(versions).size, versions.length, "Standard migration versions must be unique.");
assert.deepEqual(versions, [...versions].sort(), "Standard migrations must be ordered by version.");

const mirroredCount = legacyFiles.length;
const standardOnlyCount = migrationFiles.length - mirroredCount - 1;
assert.ok(
  standardOnlyCount >= requiredReconciliationNames.length,
  "The standard migration directory is missing one or more reconciliation migrations.",
);

console.log(
  `Verified the Production baseline, ${mirroredCount} historical forward migrations, and ${standardOnlyCount} standard-only reconciliation migrations.`,
);
