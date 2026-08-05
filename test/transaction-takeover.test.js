import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("new leagues default to one weekly move without changing saved unlimited leagues", () => {
  const league = source("src/components/PokemonDraftLeague.jsx");
  assert.match(league, /maxTransactionsPerWeek: 1, \/\/ safer new-league default/);
  assert.match(league, /hasOwnProperty\.call\(remoteSettings, "maxTransactionsPerWeek"\)/);
  assert.match(league, /\? remoteSettings\.maxTransactionsPerWeek\s*: base\.settings\.maxTransactionsPerWeek/);
  assert.match(league, /Existing leagues keep their saved choice, including Unlimited/);
});

test("instant free-agent moves show allowance and require confirmation", () => {
  const league = source("src/components/PokemonDraftLeague.jsx");
  assert.match(league, /Weekly allowance: \$\{weeklyRemaining\} of \$\{info\.weekLimit\} remaining/);
  assert.match(league, /if \(settings\.faClaimMode === "instant"\) setConfirmFreeAgent\(true\)/);
  assert.match(league, /aria-labelledby="confirm-free-agent-title"/);
  assert.match(league, /CONFIRM TRANSACTION/);
});

test("live takeover is commissioner-controlled and preserves draft assets", () => {
  const migration = source("supabase/254-live-bot-team-takeover.sql");
  assert.match(migration, /not public\.is_league_staff\(p_league_id\)/);
  assert.match(migration, /where snapshot\.league_id = p_league_id\s+for update/);
  assert.match(migration, /if p_team_index = v_current_team then/);
  assert.match(migration, /'autoDraft', false/);
  assert.match(migration, /set owner_membership_id = p_membership_id/);
  assert.match(migration, /insert into public\.auction_team_owners/);
  assert.doesNotMatch(migration, /jsonb_set\(\s*v_state,\s*'\{(?:rosters|budgets|snakeOrder|auctionNominationOrder)\}'/);
});

test("takeover RPCs use explicit authenticated grants and the commissioner UI", () => {
  const migration = source("supabase/254-live-bot-team-takeover.sql");
  const authGate = source("src/components/AuthGate.jsx");
  assert.match(migration, /revoke all on function public\.assign_live_bot_team_to_member\(uuid, integer, uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.assign_live_bot_team_to_member\(uuid, integer, uuid\)[\s\S]*to authenticated/);
  assert.match(authGate, /get_live_bot_takeover_options/);
  assert.match(authGate, /assign_live_bot_team_to_member/);
  assert.match(authGate, /Assign team without changing the draft/);
});
