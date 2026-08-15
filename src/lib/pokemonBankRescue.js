export const BANK_RESCUE_REVIEWED_ON = "2026-08-15";

export const BANK_RESCUE_STATUS = Object.freeze({
  headline: "Nintendo currently says no Pokémon Bank end date is planned.",
  summary: "DraftCenter does not assume a shutdown deadline. Nintendo says it will announce service changes in advance.",
  source_ids: ["nintendo-bank-service-update"],
});

export const BANK_RESCUE_SOURCES = Object.freeze([
  Object.freeze({
    id: "nintendo-bank-service-update",
    publisher: "Nintendo Support",
    title: "Pokémon Bank Service Update",
    url: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/61543/",
    reviewed_on: BANK_RESCUE_REVIEWED_ON,
    supports: ["service status", "advance notice", "new-download availability"],
  }),
  Object.freeze({
    id: "pokemon-home-connections",
    publisher: "Pokémon Support",
    title: "About connecting Pokémon HOME to different games",
    url: "https://support.pokemon.com/hc/en-us/articles/360038131072-About-connecting-Pok%C3%A9mon-HOME-to-different-games",
    reviewed_on: BANK_RESCUE_REVIEWED_ON,
    source_updated_on: "2026-01-30",
    supports: ["HOME Premium requirement", "Bank move methods"],
  }),
  Object.freeze({
    id: "pokemon-home-move",
    publisher: "Pokémon HOME",
    title: "Move Pokémon to Pokémon HOME",
    url: "https://home.pokemon.com/en-us/move/",
    reviewed_on: BANK_RESCUE_REVIEWED_ON,
    supports: ["one-way Bank move", "destination-game compatibility", "HOME Premium requirement"],
  }),
]);

export const BANK_RESCUE_ACTIONS = Object.freeze({
  recorded_transferred: Object.freeze({
    label: "Recorded as transferred",
    tone: "complete",
    rank: 50,
  }),
  preserve_original: Object.freeze({
    label: "Preserve original intentionally",
    tone: "preserve",
    rank: 40,
  }),
  legacy_review: Object.freeze({
    label: "Review legacy details first",
    tone: "review",
    rank: 10,
  }),
  choose_destination: Object.freeze({
    label: "Choose and verify destination",
    tone: "review",
    rank: 20,
  }),
  bank_move_review: Object.freeze({
    label: "Review one-way Bank move",
    tone: "review",
    rank: 30,
  }),
  home_compatibility: Object.freeze({
    label: "Verify destination-game compatibility",
    tone: "verify",
    rank: 60,
  }),
  uncertain_verify: Object.freeze({
    label: "Current availability uncertain—verify",
    tone: "verify",
    rank: 70,
  }),
});

const IMPORTANCE_RANK = { irreplaceable: 0, important: 1, standard: 2 };

function legacySignals(specimen) {
  const signals = [];
  if (specimen.importance === "irreplaceable") signals.push("irreplaceable importance");
  else if (specimen.importance === "important") signals.push("important status");
  if (specimen.is_event) signals.push("event status");
  if (Array.isArray(specimen.ribbons) && specimen.ribbons.length) signals.push("saved ribbons");
  if (String(specimen.origin_mark || "").trim()) signals.push("an origin mark");
  return signals;
}

function result(key, reason, sourceIds, specimen, verificationReason) {
  const action = BANK_RESCUE_ACTIONS[key];
  return {
    key,
    label: action.label,
    tone: action.tone,
    reason,
    reviewed_on: BANK_RESCUE_REVIEWED_ON,
    source_ids: sourceIds,
    owner_record_only: true,
    verification: {
      key: "uncertain_verify",
      label: BANK_RESCUE_ACTIONS.uncertain_verify.label,
      reason: verificationReason || "DraftCenter has no audited species, form, mark, or reacquisition-availability catalog for this individual.",
    },
    specimen_id: specimen.id || null,
  };
}

export function classifyBankRescueSpecimen(specimen = {}) {
  const locationKind = String(specimen.location_kind || "");
  const transferState = String(specimen.transfer_state || "not_planned");

  if (transferState === "transferred") {
    return result(
      "recorded_transferred",
      "You marked this individual as transferred. DraftCenter cannot verify an external move, so confirm it in Pokémon HOME before relying on this record.",
      ["pokemon-home-connections"],
      specimen,
      "The completion state is owner-entered and is not proof from Pokémon Bank or Pokémon HOME.",
    );
  }

  if (transferState === "keep_original") {
    return result(
      "preserve_original",
      "You chose to keep this individual in its original location. A Bank-to-HOME move is one-way, so exclude it from a move batch unless you change that choice.",
      ["pokemon-home-move"],
      specimen,
    );
  }

  if (locationKind === "pokemon_bank") {
    const signals = legacySignals(specimen);
    if (signals.length) {
      return result(
        "legacy_review",
        `This Bank record has ${signals.join(", ")}. Review those owner-entered details before any one-way move; DraftCenter does not know whether more legacy work is possible.`,
        ["pokemon-home-move"],
        specimen,
      );
    }

    if (!String(specimen.intended_destination || "").trim()) {
      return result(
        "choose_destination",
        "This individual is recorded in Bank without an intended destination. Moving to HOME requires a Premium Plan, and compatibility with a destination game must be checked separately.",
        ["pokemon-home-connections", "pokemon-home-move"],
        specimen,
      );
    }

    return result(
      "bank_move_review",
      "This individual is recorded in Bank. Nintendo says no end date is planned; moving to HOME requires Premium and cannot be reversed back into Bank.",
      ["nintendo-bank-service-update", "pokemon-home-connections", "pokemon-home-move"],
      specimen,
    );
  }

  if (locationKind === "pokemon_home") {
    return result(
      "home_compatibility",
      "This individual is recorded in HOME. Before moving it into a game, verify that the Pokémon appears in that game.",
      ["pokemon-home-move"],
      specimen,
    );
  }

  return result(
    "uncertain_verify",
    "This record is outside Bank and HOME, or its service path is not established. Current transfer and reacquisition availability remain uncertain—verify.",
    ["pokemon-home-move"],
    specimen,
  );
}

export function buildBankRescueReview(inventory = {}) {
  const records = (inventory?.specimens || []).map((specimen) => ({
    specimen,
    classification: classifyBankRescueSpecimen(specimen),
  })).sort((left, right) => {
    const actionDifference = BANK_RESCUE_ACTIONS[left.classification.key].rank
      - BANK_RESCUE_ACTIONS[right.classification.key].rank;
    if (actionDifference) return actionDifference;
    const importanceDifference = (IMPORTANCE_RANK[left.specimen.importance] ?? 3)
      - (IMPORTANCE_RANK[right.specimen.importance] ?? 3);
    if (importanceDifference) return importanceDifference;
    return String(left.specimen.pokemon || "").localeCompare(String(right.specimen.pokemon || ""));
  });

  const counts = records.reduce((summary, { classification }) => {
    summary[classification.key] = (summary[classification.key] || 0) + 1;
    return summary;
  }, {});

  return {
    reviewed_on: BANK_RESCUE_REVIEWED_ON,
    status: BANK_RESCUE_STATUS,
    sources: BANK_RESCUE_SOURCES,
    counts,
    uncertain_count: records.filter(({ classification }) => classification.verification.key === "uncertain_verify").length,
    records,
  };
}

export function bankRescueExport(inventory = {}) {
  const review = buildBankRescueReview(inventory);
  return {
    reviewed_on: review.reviewed_on,
    status: review.status,
    sources: review.sources,
    classifications: review.records.map(({ specimen, classification }) => ({
      specimen_id: specimen.id || null,
      species: specimen.pokemon || null,
      classification: classification.key,
      label: classification.label,
      reason: classification.reason,
      verification: classification.verification,
      source_ids: classification.source_ids,
      owner_record_only: classification.owner_record_only,
    })),
  };
}
