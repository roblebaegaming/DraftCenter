import { createClient } from "@supabase/supabase-js";

const required = [
  "DC_TEST_LEAGUE_ID",
  "DC_TEST_MANAGER_A_EMAIL",
  "DC_TEST_MANAGER_A_PASSWORD",
  "DC_TEST_MANAGER_B_EMAIL",
  "DC_TEST_MANAGER_B_PASSWORD",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !publicKey) throw new Error("DraftCenter Supabase public configuration is missing.");

function client() {
  return createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(label, email, password) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`${label} could not sign in: ${error?.message || "missing user"}`);
  return { label, supabase, userId: data.user.id };
}

function success(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const leagueId = process.env.DC_TEST_LEAGUE_ID;
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

const [managerARole, managerBRole] = await Promise.all([
  managerA.supabase.from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", managerA.userId).single(),
  managerB.supabase.from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", managerB.userId).single(),
]);
assert(success(managerARole, "manager A role").role === "co_commissioner", "Manager A must be a temporary co-commissioner for this test.");
assert(success(managerBRole, "manager B role").role === "coach", "Manager B must remain a regular manager for the permission test.");

const snapshotRow = success(
  await managerA.supabase.from("league_state_snapshots").select("state").eq("league_id", leagueId).single(),
  "practice league state",
);
const sourceState = snapshotRow.state;
assert(sourceState && sourceState.locked === false, "The practice league must be in pre-draft setup.");
assert(Array.isArray(sourceState.teams) && sourceState.teams.length >= 2, "The practice league needs at least two teams.");
assert((sourceState.schedule || []).length === 0, "The practice league already has schedule activity.");
assert(Object.keys(sourceState.matchResults || {}).length === 0, "The practice league already has results.");

const pokemon = [
  { id: "25", name: "Pikachu", t1: "electric", t2: null, bst: 320, cost: 7, isRestricted: false, isMega: false },
  { id: "133", name: "Eevee", t1: "normal", t2: null, bst: 325, cost: 5, isRestricted: false, isMega: false },
  { id: "1", name: "Bulbasaur", t1: "grass", t2: "poison", bst: 318, cost: 3, isRestricted: false, isMega: false },
];
const settings = {
  ...sourceState.settings,
  draftType: "snake",
  snakeBudgetEnabled: true,
  budget: 20,
  rosterMin: 1,
  rosterMax: 1,
  rosterSize: 1,
  pickTimeLimitMinutes: 0,
  restrictedCap: null,
  megaCap: null,
};
const teamCount = sourceState.teams.length;
const startedState = {
  ...sourceState,
  settings,
  locked: true,
  draftStartedAt: Date.now(),
  rosters: Array.from({ length: teamCount }, () => []),
  budgets: Array.from({ length: teamCount }, () => 20),
  pool: pokemon,
  queues: {},
  keeperRosters: {},
  snakeOrder: [0, 1],
  pickIndex: 0,
  pickDeadline: null,
  paused: false,
  pausedAt: null,
  pauseIsOvernight: false,
  schedule: [],
  matchResults: {},
  trades: [],
  transactionLog: [],
  playoffs: null,
  seasonFinalizedAt: null,
  liveDraft: {
    sessionId: null,
    basePool: pokemon,
    pokemonIds: {},
    firstRoundOrder: [0, 1],
    fullPickOrder: [0, 1],
    preservedQueues: {},
    keeperRosters: {},
  },
};

const provisioned = success(
  await managerA.supabase.rpc("provision_live_snake_draft_v2", {
    p_league_id: leagueId,
    p_teams: sourceState.teams,
    p_pokemon: pokemon,
    p_pick_order: [0, 1],
    p_settings: settings,
    p_keepers: {},
    p_started_state: startedState,
  }),
  "short live draft provisioning",
);
const sessionId = provisioned.draft_session_id;
const pokemonIds = provisioned.pokemon_ids;
assert(sessionId && pokemonIds?.["25"] && pokemonIds?.["133"], "The short live draft did not return its server IDs.");

success(await managerA.supabase.rpc("make_snake_pick", {
  p_draft_session_id: sessionId,
  p_league_pokemon_id: pokemonIds["25"],
}), "pick 1");
success(await managerA.supabase.rpc("make_snake_pick", {
  p_draft_session_id: sessionId,
  p_league_pokemon_id: pokemonIds["133"],
}), "pick 2");

const completedDraft = success(
  await managerA.supabase.rpc("get_live_snake_draft", { p_league_id: leagueId }),
  "completed short draft",
);
assert(completedDraft.session.status === "complete", "The short two-pick draft did not complete.");
assert(completedDraft.picks.length === 2, "The short draft did not record exactly two picks.");

const managerPermission = await managerB.supabase.rpc("undo_last_live_snake_pick", {
  p_league_id: leagueId,
  p_expected_pick_number: 1,
});
assert(managerPermission.error, "A regular manager unexpectedly undid a commissioner-only pick.");

const undoRace = await Promise.all([
  managerA.supabase.rpc("undo_last_live_snake_pick", { p_league_id: leagueId, p_expected_pick_number: 1 }),
  managerA.supabase.rpc("undo_last_live_snake_pick", { p_league_id: leagueId, p_expected_pick_number: 1 }),
]);
const undoWinners = undoRace.filter((result) => !result.error);
const undoRejections = undoRace.filter((result) => result.error);
assert(undoWinners.length === 1 && undoRejections.length === 1, "The concurrent undo test did not produce exactly one winner and one stale rejection.");
assert(undoRejections[0].error.message.includes("draft changed"), "The rejected concurrent undo did not report a stale board.");

const [afterRaceLive, afterRaceState, pokemonRows] = await Promise.all([
  managerA.supabase.rpc("get_live_snake_draft", { p_league_id: leagueId }),
  managerA.supabase.from("league_state_snapshots").select("state").eq("league_id", leagueId).single(),
  managerA.supabase.from("league_pokemon").select("source_key,is_drafted").eq("league_id", leagueId),
]);
const liveAfterRace = success(afterRaceLive, "live draft after concurrent undo");
const stateAfterRace = success(afterRaceState, "snapshot after concurrent undo").state;
const pokemonAfterRace = success(pokemonRows, "Pokemon rows after concurrent undo");
assert(liveAfterRace.session.status === "active" && liveAfterRace.session.current_pick_number === 1, "Undo did not return Pick 2's team to the clock.");
assert(liveAfterRace.picks.length === 1 && liveAfterRace.picks[0].pick_number === 0, "Concurrent undo removed more than the latest pick.");
assert((stateAfterRace.rosters?.[1] || []).length === 0, "The undone Pokemon remained on its saved roster.");
assert(stateAfterRace.pool.some((entry) => String(entry.id) === "133"), "The undone Pokemon did not return to the pool.");
assert(Number(stateAfterRace.budgets?.[1]) === 20, "The undone pick's budget was not restored.");
assert(pokemonAfterRace.find((entry) => entry.source_key === "133")?.is_drafted === false, "The undone Pokemon remained marked as drafted.");

success(await managerA.supabase.rpc("undo_last_live_snake_pick", {
  p_league_id: leagueId,
  p_expected_pick_number: 0,
}), "final test pick cleanup");
const cleanLive = success(
  await managerA.supabase.rpc("get_live_snake_draft", { p_league_id: leagueId }),
  "clean live draft",
);
assert(cleanLive.session.status === "active" && cleanLive.session.current_pick_number === 0, "Final test cleanup did not return the draft to Pick 1.");
assert(cleanLive.picks.length === 0, "Final test cleanup left a draft pick behind.");

console.log(JSON.stringify({
  passed: true,
  commissionerOnly: true,
  completedDraftUndo: true,
  concurrentRequests: { succeeded: 1, staleRejected: 1 },
  onePickOnly: true,
  rosterRestored: true,
  poolRestored: true,
  budgetRestored: true,
  livePointerRestored: true,
}, null, 2));
