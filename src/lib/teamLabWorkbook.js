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
  const teamName = text(myTeam?.team_name) || "My Team";

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
      ["How to use", "Use Matchup Plans for the weekly overview, Opponent Sets for planned and revealed information, Turn Log for battle review, and Game Plans for separate games in a set."],
    ],
    headerRow: 3,
    widths: [31, 100],
    mergeTitleThrough: 1,
  };

  const myTeamSheet = workbookSheet(
    "My Team",
    `My Team — ${teamName}`,
    "Keep the roster here and add the set, role, speed, and game-plan details you want beside it.",
    ["Pokémon", "Brought now", "Fainted now", "Ability", "Item", "Move 1", "Move 2", "Move 3", "Move 4", "Role / lead plan", "Speed / EV note", "Team-plan notes"],
    (myTeam?.pokemon || []).map((name) => {
      const pokemon = activeMyPokemon.get(name) || {};
      return [name, yesNo(pokemon.brought), yesNo(pokemon.fainted), "", "", "", "", "", "", "", "", ""];
    }),
    [24, 13, 13, 20, 20, 20, 20, 20, 20, 26, 24, 42],
  );

  const matchupPlans = workbookSheet(
    "Matchup Plans",
    `Matchup Plans — ${teamName}`,
    "One row per saved opponent plan. Private preparation and battle notes are intentionally included.",
    ["Week / round", "Opponent", "Opponent team", "Sheet", "Format", "Opponent roster", "Preparation notes", "Battle notes", "Actions", "Seen", "Fainted"],
    matchups.map((matchup) => {
      const report = reportForMatchup(matchup, activeMatchupId, activeState);
      const opponentPokemon = report.opponent_pokemon || [];
      return [
        weekForMatchup(matchup, activeMatchupId, activeState),
        text(matchup.opponent_name),
        text(matchup.opponent_team_name),
        sheetModeForMatchup(matchup, activeMatchupId, activeState),
        text(matchup.format_name || matchup.format_id),
        (matchup.pokemon || []).join(", "),
        text(matchup.notes),
        text(report.battle_notes),
        report.turn_log?.events?.length || 0,
        opponentPokemon.filter((pokemon) => pokemon.brought).length,
        opponentPokemon.filter((pokemon) => pokemon.fainted).length,
      ];
    }),
    [17, 24, 24, 11, 18, 48, 58, 58, 11, 10, 10],
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
    "Three editable planning rows per matchup. Add more rows in Excel or Google Sheets for longer sets.",
    ["Week / round", "Opponent", "Sheet", "Game", "Planned lead", "Back Pokémon", "Win condition", "Key threats", "Opposing lead", "What worked", "Next-game adjustment", "Notes"],
    matchups.flatMap((matchup) => Array.from({ length: WORKBOOK_GAME_PLAN_COUNT }, (_, index) => [
      weekForMatchup(matchup, activeMatchupId, activeState),
      text(matchup.opponent_name),
      sheetModeForMatchup(matchup, activeMatchupId, activeState),
      index + 1,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      index === 0 ? text(matchup.notes) : "",
    ])),
    [17, 23, 10, 9, 23, 30, 34, 34, 23, 34, 38, 48],
  );

  return [overview, myTeamSheet, matchupPlans, opponentSets, turnLog, gamePlans];
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
