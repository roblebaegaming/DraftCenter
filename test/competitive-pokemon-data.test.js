import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { competitivePokemonKey, competitiveTournamentPokemon } from "../src/lib/competitivePokemon.js";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");
const artifacts = [
  "data/competitive/smogon-2026-06-gen9ou-1825.json",
  "data/competitive/smogon-2026-06-gen9nationaldex-1760.json",
  "data/competitive/smogon-2026-06-gen9doublesou-1825.json",
  "data/competitive/smogon-2026-06-champions-reg-mb-1760.json",
];

test("competitive Pokemon keys preserve battle-relevant forms", () => {
  assert.equal(competitivePokemonKey("Ogerpon-Wellspring"), "ogerpon-wellspring-mask");
  assert.equal(competitivePokemonKey("Indeedee-F"), "indeedee-female");
  assert.equal(competitivePokemonKey("Urshifu-Rapid-Strike"), "urshifu-rapid-strike");
  assert.notEqual(competitivePokemonKey("Indeedee-F"), competitivePokemonKey("Indeedee-M"));
  assert.deepEqual(competitiveTournamentPokemon({ id: "charizard", name: "Charizard", item: "Charizardite Y" }), { pokemon_key: "charizard-mega-y", pokemon_name: "Mega Charizard Y" });
  assert.deepEqual(competitiveTournamentPokemon({ id: "garchomp", name: "Garchomp", item: "Garchompite" }), { pokemon_key: "garchomp-mega-z", pokemon_name: "Mega Garchomp" });
  assert.throws(() => competitiveTournamentPokemon({ id: "test", name: "Test", item: "Unknownite" }), /Unmapped Mega Stone/);
});

test("pinned Smogon artifacts retain provenance, samples, and unique ranks", () => {
  let battles = 0;
  for (const path of artifacts) {
    const artifact = JSON.parse(read(path));
    assert.equal(artifact.schema_version, 1);
    assert.match(artifact.dataset.source_url, /^https:\/\/www\.smogon\.com\/stats\/2026-06\//);
    assert.match(artifact.dataset.source_sha256, /^[a-f0-9]{64}$/);
    assert.ok(artifact.rows.length >= 300);
    assert.equal(new Set(artifact.rows.map((row) => row.rank)).size, artifact.rows.length);
    assert.equal(new Set(artifact.rows.map((row) => row.pokemon_key)).size, artifact.rows.length);
    assert.deepEqual(artifact.rows.map((row) => row.rank), artifact.rows.map((row) => row.rank).toSorted((a, b) => a - b));
    battles += artifact.dataset.total_battles;
  }
  assert.equal(battles, 2719877);
});

test("competitive schema is private by default and exposes only a bounded RPC", () => {
  const migration = read("supabase/344-competitive-pokemon-statistics.sql");
  for (const table of ["competitive_formats", "competitive_datasets", "pokemon_competitive_snapshots"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
  assert.match(migration, /security definer/);
  assert.match(migration, /limit 12/);
  assert.match(migration, /grant execute on function public\.get_public_pokemon_competitive_profile\(text\) to anon, authenticated/);
});

test("both Pokedex experiences explain and display competitive observations", () => {
  const profile = read("src/app/pokemon/[name]/page.js");
  const directory = read("src/components/PokemonDirectory.jsx");
  const component = read("src/components/CompetitivePokemonProfile.jsx");
  assert.match(profile, /getPublicPokemonCompetitiveProfile\(pokemon\.name\)/);
  assert.match(directory, /get_public_pokemon_competitive_profile/);
  assert.match(component, /not a DraftCenter tier, price, legality rule, or tournament win rate/);
  assert.match(component, /View source data/);
  assert.match(component, /total_battles/);
});

test("reviewed tournament cohort is complete, anonymous, and form aware", () => {
  const artifact = JSON.parse(read("data/competitive/tournaments/limitless-vgc-2026-08-reg-mb.json"));
  assert.equal(artifact.events.length, 10);
  assert.equal(artifact.events.reduce((sum, event) => sum + event.team_count, 0), 737);
  assert.equal(artifact.events.reduce((sum, event) => sum + event.teams.reduce((teamSum, team) => teamSum + team.roster.length, 0), 0), 4422);
  for (const event of artifact.events) {
    assert.equal(event.team_sheet_coverage, 100);
    assert.equal(event.team_count, event.player_count);
    assert.match(event.source_sha256, /^[a-f0-9]{64}$/);
    assert.equal(new Set(event.teams.map((team) => team.placement)).size, event.teams.length);
    for (const team of event.teams) {
      assert.deepEqual(Object.keys(team).toSorted(), ["is_champion", "is_finalist", "losses", "made_top_cut", "placement", "roster", "source_entry_key", "ties", "wins"].toSorted());
      assert.equal(team.roster.length, 6);
      assert.equal(new Set(team.roster.map((member) => member.pokemon_key)).size, 6);
    }
  }
  const serialized = JSON.stringify(artifact);
  assert.doesNotMatch(serialized, /"country"\s*:/);
  assert.doesNotMatch(serialized, /"player"\s*:/);
  assert.doesNotMatch(serialized, /"handle"\s*:/);

  const garchompTeams = artifact.events.flatMap((event) => event.teams.map((team) => ({ event, team }))).filter(({ team }) => team.roster.some((member) => member.pokemon_key === "garchomp"));
  assert.equal(garchompTeams.length, 247);
  assert.equal(new Set(garchompTeams.map(({ event }) => event.source_event_id)).size, 10);
  assert.equal(garchompTeams.filter(({ team }) => team.made_top_cut).length, 48);
  assert.equal(garchompTeams.filter(({ team }) => team.is_finalist).length, 8);
  assert.equal(garchompTeams.filter(({ team }) => team.is_champion).length, 4);
});

test("Team Lab tournament suggestions are a compact anonymous derivative of the reviewed cohort", () => {
  const artifact = JSON.parse(read("data/competitive/tournaments/limitless-vgc-2026-08-reg-mb-team-lab-suggestions.json"));
  assert.equal(artifact.schema_version, 1);
  assert.equal(artifact.format.regulation_id, "reg-mb");
  assert.equal(artifact.format.evidence_type, "open-tournament-team-sheets");
  assert.equal(artifact.dataset.event_count, 10);
  assert.equal(artifact.dataset.team_count, 737);
  assert.equal(artifact.dataset.period_start, "2026-08-01");
  assert.equal(artifact.dataset.period_end, "2026-08-06");
  assert.equal(artifact.dataset.events.length, 10);
  assert.ok(Object.keys(artifact.pokemon).length >= 180);
  assert.equal(artifact.pokemon.garchomp.sample_teams, 247);
  assert.deepEqual(artifact.pokemon.garchomp.moves.slice(0, 4).map((row) => row.name), ["Dragon Claw", "Rock Slide", "Earthquake", "Protect"]);
  assert.deepEqual(artifact.pokemon["garchomp-mega-z"].items, [{ name: "Garchompite", count: 10, percentage: 100 }]);
  assert.deepEqual(artifact.pokemon["garchomp-mega-z"].abilities, []);
  for (const record of Object.values(artifact.pokemon)) {
    assert.ok(record.sample_teams > 0 && record.sample_teams <= artifact.dataset.team_count);
    for (const category of ["moves", "items", "abilities"]) {
      assert.ok(record[category].length <= 12);
      assert.deepEqual(record[category].map((row) => row.count), record[category].map((row) => row.count).toSorted((a, b) => b - a));
      assert.ok(record[category].every((row) => row.count <= record.sample_teams && row.percentage > 0 && row.percentage <= 100));
    }
  }
  const serialized = JSON.stringify(artifact);
  assert.doesNotMatch(serialized, /"country"\s*:/);
  assert.doesNotMatch(serialized, /"player"\s*:/);
  assert.doesNotMatch(serialized, /"handle"\s*:/);

  const route = read("src/app/api/team-lab/competitive-suggestions/route.js");
  assert.match(route, /championsbattledata\.com/);
  assert.match(route, /limitless-open-team-sheets/);
  assert.match(route, /Current Pokémon Champions ranked doubles data/);
  assert.match(route, /tournament sample unavailable/);
  assert.match(route, /s-maxage=21600/);
});

test("tournament aggregates are RLS-backed, bounded, and separate from ladder usage", () => {
  const migration = read("supabase/346-competitive-tournament-results.sql");
  for (const table of ["competitive_tournaments", "competitive_tournament_teams", "competitive_tournament_team_members"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
  assert.match(migration, /get_public_pokemon_tournament_profile/);
  assert.match(migration, /recent_results.*row_number <= 5/s);
  assert.match(migration, /teammate_counts.*row_number <= 8/s);
  assert.match(migration, /relevant_formats.*limit 6/s);
  assert.doesNotMatch(migration, /\n\s*(player_name|player_handle|country|email)\s+/i);
  const component = read("src/components/TournamentPokemonProfile.jsx");
  assert.match(component, /not official Championship Series results/);
  assert.match(component, /Top-cut conversion/);
  assert.match(component, /Match win rate/);
  assert.match(component, /team-sheet coverage/);
});

test("competitive data documentation matches the forward-only migration sequence", () => {
  const documentation = read("docs/competitive-pokemon-data.md");
  const schemaCache = read("supabase/348-reload-competitive-profile-schema-cache.sql");
  assert.match(documentation, /Migration 344 creates the private-by-default competitive catalog/);
  assert.match(documentation, /Migration 345 imports pinned June 2026 Pokémon/);
  assert.match(documentation, /Migration 346 adds private event/);
  assert.match(documentation, /Migration 347 imports 10 completed/);
  assert.match(documentation, /Migration 348 explicitly refreshes the PostgREST schema cache/);
  assert.match(documentation, /Never rewrite migrations\s+344 through 348/);
  assert.match(schemaCache, /notify pgrst, 'reload schema';/);
  assert.doesNotMatch(documentation, /Migration 343 creates the private-by-default competitive catalog/);
});
