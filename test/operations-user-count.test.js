import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { summarizeAuthUsers } from "../src/lib/authUserTotals.js";

test("authentication totals include Discord, email, linked, and other accounts", () => {
  const totals = summarizeAuthUsers([
    { identities: [{ provider: "email" }] },
    { identities: [{ provider: "discord" }] },
    { identities: [{ provider: "email" }, { provider: "discord" }] },
    { identities: [{ provider: "github" }] },
  ]);
  assert.deepEqual(totals, { total: 4, email: 2, discord: 2, both: 1, other: 1 });
});

test("Operations exposes aggregate identity counts without user identifiers", () => {
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  assert.match(dashboard, /Total accounts/);
  assert.match(dashboard, /Discord identity/);
  assert.match(dashboard, /Email \+ Discord linked/);
  assert.doesNotMatch(dashboard, /data\.users\?\.(email_address|discord_username|identities)/);
});
