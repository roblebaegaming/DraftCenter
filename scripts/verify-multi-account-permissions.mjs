import { createClient } from "@supabase/supabase-js";

const required = [
  "DC_MANAGER_INVITE_TOKEN",
  "DC_SPECTATOR_INVITE_TOKEN",
  "DC_TEST_MANAGER_A_EMAIL",
  "DC_TEST_MANAGER_A_PASSWORD",
  "DC_TEST_MANAGER_B_EMAIL",
  "DC_TEST_MANAGER_B_PASSWORD",
  "DC_TEST_SPECTATOR_EMAIL",
  "DC_TEST_SPECTATOR_PASSWORD",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !publicKey) throw new Error("DraftCenter Supabase public configuration is missing.");

function client() {
  return createClient(
    supabaseUrl,
    publicKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

async function resetDedicatedTestPasswords() {
  if (process.env.DC_RESET_TEST_PASSWORDS !== "1") return;
  if (!serviceRoleKey) {
    throw new Error("A DraftCenter service role key is required when DC_RESET_TEST_PASSWORDS=1.");
  }
  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const targets = [
    [process.env.DC_TEST_MANAGER_A_EMAIL, process.env.DC_TEST_MANAGER_A_PASSWORD],
    [process.env.DC_TEST_MANAGER_B_EMAIL, process.env.DC_TEST_MANAGER_B_PASSWORD],
    [process.env.DC_TEST_SPECTATOR_EMAIL, process.env.DC_TEST_SPECTATOR_PASSWORD],
  ];
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Could not list dedicated test users: ${error.message}`);
  for (const [email, password] of targets) {
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error(`Dedicated test user was not found: ${email}`);
    const result = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (result.error) throw new Error(`Could not reset dedicated test user: ${result.error.message}`);
  }
}

async function signIn(label, email, password) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`${label} could not sign in: ${error?.message || "missing user"}`);
  return { label, supabase, userId: data.user.id };
}

function expectSuccess(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function expectFailure(result, label) {
  if (!result.error) throw new Error(`${label}: operation unexpectedly succeeded`);
  return result.error.message;
}

await resetDedicatedTestPasswords();

const managerA = await signIn(
  "manager A",
  process.env.DC_TEST_MANAGER_A_EMAIL,
  process.env.DC_TEST_MANAGER_A_PASSWORD,
);
const managerB = await signIn(
  "manager B",
  process.env.DC_TEST_MANAGER_B_EMAIL,
  process.env.DC_TEST_MANAGER_B_PASSWORD,
);
const spectator = await signIn(
  "spectator",
  process.env.DC_TEST_SPECTATOR_EMAIL,
  process.env.DC_TEST_SPECTATOR_PASSWORD,
);

const managerToken = process.env.DC_MANAGER_INVITE_TOKEN;
const spectatorToken = process.env.DC_SPECTATOR_INVITE_TOKEN;
const leagueIdA = expectSuccess(
  await managerA.supabase.rpc("accept_league_invite", { p_token: managerToken }),
  "manager A invite",
);
const leagueIdB = expectSuccess(
  await managerB.supabase.rpc("accept_league_invite", { p_token: managerToken }),
  "manager B invite",
);
const leagueIdSpectator = expectSuccess(
  await spectator.supabase.rpc("accept_spectator_invite", { p_token: spectatorToken }),
  "spectator invite",
);
if (leagueIdA !== leagueIdB || leagueIdA !== leagueIdSpectator) {
  throw new Error("Invitations did not resolve to the same practice league.");
}
const leagueId = leagueIdA;

const race = await Promise.all([
  managerA.supabase.rpc("claim_live_setup_team", { p_league_id: leagueId, p_team_index: 0 }),
  managerB.supabase.rpc("claim_live_setup_team", { p_league_id: leagueId, p_team_index: 0 }),
]);
const raceWinners = race.map((result, index) => ({ result, actor: index === 0 ? managerA : managerB })).filter(({ result }) => !result.error);
const raceLosers = race.map((result, index) => ({ result, actor: index === 0 ? managerA : managerB })).filter(({ result }) => result.error);
if (raceWinners.length !== 1 || raceLosers.length !== 1) {
  throw new Error(`Concurrent team claim expected one winner and one rejection; got ${raceWinners.length} winner(s): ${race.map((entry) => entry.error?.message || "success").join(" | ")}`);
}
const secondClaim = await raceLosers[0].actor.supabase.rpc("claim_live_setup_team", {
  p_league_id: leagueId,
  p_team_index: 1,
});
expectSuccess(secondClaim, "losing manager's alternate team claim");

const teamByUser = new Map();
const state = raceWinners[0].result.data;
for (let index = 0; index < (state?.teams || []).length; index += 1) {
  const owner = state.teams[index]?.claimedByUserId;
  if (owner) teamByUser.set(owner, index);
}
const winnerIndex = teamByUser.get(raceWinners[0].actor.userId);
const loserIndex = raceLosers[0].actor === managerA ? 1 : 1;
teamByUser.set(raceLosers[0].actor.userId, loserIndex);
const managerAIndex = teamByUser.get(managerA.userId);
const managerBIndex = teamByUser.get(managerB.userId);
if (!Number.isInteger(managerAIndex) || !Number.isInteger(managerBIndex)) {
  throw new Error("Claimed team ownership was not persisted by account ID.");
}

const membershipResults = await Promise.all([
  managerA.supabase.from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", managerA.userId).single(),
  managerB.supabase.from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", managerB.userId).single(),
  spectator.supabase.from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", spectator.userId).single(),
]);
const roles = membershipResults.map((result, index) => expectSuccess(result, `membership ${index + 1}`).role);
if (roles.join(",") !== "coach,coach,viewer") throw new Error(`Unexpected roles: ${roles.join(",")}`);

const spectatorClaimError = expectFailure(
  await spectator.supabase.rpc("claim_live_setup_team", { p_league_id: leagueId, p_team_index: 2 }),
  "spectator team claim",
);
const spectatorPreferenceError = expectFailure(
  await spectator.supabase.rpc("mutate_league_team_preference", {
    p_league_id: leagueId,
    p_action: "description",
    p_team_index: 2,
    p_payload: { value: "spectator should not write" },
  }),
  "spectator team preference mutation",
);
const crossTeamPreferenceError = expectFailure(
  await managerA.supabase.rpc("mutate_league_team_preference", {
    p_league_id: leagueId,
    p_action: "description",
    p_team_index: managerBIndex,
    p_payload: { value: "manager A should not write manager B's team" },
  }),
  "cross-team preference mutation",
);

const ownQueue = expectSuccess(
  await managerA.supabase.rpc("mutate_my_draft_queue", {
    p_league_id: leagueId,
    p_team_index: managerAIndex,
    p_action: "add",
    p_pokemon_name: "Pikachu",
  }),
  "manager A queue add",
);
const managerBQueue = expectSuccess(
  await managerB.supabase.rpc("list_my_draft_queue", { p_league_id: leagueId, p_team_index: managerBIndex }),
  "manager B own queue",
);
const crossQueueError = expectFailure(
  await managerB.supabase.rpc("list_my_draft_queue", { p_league_id: leagueId, p_team_index: managerAIndex }),
  "manager B cross-team queue read",
);
const spectatorQueueError = expectFailure(
  await spectator.supabase.rpc("list_my_draft_queue", { p_league_id: leagueId, p_team_index: managerAIndex }),
  "spectator queue read",
);
if (!Array.isArray(ownQueue) || ownQueue[0] !== "Pikachu" || managerBQueue.length !== 0) {
  throw new Error("Private queue contents were not isolated as expected.");
}

const directSnapshotWrites = await Promise.all([
  managerA.supabase.from("league_state_snapshots").update({ updated_at: new Date().toISOString() }).eq("league_id", leagueId).select("league_id"),
  spectator.supabase.from("league_state_snapshots").update({ updated_at: new Date().toISOString() }).eq("league_id", leagueId).select("league_id"),
]);
if (directSnapshotWrites.some((result) => !result.error && result.data?.length)) {
  throw new Error("A non-commissioner directly updated the shared league snapshot.");
}

const cleanupQueue = await managerA.supabase.rpc("mutate_my_draft_queue", {
  p_league_id: leagueId,
  p_team_index: managerAIndex,
  p_action: "remove",
  p_pokemon_name: "Pikachu",
});
expectSuccess(cleanupQueue, "queue cleanup");

console.log(JSON.stringify({
  ok: true,
  leagueId,
  roles,
  claimedTeamIndexes: { managerA: managerAIndex, managerB: managerBIndex },
  concurrentClaim: { winners: raceWinners.length, rejected: raceLosers.length, rejection: raceLosers[0].result.error.message },
  spectator: { claimRejected: spectatorClaimError, preferenceRejected: spectatorPreferenceError },
  managerIsolation: { crossTeamPreferenceRejected: crossTeamPreferenceError, crossQueueReadRejected: crossQueueError },
  privateQueue: { ownQueueVisible: true, otherManagerQueueEmpty: true, spectatorReadRejected: spectatorQueueError },
  directSnapshotMutationBlocked: true,
}, null, 2));
