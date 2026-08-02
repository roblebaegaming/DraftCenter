import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.DC_TEST_EMAIL;
const password = process.env.DC_TEST_PASSWORD;

if (!url || !key || !email || !password) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DC_TEST_EMAIL, and DC_TEST_PASSWORD.");
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anonymous = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const id = randomUUID();
const foreignOwnerId = randomUUID();
let signedInUser = null;

const source = {
  id,
  owner_id: foreignOwnerId,
  team_name: "Recovery Validation Team",
  league_name: "Recovery Validation League",
  format_name: "Regulation M-B",
  workspace_type: "tournament",
  planning_entries: [{ id: "round-1", title: "Round 1", notes: "Bring the saved six", url: "https://example.com/round-1" }],
  notes: "General recovery note",
  weekly_notes: "Weekly recovery note",
  pokepaste_url: "https://pokepast.es/example",
  replica_code: "RECOVERY-123",
  spreadsheet_url: "https://example.com/sheet",
  team_report_url: "https://example.com/report",
  pokemon: ["Archaludon", "Garchomp", "Incineroar"],
  archived: false,
  is_public: true,
  regulation_id: "regulation-m-b",
  public_summary: "Recovery validation public summary",
  share_pokepaste: true,
  share_replica_code: true,
  share_team_report: true,
};

const restoredFields = [
  "team_name", "league_name", "format_name", "workspace_type", "planning_entries",
  "notes", "weekly_notes", "pokepaste_url", "replica_code", "spreadsheet_url",
  "team_report_url", "pokemon", "archived", "is_public", "regulation_id",
  "public_summary", "share_pokepaste", "share_replica_code", "share_team_report",
];

function assertRestored(row) {
  assert.equal(row.owner_id, signedInUser.id, "restore must ignore caller-supplied owner_id");
  for (const field of restoredFields) assert.deepEqual(row[field], source[field], `${field} was not restored`);
}

try {
  const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(authError);
  signedInUser = authData.user;
  assert.ok(signedInUser?.id, "test account did not sign in");

  const { error: anonymousError } = await anonymous.rpc("restore_my_personal_teams", { p_teams: [source] });
  assert.ok(anonymousError, "signed-out callers must not restore My Teams");

  const { data: insertedCount, error: insertError } = await client.rpc("restore_my_personal_teams", { p_teams: [source] });
  assert.ifError(insertError);
  assert.equal(insertedCount, 1);

  let result = await client.from("personal_teams").select("*").eq("id", id).single();
  assert.ifError(result.error);
  assertRestored(result.data);

  const { error: mutateError } = await client.from("personal_teams").update({
    team_name: "Changed after export",
    team_report_url: null,
    is_public: false,
    regulation_id: null,
    public_summary: "",
    share_pokepaste: false,
    share_replica_code: false,
    share_team_report: false,
  }).eq("id", id);
  assert.ifError(mutateError);

  const { data: updatedCount, error: updateError } = await client.rpc("restore_my_personal_teams", { p_teams: [source] });
  assert.ifError(updateError);
  assert.equal(updatedCount, 1);

  result = await client.from("personal_teams").select("*").eq("id", id).single();
  assert.ifError(result.error);
  assertRestored(result.data);

  console.log(JSON.stringify({
    passed: true,
    insertRestore: true,
    updateRestore: true,
    ownerIsolation: true,
    signedOutRejected: true,
    restoredFieldCount: restoredFields.length,
  }));
} finally {
  if (signedInUser) await client.from("personal_teams").delete().eq("id", id);
  await client.auth.signOut();
}
