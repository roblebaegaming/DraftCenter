import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data/pokemon/pokemon-legends-alpha-availability.json");
const LEGENDS_ARCEUS = path.join(
  ROOT,
  "data/nuzlocke/pokemon-legends-arceus.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
);
const LEGENDS_ZA_POKEDEX = path.join(
  ROOT,
  "data/pokemon/pokemon-legends-za-pokedex.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
);
const LEGENDS_ZA_AUDIT = path.join(
  ROOT,
  "data/nuzlocke/pokemon-legends-za-encounter-audit.pkhex-90b265a8f339f46ae1bf3b592f88281fe6500a92.json",
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function uniqueSpecies(entries) {
  const byId = new Map();
  for (const entry of entries) {
    const pokemonId = Number(entry.pokemon_id ?? entry.species_id);
    if (!Number.isInteger(pokemonId) || pokemonId < 1 || byId.has(pokemonId)) continue;
    byId.set(pokemonId, {
      pokemon_id: pokemonId,
      pokemon_name: entry.pokemon_name ?? entry.species_name,
      species_family: entry.species_family,
    });
  }
  return [...byId.values()].sort((left, right) => left.pokemon_id - right.pokemon_id);
}

function availability(gameKey, entries, directAlphaIds, directAlphaFamilies, source) {
  const species = uniqueSpecies(entries);
  const eligible = [];
  const alphaLocked = [];

  for (const entry of species) {
    if (directAlphaIds.has(entry.pokemon_id)) {
      eligible.push({ pokemon_id: entry.pokemon_id, pokemon_name: entry.pokemon_name, basis: "direct" });
    } else if (entry.species_family && directAlphaFamilies.has(entry.species_family)) {
      eligible.push({ pokemon_id: entry.pokemon_id, pokemon_name: entry.pokemon_name, basis: "evolution" });
    } else {
      alphaLocked.push({ pokemon_id: entry.pokemon_id, pokemon_name: entry.pokemon_name });
    }
  }

  return {
    game_key: gameKey,
    total_species: species.length,
    alpha_eligible_species: eligible.length,
    alpha_locked_species: alphaLocked.length,
    source,
    eligible,
    alpha_locked: alphaLocked,
  };
}

const arceus = readJson(LEGENDS_ARCEUS);
const zaPokedex = readJson(LEGENDS_ZA_POKEDEX);
const zaAudit = readJson(LEGENDS_ZA_AUDIT);

const arceusDirect = new Set(arceus.encounters
  .filter(({ conditions = [] }) => conditions.includes("alpha-encounter"))
  .map(({ pokemon_id }) => Number(pokemon_id)));
const arceusDirectFamilies = new Set(arceus.encounters
  .filter(({ conditions = [] }) => conditions.includes("alpha-encounter"))
  .map(({ species_family }) => species_family)
  .filter(Boolean));
const zaDirect = new Set(zaAudit.source_rows
  .filter(({ is_alpha }) => is_alpha === true)
  .map(({ species_id }) => Number(species_id)));
const zaDirectFamilies = new Set(zaPokedex.entries
  .filter(({ pokemon_id }) => zaDirect.has(Number(pokemon_id)))
  .map(({ species_family }) => species_family)
  .filter(Boolean));

const games = [
  availability("legends-arceus", arceus.pokedex_entries, arceusDirect, arceusDirectFamilies, {
    pokedex_commit: "5064f1d72746b3a6a931616dae3fb6445c556d4f",
    encounter_commit: "18cc30d6416b8fc58320af0f9b9d1b62bee405e1",
    source_kind: "reviewed encounter catalog",
  }),
  availability("legends-za", zaPokedex.entries, zaDirect, zaDirectFamilies, {
    pokedex_commit: zaPokedex.source_commit,
    encounter_commit: zaAudit.sources.pkhex_commit,
    source_kind: "pinned non-public encounter audit",
  }),
];

const expected = {
  "legends-arceus": { total: 242, eligible: 224, locked: 18 },
  "legends-za": { total: 364, eligible: 339, locked: 25 },
};
for (const game of games) {
  const counts = expected[game.game_key];
  if (!counts
    || game.total_species !== counts.total
    || game.alpha_eligible_species !== counts.eligible
    || game.alpha_locked_species !== counts.locked) {
    throw new Error(`Alpha availability counts changed for ${game.game_key}: ${game.total_species}/${game.alpha_eligible_species}/${game.alpha_locked_species}; review the pinned sources before updating the gate.`);
  }
}

const artifact = {
  schema_version: 1,
  generated_from_pinned_sources: true,
  eligibility_rule: "A species is eligible when a reviewed source contains a direct Alpha encounter, gift, or static specimen, or when it can evolve from a directly obtainable Alpha in the same reviewed evolution family.",
  privacy_boundary: "This artifact contains species eligibility only. It intentionally omits locations, levels, probabilities, progression requirements, and encounter rows.",
  games,
};
const output = `${JSON.stringify(artifact, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== output) {
    throw new Error("The checked-in Legends Alpha availability artifact is stale. Run npm run catalog:build:legends-alpha.");
  }
  console.log("Legends Alpha availability verified: Arceus 224/242, Z-A 339/364.");
} else {
  fs.writeFileSync(OUTPUT, output);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}.`);
}
