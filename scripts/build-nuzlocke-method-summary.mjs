import fs from "node:fs/promises";
import path from "node:path";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value, list[index + 1]] : null).filter(Boolean));
const inputDirectory = String(args.get("--input-dir") || "");
const output = String(args.get("--output") || "");
const sourceCommit = String(args.get("--commit") || "");
if (!inputDirectory || !output) throw new Error("--input-dir and --output are required.");
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("--commit must be an exact 40-character source commit.");

const suffix = `.pokeapi-${sourceCommit}.json`;
const files = (await fs.readdir(inputDirectory))
  .filter((name) => name.startsWith("pokemon-") && name.endsWith(suffix) && !name.includes("-evolutions."));
const records = [];
for (const file of files) {
  const catalog = JSON.parse(await fs.readFile(path.join(inputDirectory, file), "utf8"));
  const gameKey = String(catalog.game?.game_key || "");
  const releaseOrder = Number(catalog.game?.release_order);
  if (!gameKey || !Number.isInteger(releaseOrder)) throw new Error(`${file} is missing bounded game metadata.`);
  if (!String(catalog.game.coverage_note || "").includes(sourceCommit)) throw new Error(`${file} does not match the pinned source commit.`);
  const methods = [...new Set((catalog.encounters || []).map((row) => String(row.method || "")).filter(Boolean))].sort();
  if (!methods.length || methods.length > 50) throw new Error(`${file} has an invalid method summary.`);
  records.push({ game_key: gameKey, release_order: releaseOrder, source_commit: sourceCommit, methods });
}
records.sort((left, right) => left.release_order - right.release_order);
if (records.length !== 37 || new Set(records.map((record) => record.game_key)).size !== 37) throw new Error("The reviewed method summary must contain exactly 37 games.");

await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
await fs.writeFile(output, `${JSON.stringify({ source_commit: sourceCommit, games: Object.fromEntries(records.map(({ game_key, source_commit, methods }) => [game_key, { source_commit, methods }])) }, null, 2)}\n`);
console.log(`Wrote ${output} with ${records.length} verified game method summaries.`);
