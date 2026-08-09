import { pokemonProfileSlugForName } from "../lib/publicPokemonIndex";

function displayDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function placementLabel(value) {
  const number = Number(value);
  if (number === 1) return "Champion";
  if (number === 2) return "Finalist";
  return `#${number}`;
}

export default function TournamentPokemonProfile({ formats = [], pokemonName = "This Pokémon" }) {
  if (!formats?.length) return <p className="muted">Reviewed tournament results will appear after {pokemonName} is present in a complete imported event cohort.</p>;
  return <div className="tournament-pokemon-profile">
    {formats.map((format) => <section key={format.format_id}>
      <header><div><span className="eyebrow">TOURNAMENT RESULTS · {format.ruleset_family.toUpperCase()}</span><h3>{format.format_name}</h3></div><small>{displayDate(format.period_start)}–{displayDate(format.period_end)}</small></header>
      <p className="muted">Anonymous aggregates from {Number(format.tournaments).toLocaleString()} fully reported online community events. These are not official Championship Series results.</p>
      <div className="tournament-result-metrics">
        <article><strong>{Number(format.field_usage).toFixed(2)}%</strong><span>Field usage</span><small>{format.team_appearances} of {format.imported_teams} complete teams</small></article>
        <article><strong>{Number(format.top_cut_conversion).toFixed(2)}%</strong><span>Top-cut conversion</span><small>{format.top_cuts} top cuts from {format.team_appearances} appearances</small></article>
        <article><strong>{Number(format.match_win_rate).toFixed(2)}%</strong><span>Match win rate</span><small>{format.match_wins}-{format.match_losses}-{format.match_ties} combined record</small></article>
        <article><strong>{format.finals}</strong><span>Finals</span><small>{Number(format.finals_conversion).toFixed(2)}% of team appearances</small></article>
        <article><strong>{format.wins}</strong><span>Tournament wins</span><small>{Number(format.win_conversion).toFixed(2)}% of team appearances</small></article>
      </div>
      {format.recent_results?.length ? <><h4>Recent top finishes</h4><div className="tournament-pokemon-finishes">{format.recent_results.map((result) => <a key={`${result.source_url}-${result.placement}`} href={result.source_url} target="_blank" rel="noreferrer"><strong>{placementLabel(result.placement)} · {result.event_name}</strong><span>{displayDate(result.event_date)} · {result.player_count} players · {result.team_sheet_coverage}% team-sheet coverage</span></a>)}</div></> : null}
      {format.teammates?.length ? <><h4>Most common tournament teammates</h4><div className="pokemon-tags">{format.teammates.map((teammate) => <a key={teammate.pokemon_key} href={`/pokemon/${pokemonProfileSlugForName(teammate.pokemon_key)}`}>{teammate.pokemon_name} · {teammate.teams}</a>)}</div></> : null}
    </section>)}
  </div>;
}
