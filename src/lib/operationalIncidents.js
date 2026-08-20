const INCIDENT_BURST_WINDOW_MS = 5 * 60 * 1000;

const resolvedIncidentRules = [
  {
    kind: "league_save_failed",
    message: /^Auction Draft Tournament settings are fixed when the field locks\.$/i,
    resolvedBefore: "2026-08-19T23:30:04.000Z",
    resolutionLabel: "Tournament regulation lock ordering fixed in release #349",
    resolutionUrl: "https://github.com/roblebaegaming/DraftCenter/pull/349",
  },
  {
    kind: "draft_operation_failed",
    message: /^The new league setup could not be initialized: upper bound of FOR loop cannot be null$/i,
    resolvedBefore: "2026-08-20T04:02:34.000Z",
    resolutionLabel: "Empty league initialization fixed in release #361",
    resolutionUrl: "https://github.com/roblebaegaming/DraftCenter/pull/361",
  },
];

function expectedOperationalRejection(event) {
  const kind = String(event?.kind || "");
  const message = String(event?.message || "");
  if (kind === "league_save_failed" && /only league commissioners can save|changed in another session|refresh before saving again/i.test(message)) return true;
  if (kind === "draft_operation_failed" && /no longer available|already (?:drafted|selected|picked)|not (?:your|that team(?:'s)?) turn|changed in another session|refresh before|cannot afford|would leave less than|roster (?:minimum|maximum|limit)|no active (?:snake|auction) draft found|already has a live draft|not ready on the live draft board|team logos must use a secure https url/i.test(message)) return true;
  return false;
}

export function classifyOperationalEvent(event) {
  if (expectedOperationalRejection(event)) return { classification: "expected_rejection" };
  const occurredAt = Date.parse(event?.occurred_at || "");
  const kind = String(event?.kind || "");
  const message = String(event?.message || "");
  const resolvedRule = resolvedIncidentRules.find((rule) => (
    rule.kind === kind
    && rule.message.test(message)
    && Number.isFinite(occurredAt)
    && occurredAt < Date.parse(rule.resolvedBefore)
  ));
  if (!resolvedRule) return { classification: "system_failure" };
  return {
    classification: "resolved_incident",
    resolved_at: resolvedRule.resolvedBefore,
    resolution_label: resolvedRule.resolutionLabel,
    resolution_url: resolvedRule.resolutionUrl,
  };
}

function incidentSignature(event) {
  return [
    String(event?.classification || "system_failure"),
    String(event?.league_id || ""),
    String(event?.kind || ""),
    String(event?.message || "").trim(),
    String(event?.resolution_url || ""),
  ].join("\u001f");
}

export function groupOperationalIncidents(events, { burstWindowMs = INCIDENT_BURST_WINDOW_MS } = {}) {
  const sorted = [...(events || [])].sort((a, b) => Date.parse(b?.occurred_at || "") - Date.parse(a?.occurred_at || ""));
  const latestGroupBySignature = new Map();
  const groups = [];
  for (const event of sorted) {
    const occurredAt = Date.parse(event?.occurred_at || "");
    const signature = incidentSignature(event);
    const current = latestGroupBySignature.get(signature);
    const oldestGroupedAt = Date.parse(current?.first_occurred_at || "");
    if (current && Number.isFinite(occurredAt) && Number.isFinite(oldestGroupedAt) && oldestGroupedAt - occurredAt <= burstWindowMs) {
      current.occurrence_count += 1;
      current.first_occurred_at = event.occurred_at;
      continue;
    }
    const group = {
      ...event,
      occurrence_count: 1,
      first_occurred_at: event.occurred_at,
      last_occurred_at: event.occurred_at,
    };
    groups.push(group);
    latestGroupBySignature.set(signature, group);
  }
  return groups;
}
