import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { browserCanResolveHostedAutoDraft, preserveLoadedPrivateDraftQueue } from "../src/lib/draftQueueSafety.js";
import { readLeagueNavigation, writeLeagueNavigation } from "../src/lib/leagueNavigation.js";

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
});

test("invalid navigation values fall back safely", () => {
  assert.deepEqual(readLeagueNavigation("?tab=unknown&section=unknown"), { tab: "home", section: "activity", explicit: false });
  assert.equal(readLeagueNavigation("", { isNew: true }).tab, "setup");
});

test("the global navigation keeps Draft Home accessible at the top", () => {
  const navigation = fs.readFileSync(new URL("../src/components/SiteQuickLinks.jsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(navigation, /className="site-brand-link site-draft-home" href="\/\?view=dashboard"/);
  assert.match(navigation, /aria-label="Draft Home"/);
  assert.match(navigation, /<span>Draft Home<\/span>/);
  assert.match(navigation, /aria-label="Tools and resources"/);
  assert.match(styles, /\.site-global-header\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/);
  assert.match(styles, /\.site-draft-home\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(styles, /\.site-draft-home:focus-visible\s*\{/);
});
