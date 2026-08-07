import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data", "nuzlocke");
const sourceCommit = "5064f1d72746b3a6a931616dae3fb6445c556d4f";
const slugOverrides = { firered: "fire-red", leafgreen: "leaf-green", heartgold: "heart-gold", soulsilver: "soul-silver" };
const starterFallbacks = {
  red: [[1, "Bulbasaur"], [4, "Charmander"], [7, "Squirtle"]],
  blue: [[1, "Bulbasaur"], [4, "Charmander"], [7, "Squirtle"]],
  yellow: [[25, "Pikachu"]],
};
const profileSlug = (name) => name.toLowerCase().replace(/[.'’:%]/g, "").replace(/♀/g, "-f").replace(/♂/g, "-m").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const files = fs.readdirSync(dataDir)
  .filter((name) => name.startsWith("pokemon-") && name.endsWith(`.pokeapi-${sourceCommit}.json`) && !name.includes("-evolutions."));

const games = files.map((file) => {
  const catalog = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  const { game } = catalog;
  const slug = slugOverrides[game.game_key] || game.game_key;
  const starters = game.starters || (starterFallbacks[game.game_key] || []).map(([pokemon_id, pokemon_name]) => ({ pokemon_id, pokemon_name }));
  const methods = [...new Set(catalog.encounters.map((row) => row.method))].sort();
  const encountersByArea = new Map();
  for (const row of catalog.encounters) {
    if (!encountersByArea.has(row.area_key)) encountersByArea.set(row.area_key, new Map());
    const byMethod = encountersByArea.get(row.area_key);
    if (!byMethod.has(row.method)) byMethod.set(row.method, new Map());
    const form = row.form_name ? ` (${row.form_name})` : "";
    const key = `${row.pokemon_id}:${row.form_name || ""}`;
    const pokemon = byMethod.get(row.method).get(key) || {
      pokemonId: row.pokemon_id,
      name: `${row.pokemon_name}${form}`,
      minLevel: row.min_level,
      maxLevel: row.max_level,
    };
    pokemon.minLevel = Math.min(pokemon.minLevel ?? row.min_level, row.min_level ?? pokemon.minLevel);
    pokemon.maxLevel = Math.max(pokemon.maxLevel ?? row.max_level, row.max_level ?? pokemon.maxLevel);
    byMethod.get(row.method).set(key, pokemon);
  }
  const areas = catalog.locations.map((location) => ({
    areaKey: location.area_key,
    label: location.display_name,
    methods: [...(encountersByArea.get(location.area_key) || new Map())].map(([method, pokemon]) => ({
      method,
      pokemon: [...pokemon.values()].sort((a, b) => a.pokemonId - b.pokemonId || a.name.localeCompare(b.name)),
    })),
  })).filter((area) => area.methods.length);
  const uniquePokemon = new Set(catalog.encounters.map((row) => `${row.pokemon_id}:${row.form_name || ""}`)).size;
  return {
    slug,
    gameKey: game.game_key,
    displayName: game.display_name,
    generation: game.generation,
    releaseOrder: game.release_order,
    family: game.family,
    description: `A route-by-route ${game.display_name} Nuzlocke encounter guide covering all ${areas.length} reviewed catch areas, with every available Pokémon grouped by encounter method.`,
    counts: { locations: areas.length, methods: methods.length, pokemon: uniquePokemon },
    starters: starters.map((starter) => ({ pokemonId: starter.pokemon_id, name: starter.pokemon_name, profileSlug: profileSlug(starter.pokemon_name) })),
    conditions: (game.condition_groups || []).map((group) => ({ id: group.id, label: group.label, options: group.options.map((option) => option.label) })),
    methods,
    areas,
    generatorHref: `/nuzlocke?game=${game.game_key}&seed=${slug}-guide&size=6&mode=route-random&weighting=equal&starter=include`,
  };
}).sort((a, b) => a.releaseOrder - b.releaseOrder);

fs.writeFileSync(path.join(root, "src", "lib", "nuzlockeGameGuides.json"), `${JSON.stringify({ sourceCommit, publishedDate: "2026-08-07", games }, null, 2)}\n`);
console.log(`Built ${games.length} complete Nuzlocke game guides.`);
