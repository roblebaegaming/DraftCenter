import { createClient } from "@supabase/supabase-js";

const expectedSlug = "concurrency-rehearsal-jul-27-9nnn5";
const expectedLeagueName = "Concurrency Rehearsal Jul 27";
const targetTeamIndex = 2;
const expectedTestUsernames = new Set(["omnisports", "draftcenter"]);

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required local variable: ${name}`);
  return value;
}

function client(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(url, key, email, password) {
  const supabase = client(url, key);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Test account sign-in failed: ${error?.message || "unknown"}`);
  return { supabase, user: data.user };
}

async function one(query, label) {
  const { data, error } = await query.single();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const url = required("NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL");
const publishableKey = required("NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = required("DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY");
const userAEmail = required("DRAFTCENTER_CONCURRENCY_USER_A_EMAIL");
const userAPassword = required("DRAFTCENTER_CONCURRENCY_USER_A_PASSWORD");
const userBEmail = required("DRAFTCENTER_CONCURRENCY_USER_B_EMAIL");
const userBPassword = required("DRAFTCENTER_CONCURRENCY_USER_B_PASSWORD");

const admin = client(url, serviceRoleKey);
const league = await one(
  admin.from("leagues").select("id,name,slug").eq("slug", expectedSlug),
  "Disposable league lookup failed",
);
if (league.name !== expectedLeagueName) {
  throw new Error("Disposable league guard failed: the expected name does not match.");
}

const [accountA, accountB] = await Promise.all([
  signIn(url, publishableKey, userAEmail, userAPassword),
  signIn(url, publishableKey, userBEmail, userBPassword),
]);
if (accountA.user.id === accountB.user.id) throw new Error("Concurrency test requires two distinct accounts.");

const { data: profiles, error: profileError } = await admin
  .from("profiles")
  .select("id,username")
  .in("id", [accountA.user.id, accountB.user.id]);
if (profileError) throw new Error(`Test profile lookup failed: ${profileError.message}`);
const usernames = new Set((profiles || []).map((profile) => String(profile.username || "").toLowerCase()));
if (
  usernames.size !== expectedTestUsernames.size
  || [...expectedTestUsernames].some((username) => !usernames.has(username))
) {
  throw new Error("Account guard failed: use only the OmniSports and DraftCenter test accounts.");
}

const { data: memberships, error: membershipError } = await admin
  .from("league_memberships")
  .select("id,user_id,role")
  .eq("league_id", league.id)
  .in("user_id", [accountA.user.id, accountB.user.id]);
if (membershipError) throw new Error(`Membership lookup failed: ${membershipError.message}`);
if (
  memberships?.length !== 2
  || memberships.some((membership) => !["coach", "commissioner", "co_commissioner"].includes(membership.role))
) {
  throw new Error("Both test accounts must already be manager-capable members of the disposable league.");
}

const snapshotBefore = await one(
  admin.from("league_state_snapshots").select("state,revision").eq("league_id", league.id),
  "Snapshot lookup failed",
);
if (snapshotBefore.state?.locked) throw new Error("The disposable league must not have a locked draft.");
const targetSnapshotTeam = snapshotBefore.state?.teams?.[targetTeamIndex];
if (!targetSnapshotTeam || targetSnapshotTeam.claimedBy || targetSnapshotTeam.claimedByUserId) {
  throw new Error("Littleroot Mudkips must be open before running the concurrency test.");
}

const { data: teamsBefore, error: teamsBeforeError } = await admin
  .from("teams")
  .select("id,source_key,name,owner_membership_id")
  .eq("league_id", league.id);
if (teamsBeforeError) throw new Error(`Relational team lookup failed: ${teamsBeforeError.message}`);
const targetRelationalTeam = teamsBefore.find((team) => team.source_key === String(targetTeamIndex));
if (!targetRelationalTeam || targetRelationalTeam.owner_membership_id) {
  throw new Error("Littleroot Mudkips must be relationally open before running the concurrency test.");
}

let primaryError;
try {
  const results = await Promise.all([
    accountA.supabase.rpc("claim_live_setup_team", {
      p_league_id: league.id,
      p_team_index: targetTeamIndex,
    }),
    accountB.supabase.rpc("claim_live_setup_team", {
      p_league_id: league.id,
      p_team_index: targetTeamIndex,
    }),
  ]);

  const successes = results.filter((result) => !result.error);
  const failures = results.filter((result) => result.error);
  if (successes.length !== 1 || failures.length !== 1) {
    throw new Error(`Expected one success and one rejection; received ${successes.length} and ${failures.length}.`);
  }
  if (!/already been claimed/i.test(failures[0].error.message)) {
    throw new Error(`Unexpected losing response: ${failures[0].error.message}`);
  }

  const snapshotAfter = await one(
    admin.from("league_state_snapshots").select("state").eq("league_id", league.id),
    "Post-claim snapshot lookup failed",
  );
  const relationalAfter = await one(
    admin
      .from("teams")
      .select("owner_membership_id")
      .eq("league_id", league.id)
      .eq("source_key", String(targetTeamIndex)),
    "Post-claim relational lookup failed",
  );
  const winningUserId = snapshotAfter.state?.teams?.[targetTeamIndex]?.claimedByUserId;
  const winningMembership = memberships.find((membership) => membership.user_id === winningUserId);
  if (!winningUserId || relationalAfter.owner_membership_id !== winningMembership?.id) {
    throw new Error("Snapshot and relational ownership do not identify the same sole winner.");
  }

  console.log(JSON.stringify({
    result: "pass",
    league: expectedLeagueName,
    targetTeam: targetSnapshotTeam.name,
    winningTestAccount: profiles.find((profile) => profile.id === winningUserId)?.username,
    losingResponse: "already_claimed",
  }, null, 2));
} catch (error) {
  primaryError = error;
} finally {
  for (const team of teamsBefore) {
    const { error } = await admin
      .from("teams")
      .update({ owner_membership_id: team.owner_membership_id })
      .eq("id", team.id);
    if (error && !primaryError) primaryError = new Error(`Relational restoration failed: ${error.message}`);
  }
  const { error: snapshotRestoreError } = await admin
    .from("league_state_snapshots")
    .update({
      state: snapshotBefore.state,
      revision: snapshotBefore.revision + 2,
      updated_at: new Date().toISOString(),
    })
    .eq("league_id", league.id);
  if (snapshotRestoreError && !primaryError) {
    primaryError = new Error(`Snapshot restoration failed: ${snapshotRestoreError.message}`);
  }
}

if (primaryError) throw primaryError;
