const APPROVED_SOURCE_HOSTS = new Set([
  "championships.pokemon.com",
  "play.pokemon.com",
  "worlds.pokemon.com",
  "www.pokemon.com",
]);

const REGISTRY_CONTRACTS = {
  "2026-pokemon-go": { entryUnit: "individual", qualificationCountKey: "championshipPointSlotTotal" },
  "2026-pokemon-unite": { entryUnit: "team", qualificationCountKey: "modeledQualificationAwardTotal" },
};

function requireValue(condition, message) {
  if (!condition) throw new Error(`Worlds source registry rejected: ${message}`);
}

export function validateWorldsSourceRegistry(registry) {
  requireValue(registry && typeof registry === "object", "registry must be an object");
  const contract = REGISTRY_CONTRACTS[registry.eventId];
  requireValue(contract, `unsupported event ${registry.eventId || "(missing)"}`);
  requireValue(registry.entryUnit === contract.entryUnit, `${registry.eventId} must use ${contract.entryUnit} entries`);
  requireValue(registry.rosterReady === false, `${registry.eventId} cannot open without a reviewed roster`);
  requireValue(registry.rosterStatus === "waiting-for-official-roster", `${registry.eventId} roster status must fail closed`);
  requireValue(registry.predictionStatus === "not-open", `${registry.eventId} prediction saving must remain closed`);
  requireValue(!Array.isArray(registry.competitors), `${registry.eventId} cannot contain an unreviewed competitor list`);
  requireValue(!Array.isArray(registry.teams), `${registry.eventId} cannot contain an unreviewed team list`);
  requireValue(registry.resultAutomation?.status === "unconfigured", `${registry.eventId} results automation cannot be implied`);
  requireValue(Array.isArray(registry.sources) && registry.sources.length >= 2, `${registry.eventId} needs reviewable sources`);
  if (registry.eventId === "2026-pokemon-go") {
    requireValue(registry.predictionDesign?.pickCount === 10, `${registry.eventId} must keep the owner-approved Pick 10 format`);
    requireValue(registry.predictionDesign?.selectionLabel === "Your Champion", `${registry.eventId} must use the Your Champion label`);
    requireValue(registry.predictionDesign?.selectionMultiplier === 2, `${registry.eventId} must double Your Champion's placement points`);
  }

  for (const source of registry.sources) {
    const url = new URL(source.url);
    requireValue(url.protocol === "https:", `${source.label || "source"} must use HTTPS`);
    requireValue(APPROVED_SOURCE_HOSTS.has(url.hostname), `${url.hostname} is not an approved source host`);
  }

  let qualificationCount;
  if (registry.eventId === "2026-pokemon-go") {
    qualificationCount = registry.qualificationRules.championshipPointSlots
      .reduce((total, zone) => total + zone.slots, 0);
  } else {
    qualificationCount = registry.qualificationRules.qualificationAwards
      .reduce((total, path) => total + path.teams, 0);
  }
  requireValue(
    qualificationCount === registry.qualificationRules[contract.qualificationCountKey],
    `${registry.eventId} qualification count does not match its source registry`,
  );

  return { eventId: registry.eventId, entryUnit: registry.entryUnit, qualificationCount };
}
