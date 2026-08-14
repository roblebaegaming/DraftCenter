import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEAGUE_SOURCE_PATH = path.join(ROOT, "src/components/PokemonDraftLeague.jsx");
const OUTPUT_PATH = path.join(ROOT, "src/data/draft-lab-catalog.json");

async function importSource(relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function evaluateLeagueCatalog(source) {
  const showdown = await importSource("src/lib/showdown-regional-pokedexes.js");
  const catalog = await importSource("src/lib/regulation-catalog.js");
  const start = source.indexOf("const TYPE_COLORS");
  const end = source.indexOf("function regulationFor");
  if (start < 0 || end <= start) throw new Error("League catalog block is no longer discoverable.");
  const dataSource = source
    .slice(start, end)
    .replaceAll("export const ", "const ")
    .replaceAll("export function ", "function ");
  const evaluate = new Function(
    "SHOWDOWN_REGIONAL_POKEDEXES",
    "SHOWDOWN_GAME_AVAILABILITY",
    "withRegulationMetadata",
    `${dataSource}\nreturn { MASTER_POKEDEX, REGULATION_SETS };`,
  );
  return evaluate(
    showdown.SHOWDOWN_REGIONAL_POKEDEXES,
    showdown.SHOWDOWN_GAME_AVAILABILITY,
    catalog.withRegulationMetadata,
  );
}

function evaluatePokemonData(source) {
  const start = source.indexOf("export const POKEMON_DATA = {");
  const marker = "\n};\n\n// Shared PokeAPI response parsing";
  const end = source.indexOf(marker, start);
  if (start < 0 || end <= start) throw new Error("Static Pokémon data block is no longer discoverable.");
  const dataSource = `${source.slice(start, end + 3).replace("export const ", "const ")}\nreturn POKEMON_DATA;`;
  return new Function(dataSource)();
}

function regulationSnapshot(regulation) {
  const keys = [
    "id", "name", "subtitle", "gameId", "generation", "category", "order", "current",
    "legalNames", "restrictedNames", "defaultRestrictedCap", "defaultMegaCap",
  ];
  return Object.fromEntries(keys
    .filter((key) => regulation[key] !== undefined)
    .map((key) => [key, regulation[key]]));
}

async function buildSnapshot() {
  const source = fs.readFileSync(LEAGUE_SOURCE_PATH, "utf8").replace(/\r\n/g, "\n");
  const [{ MASTER_POKEDEX, REGULATION_SETS }, POKEMON_DATA] = await Promise.all([
    evaluateLeagueCatalog(source),
    Promise.resolve(evaluatePokemonData(source)),
  ]);
  const pokemon = [...new Map(MASTER_POKEDEX.map((entry) => [entry.name, entry])).values()]
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      t1: entry.t1,
      t2: entry.t2 || null,
      bst: entry.bst,
      gen: entry.gen,
      isMega: Boolean(entry.isMega),
      stats: POKEMON_DATA[entry.name]?.stats || null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    version: 1,
    generatedFrom: "src/components/PokemonDraftLeague.jsx",
    pokemon,
    regulations: Object.fromEntries(Object.entries(REGULATION_SETS)
      .map(([id, regulation]) => [id, regulationSnapshot(regulation)])),
  };
}

const expected = `${JSON.stringify(await buildSnapshot(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  const actual = fs.existsSync(OUTPUT_PATH)
    ? fs.readFileSync(OUTPUT_PATH, "utf8").replace(/\r\n/g, "\n")
    : "";
  if (actual !== expected) {
    console.error("Draft Lab catalog is stale. Run npm run draft-lab:build-catalog.");
    process.exit(1);
  }
  console.log("Draft Lab catalog matches the league catalog and regulation source.");
} else {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, expected);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}.`);
}
