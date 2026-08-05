const TOP_LEVEL_TABS = new Set(["home", "setup", "draft", "myteam", "league", "predictions", "messages"]);
const LEAGUE_SECTIONS = new Set(["activity", "draft", "schedule", "playoffs", "standings", "predictions", "trades", "awards", "history", "adp"]);

export function readLeagueNavigation(search, { isNew = false } = {}) {
  const params = new URLSearchParams(search || "");
  const requestedTab = params.get("tab");
  const requestedSection = params.get("section");
  return {
    tab: TOP_LEVEL_TABS.has(requestedTab) ? requestedTab : isNew ? "setup" : "home",
    section: LEAGUE_SECTIONS.has(requestedSection) ? requestedSection : "activity",
    explicit: TOP_LEVEL_TABS.has(requestedTab),
  };
}

export function writeLeagueNavigation(search, tab, section) {
  const params = new URLSearchParams(search || "");
  if (TOP_LEVEL_TABS.has(tab)) params.set("tab", tab);
  else params.delete("tab");
  if (tab === "league" && LEAGUE_SECTIONS.has(section)) params.set("section", section);
  else params.delete("section");
  const query = params.toString();
  return query ? `?${query}` : "";
}
