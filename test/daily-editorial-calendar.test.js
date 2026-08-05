import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/260-community-editorial-calendar.sql", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../src/app/api/operations/daily-three/route.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../src/components/DailyThreeOperations.jsx", import.meta.url), "utf8");

test("Question of the Day has a private human-first editorial calendar", () => {
  assert.match(migration, /community_questions_of_the_day/);
  assert.match(migration, /topic in \('human', 'pokemon'\)/);
  assert.match(migration, /revoke all on table public\.community_questions_of_the_day from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.community_questions_of_the_day to service_role/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.ok((migration.match(/'human'\)/g) || []).length > (migration.match(/'pokemon'\)/g) || []).length);
});

test("owner Operations can preview and update only future editorial content", () => {
  assert.match(route, /requireOwner\(request\)/);
  assert.match(route, /date <= today/);
  assert.match(route, /body\.kind === "poll"/);
  assert.match(route, /body\.kind === "quiz"/);
  assert.match(route, /body\.kind === "question"/);
  assert.match(ui, /Community daily content/);
  assert.match(ui, /locked=date<=data\.today/);
  assert.match(ui, /min=\{firstFuture\}/);
});
