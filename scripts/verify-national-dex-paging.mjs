import assert from "node:assert/strict";
import { loadAllLeaguePokemon } from "../src/lib/leaguePokemon.mjs";

const catalogue = Array.from({ length: 1027 }, (_, index) => ({
  id: `row-${index}`,
  source_key: String(index),
}));
const requestedRanges = [];
const query = {
  select() { return this; },
  eq() { return this; },
  order() { return this; },
  async range(from, to) {
    requestedRanges.push([from, to]);
    return { data: catalogue.slice(from, to + 1), error: null };
  },
};
const supabase = { from() { return query; } };
const result = await loadAllLeaguePokemon(supabase, "national-dex-test");

assert.equal(result.error, null);
assert.equal(result.data.length, catalogue.length);
assert.deepEqual(requestedRanges, [[0, 999], [1000, 1999]]);
console.log(`National Dex paging verified across ${result.data.length} Pokémon rows.`);
