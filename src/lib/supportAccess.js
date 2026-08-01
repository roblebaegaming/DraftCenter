import { ownerEmails } from "./ownerOperations";

export async function authenticateUser(request, supabase) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sign in is required.", status: 401 };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { error: "Your session could not be verified.", status: 401 };
  return { user: data.user };
}

export async function leagueStaffRole(supabase, leagueId, userId) {
  const { data } = await supabase.from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", userId).maybeSingle();
  return ["commissioner", "co_commissioner"].includes(data?.role) ? data.role : null;
}

export async function findSupportUser(supabase) {
  const wanted = new Set(ownerEmails());
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => wanted.has(String(item.email || "").toLowerCase()));
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

export function activeGrant(row) {
  return Boolean(row && !row.revoked_at && Date.parse(row.expires_at) > Date.now());
}
