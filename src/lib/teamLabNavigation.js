const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeUuid(value) {
  const id = String(value || "").trim();
  return UUID_PATTERN.test(id) ? id : "";
}

export function readTeamLabNavigation(search) {
  const params = new URLSearchParams(search || "");
  return {
    workspaceId: safeUuid(params.get("workspace")),
    battleMatchupId: safeUuid(params.get("battle")),
  };
}

export function writeTeamLabNavigation(search, { workspaceId = "", battleMatchupId = "" } = {}) {
  const params = new URLSearchParams(search || "");
  const workspace = safeUuid(workspaceId);
  const battle = safeUuid(battleMatchupId);
  if (workspace) params.set("workspace", workspace);
  else params.delete("workspace");
  if (battle) params.set("battle", battle);
  else params.delete("battle");
  return params.toString();
}
