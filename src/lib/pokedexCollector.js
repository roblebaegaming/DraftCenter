import { POKEDEX_MARK_OPTIONS, uniquePokedexEntries } from "./pokedexTracker.js";

export const POKEDEX_COLLECTOR_EXPORT_FORMAT = "draftcenter-pokedex-tracker";
export const POKEDEX_COLLECTOR_EXPORT_VERSION = 5;
export const POKEDEX_COLLECTOR_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const POKEDEX_COLLECTOR_MAX_CSV_ROWS = 5000;
export const POKEDEX_COLLECTOR_MAX_RESTORE_TRACKERS = 50;

export const POKEDEX_COLLECTOR_CSV_HEADERS = [
  "record_type",
  "species",
  "pokemon_id",
  "national_dex",
  "registered",
  "shiny_registered",
  "form",
  "nickname",
  "shiny",
  "alpha",
  "gender",
  "level",
  "original_trainer",
  "origin_game",
  "origin_mark",
  "location_key",
  "storage_location",
  "location_type",
  "location_platform",
  "location_notes",
  "box",
  "box_position",
  "poke_ball",
  "ribbons",
  "marks",
  "event",
  "notes",
];

export const POKEDEX_COLLECTOR_FEEDBACK_CHECKLIST = [
  "Which game or HOME collection did you try?",
  "Did the game-specific numbering and order match what you expected?",
  "Were the base-game and DLC area dexes easy to understand and switch between?",
  "Did Find show a useful answer for where to get a missing Pokémon?",
  "Did the box layout make the checklist easier to use in the game?",
  "Did linked National Dex progress behave the way you expected?",
  "Could you find and edit an individual Pokémon quickly?",
  "If you imported a CSV or opened the workbook, what was confusing or missing?",
  "What one feature would make the tracker more useful to you?",
  "Would you prefer a one-time contribution or an optional subscription for future convenience features?",
  "Anything you expected Pokédex Tracker to do that it did not?",
].join("\n");

const LOCATION_KINDS = new Set(["game_save", "pokemon_bank", "pokemon_home", "cartridge", "other"]);
const GENDERS = new Set(["unknown", "male", "female", "genderless"]);
const IMPORTANCE_LEVELS = new Set(["standard", "important", "irreplaceable"]);
const TRANSFER_STATES = new Set(["not_planned", "planned", "ready", "transferred", "keep_original"]);
const MARK_KEYS = new Set(POKEDEX_MARK_OPTIONS.map(({ key }) => key));
const TRUE_VALUES = new Set(["1", "true", "yes", "y", "checked", "registered"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "", "unchecked", "missing"]);

function text(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return text(value).normalize("NFKD").toLocaleLowerCase().replace(/[\s_-]+/g, " ");
}

function normalizedHeader(value) {
  return text(value).replace(/^\uFEFF/, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function booleanCell(value, label, rowNumber, errors, fallback = false) {
  const candidate = normalized(value);
  if (TRUE_VALUES.has(candidate)) return true;
  if (FALSE_VALUES.has(candidate)) return false;
  errors.push(`Row ${rowNumber}: ${label} must be yes or no.`);
  return fallback;
}

function integerCell(value, { label, rowNumber, errors, min, max, optional = true }) {
  const candidate = text(value);
  if (!candidate && optional) return null;
  if (!/^\d+$/.test(candidate)) {
    errors.push(`Row ${rowNumber}: ${label} must be a whole number${optional ? " or blank" : ""}.`);
    return null;
  }
  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`Row ${rowNumber}: ${label} must be between ${min} and ${max}.`);
    return null;
  }
  return parsed;
}

function field(row, headerIndex, ...names) {
  for (const name of names) {
    const index = headerIndex.get(name);
    if (index !== undefined) return row[index] ?? "";
  }
  return "";
}

function locationFallbackKey(kind, name, platform) {
  const basis = [kind, name, platform].map(normalized).join("|");
  let hash = 2166136261;
  for (let index = 0; index < basis.length; index += 1) {
    hash ^= basis.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `location-${(hash >>> 0).toString(16)}`;
}

function uniqueArray(values) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function csvCell(value) {
  let candidate = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(candidate)) candidate = `'${candidate}`;
  return `"${candidate.replaceAll('"', '""')}"`;
}

export function pokedexCollectorCsvTemplate() {
  return `${POKEDEX_COLLECTOR_CSV_HEADERS.map(csvCell).join(",")}\r\n`;
}

export function parseCsvTable(input) {
  const source = String(input ?? "").replace(/^\uFEFF/, "");
  if (!source.trim()) throw new Error("Choose a CSV file with a header row.");
  if (source.includes("\0")) throw new Error("The CSV contains unsupported null characters.");

  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"' && cell === "") quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("The CSV has an unfinished quoted value.");
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export function parsePokedexCollectorCsv(input, catalogEntries = []) {
  if (new TextEncoder().encode(String(input ?? "")).byteLength > POKEDEX_COLLECTOR_MAX_FILE_BYTES) {
    throw new Error("Choose a CSV file under 10 MB.");
  }
  const rows = parseCsvTable(input);
  if (rows.length < 2) throw new Error("The CSV has a header but no import rows.");
  if (rows.length - 1 > POKEDEX_COLLECTOR_MAX_CSV_ROWS) {
    throw new Error(`Import at most ${POKEDEX_COLLECTOR_MAX_CSV_ROWS.toLocaleString()} rows at a time.`);
  }

  const headerIndex = new Map();
  rows[0].forEach((value, index) => {
    const key = normalizedHeader(value);
    if (!key) return;
    if (headerIndex.has(key)) throw new Error(`The CSV contains the header “${key}” more than once.`);
    headerIndex.set(key, index);
  });
  if (!["species", "pokemon", "name", "pokemon_id", "national_dex", "dex_number"].some((key) => headerIndex.has(key))) {
    throw new Error("The CSV needs a species, pokemon_id, or Pokédex-number column.");
  }

  const byPokemonId = new Map(catalogEntries.map((entry) => [Number(entry.pokemon_id), entry]));
  const byName = new Map(catalogEntries.map((entry) => [normalized(entry.pokemon), entry]));
  const byDexNumber = new Map();
  for (const entry of catalogEntries) {
    const key = Number(entry.dex_number);
    if (!byDexNumber.has(key)) byDexNumber.set(key, entry);
    else byDexNumber.set(key, null);
  }

  const errors = [];
  const warnings = [];
  const locations = new Map();
  const specimens = [];
  const progress = new Map();

  rows.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const recordType = normalizedHeader(field(row, headerIndex, "record_type")) || "individual";
    if (!new Set(["individual", "checklist"]).has(recordType)) {
      errors.push(`Row ${rowNumber}: record_type must be individual or checklist.`);
      return;
    }

    const idValue = integerCell(field(row, headerIndex, "pokemon_id"), {
      label: "pokemon_id", rowNumber, errors, min: 1, max: 99999,
    });
    const nameValue = field(row, headerIndex, "species", "pokemon", "name");
    const dexValue = integerCell(field(row, headerIndex, "national_dex", "dex_number"), {
      label: "Pokédex number", rowNumber, errors, min: 1, max: 99999,
    });
    const entry = (idValue && byPokemonId.get(idValue))
      || (nameValue && byName.get(normalized(nameValue)))
      || (dexValue && byDexNumber.get(dexValue));
    if (!entry) {
      errors.push(`Row ${rowNumber}: ${text(nameValue) || idValue || dexValue || "the Pokémon"} is not in this tracker’s catalog.`);
      return;
    }
    if (idValue && idValue !== Number(entry.pokemon_id)) {
      errors.push(`Row ${rowNumber}: pokemon_id does not match the named Pokémon.`);
      return;
    }
    if (nameValue && Number(byName.get(normalized(nameValue))?.pokemon_id) !== Number(entry.pokemon_id)) {
      errors.push(`Row ${rowNumber}: the species name does not match pokemon_id or the selected catalog.`);
      return;
    }
    if (dexValue && Number(entry.dex_number) !== dexValue) {
      errors.push(`Row ${rowNumber}: the Pokédex number does not match the selected Pokémon.`);
      return;
    }

    const registered = booleanCell(field(row, headerIndex, "registered", "caught"), "registered", rowNumber, errors);
    const shinyRegistered = booleanCell(field(row, headerIndex, "shiny_registered", "shiny_caught"), "shiny_registered", rowNumber, errors);
    if (registered) progress.set(`${entry.pokemon_id}:standard`, { pokemon_id: Number(entry.pokemon_id), is_shiny: false });
    if (shinyRegistered) progress.set(`${entry.pokemon_id}:shiny`, { pokemon_id: Number(entry.pokemon_id), is_shiny: true });
    if (recordType === "checklist") {
      if (!registered && !shinyRegistered) warnings.push(`Row ${rowNumber}: checklist row did not mark standard or shiny progress.`);
      return;
    }

    const locationName = text(field(row, headerIndex, "storage_location", "location_name"));
    const locationKind = normalizedHeader(field(row, headerIndex, "location_type", "location_kind")) || (locationName ? "other" : "");
    const locationPlatform = text(field(row, headerIndex, "location_platform", "platform"));
    const locationNotes = text(field(row, headerIndex, "location_notes"));
    let locationRef = text(field(row, headerIndex, "location_key", "location_ref"));
    if (locationName || locationRef) {
      if (!locationName) errors.push(`Row ${rowNumber}: a location_key also needs storage_location.`);
      if (!LOCATION_KINDS.has(locationKind)) errors.push(`Row ${rowNumber}: location_type is not supported.`);
      locationRef ||= locationFallbackKey(locationKind, locationName, locationPlatform);
      const nextLocation = { source_key: locationRef, kind: locationKind, name: locationName, platform: locationPlatform, notes: locationNotes };
      const currentLocation = locations.get(locationRef);
      if (currentLocation && JSON.stringify(currentLocation) !== JSON.stringify(nextLocation)) {
        errors.push(`Row ${rowNumber}: location_key “${locationRef}” has conflicting location details.`);
      } else locations.set(locationRef, nextLocation);
    }

    const gender = normalizedHeader(field(row, headerIndex, "gender")) || "unknown";
    const importance = normalizedHeader(field(row, headerIndex, "importance")) || "standard";
    const transferState = normalizedHeader(field(row, headerIndex, "transfer_state")) || "not_planned";
    if (!GENDERS.has(gender)) errors.push(`Row ${rowNumber}: gender is not supported.`);
    if (!IMPORTANCE_LEVELS.has(importance)) errors.push(`Row ${rowNumber}: importance is not supported.`);
    if (!TRANSFER_STATES.has(transferState)) errors.push(`Row ${rowNumber}: transfer_state is not supported.`);

    const transferredOn = text(field(row, headerIndex, "transferred_on"));
    if (transferredOn && !/^\d{4}-\d{2}-\d{2}$/.test(transferredOn)) {
      errors.push(`Row ${rowNumber}: transferred_on must use YYYY-MM-DD.`);
    }
    const ribbons = uniqueArray(text(field(row, headerIndex, "ribbons")).split(/\s*[|;]\s*/));
    const marks = uniqueArray(text(field(row, headerIndex, "marks")).split(/\s*[|;]\s*/));
    const unknownMarks = marks.filter((key) => !MARK_KEYS.has(key));
    if (unknownMarks.length) errors.push(`Row ${rowNumber}: unsupported mark ${unknownMarks.map((key) => `“${key}”`).join(", ")}.`);
    specimens.push({
      pokemon_id: Number(entry.pokemon_id),
      form_label: text(field(row, headerIndex, "form", "form_label")),
      nickname: text(field(row, headerIndex, "nickname")),
      is_shiny: booleanCell(field(row, headerIndex, "shiny", "is_shiny"), "shiny", rowNumber, errors),
      is_alpha: booleanCell(field(row, headerIndex, "alpha", "is_alpha"), "alpha", rowNumber, errors),
      gender,
      level: integerCell(field(row, headerIndex, "level"), { label: "level", rowNumber, errors, min: 1, max: 100 }),
      original_trainer: text(field(row, headerIndex, "original_trainer", "ot")),
      origin_game: text(field(row, headerIndex, "origin_game")),
      origin_mark: text(field(row, headerIndex, "origin_mark")),
      location_ref: locationRef || null,
      box_label: text(field(row, headerIndex, "box", "box_label")),
      box_position: integerCell(field(row, headerIndex, "box_position", "slot"), { label: "box_position", rowNumber, errors, min: 1, max: 30 }),
      pokeball: normalizedHeader(field(row, headerIndex, "poke_ball", "pokeball")) || null,
      ribbons,
      marks,
      is_event: booleanCell(field(row, headerIndex, "event", "is_event"), "event", rowNumber, errors),
      importance,
      intended_destination: text(field(row, headerIndex, "intended_destination", "destination")),
      transfer_state: transferState,
      transferred_on: transferState === "transferred" ? transferredOn || null : null,
      notes: text(field(row, headerIndex, "notes")),
      source_row: rowNumber,
    });
  });

  if (errors.length) return { errors, warnings, locations: [], specimens: [], progress: [], rowCount: rows.length - 1 };
  if (!specimens.length && !progress.size) warnings.push("The file contains no individuals or checklist progress to import.");
  return {
    errors,
    warnings,
    locations: [...locations.values()],
    specimens,
    progress: [...progress.values()],
    rowCount: rows.length - 1,
  };
}

function allowedRestoreTracker(candidate, index) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`Tracker ${index + 1} is not a valid object.`);
  }
  const catalogKey = text(candidate.catalog_key);
  const title = text(candidate.title);
  if (!/^[a-z0-9-]{1,64}$/.test(catalogKey)) throw new Error(`Tracker ${index + 1} has an invalid catalog key.`);
  if (!title || title.length > 80) throw new Error(`Tracker ${index + 1} needs a title between 1 and 80 characters.`);
  if (candidate.include_shiny !== undefined && typeof candidate.include_shiny !== "boolean") {
    throw new Error(`Tracker ${index + 1} has an invalid include_shiny value.`);
  }
  if (candidate.include_alpha !== undefined && typeof candidate.include_alpha !== "boolean") {
    throw new Error(`Tracker ${index + 1} has an invalid include_alpha value.`);
  }
  const arrays = Object.fromEntries(["entries", "details", "locations", "specimens", "wanted"].map((key) => {
    const value = candidate[key] ?? [];
    if (!Array.isArray(value)) throw new Error(`Tracker ${index + 1} has an invalid ${key} list.`);
    return [key, value];
  }));
  if (arrays.entries.length > 3000 || arrays.details.length > 3000 || arrays.locations.length > 500 || arrays.specimens.length > 5000 || arrays.wanted.length > 6000) {
    throw new Error(`Tracker ${index + 1} is larger than the supported restore limits.`);
  }
  return {
    catalog_key: catalogKey,
    title,
    include_shiny: Boolean(candidate.include_shiny),
    include_alpha: Boolean(candidate.include_alpha),
    entries: arrays.entries,
    details: arrays.details,
    locations: arrays.locations,
    specimens: arrays.specimens,
    wanted: arrays.wanted,
  };
}

export function parsePokedexRestoreJson(input) {
  if (new TextEncoder().encode(String(input ?? "")).byteLength > POKEDEX_COLLECTOR_MAX_FILE_BYTES) {
    throw new Error("Choose a JSON file under 10 MB.");
  }
  let payload;
  try {
    payload = JSON.parse(String(input ?? ""));
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  let candidates;
  if (payload?.format === "draftcenter-account-export") candidates = payload?.pokedex_trackers?.trackers;
  else if (Array.isArray(payload?.trackers)) candidates = payload.trackers;
  else if (payload?.tracker && typeof payload.tracker === "object") candidates = [{
    ...payload.tracker,
    entries: payload.entries || [],
    details: payload.details || [],
    locations: payload.locations || [],
    specimens: payload.specimens || [],
    wanted: payload.wanted || [],
  }];
  if (!Array.isArray(candidates) || !candidates.length) {
    throw new Error("This JSON file does not contain a DraftCenter Pokédex tracker backup.");
  }
  if (candidates.length > POKEDEX_COLLECTOR_MAX_RESTORE_TRACKERS) {
    throw new Error(`Restore at most ${POKEDEX_COLLECTOR_MAX_RESTORE_TRACKERS} trackers at a time.`);
  }
  const trackers = candidates.map(allowedRestoreTracker);
  return {
    trackers,
    summary: {
      trackers: trackers.length,
      entries: trackers.reduce((total, tracker) => total + tracker.entries.length, 0),
      details: trackers.reduce((total, tracker) => total + tracker.details.length, 0),
      locations: trackers.reduce((total, tracker) => total + tracker.locations.length, 0),
      specimens: trackers.reduce((total, tracker) => total + tracker.specimens.length, 0),
      wanted: trackers.reduce((total, tracker) => total + tracker.wanted.length, 0),
    },
  };
}

export function buildPokedexTrackerPortableExport(active, inventory, exportedAt = new Date()) {
  if (!active?.tracker) throw new Error("Open a Pokédex tracker before exporting it.");
  const entries = [];
  const details = [];
  const wanted = [];
  for (const pokemon of uniquePokedexEntries(active.pokemon || [])) {
    if (pokemon.caught) entries.push({ pokemon_id: pokemon.pokemon_id, pokemon: pokemon.pokemon, dex_number: pokemon.dex_number, is_shiny: false });
    if (pokemon.shiny_caught) entries.push({ pokemon_id: pokemon.pokemon_id, pokemon: pokemon.pokemon, dex_number: pokemon.dex_number, is_shiny: true });
    if (pokemon.alpha_caught) entries.push({ pokemon_id: pokemon.pokemon_id, pokemon: pokemon.pokemon, dex_number: pokemon.dex_number, is_shiny: false, is_alpha: true });
    if (pokemon.pokeball || pokemon.ribbons?.length || pokemon.marks?.length || pokemon.notes) details.push({
      pokemon_id: pokemon.pokemon_id, pokemon: pokemon.pokemon, dex_number: pokemon.dex_number, is_shiny: false,
      pokeball: pokemon.pokeball || "", ribbons: pokemon.ribbons || [], marks: pokemon.marks || [], notes: pokemon.notes || "",
    });
    if (pokemon.shiny_pokeball || pokemon.shiny_ribbons?.length || pokemon.shiny_marks?.length || pokemon.shiny_notes) details.push({
      pokemon_id: pokemon.pokemon_id, pokemon: pokemon.pokemon, dex_number: pokemon.dex_number, is_shiny: true,
      pokeball: pokemon.shiny_pokeball || "", ribbons: pokemon.shiny_ribbons || [], marks: pokemon.shiny_marks || [], notes: pokemon.shiny_notes || "",
    });
    if (pokemon.wanted) wanted.push({
      pokemon_id: pokemon.pokemon_id, pokemon: pokemon.pokemon, dex_number: pokemon.dex_number, is_shiny: false,
      form_label: pokemon.wanted_form || "", marks: pokemon.wanted_marks || [], wants_alpha: Boolean(pokemon.wanted_alpha), notes: pokemon.wanted_notes || "",
    });
    if (pokemon.shiny_wanted) wanted.push({
      pokemon_id: pokemon.pokemon_id, pokemon: pokemon.pokemon, dex_number: pokemon.dex_number, is_shiny: true,
      form_label: pokemon.shiny_wanted_form || "", marks: pokemon.shiny_wanted_marks || [], wants_alpha: Boolean(pokemon.shiny_wanted_alpha), notes: pokemon.shiny_wanted_notes || "",
    });
  }
  return {
    format: POKEDEX_COLLECTOR_EXPORT_FORMAT,
    version: POKEDEX_COLLECTOR_EXPORT_VERSION,
    exported_at: (exportedAt instanceof Date ? exportedAt : new Date(exportedAt)).toISOString(),
    restore_behavior: "creates-a-new-private-copy",
    tracker: {
      catalog_key: active.tracker.catalog_key,
      title: active.tracker.title,
      include_shiny: active.tracker.include_shiny,
      include_alpha: Boolean(active.tracker.include_alpha),
    },
    entries,
    details,
    locations: inventory?.locations || [],
    specimens: inventory?.specimens || [],
    wanted,
  };
}

export function buildPokedexCollectorDashboard(trackers = []) {
  const values = Array.isArray(trackers) ? trackers : [];
  const totalCatalogEntries = values.reduce((sum, tracker) => sum + Number(tracker.total || 0), 0);
  const caught = values.reduce((sum, tracker) => sum + Number(tracker.caught || 0), 0);
  const shinyCaught = values.reduce((sum, tracker) => sum + Number(tracker.shiny_caught || 0), 0);
  const specimens = values.reduce((sum, tracker) => sum + Number(tracker.specimen_count || 0), 0);
  const locations = values.reduce((sum, tracker) => sum + Number(tracker.location_count || 0), 0);
  return {
    trackers: values.length,
    totalCatalogEntries,
    caught,
    shinyCaught,
    specimens,
    locations,
    completion: totalCatalogEntries ? Math.round((caught / totalCatalogEntries) * 100) : 0,
  };
}

export function pokedexCollectorFilename(title, suffix, exportedAt = new Date(), extension = "json") {
  const date = (exportedAt instanceof Date ? exportedAt : new Date(exportedAt)).toISOString().slice(0, 10);
  const slug = text(title).normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLocaleLowerCase().slice(0, 60) || "pokedex-collector";
  return `${slug}-${suffix}-${date}.${extension}`;
}
