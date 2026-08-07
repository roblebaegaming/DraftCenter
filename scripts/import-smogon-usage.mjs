import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { competitivePokemonKey } from "../src/lib/competitivePokemon.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const month = option("month");
const sourceFormat = option("source-format");
const formatId = option("format-id");
const formatName = option("format-name");
const battleStyle = option("battle-style");
const rulesetFamily = option("ruleset-family") || "smogon";
const generation = Number(option("generation") || 9);
const regulationId = option("regulation-id");
const cutoff = Number(option("cutoff") || 0);
const output = option("output");

if (!/^\d{4}-\d{2}$/.test(month || "") || !/^[a-z0-9]+$/.test(sourceFormat || "") ||
    !/^[a-z0-9-]+$/.test(formatId || "") || !formatName ||
    !["singles", "doubles"].includes(battleStyle) || !output ||
    !Number.isInteger(cutoff) || cutoff < 0) {
  throw new Error("Required: --month YYYY-MM --source-format ID --format-id ID --format-name NAME --battle-style singles|doubles --cutoff N --output FILE");
}

const sourceUrl = `https://www.smogon.com/stats/${month}/${sourceFormat}-${cutoff}.txt`;
const response = await fetch(sourceUrl, { headers: { "user-agent": "DraftCenter competitive data importer" } });
if (!response.ok) throw new Error(`Smogon returned ${response.status} for ${sourceUrl}`);
const raw = await response.text();
const totalBattles = Number(raw.match(/Total battles:\s*(\d+)/)?.[1]);
if (!Number.isSafeInteger(totalBattles) || totalBattles <= 0) throw new Error("Missing or invalid Total battles header");

const rows = [];
for (const line of raw.split(/\r?\n/)) {
  const match = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|\s*([\d.]+)%\s*\|\s*(\d+)\s*\|\s*([\d.]+)%\s*\|$/);
  if (!match) continue;
  const pokemonName = match[2].trim();
  rows.push({
    rank: Number(match[1]), pokemon_key: competitivePokemonKey(pokemonName), pokemon_name: pokemonName,
    weighted_usage: Number(match[3]), raw_uses: Number(match[4]), raw_usage: Number(match[5]),
    real_uses: Number(match[6]), real_usage: Number(match[7]),
  });
}
if (rows.length < 10 || new Set(rows.map((row) => row.pokemon_key)).size !== rows.length) {
  throw new Error(`Parsed ${rows.length} rows or found a duplicate normalized Pokemon key`);
}

const [year, monthNumber] = month.split("-").map(Number);
const periodStart = `${month}-01`;
const periodEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
const artifact = {
  schema_version: 1,
  format: { id: formatId, name: formatName, battle_style: battleStyle, ruleset_family: rulesetFamily, generation, regulation_id: regulationId || null, source_format_id: sourceFormat },
  dataset: {
    source_name: "Smogon University",
    source_url: sourceUrl,
    period_start: periodStart,
    period_end: periodEnd,
    rating_cutoff: cutoff,
    total_battles: totalBattles,
    methodology: "Monthly Pokemon Showdown ladder usage published by Smogon; weighted usage reflects the selected rating cutoff.",
    source_sha256: createHash("sha256").update(raw).digest("hex"),
  },
  rows,
};
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${rows.length} Pokemon from ${totalBattles} battles to ${output}`);
