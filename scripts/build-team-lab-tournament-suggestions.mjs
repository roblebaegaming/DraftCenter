import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { competitiveTournamentPokemon } from "../src/lib/competitivePokemon.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const input = option("input");
const output = option("output");
const check = process.argv.includes("--check");
if (!input || !output) {
  throw new Error("Required: --input reviewed Limitless cohort --output compact Team Lab suggestions [--check]");
}

const cohort = JSON.parse(await fs.readFile(input, "utf8"));
if (cohort.schema_version !== 1 || !Array.isArray(cohort.events) || cohort.events.length < 1) {
  throw new Error("The reviewed Limitless cohort is missing or invalid");
}

async function source(eventId, endpoint) {
  const url = `https://play.limitlesstcg.com/api/tournaments/${eventId}/${endpoint}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "DraftCenter Team Lab competitive suggestion builder" } });
    if (response.ok) return { text: await response.text(), url };
    if (response.status !== 429 || attempt === 4) throw new Error(`Limitless returned ${response.status} for ${url}`);
    const retrySeconds = Math.min(30, Math.max(1, Number(response.headers.get("retry-after") || 5)));
    await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000));
  }
}

function addCount(map, value) {
  const name = String(value || "").trim();
  if (!name || name.length > 100) return;
  const key = name.toLocaleLowerCase("en-US");
  const current = map.get(key) || { name, count: 0 };
  current.count += 1;
  map.set(key, current);
}

function ranked(map, sampleSize) {
  return [...map.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 12)
    .map(({ name, count }) => ({ name, count, percentage: Number((100 * count / sampleSize).toFixed(1)) }));
}

const aggregate = new Map();
const eventSources = [];
let totalTeams = 0;
for (const event of cohort.events) {
  const eventId = String(event.source_event_id || "");
  if (!/^[a-zA-Z0-9_-]{4,100}$/.test(eventId)) throw new Error("The cohort contains an invalid event identifier");
  const [detailsSource, standingsSource, pairingsSource] = await Promise.all([
    source(eventId, "details"),
    source(eventId, "standings"),
    source(eventId, "pairings"),
  ]);
  const sourceSha256 = createHash("sha256")
    .update([detailsSource.text, standingsSource.text, pairingsSource.text].join("\n"))
    .digest("hex");
  if (sourceSha256 !== event.source_sha256) {
    throw new Error(`${eventId} no longer matches the reviewed cohort source hash`);
  }
  const standings = JSON.parse(standingsSource.text);
  const complete = standings.filter((entry) => Array.isArray(entry.decklist) && entry.decklist.length === 6);
  if (complete.length !== event.team_count) throw new Error(`${eventId} team-sheet count changed after cohort review`);
  totalTeams += complete.length;
  eventSources.push({
    id: eventId,
    name: event.name,
    date: event.event_date,
    teams: complete.length,
    url: event.source_url,
    source_sha256: sourceSha256,
  });

  for (const team of complete) {
    for (const member of team.decklist) {
      const pokemon = competitiveTournamentPokemon(member);
      if (!aggregate.has(pokemon.pokemon_key)) {
        aggregate.set(pokemon.pokemon_key, {
          name: pokemon.pokemon_name,
          sample_teams: 0,
          moves: new Map(),
          items: new Map(),
          abilities: new Map(),
        });
      }
      const record = aggregate.get(pokemon.pokemon_key);
      record.sample_teams += 1;
      for (const move of new Set(Array.isArray(member.attacks) ? member.attacks : [])) addCount(record.moves, move);
      addCount(record.items, member.item);
      if (!/ite(?: [xy])?$/i.test(String(member.item || "").trim())) addCount(record.abilities, member.ability);
    }
  }
}

const dates = eventSources.map((event) => event.date).sort();
const artifact = {
  schema_version: 1,
  format: {
    id: cohort.events[0].format_id,
    regulation_id: "reg-mb",
    name: "Pokémon Champions Regulation M-B",
    battle_style: "doubles",
    evidence_type: "open-tournament-team-sheets",
  },
  dataset: {
    source_name: "Limitless Tournament Platform",
    source_url: cohort.source.api_documentation,
    cohort_artifact: input.replaceAll("\\", "/"),
    period_start: dates[0],
    period_end: dates.at(-1),
    event_count: eventSources.length,
    team_count: totalTeams,
    methodology: "Counts moves, held items, and non-Mega base abilities from one complete public open team sheet per entrant in the reviewed cohort. Player identity is not retained.",
    privacy: cohort.privacy,
    events: eventSources,
  },
  pokemon: Object.fromEntries([...aggregate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, record]) => [key, {
      name: record.name,
      sample_teams: record.sample_teams,
      moves: ranked(record.moves, record.sample_teams),
      items: ranked(record.items, record.sample_teams),
      abilities: ranked(record.abilities, record.sample_teams),
    }])),
};
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (check) {
  const current = await fs.readFile(output, "utf8").catch(() => "");
  if (current !== serialized) throw new Error(`${output} is stale; rebuild and review it`);
  console.log(`Verified ${Object.keys(artifact.pokemon).length} Pokémon across ${totalTeams} open team sheets`);
} else {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, serialized, "utf8");
  console.log(`Wrote ${Object.keys(artifact.pokemon).length} Pokémon across ${totalTeams} open team sheets to ${output}`);
}
