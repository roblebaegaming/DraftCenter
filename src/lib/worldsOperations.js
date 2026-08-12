const DISCIPLINE_ORDER = Object.freeze({ vgc: 0, tcg: 1, go: 2 });
const EXPERIENCE_ORDER = Object.freeze({ pick: 0, meta: 1, bracket: 2 });

function disciplineLabel(value) {
  return ({ vgc: "VGC", tcg: "TCG", go: "Pokémon GO" })[value] || String(value || "Worlds").toUpperCase();
}

function entryCountKey(kind, eventId) {
  return `${kind}:${eventId}`;
}

export function summarizeWorldsEntryCounts({ pickEvents = [], metaEvents = [], bracketEvents = [], counts = {} } = {}) {
  const pickEventsById = new Map(pickEvents.map((event) => [event.id, event]));
  const events = [
    ...pickEvents.map((event) => ({
      event_id: event.id,
      display_name: event.display_name,
      discipline: event.discipline,
      experience: "pick",
      experience_label: `Pick ${event.picks_required}`,
      status: event.status,
      entries: Number(counts[entryCountKey("pick", event.id)] || 0),
    })),
    ...metaEvents.map((event) => ({
      event_id: event.id,
      display_name: event.display_name,
      discipline: event.discipline,
      experience: "meta",
      experience_label: "Meta Picks",
      status: event.status,
      entries: Number(counts[entryCountKey("meta", event.id)] || 0),
    })),
    ...bracketEvents.map((event) => {
      const parent = pickEventsById.get(event.event_id);
      const discipline = parent?.discipline || "vgc";
      return {
        event_id: event.event_id,
        display_name: `${disciplineLabel(discipline)} Masters Top Cut`,
        discipline,
        experience: "bracket",
        experience_label: "Top Cut challenge",
        status: event.status,
        entries: Number(counts[entryCountKey("bracket", event.event_id)] || 0),
      };
    }),
  ].filter((event) => event.status !== "cancelled").sort((a, b) => (
    (DISCIPLINE_ORDER[a.discipline] ?? 99) - (DISCIPLINE_ORDER[b.discipline] ?? 99)
    || (EXPERIENCE_ORDER[a.experience] ?? 99) - (EXPERIENCE_ORDER[b.experience] ?? 99)
    || a.display_name.localeCompare(b.display_name)
  ));

  return {
    total: events.reduce((sum, event) => sum + event.entries, 0),
    events,
  };
}

async function exactEventCount(supabase, table, eventId) {
  const result = await supabase.from(table).select("event_id", { count: "exact", head: true }).eq("event_id", eventId);
  if (result.error) throw result.error;
  return Number(result.count || 0);
}

export async function getWorldsEntryCounts(supabase) {
  const [pickEventsResult, metaEventsResult, bracketEventsResult] = await Promise.all([
    supabase.from("worlds_pick_events").select("id,display_name,discipline,picks_required,status"),
    supabase.from("worlds_meta_events").select("id,display_name,discipline,status"),
    supabase.from("worlds_bracket_events").select("event_id,status"),
  ]);
  for (const result of [pickEventsResult, metaEventsResult, bracketEventsResult]) {
    if (result.error) throw result.error;
  }

  const countRequests = [
    ...(pickEventsResult.data || []).map((event) => ({ key: entryCountKey("pick", event.id), table: "worlds_pick_entries", eventId: event.id })),
    ...(metaEventsResult.data || []).map((event) => ({ key: entryCountKey("meta", event.id), table: "worlds_meta_entries", eventId: event.id })),
    ...(bracketEventsResult.data || []).map((event) => ({ key: entryCountKey("bracket", event.event_id), table: "worlds_bracket_entries", eventId: event.event_id })),
  ];
  const values = await Promise.all(countRequests.map((request) => exactEventCount(supabase, request.table, request.eventId)));
  const counts = Object.fromEntries(countRequests.map((request, index) => [request.key, values[index]]));

  return summarizeWorldsEntryCounts({
    pickEvents: pickEventsResult.data,
    metaEvents: metaEventsResult.data,
    bracketEvents: bracketEventsResult.data,
    counts,
  });
}
