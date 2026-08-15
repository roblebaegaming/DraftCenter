import { buildBankRescueReview } from "./pokemonBankRescue.js";
import { POKEDEX_COLLECTOR_CSV_HEADERS, pokedexCollectorFilename } from "./pokedexCollector.js";

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
  const hubById = new Map((hub?.trackers || []).map((tracker) => [tracker.id, tracker]));
  const exportedIso = (exportedAt instanceof Date ? exportedAt : new Date(exportedAt)).toISOString();
  const totalSpecimens = trackers.reduce((sum, tracker) => sum + (tracker.specimens || []).length, 0);
  const totalLocations = trackers.reduce((sum, tracker) => sum + (tracker.locations || []).length, 0);

  const summary = {
    name: "Summary",
    rows: [
      ["DraftCenter Collector — private collection workbook"],
      ["This download contains private checklist and collection information because you explicitly exported it. Store and share it carefully."],
      [],
      ["Field", "Value"],
      ["Trackers", trackers.length],
      ["Storage locations", totalLocations],
      ["Individual Pokémon", totalSpecimens],
      ["Exported", exportedIso],
      ["Restore behavior", "JSON restore creates new private copies and never overwrites an existing tracker."],
      ["Bank Rescue boundary", "Dated owner-action guidance only; compatibility and availability remain uncertain until verified."],
    ],
    headerRow: 3,
    widths: [30, 110],
    mergeTitleThrough: 1,
  };

  const trackerRows = trackers.map((tracker) => {
    const hubTracker = hubById.get(tracker.id) || tracker;
    return [
      trackerLabel(tracker), safe(tracker.catalog_name || hubTracker.catalog_name || tracker.catalog_key),
      Number(tracker.total || hubTracker.total || 0), Number(hubTracker.caught || (tracker.entries || []).filter((entry) => !entry.is_shiny).length),
      Number(hubTracker.shiny_caught || (tracker.entries || []).filter((entry) => entry.is_shiny).length),
      yesNo(tracker.include_shiny), (tracker.locations || []).length, (tracker.specimens || []).length,
      safe(tracker.updated_at),
    ];
  });

  const checklistRows = trackers.flatMap((tracker) => (tracker.entries || []).map((entry) => [
    trackerLabel(tracker), safe(tracker.catalog_name || tracker.catalog_key), entry.pokemon_id,
    safe(entry.pokemon), entry.dex_number ?? "", entry.is_shiny ? "Shiny" : "Standard", safe(entry.caught_at),
  ]));

  const detailRows = trackers.flatMap((tracker) => (tracker.details || []).map((detail) => [
    trackerLabel(tracker), detail.pokemon_id, safe(detail.pokemon), detail.dex_number ?? "",
    detail.is_shiny ? "Shiny" : "Standard", safe(detail.pokeball), (detail.ribbons || []).map(safe).join(" | "), safe(detail.notes), safe(detail.updated_at),
  ]));

  const locationRows = trackers.flatMap((tracker) => (tracker.locations || []).map((location, index) => [
    trackerLabel(tracker), `location-${index + 1}`, safe(location.name), safe(location.kind), safe(location.platform), safe(location.notes), safe(location.updated_at),
  ]));

  const specimenRows = trackers.flatMap((tracker) => enrichedSpecimens(tracker).map((specimen) => [
    trackerLabel(tracker), safe(specimen.pokemon), specimen.pokemon_id, specimen.dex_number ?? "", safe(specimen.form_label), safe(specimen.nickname),
    yesNo(specimen.is_shiny), safe(specimen.gender), specimen.level ?? "", safe(specimen.original_trainer), safe(specimen.origin_game), safe(specimen.origin_mark),
    safe(specimen.location_name), safe(specimen.location_kind), safe(specimen.location_platform), safe(specimen.box_label), specimen.box_position ?? "",
    safe(specimen.pokeball), (specimen.ribbons || []).map(safe).join(" | "), yesNo(specimen.is_event), safe(specimen.importance),
    safe(specimen.intended_destination), safe(specimen.transfer_state), safe(specimen.transferred_on), safe(specimen.notes),
  ]));

  const rescueRows = trackers.flatMap((tracker) => {
    const inventory = { specimens: enrichedSpecimens(tracker) };
    const review = buildBankRescueReview(inventory);
    const sources = new Map(review.sources.map((source) => [source.id, source.url]));
    return review.records.map(({ specimen, classification }) => [
      trackerLabel(tracker), safe(specimen.pokemon), safe(specimen.nickname), safe(specimen.location_name), safe(specimen.location_kind),
      classification.label, classification.reason, classification.verification.label, classification.reviewed_on,
      classification.source_ids.join(" | "), classification.source_ids.map((id) => sources.get(id)).filter(Boolean).join(" | "), yesNo(classification.owner_record_only),
    ]);
  });

  const template = sheet(
    "Import Template",
    "Bulk CSV import template",
    "Copy the header row into a UTF-8 CSV. Use record_type checklist for progress-only rows or individual for repeatable collection records. Existing data is never overwritten.",
    POKEDEX_COLLECTOR_CSV_HEADERS,
    [["individual", "Pikachu", 25, "yes", "no", "", "Example only — remove this row", "no", "unknown", "", "", "", "", "home-main", "HOME main", "pokemon_home", "Switch", "", "Living Dex", 1, "poke", "", "no", "standard", "", "not_planned", "", "Remove this example before import"]],
    POKEDEX_COLLECTOR_CSV_HEADERS.map((header) => Math.max(13, Math.min(26, header.length + 3))),
  );

  return [
    summary,
    sheet("Trackers", "Tracker dashboard", "Cross-tracker progress and inventory totals.", ["Tracker", "Catalog", "Catalog total", "Registered", "Shiny registered", "Shiny layer", "Locations", "Individuals", "Updated"], trackerRows, [28, 28, 14, 13, 17, 13, 12, 13, 24]),
    sheet("Checklist", "Registered checklist entries", "Only registered standard or shiny entries are listed.", ["Tracker", "Catalog", "Pokémon ID", "Species", "Dex number", "Progress type", "Registered at"], checklistRows, [28, 26, 12, 24, 12, 14, 24]),
    sheet("Entry Details", "Checklist details", "Optional ball, ribbon, and private-note details stored independently of registration.", ["Tracker", "Pokémon ID", "Species", "Dex number", "Progress type", "Poké Ball", "Ribbons", "Private note", "Updated"], detailRows, [28, 12, 24, 12, 14, 18, 42, 55, 24]),
    sheet("Locations", "Storage locations", "Private game-save, Bank, HOME, cartridge, and other owner-described locations.", ["Tracker", "Import key", "Location", "Type", "Platform", "Private note", "Updated"], locationRows, [28, 16, 28, 18, 22, 46, 24]),
    sheet("Individuals", "Individual Pokémon", "Repeatable private records for actual individuals and their owner-entered history.", ["Tracker", "Species", "Pokémon ID", "Dex number", "Form", "Nickname", "Shiny", "Gender", "Level", "Original Trainer", "Origin game", "Origin mark", "Location", "Location type", "Platform", "Box", "Slot", "Poké Ball", "Ribbons", "Event", "Importance", "Destination", "Transfer state", "Transferred on", "Private note"], specimenRows, [28, 24, 12, 12, 22, 22, 9, 12, 9, 22, 22, 22, 26, 18, 20, 18, 9, 18, 42, 9, 14, 24, 18, 16, 55]),
    sheet("Bank Rescue", "Bank Rescue review", "Dated organizing guidance derived from private records. It never proves availability, compatibility, or an external transfer.", ["Tracker", "Species", "Nickname", "Location", "Location type", "Action", "Reason", "Availability", "Reviewed", "Source IDs", "Source URLs", "Owner record only"], rescueRows, [28, 24, 22, 26, 18, 32, 70, 34, 14, 44, 68, 18]),
    template,
  ];
}

export function buildPokedexCollectorWorkbookFilename(exportedAt = new Date()) {
  return pokedexCollectorFilename("DraftCenter Collector", "workbook", exportedAt, "xlsx");
}
