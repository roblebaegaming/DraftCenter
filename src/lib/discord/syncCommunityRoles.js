const MANAGED_ROLE_NAMES = ["League Commissioner", "Coach", "Champion"];

async function discordRequest(path, options = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DraftCenter Discord role sync is not configured.");
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (response.ok) return response.status === 204 ? null : response.json();
  const detail = await response.json().catch(() => ({}));
  if (response.status === 404) throw new Error("Join the DraftCenter Discord server before syncing roles.");
  if (response.status === 403) throw new Error("The DraftCenter bot needs Manage Roles permission and must be above the community roles.");
  throw new Error(detail.message || "Discord could not update your community roles.");
}

export async function syncCommunityRoles(supabase, userId) {
  const guildId = process.env.DISCORD_COMMUNITY_GUILD_ID || "1530073610155196658";
  const [{ data: connection, error: connectionError }, { data: memberships, error: membershipError }, { data: championBadges, error: badgeError }] = await Promise.all([
    supabase.from("discord_user_connections").select("discord_user_id,discord_username").eq("user_id", userId).maybeSingle(),
    supabase.from("league_memberships").select("role,archived_at").eq("user_id", userId).is("archived_at", null),
    supabase.from("user_badge_progress").select("progress,tier").eq("user_id", userId).eq("badge_code", "league_champion"),
  ]);
  if (connectionError || membershipError || badgeError) throw connectionError || membershipError || badgeError;
  if (!connection) throw new Error("Connect your Discord profile before syncing roles.");

  const roles = await discordRequest(`/guilds/${guildId}/roles`);
  const roleIds = new Map((roles || []).filter((role) => MANAGED_ROLE_NAMES.includes(role.name)).map((role) => [role.name, role.id]));
  const missing = MANAGED_ROLE_NAMES.filter((name) => !roleIds.has(name));
  if (missing.length) throw new Error(`Discord is missing these DraftCenter roles: ${missing.join(", ")}.`);

  const activeRoles = new Set((memberships || []).map((membership) => membership.role));
  const desired = new Set();
  if (["commissioner", "co_commissioner", "coach"].some((role) => activeRoles.has(role))) desired.add("Coach");
  if (["commissioner", "co_commissioner"].some((role) => activeRoles.has(role))) desired.add("League Commissioner");
  if ((championBadges || []).some((badge) => badge.progress > 0 || badge.tier > 0)) desired.add("Champion");

  const member = await discordRequest(`/guilds/${guildId}/members/${connection.discord_user_id}`);
  const currentRoleIds = new Set(member.roles || []);
  const added = [];
  const removed = [];
  for (const name of MANAGED_ROLE_NAMES) {
    const roleId = roleIds.get(name);
    const shouldHave = desired.has(name);
    const hasRole = currentRoleIds.has(roleId);
    if (shouldHave && !hasRole) {
      await discordRequest(`/guilds/${guildId}/members/${connection.discord_user_id}/roles/${roleId}`, { method: "PUT" });
      added.push(name);
    } else if (!shouldHave && hasRole) {
      await discordRequest(`/guilds/${guildId}/members/${connection.discord_user_id}/roles/${roleId}`, { method: "DELETE" });
      removed.push(name);
    }
  }

  return { username: connection.discord_username, roles: [...desired], added, removed };
}
