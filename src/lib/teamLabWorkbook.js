import { buildTeamLabPerformanceSummary } from "./teamLab.js";

const WORKBOOK_GAME_PLAN_COUNT = 3;

function text(value) {
  return String(value ?? "").trim();
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function moveAt(pokemon, index) {
  return text(pokemon?.moves?.[index]);
}

function statSpread(stats, defaultsTo = 0) {
  const labels = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
  return Object.entries(labels)
    .filter(([key]) => Number(stats?.[key]) !== defaultsTo)
    .map(([key, label]) => `${Number(stats?.[key])} ${label}`)
    .join(" / ");
}

function reportForMatchup(matchup, activeMatchupId, activeState) {
  return matchup.id === activeMatchupId && activeState?.report
    ? activeState.report
    : matchup.battle_report || {};
}

function sheetModeForMatchup(matchup, activeMatchupId, activeState) {
  const mode = matchup.id === activeMatchupId ? activeState?.sheetMode : matchup.sheet_mode;
  return mode === "open" ? "Open" : "Closed";
}

function weekForMatchup(matchup, activeMatchupId, activeState) {
  return text(matchup.id === activeMatchupId ? activeState?.weekLabel : matchup.week_label);
}

function workbookSheet(name, title, purpose, headers, dataRows, widths) {
  const rows = [
    [title],
    [purpose],
    [],
    headers,
    ...(dataRows.length ? dataRows : [["No saved information yet"]]),
  ];
  return {
    name,
    rows,
    headerRow: 3,
    widths,
    mergeTitleThrough: Math.max(headers.length - 1, 0),
  };
}

export function buildTeamLabWorkbookSheets({
  myTeam,
  matchups = [],
  activeMatchupId = "",
  activeState = null,
  formatName = "",
  exportedAt = new Date(),
}) {
  const exportDate = exportedAt instanceof Date && !Number.isNaN(exportedAt.valueOf())
    ? exportedAt.toISOString()
    : new Date(exportedAt).toISOString();
  const activeMatchup = matchups.find((matchup) => matchup.id === activeMatchupId) || matchups[0] || null;
  const activeReport = activeMatchup ? reportForMatchup(activeMatchup, activeMatchupId, activeState) : {};
  const activeMyPokemon = new Map((activeReport.my_pokemon || []).map((pokemon) => [pokemon.name, pokemon]));
  const mySetByName = new Map((myTeam?.team_sets?.pokemon || []).map((pokemon) => [pokemon.name, pokemon]));
  const teamName = text(myTeam?.team_name) || "My Team";
  const performanceMatchups = matchups.map((matchup) => matchup.id === activeMatchupId && activeState?.report
    ? { ...matchup, battle_report: activeState.report }
    : matchup);
  const performance = buildTeamLabPerformanceSummary(performanceMatchups, myTeam?.pokemon || []);

  const overview = {
    name: "Overview",
    rows: [
      [`DraftCenter Team Lab — ${teamName}`],
      ["Private planning workbook for Excel or Google Sheets. It includes private notes and scouting because you explicitly downloaded it."],
      [],
      ["Field", "Value"],
      ["Team", teamName],
      ["League", text(myTeam?.league_name)],
      ["Current format", text(formatName || myTeam?.format_name)],
      ["Opponent plans", matchups.length],
      ["Current Battle Mode opponent", text(activeMatchup?.opponent_name)],
      ["Current week or round", activeMatchup ? weekForMatchup(activeMatchup, activeMatchupId, activeState) : ""],
      ["Current sheet type", activeMatchup ? sheetModeForMatchup(activeMatchup, activeMatchupId, activeState) : ""],
      ["Exported", exportDate],
      [],
      ["How to use", "Use Performance for the team record and usage, Matchup Plans for the weekly overview, Opponent Sets for revealed information, Turn Log for battle review, and Game Plans for each game."],
    ],
    headerRow: 3,
    widths: [31, 100],
    mergeTitleThrough: 1,
  };

  const performanceSheet = {
    name: "Performance",
    rows: [
      [`Performance — ${teamName}`],
      ["Team record and Pokémon usage calculated from completed private Battle Room games."],
      [],
      ["Record", `${performance.wins}-${performance.losses}${performance.ties ? `-${performance.ties}` : ""}`],
      ["Win rate", performance.winRate == null ? "" : `${performance.winRate}%`],
      ["Games logged", performance.games.length],
      ["Matches logged", performance.matchesLogged],
      ["Current streak", performance.streak.count ? `${performance.streak.result === "win" ? "W" : "L"}${performance.streak.count}` : ""],
      ["Last 10", performance.lastTen.map((result) => result === "win" ? "W" : result === "loss" ? "L" : "T").join(" ")],
      [],
      ["Pokémon", "Matches brought", "Leads", "Lead wins", "Lead losses", "Tera matches"],
      ...(performance.pokemon.length ? performance.pokemon.map((pokemon) => [pokemon.name, pokemon.broughtMatches, pokemon.leads, pokemon.leadWins, pokemon.leadLosses, pokemon.teraMatches]) : [["No completed games yet"]]),
    ],
    headerRow: 10,
    widths: [25, 18, 12, 14, 14, 15],
    mergeTitleThrough: 5,
  };

  const myTeamSheet = workbookSheet(
    "My Team",
    `My Team — ${teamName}`,
    "Keep the roster here and add the set, role, speed, and game-plan details you want beside it.",
    ["Pokémon", "Brought now", "Fainted now", "Level", "Ability", "Item", "Nature", "Tera type", "EVs", "IVs", "Move 1", "Move 2", "Move 3", "Move 4", "Role", "Private set notes"],
    (myTeam?.pokemon || []).map((name) => {
      const pokemon = activeMyPokemon.get(name) || {};
      const set = mySetByName.get(name) || {};
      return [name, yesNo(pokemon.brought), yesNo(pokemon.fainted), set.level || "", text(set.ability), text(set.item), text(set.nature), text(set.tera_type), statSpread(set.evs), statSpread(set.ivs, 31), moveAt(set, 0), moveAt(set, 1), moveAt(set, 2), moveAt(set, 3), text(set.role), text(set.notes)];
    }),
    [24, 13, 13, 9, 20, 20, 14, 14, 35, 35, 20, 20, 20, 20, 24, 45],
  );

  const matchupPlans = workbookSheet(
    "Matchup Plans",
    `Matchup Plans — ${teamName}`,
    "One row per saved opponent plan. Private preparation and battle notes are intentionally included.",
    ["Week / round", "Opponent", "Opponent team", "Sheet", "Format", "Opponent roster", "Preparation notes", "Battle notes", "Set score", "Weather", "Terrain", "Actions", "Seen", "Fainted"],
    matchups.map((matchup) => {
      const report = reportForMatchup(matchup, activeMatchupId, activeState);
      const opponentPokemon = report.opponent_pokemon || [];
      const wins = (report.series?.games || []).filter((game) => game.result === "win").length;
      const losses = (report.series?.games || []).filter((game) => game.result === "loss").length;
      return [
        weekForMatchup(matchup, activeMatchupId, activeState),
        text(matchup.opponent_name),
        text(matchup.opponent_team_name),
        sheetModeForMatchup(matchup, activeMatchupId, activeState),
        text(matchup.format_name || matchup.format_id),
        (matchup.pokemon || []).join(", "),
        text(matchup.notes),
        text(report.battle_notes),
        report.series ? `${wins}-${losses}` : "",
        text(report.battle_state?.weather),
        text(report.battle_state?.terrain),
        report.turn_log?.events?.length || 0,
        opponentPokemon.filter((pokemon) => pokemon.brought).length,
        opponentPokemon.filter((pokemon) => pokemon.fainted).length,
      ];
    }),
    [17, 24, 24, 11, 18, 48, 58, 58, 12, 12, 12, 11, 10, 10],
  );

  const opponentSetsRows = matchups.flatMap((matchup) => {
    const report = reportForMatchup(matchup, activeMatchupId, activeState);
    const plannedByName = new Map((matchup.opponent_sets?.pokemon || []).map((pokemon) => [pokemon.name, pokemon]));
    const revealedByName = new Map((report.opponent_pokemon || []).map((pokemon) => [pokemon.name, pokemon]));
    return (matchup.pokemon || []).map((name) => {
      const planned = plannedByName.get(name) || {};
      const revealed = revealedByName.get(name) || {};
      return [
        weekForMatchup(matchup, activeMatchupId, activeState),
        text(matchup.opponent_name),
        name,
        sheetModeForMatchup(matchup, activeMatchupId, activeState),
        text(planned.ability),
        text(planned.item),
        moveAt(planned, 0),
        moveAt(planned, 1),
        moveAt(planned, 2),
        moveAt(planned, 3),
        yesNo(revealed.brought),
        yesNo(revealed.fainted),
        text(revealed.ability),
        text(revealed.item),
        moveAt(revealed, 0),
        moveAt(revealed, 1),
        moveAt(revealed, 2),
        moveAt(revealed, 3),
        "",
      ];
    });
  });
  const opponentSets = workbookSheet(
    "Opponent Sets",
    `Opponent Sets — ${teamName}`,
    "Compare preplanned open-sheet or scouting information with what was actually revealed in Battle Mode.",
    ["Week / round", "Opponent", "Pokémon", "Sheet", "Planned ability", "Planned item", "Planned move 1", "Planned move 2", "Planned move 3", "Planned move 4", "Seen", "Fainted", "Revealed ability", "Revealed item", "Revealed move 1", "Revealed move 2", "Revealed move 3", "Revealed move 4", "Review notes"],
    opponentSetsRows,
    [17, 23, 23, 10, 20, 20, 20, 20, 20, 20, 9, 10, 20, 20, 20, 20, 20, 20, 40],
  );

  const turnLogRows = matchups.flatMap((matchup) => {
    const report = reportForMatchup(matchup, activeMatchupId, activeState);
    return (report.turn_log?.events || []).map((event) => [
      weekForMatchup(matchup, activeMatchupId, activeState),
      text(matchup.opponent_name),
      event.game || 1,
      event.turn,
      event.side === "my" ? "My side" : "Opponent",
      text(event.kind),
      text(event.pokemon),
      text(event.target),
      text(event.move),
      text(event.detail),
      text(event.damage),
      text(event.note),
    ]);
  });
  const turnLog = workbookSheet(
    "Turn Log",
    `Turn Log — ${teamName}`,
    "Every saved action across this team workspace, ready to filter by opponent, game, turn, side, or action.",
    ["Week / round", "Opponent", "Game", "Turn", "Side", "Action", "Pokémon", "Target", "Move", "Ability / item reveal", "Damage", "Action note"],
    turnLogRows,
    [17, 23, 9, 9, 12, 12, 23, 23, 22, 25, 14, 46],
  );

  const gamePlans = workbookSheet(
    "Game Plans",
    `Game Plans — ${teamName}`,
    "Saved per-game plans, results, and between-game adjustments. Legacy reports receive three editable starter rows.",
    ["Week / round", "Opponent", "Sheet", "Game", "Result", "Planned lead", "Opposing lead", "Game plan", "Next-game adjustment", "Preparation notes"],
    matchups.flatMap((matchup) => {
      const report = reportForMatchup(matchup, activeMatchupId, activeState);
      const games = report.series?.games?.length ? report.series.games : Array.from({ length: WORKBOOK_GAME_PLAN_COUNT }, (_, index) => ({ game: index + 1 }));
      return games.map((game, index) => [
        weekForMatchup(matchup, activeMatchupId, activeState),
        text(matchup.opponent_name),
        sheetModeForMatchup(matchup, activeMatchupId, activeState),
        game.game || index + 1,
        text(game.result),
        text(game.my_lead),
        text(game.opponent_lead),
        text(game.plan),
        text(game.adjustments),
        index === 0 ? text(matchup.notes) : "",
      ]);
    }),
    [17, 23, 10, 9, 12, 23, 23, 55, 45, 48],
  );

  return [overview, performanceSheet, myTeamSheet, matchupPlans, opponentSets, turnLog, gamePlans];
}

export function buildTeamLabWorkbookFilename(teamName, exportedAt = new Date()) {
  const date = (exportedAt instanceof Date ? exportedAt : new Date(exportedAt)).toISOString().slice(0, 10);
  const slug = text(teamName)
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase()
    .slice(0, 60) || "team-lab";
  return `${slug}-battle-workbook-${date}.xlsx`;
}
