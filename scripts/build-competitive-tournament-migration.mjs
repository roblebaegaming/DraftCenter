import fs from "node:fs/promises";
import process from "node:process";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error("Usage: node scripts/build-competitive-tournament-migration.mjs ARTIFACT... --output FILE");
const inputs = args.slice(0, outputIndex);
if (!inputs.length) throw new Error("At least one artifact is required");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const boolean = (value) => value ? "true" : "false";
const lines = ["-- Generated from reviewed Limitless API tournament artifacts.", "begin;"];

for (const input of inputs) {
  const artifact = JSON.parse(await fs.readFile(input, "utf8"));
  for (const event of artifact.events) {
    const teamsJson = quote(JSON.stringify(event.teams));
    lines.push(
      `insert into public.competitive_tournaments (format_id,source_name,source_event_id,source_url,name,event_date,event_kind,player_count,team_count,top_cut_size,team_sheet_coverage,is_official,source_sha256) values (${quote(event.format_id)},${quote(event.source_name)},${quote(event.source_event_id)},${quote(event.source_url)},${quote(event.name)},${quote(event.event_date)},${quote(event.event_kind)},${event.player_count},${event.team_count},${event.top_cut_size},${event.team_sheet_coverage},${boolean(event.is_official)},${quote(event.source_sha256)}) on conflict (source_name,source_event_id) do update set source_url=excluded.source_url,name=excluded.name,event_date=excluded.event_date,player_count=excluded.player_count,team_count=excluded.team_count,top_cut_size=excluded.top_cut_size,team_sheet_coverage=excluded.team_sheet_coverage,source_sha256=excluded.source_sha256;`,
      `with event as (select id from public.competitive_tournaments where source_name=${quote(event.source_name)} and source_event_id=${quote(event.source_event_id)}) insert into public.competitive_tournament_teams (tournament_id,source_entry_key,placement,wins,losses,ties,made_top_cut,is_finalist,is_champion,roster_size) select event.id,t.source_entry_key,t.placement,t.wins,t.losses,t.ties,t.made_top_cut,t.is_finalist,t.is_champion,jsonb_array_length(t.roster) from event cross join jsonb_to_recordset(${teamsJson}::jsonb) as t(source_entry_key text,placement integer,wins integer,losses integer,ties integer,made_top_cut boolean,is_finalist boolean,is_champion boolean,roster jsonb) on conflict (tournament_id,source_entry_key) do update set placement=excluded.placement,wins=excluded.wins,losses=excluded.losses,ties=excluded.ties,made_top_cut=excluded.made_top_cut,is_finalist=excluded.is_finalist,is_champion=excluded.is_champion,roster_size=excluded.roster_size;`,
      `with event as (select id from public.competitive_tournaments where source_name=${quote(event.source_name)} and source_event_id=${quote(event.source_event_id)}), rosters as (select t.source_entry_key,t.roster from jsonb_to_recordset(${teamsJson}::jsonb) as t(source_entry_key text,roster jsonb)), members as (select team.id as team_id,member.ordinality::smallint as slot,member.value->>'pokemon_key' as pokemon_key,member.value->>'pokemon_name' as pokemon_name from event join public.competitive_tournament_teams team on team.tournament_id=event.id join rosters on rosters.source_entry_key=team.source_entry_key cross join lateral jsonb_array_elements(rosters.roster) with ordinality as member(value,ordinality)) insert into public.competitive_tournament_team_members (team_id,slot,pokemon_key,pokemon_name) select team_id,slot,pokemon_key,pokemon_name from members on conflict (team_id,slot) do update set pokemon_key=excluded.pokemon_key,pokemon_name=excluded.pokemon_name;`
    );
  }
}
lines.push("commit;", "");
await fs.writeFile(args[outputIndex + 1], lines.join("\n"), "utf8");
console.log(`Wrote ${args[outputIndex + 1]}`);
