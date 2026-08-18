"use client";

import {
  buildTeamLabPerformanceSummary,
  summarizeTeamLabBattleReport,
  TEAM_LAB_BATTLE_PURPOSE_OPTIONS,
} from "../lib/teamLab";

function recordText(summary) {
  return `${summary.wins}–${summary.losses}${summary.ties ? `–${summary.ties}` : ""}`;
}

function resultDetail(summary) {
  return summary.winRate == null
    ? `${summary.games} game${summary.games === 1 ? "" : "s"}`
    : `${summary.winRate}% wins · ${summary.games} game${summary.games === 1 ? "" : "s"}`;
}

function reportDate(value) {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

export default function TeamLabReports({ matchups = [], rosterNames = [], onOpenBattle = null }) {
  const summary = buildTeamLabPerformanceSummary(matchups, rosterNames);
  const reports = matchups
    .map(summarizeTeamLabBattleReport)
    .filter((report) => report.hasActivity)
    .sort((left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""));
  const streak = summary.streak.count
    ? `${summary.streak.result === "win" ? "W" : "L"}${summary.streak.count}`
    : "—";

  return <section className="team-lab-performance" aria-labelledby="team-lab-performance-title">
    <div className="team-lab-performance-heading"><div><span className="eyebrow">TEAM PERFORMANCE</span><h3 id="team-lab-performance-title">Battle reports and usage</h3><p>Private Battle Mode results roll up automatically here and in My Teams.</p></div>{summary.games.length > 0 && <span>{summary.games.length} game{summary.games.length === 1 ? "" : "s"} logged</span>}</div>
    <div className="team-lab-performance-metrics">
      <div><span>Record</span><strong>{recordText(summary)}</strong><small>{summary.ties ? "W–L–T" : "Wins–losses"}</small></div>
      <div><span>Win rate</span><strong>{summary.winRate == null ? "—" : `${summary.winRate}%`}</strong><small>Decided games</small></div>
      <div><span>Current streak</span><strong>{streak}</strong><small>{summary.streak.count ? `${summary.streak.result === "win" ? "Win" : "Loss"} streak` : "No results yet"}</small></div>
      <div><span>Matches</span><strong>{summary.matchesLogged}</strong><small>Completed reports</small></div>
      {summary.rating.gamesTracked > 0 && <div><span>Latest rating</span><strong>{summary.rating.latest ?? "—"}</strong><small>{summary.rating.totalChange >= 0 ? "+" : ""}{summary.rating.totalChange} tracked change</small></div>}
      {summary.replayCount > 0 && <div><span>Replays</span><strong>{summary.replayCount}</strong><small>Private saved links</small></div>}
    </div>
    {summary.lastTen.length > 0 ? <div className="team-lab-last-ten"><span>Last {summary.lastTen.length}</span><div>{summary.lastTen.map((result, index) => <b key={`${result}-${index}`} className={`is-${result}`} aria-label={result}>{result === "win" ? "W" : result === "loss" ? "L" : "T"}</b>)}</div></div> : <p className="team-lab-performance-empty">Choose Win, Loss, or Tie in Battle Mode and your team history will begin here.</p>}

    {summary.games.length > 0 && <div className="team-lab-report-breakdowns">
      <section><h4>By battle type</h4><div className="team-lab-purpose-performance">{TEAM_LAB_BATTLE_PURPOSE_OPTIONS.filter((option) => summary.purposes[option.id].games > 0).map((option) => <article key={option.id}><span>{option.label}</span><strong>{recordText(summary.purposes[option.id])}</strong><small>{resultDetail(summary.purposes[option.id])}</small></article>)}</div></section>
      <section><h4>By team sheet</h4><div className="team-lab-sheet-performance"><article><span>Open team sheet</span><strong>{recordText(summary.sheetModes.open)}</strong><small>{resultDetail(summary.sheetModes.open)}</small></article><article><span>Closed team sheet</span><strong>{recordText(summary.sheetModes.closed)}</strong><small>{resultDetail(summary.sheetModes.closed)}</small></article></div></section>
    </div>}

    {reports.length > 0 && <details className="team-lab-individual-reports" open><summary>Individual battle reports</summary><div>{reports.map((report) => <article key={report.id}>
      <header><div><span className="eyebrow">{report.purposeLabel} · {report.sheetMode === "open" ? "Open sheet" : "Closed sheet"}</span><h4>{report.weekLabel || report.sessionLabel || "Saved battle"} · vs. {report.opponentName}</h4>{report.opponentTeamName && <p>{report.opponentTeamName}</p>}</div>{reportDate(report.updatedAt) && <time dateTime={report.updatedAt}>{reportDate(report.updatedAt)}</time>}</header>
      <div className="team-lab-report-facts"><span><strong>{recordText(report.series)}</strong> match</span><span><strong>{report.completedGames}</strong> game{report.completedGames === 1 ? "" : "s"}</span><span><strong>{report.turnActions}</strong> turn action{report.turnActions === 1 ? "" : "s"}</span><span><strong>{report.revealedMoves}</strong> revealed move{report.revealedMoves === 1 ? "" : "s"}</span><span><strong>{report.myBrought}</strong> of yours brought</span><span><strong>{report.opponentBrought}</strong> opponents seen</span>{report.replayCount > 0 && <span><strong>{report.replayCount}</strong> replay{report.replayCount === 1 ? "" : "s"}</span>}{report.ratingGames > 0 && <span><strong>{report.ratingGames}</strong> rating update{report.ratingGames === 1 ? "" : "s"}</span>}</div>
      {report.sessionLabel && report.sessionLabel !== report.weekLabel && <p className="team-lab-report-session">Session: {report.sessionLabel}</p>}
      {onOpenBattle && <button type="button" className="secondary-button" onClick={() => onOpenBattle(matchups.find((matchup) => String(matchup.id) === report.id))}>Open or continue in Battle Mode</button>}
    </article>)}</div></details>}

    {summary.games.length > 0 && <details><summary>Pokémon, matchup, and move analytics</summary>
      <h4>Your Pokémon usage and leads</h4><div className="team-lab-performance-pokemon">{summary.pokemon.map((pokemon) => <article key={pokemon.name}><strong>{pokemon.name}</strong><span>{pokemon.broughtMatches} match{pokemon.broughtMatches === 1 ? "" : "es"} brought</span><small>{pokemon.leads} lead{pokemon.leads === 1 ? "" : "s"} · {pokemon.leadWins}–{pokemon.leadLosses} lead record{pokemon.megaMatches ? ` · ${pokemon.megaMatches} Mega` : ""}{pokemon.teraMatches ? ` · ${pokemon.teraMatches} Tera` : ""}</small></article>)}</div>
      {summary.opponentPokemon.length > 0 && <div className="team-lab-opponent-matchups"><h4>Opposing-Pokémon matchup record</h4><div>{summary.opponentPokemon.map((pokemon) => <article key={pokemon.name}><strong>{pokemon.name}</strong><span>{pokemon.wins}–{pokemon.losses}{pokemon.ties ? `–${pokemon.ties}` : ""}</span><small>{pokemon.winRate == null ? "No completed match decisions" : `${pokemon.winRate}% wins`} · seen in {pokemon.seenMatches}</small></article>)}</div></div>}
      {summary.moveUsage.length > 0 && <div className="team-lab-move-usage"><h4>Recorded move usage</h4><div>{summary.moveUsage.slice(0, 24).map((usage) => <article key={`${usage.side}-${usage.pokemon}-${usage.move}`}><span>{usage.side === "my" ? "Your side" : "Opponent"}</span><strong>{usage.pokemon} · {usage.move}</strong><small>{usage.uses} use{usage.uses === 1 ? "" : "s"} across {usage.games} game{usage.games === 1 ? "" : "s"}{usage.winRate == null ? "" : ` · ${usage.winRate}% wins when used`}</small></article>)}</div></div>}
      {(summary.replayCount > 0 || summary.rating.gamesTracked > 0) && <div className="team-lab-game-history"><h4>Ratings and replays</h4><div>{summary.games.filter((game) => game.replayUrl || game.eloBefore != null || game.eloAfter != null).map((game) => <article key={`${game.matchupId}-${game.game}`}><strong>{game.weekLabel || game.sessionLabel || game.opponentName || "Saved match"} · Game {game.game}</strong><span>{game.eloBefore != null || game.eloAfter != null ? `${game.eloBefore ?? "—"} → ${game.eloAfter ?? "—"}` : "No rating"}</span>{game.replayUrl && <a href={game.replayUrl} target="_blank" rel="noreferrer">Open replay</a>}</article>)}</div></div>}
    </details>}
  </section>;
}
