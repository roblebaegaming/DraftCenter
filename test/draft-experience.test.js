import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { browserCanResolveHostedAutoDraft, preserveLoadedPrivateDraftQueue } from "../src/lib/draftQueueSafety.js";
import { readLeagueNavigation, writeLeagueNavigation } from "../src/lib/leagueNavigation.js";
import {
  MAX_SNAPSHOT_CONFLICT_RETRIES,
  SAVE_FAILURE_GRACE_MS,
  saveWithConflictRecovery,
  waitForSaveFailureGrace,
} from "../src/lib/leagueSaveReconciliation.js";

const draftLeagueSource = fs.readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");

test("hosted snapshot changes preserve an already loaded private queue", () => {
  const current = { queues: { 2: ["Garchomp", "Rotom-Wash"] } };
  const hydrated = { teams: [{}, {}, {}], queues: {} };
  assert.deepEqual(
    preserveLoadedPrivateDraftQueue(hydrated, current, 2, 2).queues[2],
    ["Garchomp", "Rotom-Wash"],
  );
  assert.equal(preserveLoadedPrivateDraftQueue(hydrated, current, 2, null), hydrated);
});

test("a hosted human auto-draft waits for that manager's authoritative queue", () => {
  const base = {
    leagueId: "league-id",
    isBotTeam: false,
    isCommissioner: true,
    teamIndex: 4,
    myTeamIndex: 4,
  };
  assert.equal(browserCanResolveHostedAutoDraft({ ...base, loadedPrivateQueueTeamIndex: null }), false);
  assert.equal(browserCanResolveHostedAutoDraft({ ...base, loadedPrivateQueueTeamIndex: 4 }), true);
  assert.equal(browserCanResolveHostedAutoDraft({ ...base, myTeamIndex: 1, loadedPrivateQueueTeamIndex: 1 }), false);
  assert.equal(browserCanResolveHostedAutoDraft({ ...base, isBotTeam: true }), true);
});

test("league navigation survives reload without dropping the league key", () => {
  const next = writeLeagueNavigation("?league=pallet-town&invite=kept", "league", "draft");
  assert.equal(next, "?league=pallet-town&invite=kept&tab=league&section=draft");
  assert.deepEqual(readLeagueNavigation(next), { tab: "league", section: "draft", explicit: true });
  assert.match(draftLeagueSource, /if \(initialNavigation\.explicit\) return;/);
  assert.doesNotMatch(draftLeagueSource, /initialNavigation\.explicit && tab !== "draft"/);
  assert.match(draftLeagueSource, /window\.addEventListener\("popstate", restoreNavigation\)/);
});

test("invalid navigation values fall back safely", () => {
  assert.deepEqual(readLeagueNavigation("?tab=unknown&section=unknown"), { tab: "home", section: "activity", explicit: false });
  assert.equal(readLeagueNavigation("", { isNew: true }).tab, "setup");
});

test("snapshot saves refresh and reapply an edit before bounded conflict retries", async () => {
  const attempts = [];
  const loaded = [{ rev: 8, value: 20 }, { rev: 10, value: 30 }];
  const responses = [
    { ok: false, conflict: true, message: "changed" },
    { ok: false, conflict: true, message: "changed again" },
    { ok: true },
  ];
  const result = await saveWithConflictRecovery({
    initialState: { rev: 6, value: 10 },
    leagueId: "league-id",
    updater: (state) => ({ ...state, value: state.value + 1 }),
    save: async (state, _leagueId, options) => {
      attempts.push({ state, options });
      return responses.shift();
    },
    load: async () => loaded.shift(),
    hydrate: (state) => state,
  });

  assert.equal(MAX_SNAPSHOT_CONFLICT_RETRIES, 2);
  assert.deepEqual(attempts.map(({ state }) => state), [
    { rev: 6, value: 10 },
    { rev: 9, value: 21 },
    { rev: 11, value: 31 },
  ]);
  assert.deepEqual(attempts.map(({ options }) => options.reportConflicts), [false, false, true]);
  assert.equal(result.ok, true);
  assert.equal(result.recoveredConflict, true);
  assert.deepEqual(result.savedState, { rev: 11, value: 31 });
});

test("non-conflict failures are not replayed and wait through the trust grace period", async () => {
  let attempts = 0;
  const result = await saveWithConflictRecovery({
    initialState: { rev: 4 },
    leagueId: "league-id",
    updater: (state) => state,
    save: async () => {
      attempts += 1;
      return { ok: false, conflict: false, message: "timeout" };
    },
    load: async () => assert.fail("a timeout must not be replayed"),
    hydrate: (state) => state,
  });
  assert.equal(attempts, 1);
  assert.equal(result.ok, false);

  let waited = 0;
  const remaining = await waitForSaveFailureGrace(1000, {
    now: () => 2500,
    wait: async (milliseconds) => { waited = milliseconds; },
  });
  assert.equal(SAVE_FAILURE_GRACE_MS, 4000);
  assert.equal(remaining, 2500);
  assert.equal(waited, 2500);
});

test("manual checkpoints advance through commit and expose a verification state", () => {
  assert.match(draftLeagueSource, /function saveNow\(\) \{[\s\S]*?commit\(failedSaveUpdaterRef\.current \|\| \(\(current\) => current\)\);/u);
  assert.doesNotMatch(draftLeagueSource, /function saveNow\(\) \{[\s\S]*?saveRemote\(state, leagueId\)/u);
  assert.match(draftLeagueSource, /setSaveStatus\("verifying"\)[\s\S]*?waitForSaveFailureGrace\(startedAt\)/u);
  assert.match(draftLeagueSource, /current === "loading" \? "saved" : current/u);
  assert.match(draftLeagueSource, /remote && remote\.rev >= revRef\.current && !saveProtectionRef\.current/u);
  assert.match(draftLeagueSource, /failedSaveUpdaterRef\.current = typeof updater === "function" \? updater : null/u);
  assert.match(draftLeagueSource, /VERIFYING SAVE\.\.\./u);
  assert.match(draftLeagueSource, /save still failed after waiting/u);
});

test("auction managers can nominate directly while the optional queue stays stable", () => {
  assert.match(draftLeagueSource, /className="mt-2 grid grid-cols-2 gap-2"/u);
  assert.match(draftLeagueSource, />\s*NOMINATE\s*<\/button>/u);
  assert.match(draftLeagueSource, /\+ QUEUE FOR LATER/u);
  assert.match(draftLeagueSource, /disabled=\{!canNominate \|\| !!nominee\}/u);
  assert.match(draftLeagueSource, /disabled=\{!myNominationTurn\}/u);
  assert.match(draftLeagueSource, /Your queue is optional\./u);
  assert.match(draftLeagueSource, /className="draft-queue-panel rounded-lg p-4 mb-6"/u);
});

test("the global navigation keeps DraftCenter Home clear and accessible at the top", () => {
  const navigation = fs.readFileSync(new URL("../src/components/SiteQuickLinks.jsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(navigation, /className=\{`site-brand-link site-draft-home\$\{pathname === "\/" \? " is-active" : ""\}`\} href="\/\?view=dashboard"/);
  assert.match(navigation, /aria-label="DraftCenter Home"/);
  assert.match(navigation, /aria-current=\{pathname === "\/" \? "page" : undefined\}/);
  assert.match(navigation, /className="draft-home-label-wide">DraftCenter Home<\/span>/);
  assert.match(navigation, /className="draft-home-label-compact" aria-hidden="true">Home<\/span>/);
  assert.match(navigation, /aria-label="Tools and resources"/);
  assert.match(styles, /\.site-global-header\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/);
  assert.match(styles, /\.site-draft-home\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(styles, /\.site-draft-home\.is-active\s*\{/);
  assert.match(styles, /\.site-draft-home:focus-visible\s*\{/);
  assert.match(styles, /@media \(max-width:760px\)\s*\{[\s\S]*?\.draft-home-label-wide\s*\{\s*display:\s*none;\s*\}[\s\S]*?\.draft-home-label-compact\s*\{\s*display:\s*inline;\s*\}/);
});
