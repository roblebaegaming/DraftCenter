import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const DATA_PATH = new URL(
  "../data/community-adp/trickruby-2026-weighted-snake.json",
  import.meta.url,
);
const MIGRATIONS_PATH = new URL("../supabase/migrations/", import.meta.url);
const rawData = readFileSync(DATA_PATH, "utf8");
const source = JSON.parse(rawData);
const migrationName = readdirSync(MIGRATIONS_PATH).find((name) =>
  name.endsWith("_add_trickruby_community_adp_samples.sql"),
);

assert.ok(migrationName, "The TrickRuby Community ADP migration must exist.");

const migration = readFileSync(
  new URL(`../supabase/migrations/${migrationName}`, import.meta.url),
  "utf8",
);

const md5 = (value) => createHash("md5").update(value).digest("hex");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sqlQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;

test("the reviewed source preserves the four points-snake pick sequences", () => {
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.interpretation.draftType, "points-snake");
  assert.equal(source.interpretation.teamsPerPod, 8);
  assert.equal(source.interpretation.pickNumbers, "one-based");
  assert.equal(source.interpretation.pointsAffectOrder, false);
  assert.match(source.interpretation.rule, /leftmost team to the rightmost team/i);
  assert.match(source.interpretation.rule, /reverse direction/i);
  assert.match(source.interpretation.rule, /skip blank cells/i);

  const expected = [
    {
      sourceKey: "trickruby-2026-bearemy",
      completedPicks: 80,
      first: "Mega Pyroar",
      last: "Appletun",
      csvSha256: "60171ad2a336e8bb00a53d55271b17e73eaf2b28b0bae730f87fe14c2195b3f8",
    },
    {
      sourceKey: "trickruby-2026-garchomp",
      completedPicks: 79,
      first: "Sinistcha",
      last: "Simipour",
      csvSha256: "13c8bd464d6c36a59f00ba877fa5ddf5edd2d6fdd811a73dc6389f2367c6f736",
    },
    {
      sourceKey: "trickruby-2026-jellicent",
      completedPicks: 80,
      first: "Farigiraf",
      last: "Simisage",
      csvSha256: "15a42bf80928ce36b924178d882f9877af41965dcd89362ba24cb0a70c502b47",
    },
    {
      sourceKey: "trickruby-2026-lechuga",
      completedPicks: 81,
      first: "Mega Kangaskhan",
      last: "Forretress",
      csvSha256: "e5a018407b24d57c94f801b1283318c4e6bb00cad23f45de0d4f95485851f16d",
    },
  ];

  assert.equal(source.sources.length, expected.length);
  assert.equal(
    source.sources.reduce((total, item) => total + item.picks.length, 0),
    320,
  );

  for (const reviewed of expected) {
    const item = source.sources.find(
      (candidate) => candidate.sourceKey === reviewed.sourceKey,
    );
    assert.ok(item, `Missing ${reviewed.sourceKey}`);
    assert.equal(item.completedPicks, reviewed.completedPicks);
    assert.equal(item.picks.length, reviewed.completedPicks);
    assert.deepEqual(
      item.picks.map((pick) => pick.pickNumber),
      Array.from({ length: reviewed.completedPicks }, (_, index) => index + 1),
    );
    assert.equal(new Set(item.picks.map((pick) => pick.pokemon)).size, item.picks.length);
    assert.equal(item.picks[0].pokemon, reviewed.first);
    assert.equal(item.picks.at(-1).pokemon, reviewed.last);
    assert.equal(item.sourceCsvSha256, reviewed.csvSha256);
    assert.equal(
      md5(
        item.picks
          .map((pick) => `${pick.pickNumber}:${pick.pokemon}`)
          .join("\n"),
      ),
      item.pickOrderMd5,
    );
  }
});

test("all four sources share the reviewed 307-Pokemon eligible pool", () => {
  const eligible = source.eligiblePool.pokemon;
  assert.equal(source.eligiblePool.regulationId, "reg-mb");
  assert.equal(source.eligiblePool.pokemonCount, 307);
  assert.equal(eligible.length, 307);
  assert.equal(new Set(eligible).size, 307);
  assert.deepEqual(eligible, [...eligible].sort((left, right) => left.localeCompare(right)));
  assert.equal(md5(eligible.join("\n")), source.eligiblePool.namesMd5);

  const eligibleSet = new Set(eligible);
  for (const item of source.sources) {
    for (const pick of item.picks) {
      assert.ok(
        eligibleSet.has(pick.pokemon),
        `${pick.pokemon} is missing from the reviewed eligible pool`,
      );
    }
  }
});

test("the migration is tied to the reviewed artifact and fails closed", () => {
  assert.match(
    migration,
    new RegExp(`Reviewed data artifact SHA-256: ${sha256(rawData)}`),
  );
  assert.match(migration, /create table public\.community_draft_sources/i);
  assert.match(migration, /create table public\.community_draft_samples/i);
  assert.match(
    migration,
    /alter table public\.community_draft_sources enable row level security/i,
  );
  assert.match(
    migration,
    /alter table public\.community_draft_samples enable row level security/i,
  );
  assert.match(
    migration,
    /create index community_draft_samples_pokemon_key\s+on public\.community_draft_samples\(pokemon_id, source_key\)/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.community_draft_sources\s+from public, anon, authenticated, service_role/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.community_draft_samples\s+from public, anon, authenticated, service_role/i,
  );
  assert.match(migration, /eligible pool failed the reviewed count\/hash gate/i);
  assert.match(migration, /source picks failed the sequence\/hash gate/i);
  assert.match(migration, /samples failed the final count gate/i);
  assert.match(migration, /<> 4[\s\S]*<> 1228[\s\S]*<> 320/i);

  for (const pokemon of source.eligiblePool.pokemon) {
    assert.ok(
      migration.includes(`(${sqlQuote(pokemon)})`),
      `Migration is missing eligible Pokemon ${pokemon}`,
    );
  }
  for (const item of source.sources) {
    for (const pick of item.picks) {
      assert.ok(
        migration.includes(
          `(${sqlQuote(item.sourceKey)}, ${pick.pickNumber}, ${sqlQuote(pick.pokemon)})`,
        ),
        `Migration is missing ${item.sourceKey} pick ${pick.pickNumber}`,
      );
    }
  }
});

test("Community Explore and Pokedex profiles consume eligibility-aware imported samples", () => {
  assert.match(migration, /imported_adp as \(/i);
  assert.match(
    migration,
    /count\(sample\.pick_number\)::integer as drafts[\s\S]*count\(\*\)::integer as eligible_drafts/i,
  );
  assert.match(
    migration,
    /sum\(coalesce\(sample\.pick_number, source\.completed_picks \+ 1\)\)::numeric as pick_sum/i,
  );
  assert.match(
    migration,
    /select pokemon, drafts, eligible_drafts, pick_sum from imported_adp/i,
  );
  assert.match(migration, /'community:' \|\| sample\.source_key as draft_session_id/i);
  assert.match(
    migration,
    /coalesce\(sample\.pick_number, source\.completed_picks \+ 1\)::numeric as adp_value/i,
  );
  assert.match(
    migration,
    /delete from public\.public_explore_cache where cache_key = 'shared'/i,
  );
});

test("the committed source artifact contains no coach identities or contact data", () => {
  assert.doesNotMatch(rawData, /@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(rawData, /"manager"\s*:/i);
  assert.doesNotMatch(rawData, /"coach"\s*:/i);
});
