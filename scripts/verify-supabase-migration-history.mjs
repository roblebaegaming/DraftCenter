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
  const mirrorDate = new Date(firstMirrorDate.getTime() + index * 1000);
  const expectedName = `${timestamp(mirrorDate)}_${path.basename(legacy.name, ".sql").replaceAll("-", "_")}.sql`;
  const migrationPath = path.join(migrationsRoot, expectedName);

  assert.ok(fs.existsSync(migrationPath), `Missing standard migration mirror for ${legacy.name}: ${expectedName}`);
  assert.equal(
    normalizedSha256(path.join(supabaseRoot, legacy.name)),
    normalizedSha256(migrationPath),
    `Standard migration ${expectedName} differs from ${legacy.name}.`,
  );
}

const versions = migrationFiles.map((name) => {
  const match = name.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  assert.ok(match, `Invalid standard migration filename: ${name}`);
  return match[1];
});

assert.equal(new Set(versions).size, versions.length, "Standard migration versions must be unique.");
assert.deepEqual(versions, [...versions].sort(), "Standard migrations must be ordered by version.");

const mirroredCount = legacyFiles.length;
const futureCount = migrationFiles.length - mirroredCount - 1;
assert.ok(futureCount >= 0, "The standard migration directory is incomplete.");

console.log(
  `Verified the Production baseline, ${mirroredCount} historical forward migrations, and ${futureCount} later standard migrations.`,
);
