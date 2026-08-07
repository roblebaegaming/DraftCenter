import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { competitiveTournamentPokemon } from "../src/lib/competitivePokemon.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const eventIds = String(option("event-ids") || "").split(",").map((value) => value.trim()).filter(Boolean);
const output = option("output");
const formatId = option("format-id") || "champions-reg-mb";
const sourceFormat = option("source-format") || "M-B";
const minimumPlayers = Number(option("minimum-players") || 32);
const minimumCoverage = Number(option("minimum-coverage") || 95);
if (!eventIds.length || !output || !/^[a-z0-9-]+$/.test(formatId) || !/^[A-Z0-9-]+$/.test(sourceFormat) ||
    !Number.isInteger(minimumPlayers) || minimumPlayers < 2 || minimumCoverage < 0 || minimumCoverage > 100) {
  throw new Error("Required: --event-ids ID,ID --output FILE; optional: --format-id, --source-format, --minimum-players, --minimum-coverage");
}
if (new Set(eventIds).size !== eventIds.length || eventIds.some((id) => !/^[a-zA-Z0-9_-]{4,100}$/.test(id))) {
  throw new Error("Event IDs must be unique Limitless identifiers");
}

async function source(endpoint) {
  const url = `https://play.limitlesstcg.com/api/tournaments/${endpoint}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "DraftCenter competitive tournament importer" } });
    if (response.ok) {
      const text = await response.text();
      return { url, text, value: JSON.parse(text) };
    }
    if (response.status !== 429 || attempt === 4) throw new Error(`Limitless returned ${response.status} for ${url}`);
    const retrySeconds = Math.min(30, Math.max(1, Number(response.headers.get("retry-after") || 5)));
    console.log(`Limitless rate limit reached; retrying ${endpoint} in ${retrySeconds}s`);
    await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000));
  }
}

const events = [];
for (const eventId of eventIds) {
  const detailsSource = await source(`${eventId}/details`);
  const standingsSource = await source(`${eventId}/standings`);
  const pairingsSource = await source(`${eventId}/pairings`);
  const details = detailsSource.value;
  const standings = standingsSource.value;
  const pairings = pairingsSource.value;
  if (details.id !== eventId || details.game !== "VGC" || details.format !== sourceFormat ||
      !details.isPublic || !details.decklists || details.players < minimumPlayers ||
      !Array.isArray(standings) || standings.length !== details.players) {
    throw new Error(`${eventId} is not a complete public ${sourceFormat} VGC event with at least ${minimumPlayers} players`);
  }
  if (!details.phases?.some((phase) => phase.type === "SINGLE_BRACKET")) {
    throw new Error(`${eventId} has no single-elimination top cut`);
  }
  const cutLabels = pairings.map((pairing) => String(pairing.match || "").match(/^T(\d+)-/i)?.[1]).filter(Boolean).map(Number);
  const topCutSize = Math.max(...cutLabels);
  if (!Number.isInteger(topCutSize) || topCutSize < 2 || topCutSize > details.players) throw new Error(`${eventId} has no bounded top-cut size`);

  const complete = standings.filter((entry) => Array.isArray(entry.decklist) && entry.decklist.length === 6);
  const coverage = Number((100 * complete.length / details.players).toFixed(3));
  if (coverage < minimumCoverage) throw new Error(`${eventId} team-sheet coverage ${coverage}% is below ${minimumCoverage}%`);
  const placements = complete.map((entry) => Number(entry.placing));
  if (placements.some((placing) => !Number.isInteger(placing) || placing < 1) || new Set(placements).size !== placements.length) {
    throw new Error(`${eventId} contains invalid or duplicate placements`);
  }

  const teams = complete.sort((left, right) => left.placing - right.placing).map((entry) => {
    const roster = entry.decklist.map(competitiveTournamentPokemon);
    if (new Set(roster.map((member) => member.pokemon_key)).size !== roster.length) throw new Error(`${eventId} placement ${entry.placing} has duplicate normalized forms`);
    return {
      source_entry_key: `placement-${entry.placing}`,
      placement: Number(entry.placing), wins: Number(entry.record?.wins || 0), losses: Number(entry.record?.losses || 0), ties: Number(entry.record?.ties || 0),
      made_top_cut: Number(entry.placing) <= topCutSize, is_finalist: Number(entry.placing) <= 2,
      is_champion: Number(entry.placing) === 1, roster,
    };
  });
  const rawSource = [detailsSource.text, standingsSource.text, pairingsSource.text].join("\n");
  events.push({
    format_id: formatId, source_name: "Limitless Tournament Platform", source_event_id: eventId,
    source_url: `https://play.limitlesstcg.com/tournament/${eventId}/standings`, name: String(details.name),
    event_date: String(details.date).slice(0, 10), event_kind: "online-community", player_count: Number(details.players),
    team_count: teams.length, top_cut_size: topCutSize, team_sheet_coverage: coverage, is_official: false,
    source_sha256: createHash("sha256").update(rawSource).digest("hex"), teams,
  });
  console.log(`Reviewed ${details.name}: ${teams.length}/${details.players} teams, top ${topCutSize}`);
}

const artifact = {
  schema_version: 1,
  source: { name: "Limitless Tournament Platform", api_documentation: "https://docs.limitlesstcg.com/developer/tournaments" },
  privacy: "Player names, handles, countries, and account identifiers are deliberately omitted.",
  events: events.sort((left, right) => left.event_date.localeCompare(right.event_date) || left.source_event_id.localeCompare(right.source_event_id)),
};
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${events.length} events and ${events.reduce((sum, event) => sum + event.team_count, 0)} teams to ${output}`);
