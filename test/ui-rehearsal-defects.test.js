import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function leagueSource() {
  return readFile(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");
}

test("spectators see read-only empty-roster wording", async () => {
  const source = await leagueSource();
  assert.match(source, /isSpectator[\s\S]*This team's roster will appear here once the draft is underway\./);
});

test("hosted manager count stays neutral until authoritative sync", async () => {
  const source = await leagueSource();
  assert.match(source, /managerAssignmentsReady=\{!leagueId \|\| synced\}/);
  assert.match(source, /managerAssignmentsReady \? `\$\{claimed\}\/\$\{state\.teams\.length\} managers assigned` : "Manager assignments loading\.\.\."/);
});
