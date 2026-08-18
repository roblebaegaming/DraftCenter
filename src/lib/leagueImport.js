const COLUMN_ALIASES = Object.freeze({
  team: ["team", "team name", "team_name"],
  manager: ["manager", "manager name", "coach", "coach name"],
  pokemon: ["pokemon", "pokémon", "pokemon name", "pokémon name"],
  price: ["price", "cost", "points", "point value"],
});

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function cell(row, key) {
  const aliases = COLUMN_ALIASES[key];
  const entry = Object.entries(row || {}).find(([header]) => aliases.includes(normalized(header)));
  return String(entry?.[1] ?? "").trim();
}

function error(row, code, message, value = "") {
  return { row, code, message, value: String(value || "").slice(0, 160) };
}

function rosterBounds(settings = {}) {
  const variable = settings.draftType === "auction" || settings.snakeBudgetEnabled;
  if (variable) {
    const minimum = Math.max(1, Number(settings.rosterMin) || 1);
    return { minimum, maximum: Math.max(minimum, Number(settings.rosterMax) || minimum) };
  }
  const exact = Math.max(1, Number(settings.rosterSize) || 1);
  return { minimum: exact, maximum: exact };
}

export function previewLeagueImport(rows, options = {}) {
  const allRows = Array.isArray(rows) ? rows : [];
  const sourceRows = allRows.slice(0, 5000);
  const pool = Array.isArray(options.pool) ? options.pool : [];
  const byPokemon = new Map(pool.map((pokemon) => [normalized(pokemon.name), pokemon.name]));
  const pokemonByName = new Map(pool.map((pokemon) => [pokemon.name, pokemon]));
  const teams = new Map();
  const usedPokemon = new Map();
  const prices = new Map();
  const errors = [];
  const warnings = [];

  if (!sourceRows.length) errors.push(error(1, "empty", "The import sheet has no data rows."));
  if (allRows.length > 5000) errors.push(error(5001, "row_limit", "Imports are limited to 5,000 rows."));

  sourceRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const teamName = cell(row, "team");
    const managerName = cell(row, "manager");
    const rawPokemon = cell(row, "pokemon");
    const rawPrice = cell(row, "price");
    const rowHasContent = Object.values(row || {}).some((value) => String(value ?? "").trim());
    if (rowHasContent && !teamName && !managerName && !rawPokemon && !rawPrice) {
      errors.push(error(rowNumber, "unsupported_columns", "This row has data but none of the documented Team, Manager, Pokémon, or Price columns."));
      return;
    }
    if (!teamName && !managerName && !rawPokemon && !rawPrice) return;
    if (teamName.length > 80) errors.push(error(rowNumber, "team_name_length", "Team names are limited to 80 characters.", teamName));
    if (managerName.length > 80) errors.push(error(rowNumber, "manager_name_length", "Manager planning labels are limited to 80 characters.", managerName));
    if (managerName && !teamName) errors.push(error(rowNumber, "manager_without_team", "A manager must be attached to a team.", managerName));
    if (rawPrice && !rawPokemon) errors.push(error(rowNumber, "price_without_pokemon", "A price must be attached to a Pokémon.", rawPrice));

    let team = null;
    if (teamName) {
      const key = normalized(teamName);
      team = teams.get(key);
      if (!team) {
        team = { name: teamName.slice(0, 80), manager: managerName.slice(0, 80), pokemon: [], sourceRows: [rowNumber] };
        teams.set(key, team);
      } else {
        team.sourceRows.push(rowNumber);
        if (managerName && team.manager && normalized(managerName) !== normalized(team.manager)) {
          errors.push(error(rowNumber, "manager_conflict", `${team.name} has more than one manager label.`, managerName));
        } else if (managerName && !team.manager) {
          team.manager = managerName.slice(0, 80);
        }
      }
    }

    if (!rawPokemon) return;
    const canonicalPokemon = byPokemon.get(normalized(rawPokemon));
    if (!canonicalPokemon) {
      errors.push(error(rowNumber, "unknown_pokemon", `Unknown or unavailable Pokémon form “${rawPokemon}”. Use the exact DraftCenter name.`, rawPokemon));
      return;
    }
    if (rawPrice) {
      const price = Number(rawPrice);
      if (!Number.isInteger(price) || price < 1 || price > 100) {
        errors.push(error(rowNumber, "invalid_price", `${canonicalPokemon} needs a whole-number price from 1 to 100.`, rawPrice));
      } else if (prices.has(canonicalPokemon) && prices.get(canonicalPokemon) !== price) {
        errors.push(error(rowNumber, "price_conflict", `${canonicalPokemon} has conflicting prices.`, rawPrice));
      } else {
        prices.set(canonicalPokemon, price);
      }
    }
    if (!team) return;
    if (usedPokemon.has(canonicalPokemon)) {
      errors.push(error(rowNumber, "duplicate_pokemon", `${canonicalPokemon} is already assigned to ${usedPokemon.get(canonicalPokemon)}.`, canonicalPokemon));
      return;
    }
    usedPokemon.set(canonicalPokemon, team.name);
    team.pokemon.push(canonicalPokemon);
  });

  const teamList = [...teams.values()];
  const maximumTeams = Math.max(2, Number(options.maximumTeams) || 16);
  if (teamList.length > maximumTeams) errors.push(error(1, "team_limit", `This league supports at most ${maximumTeams} imported teams.`));
  if (teamList.length && teamList.length < 4) warnings.push("DraftCenter league schedules normally use at least four teams.");
  const existingTeams = Array.isArray(options.existingTeams) ? options.existingTeams : [];
  const hasClaimedTeams = existingTeams.some((team) => team?.claimedBy || team?.claimedByUserId);
  if (hasClaimedTeams && teamList.length) {
    const exactExistingOrder = teamList.length === existingTeams.length
      && teamList.every((team, index) => normalized(team.name) === normalized(existingTeams[index]?.name));
    if (!exactExistingOrder) errors.push(error(1, "claimed_team_conflict", "Managers have already claimed teams. Keep the existing team count and names in their current order, or use a new practice league for this import."));
  }

  const hasRosters = teamList.some((team) => team.pokemon.length > 0);
  if (hasRosters) {
    const bounds = rosterBounds(options.settings);
    teamList.forEach((team) => {
      if (team.pokemon.length < bounds.minimum || team.pokemon.length > bounds.maximum) {
        errors.push(error(team.sourceRows[0], "roster_capacity", `${team.name} has ${team.pokemon.length} Pokémon; complete-roster import requires ${bounds.minimum === bounds.maximum ? bounds.minimum : `${bounds.minimum}–${bounds.maximum}`}.`));
      }
      const rosterProblem = options.validateRoster?.(team.pokemon, pokemonByName);
      if (rosterProblem) errors.push(error(team.sourceRows[0], "roster_rule", `${team.name}: ${rosterProblem}`));
      if (options.settings?.draftType === "auction" || options.settings?.snakeBudgetEnabled) {
        const budget = Math.max(0, Number(options.settings?.budget) || 0);
        const spend = team.pokemon.reduce((sum, name) => {
          const importedPrice = prices.get(name);
          const pokemon = pokemonByName.get(name);
          const currentPrice = Number(options.costFor?.(pokemon, options.settings) ?? pokemon?.cost ?? 0);
          return sum + (Number.isInteger(importedPrice) ? importedPrice : currentPrice);
        }, 0);
        if (spend > budget) errors.push(error(team.sourceRows[0], "budget_exceeded", `${team.name} costs ${spend} points against a ${budget}-point budget.`));
      }
    });
  }
  if (teamList.some((team) => team.manager)) {
    warnings.push("Manager names are planning labels only. Each manager must still accept an invite and claim their team with their own account.");
  }

  return {
    ok: errors.length === 0,
    mode: hasRosters ? "complete-rosters" : "setup",
    teams: teamList.map(({ sourceRows, ...team }) => team),
    prices: Object.fromEntries(prices),
    errors,
    warnings,
    summary: {
      rows: sourceRows.length,
      teams: teamList.length,
      managers: teamList.filter((team) => team.manager).length,
      rosterPokemon: usedPokemon.size,
      priceChanges: prices.size,
    },
  };
}

export function leagueImportErrorCsv(errors = []) {
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return ["Row,Code,Value,Problem", ...(errors || []).map((item) => [item.row, item.code, item.value, item.message].map(quote).join(","))].join("\r\n");
}
