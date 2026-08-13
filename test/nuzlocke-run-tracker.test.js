import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSavedNuzlockeResult } from "../src/lib/nuzlockeRunExports.js";
import {
  appendNuzlockeHistory,
  findNuzlockeSpeciesConflicts,
  normalizeNuzlockeTracker,
  summarizeNuzlockeTracker,
} from "../src/lib/nuzlockeRunTracker.js";

const team = [
  { area_key: "starter", area_name: "Starter", pokemon_id: 133, pokemon_name: "Eevee", species_family: "eevee" },
  { area_key: "route-1", area_name: "Route 1", pokemon_id: 16, pokemon_name: "Pidgey", species_family: "pidgey", chance: 37.5 },
  { area_key: "route-2", area_name: "Route 2", pokemon_id: 17, pokemon_name: "Pidgeotto", species_family: "pidgey" },
];

test("tracker normalization is bounded, route keyed, and backward compatible", () => {
  const normalized = normalizeNuzlockeTracker({
    run_state: "unknown",
    notes: "n".repeat(6000),
    encounters: [
      { area_key: "route-2", status: "deceased", nickname: "Bird", notes: "late-game loss" },
      { area_key: "route-1", status: "invalid" },
    ],
    milestones: Array.from({ length: 40 }, (_, index) => ({ id: `m-${index}`, name: `Badge ${index}`, kind: "badge", level_cap: 101 })),
    history: Array.from({ length: 120 }, (_, index) => ({ id: `h-${index}`, at: new Date(2026, 0, index + 1).toISOString(), label: `Event ${index}` })),
  }, team);

  assert.equal(normalized.run_state, "active");
  assert.deepEqual(normalized.encounters.map((entry) => entry.area_key), ["starter", "route-1", "route-2"]);
  assert.deepEqual(normalized.encounters.map((entry) => entry.status), ["not-encountered", "not-encountered", "deceased"]);
  assert.equal(normalized.encounters[2].nickname, "Bird");
  assert.equal(normalized.notes.length, 5000);
  assert.equal(normalized.milestones.length, 32);
  assert.equal(normalized.milestones[0].level_cap, null);
  assert.equal(normalized.history.length, 100);

  const inProgressTyping = normalizeNuzlockeTracker({ notes: "Line one\n", encounters: [{ area_key: "starter", nickname: "Mr ", notes: "Caught on " }] }, team);
  assert.equal(inProgressTyping.notes, "Line one\n");
  assert.equal(inProgressTyping.encounters[0].nickname, "Mr ");
  assert.equal(inProgressTyping.encounters[0].notes, "Caught on ");

  const legacy = normalizeSavedNuzlockeResult({
    game: { game_key: "pokemon-red", display_name: "Pokémon Red" },
    seed: "legacy-run",
    team,
    complete: true,
    requested: 3,
    available: 3,
  });
  assert.equal(legacy.tracker.version, 1);
  assert.equal(legacy.team[1].chance, 37.5);
  assert.deepEqual(legacy.tracker.encounters.map((entry) => entry.status), ["not-encountered", "not-encountered", "not-encountered"]);
});

test("summary counts route outcomes and living catches", () => {
  const tracker = normalizeNuzlockeTracker({ encounters: [
    { area_key: "starter", status: "active" },
    { area_key: "route-1", status: "missed" },
    { area_key: "route-2", status: "deceased" },
  ], milestones: [
    { id: "badge-1", kind: "badge", name: "Boulder Badge", completed: true },
    { id: "badge-2", kind: "badge", name: "Cascade Badge", completed: false },
  ] }, team);
  const summary = summarizeNuzlockeTracker(tracker, team);

  assert.equal(summary.recorded, 3);
  assert.equal(summary.percent, 100);
  assert.equal(summary.caught, 2);
  assert.equal(summary.living, 1);
  assert.equal(summary.missed, 1);
  assert.equal(summary.deceased, 1);
  assert.equal(summary.milestonesCompleted, 1);
});

test("species-family conflicts include caught outcomes but exclude missed encounters", () => {
  const conflictTracker = normalizeNuzlockeTracker({ encounters: [
    { area_key: "starter", status: "not-encountered" },
    { area_key: "route-1", status: "active" },
    { area_key: "route-2", status: "deceased" },
  ] }, team);
  assert.equal(findNuzlockeSpeciesConflicts(conflictTracker, team).length, 1);

  const missedTracker = normalizeNuzlockeTracker({ ...conflictTracker, encounters: conflictTracker.encounters.map((entry) => entry.area_key === "route-2" ? { ...entry, status: "missed" } : entry) }, team);
  assert.equal(findNuzlockeSpeciesConflicts(missedTracker, team).length, 0);
});

test("history appends safely and retains the newest 100 events", () => {
  let tracker = { history: [] };
  for (let index = 0; index < 105; index += 1) tracker = appendNuzlockeHistory(tracker, { id: `e-${index}`, at: `2026-08-13T00:${String(index % 60).padStart(2, "0")}:00.000Z`, label: `Update ${index}` });
  assert.equal(tracker.history.length, 100);
  assert.equal(tracker.history[0].label, "Update 5");
  assert.equal(tracker.history.at(-1).label, "Update 104");
});
