import { POKEDEX_COLLECTOR_CSV_HEADERS, pokedexCollectorFilename } from "./pokedexCollector.js";
import {
  championsAchievementState,
  championsPokemonState,
  normalizeChampionsProgress,
  POKEMON_CHAMPIONS_POKEMON,
  POKEMON_CHAMPIONS_TRAINER_ACHIEVEMENTS,
} from "./pokemonChampionsAchievements.js";

function safe(value) {
  let candidate = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(candidate)) candidate = `'${candidate}`;
  return candidate;
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function sheet(name, title, purpose, headers, rows, widths) {
  return {
    name,
    rows: [[title], [purpose], [], headers, ...(rows.length ? rows : [["No saved information yet"]])],
    headerRow: 3,
    widths,
    mergeTitleThrough: Math.max(headers.length - 1, 0),
  };
}

function trackerLabel(tracker) {
  return safe(tracker.title || tracker.catalog_name || tracker.catalog_key || "Pokédex tracker");
}

function enrichedSpecimens(tracker) {
  const locations = new Map((tracker.locations || []).map((location) => [location.id, location]));
  return (tracker.specimens || []).map((specimen) => {
    const location = locations.get(specimen.location_id) || {};
    return {
      ...specimen,
      location_name: specimen.location_name || location.name || "",
      location_kind: specimen.location_kind || location.kind || "",
      location_platform: specimen.location_platform || location.platform || "",
    };
  });
}

export function buildPokedexCollectorWorkbookSheets({ hub, exportPayload, exportedAt = new Date() }) {
  const trackers = exportPayload?.trackers || [];
  const champions = normalizeChampionsProgress(exportPayload?.champions);
  const hubById = new Map((hub?.trackers || []).map((tracker) => [tracker.id, tracker]));
  const exportedIso = (exportedAt instanceof Date ? exportedAt : new Date(exportedAt)).toISOString();
  const totalSpecimens = trackers.reduce((sum, tracker) => sum + (tracker.specimens || []).length, 0);
  const totalLocations = trackers.reduce((sum, tracker) => sum + (tracker.locations || []).length, 0);
  const totalWanted = trackers.reduce((sum, tracker) => sum + (tracker.wanted || []).length, 0);

  const summary = {
    name: "Summary",
    rows: [
      ["Pokédex Tracker — private collection workbook"],
      ["This download contains private checklist and collection information because you explicitly exported it. Store and share it carefully."],
      [],
      ["Field", "Value"],
      ["Trackers", trackers.length],
      ["Storage locations", totalLocations],
      ["Individual Pokémon", totalSpecimens],
      ["Looking-for targets", totalWanted],
      ["Champions achievements started", Object.values(champions.achievementProgress).filter((value) => value > 0).length],
      ["Champions Pokémon started", Object.values(champions.pokemonWins).filter((value) => value > 0).length],
      ["Exported", exportedIso],
      ["About this file", "This workbook is a readable copy of the tracker information saved to your account."],
    ],
    headerRow: 3,
    widths: [30, 110],
    mergeTitleThrough: 1,
  };

  const trackerRows = trackers.map((tracker) => {
    const hubTracker = hubById.get(tracker.id) || tracker;
    return [
      trackerLabel(tracker), safe(tracker.catalog_name || hubTracker.catalog_name || tracker.catalog_key),
      Number(tracker.total || hubTracker.total || 0), Number(hubTracker.caught || (tracker.entries || []).filter((entry) => !entry.is_shiny && !entry.is_alpha).length),
      Number(hubTracker.shiny_caught || (tracker.entries || []).filter((entry) => entry.is_shiny && !entry.is_alpha).length),
      Number(hubTracker.alpha_caught || (tracker.entries || []).filter((entry) => entry.is_alpha).length),
      yesNo(tracker.include_shiny), yesNo(tracker.include_alpha), (tracker.locations || []).length, (tracker.specimens || []).length,
      safe(tracker.updated_at),
    ];
  });

  const checklistRows = trackers.flatMap((tracker) => (tracker.entries || []).map((entry) => [
    trackerLabel(tracker), safe(tracker.catalog_name || tracker.catalog_key), entry.pokemon_id,
    safe(entry.pokemon), entry.dex_number ?? "", entry.is_alpha ? "Alpha" : entry.is_shiny ? "Shiny" : "Standard", safe(entry.caught_at),
  ]));

  const detailRows = trackers.flatMap((tracker) => (tracker.details || []).map((detail) => [
    trackerLabel(tracker), detail.pokemon_id, safe(detail.pokemon), detail.dex_number ?? "",
    detail.is_shiny ? "Shiny" : "Standard", safe(detail.pokeball), (detail.ribbons || []).map(safe).join(" | "),
    (detail.marks || []).map(safe).join(" | "), safe(detail.notes), safe(detail.updated_at),
  ]));

  const wantedRows = trackers.flatMap((tracker) => (tracker.wanted || []).map((target) => [
    trackerLabel(tracker), target.pokemon_id, safe(target.pokemon), target.dex_number ?? "",
    target.is_shiny ? "Shiny" : "Standard", safe(target.form_label), (target.marks || []).map(safe).join(" | "),
    yesNo(target.wants_alpha), safe(target.notes), safe(target.updated_at),
  ]));

  const locationRows = trackers.flatMap((tracker) => (tracker.locations || []).map((location, index) => [
    trackerLabel(tracker), `location-${index + 1}`, safe(location.name), safe(location.kind), safe(location.platform), safe(location.notes), safe(location.updated_at),
  ]));

  const specimenRows = trackers.flatMap((tracker) => enrichedSpecimens(tracker).map((specimen) => [
    trackerLabel(tracker), safe(specimen.pokemon), specimen.pokemon_id, specimen.dex_number ?? "", safe(specimen.form_label), safe(specimen.nickname),
    yesNo(specimen.is_shiny), yesNo(specimen.is_alpha), safe(specimen.gender), specimen.level ?? "", safe(specimen.original_trainer), safe(specimen.origin_game), safe(specimen.origin_mark),
    safe(specimen.location_name), safe(specimen.location_kind), safe(specimen.location_platform), safe(specimen.box_label), specimen.box_position ?? "",
    safe(specimen.pokeball), (specimen.ribbons || []).map(safe).join(" | "), (specimen.marks || []).map(safe).join(" | "), yesNo(specimen.is_event), safe(specimen.notes),
  ]));

  const championsAchievementRows = POKEMON_CHAMPIONS_TRAINER_ACHIEVEMENTS.map((definition) => {
    const state = championsAchievementState(definition, champions.achievementProgress[definition.key]);
    return [definition.category, definition.name, definition.description, state.progress, state.next?.value ?? "Complete", state.completed.length,
      state.completed.flatMap((entry) => entry.rewards).join(" | ")];
  });
  const championsPokemonRows = POKEMON_CHAMPIONS_POKEMON.map((pokemon) => {
    const state = championsPokemonState(pokemon, champions.pokemonWins[pokemon.pokemonId]);
    return [pokemon.pokemonId, pokemon.name, state.progress, state.progress >= 10 ? "Yes" : "No", state.progress >= 50 ? "Yes" : "No", state.progress >= 100 ? "Yes" : "No", state.rewards.join(" | ")];
  });

  const template = sheet(
    "Import Template",
    "Bulk CSV import template",
    "Copy the header row into a UTF-8 CSV. Use record_type checklist for progress-only rows or individual for repeatable collection records. Existing data is never overwritten.",
    POKEDEX_COLLECTOR_CSV_HEADERS,
    [["individual", "Pikachu", 25, 25, "yes", "no", "", "Example only — remove this row", "no", "no", "unknown", "", "", "", "", "home-main", "HOME main", "pokemon_home", "Switch", "", "Living Dex", 1, "poke", "", "", "no", "Remove this example before import"]],
    POKEDEX_COLLECTOR_CSV_HEADERS.map((header) => Math.max(13, Math.min(26, header.length + 3))),
  );

  return [
    summary,
    sheet("Trackers", "Tracker dashboard", "Cross-tracker progress and inventory totals.", ["Tracker", "Catalog", "Catalog total", "Registered", "Shiny registered", "Alpha registered", "Shiny layer", "Alpha layer", "Locations", "Individuals", "Updated"], trackerRows, [28, 28, 14, 13, 17, 17, 13, 13, 12, 13, 24]),
    sheet("Checklist", "Registered checklist entries", "Registered standard, shiny, and supported Legends Alpha entries are listed.", ["Tracker", "Catalog", "Pokémon ID", "Species", "Dex number", "Progress type", "Registered at"], checklistRows, [28, 26, 12, 24, 12, 14, 24]),
    sheet("Entry Details", "Checklist details", "Optional ball, ribbon, mark, and private-note details stored independently of registration.", ["Tracker", "Pokémon ID", "Species", "Dex number", "Progress type", "Poké Ball", "Ribbons", "Marks", "Private note", "Updated"], detailRows, [28, 12, 24, 12, 14, 18, 42, 42, 55, 24]),
    sheet("Looking For", "Private hunt targets", "Pokémon you are looking for, including requested form, marks, Shiny status, or Alpha status.", ["Tracker", "Pokémon ID", "Species", "Dex number", "Target type", "Form or style", "Required marks", "Alpha required", "Private note", "Updated"], wantedRows, [28, 12, 24, 12, 14, 24, 42, 14, 55, 24]),
    sheet("Locations", "Storage locations", "Private game-save, HOME, cartridge, and other locations you have added.", ["Tracker", "Import key", "Location", "Type", "Platform", "Private note", "Updated"], locationRows, [28, 16, 28, 18, 22, 46, 24]),
    sheet("Individuals", "Individual Pokémon", "Private records for individual Pokémon and the details you choose to save.", ["Tracker", "Species", "Pokémon ID", "Dex number", "Form", "Nickname", "Shiny", "Alpha", "Gender", "Level", "Original Trainer", "Origin game", "Origin mark", "Location", "Location type", "Platform", "Box", "Slot", "Poké Ball", "Ribbons", "Marks", "Event", "Private note"], specimenRows, [28, 24, 12, 12, 22, 22, 9, 9, 12, 9, 22, 22, 22, 26, 18, 20, 18, 9, 18, 42, 42, 9, 55]),
    sheet("Champions Achievements", "Pokémon Champions Trainer Achievements", "Private numeric progress with earned title and badge rewards derived from the reviewed achievement catalog.", ["Category", "Achievement", "Requirement", "Current total", "Next milestone", "Milestones earned", "Titles and badges earned"], championsAchievementRows, [18, 30, 52, 15, 16, 18, 60]),
    sheet("Champions Pokémon", "Pokémon Champions Pokémon mastery", "All 208 eligible Pokémon with Admirer (10 wins), Tamer and Silver Badge (50), and Professor and Gold Badge (100) progress.", ["National Dex", "Pokémon", "Wins", "Admirer title", "Tamer + Silver Badge", "Professor + Gold Badge", "Rewards earned"], championsPokemonRows, [14, 24, 12, 16, 24, 25, 58]),
    template,
  ];
}

export function buildPokedexCollectorWorkbookFilename(exportedAt = new Date()) {
  return pokedexCollectorFilename("DraftCenter Collector", "workbook", exportedAt, "xlsx");
}
