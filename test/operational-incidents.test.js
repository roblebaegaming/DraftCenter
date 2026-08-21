import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { classifyOperationalEvent, groupOperationalIncidents } from "../src/lib/operationalIncidents.js";

const tournamentLockMessage = "Auction Draft Tournament settings are fixed when the field locks.";

function classified(event) {
  return { ...event, ...classifyOperationalEvent(event) };
}

test("known pre-fix failures are resolved without hiding a later recurrence", () => {
  const beforeFix = classifyOperationalEvent({
    kind: "league_save_failed",
    message: tournamentLockMessage,
    occurred_at: "2026-08-19T22:35:31.000Z",
  });
  assert.equal(beforeFix.classification, "resolved_incident");
  assert.match(beforeFix.resolution_label, /release #349/);

  const afterFix = classifyOperationalEvent({
    kind: "league_save_failed",
    message: tournamentLockMessage,
    occurred_at: "2026-08-20T00:00:00.000Z",
  });
  assert.deepEqual(afterFix, { classification: "system_failure" });
});

test("the empty-league setup incident is resolved only before its verified fix", () => {
  const message = "The new league setup could not be initialized: upper bound of FOR loop cannot be null";
  assert.equal(classifyOperationalEvent({ kind: "draft_operation_failed", message, occurred_at: "2026-08-20T03:39:56.000Z" }).classification, "resolved_incident");
  assert.equal(classifyOperationalEvent({ kind: "draft_operation_failed", message, occurred_at: "2026-08-20T04:03:00.000Z" }).classification, "system_failure");
});

test("server safeguards remain expected rejections", () => {
  assert.equal(classifyOperationalEvent({
    kind: "draft_operation_failed",
    message: "This Pokémon was already drafted.",
    occurred_at: "2026-08-20T05:00:00.000Z",
  }).classification, "expected_rejection");
});

test("matching reports in one five-minute burst become one incident", () => {
  const events = [
    { id: 3, league_id: "league-1", kind: "league_save_failed", message: tournamentLockMessage, occurred_at: "2026-08-19T22:35:31.000Z" },
    { id: 2, league_id: "league-1", kind: "league_save_failed", message: tournamentLockMessage, occurred_at: "2026-08-19T22:35:29.000Z" },
    { id: 1, league_id: "league-1", kind: "league_save_failed", message: tournamentLockMessage, occurred_at: "2026-08-19T22:34:23.000Z" },
  ].map(classified);
  const [incident] = groupOperationalIncidents(events);
  assert.equal(incident.occurrence_count, 3);
  assert.equal(incident.id, 3);
  assert.equal(incident.first_occurred_at, "2026-08-19T22:34:23.000Z");
  assert.equal(incident.last_occurred_at, "2026-08-19T22:35:31.000Z");
});

test("the same failure outside the burst window remains a separate incident", () => {
  const events = [
    { id: 2, league_id: "league-1", kind: "draft_operation_failed", message: "Connection failed", occurred_at: "2026-08-20T05:10:01.000Z", classification: "system_failure" },
    { id: 1, league_id: "league-1", kind: "draft_operation_failed", message: "Connection failed", occurred_at: "2026-08-20T05:00:00.000Z", classification: "system_failure" },
  ];
  assert.equal(groupOperationalIncidents(events).length, 2);
});

test("Operations exposes grouped unresolved, resolved, and safety incident feeds", () => {
  const operations = fs.readFileSync(new URL("../src/lib/ownerOperations.js", import.meta.url), "utf8");
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  assert.match(operations, /groupOperationalIncidents/);
  assert.match(operations, /resolved_operational_incidents/);
  assert.match(dashboard, /Resolved incidents/);
  assert.match(dashboard, /Repeated matching reports within five minutes are grouped together/);
  assert.match(dashboard, /matching report after its fix is treated as a new system failure/);
});
