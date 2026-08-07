import fs from "node:fs/promises";
import process from "node:process";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error("Usage: node scripts/build-competitive-data-migration.mjs ARTIFACT... --output FILE");
const output = args[outputIndex + 1];
const inputs = args.slice(0, outputIndex);
if (!inputs.length) throw new Error("At least one artifact is required");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => value == null ? "null" : quote(value);
const lines = ["-- Generated from reviewed data/competitive artifacts.", "begin;"];

for (const input of inputs) {
  const artifact = JSON.parse(await fs.readFile(input, "utf8"));
  const f = artifact.format;
  const d = artifact.dataset;
  lines.push(
    `insert into public.competitive_formats (id,name,battle_style,ruleset_family,generation,regulation_id,source_format_id) values (${quote(f.id)},${quote(f.name)},${quote(f.battle_style)},${quote(f.ruleset_family)},${Number(f.generation)},${nullable(f.regulation_id)},${quote(f.source_format_id)}) on conflict (id) do update set name=excluded.name,battle_style=excluded.battle_style,ruleset_family=excluded.ruleset_family,generation=excluded.generation,regulation_id=excluded.regulation_id,source_format_id=excluded.source_format_id;`,
    `with dataset as (insert into public.competitive_datasets (format_id,source_name,source_url,period_start,period_end,rating_cutoff,total_battles,methodology,source_sha256) values (${quote(f.id)},${quote(d.source_name)},${quote(d.source_url)},${quote(d.period_start)},${quote(d.period_end)},${Number(d.rating_cutoff)},${Number(d.total_battles)},${quote(d.methodology)},${quote(d.source_sha256)}) on conflict (format_id,source_name,period_start,period_end,rating_cutoff) do update set source_url=excluded.source_url,total_battles=excluded.total_battles,methodology=excluded.methodology,source_sha256=excluded.source_sha256 returning id) insert into public.pokemon_competitive_snapshots (dataset_id,pokemon_key,pokemon_name,rank,weighted_usage,raw_uses,raw_usage,real_uses,real_usage) select dataset.id,r.pokemon_key,r.pokemon_name,r.rank,r.weighted_usage,r.raw_uses,r.raw_usage,r.real_uses,r.real_usage from dataset cross join jsonb_to_recordset(${quote(JSON.stringify(artifact.rows))}::jsonb) as r(pokemon_key text,pokemon_name text,rank integer,weighted_usage numeric,raw_uses bigint,raw_usage numeric,real_uses bigint,real_usage numeric) on conflict (dataset_id,pokemon_key) do update set pokemon_name=excluded.pokemon_name,rank=excluded.rank,weighted_usage=excluded.weighted_usage,raw_uses=excluded.raw_uses,raw_usage=excluded.raw_usage,real_uses=excluded.real_uses,real_usage=excluded.real_usage;`
  );
}
lines.push("commit;", "");
await fs.writeFile(output, lines.join("\n"), "utf8");
console.log(`Wrote ${output}`);
