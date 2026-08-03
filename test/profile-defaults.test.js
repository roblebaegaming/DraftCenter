import test from "node:test";
import assert from "node:assert/strict";

import { defaultProfileDisplayName } from "../src/lib/profileDefaults.js";

test("plus-address tags are not exposed in the default display name", () => {
  assert.equal(
    defaultProfileDisplayName("robert.lebeda+draftcenter-email-test-20260802@gmail.com"),
    "robert.lebeda",
  );
});

test("long local parts always fit the profile constraint", () => {
  const displayName = defaultProfileDisplayName(`${"longname".repeat(10)}@example.com`);

  assert.equal(displayName.length, 40);
});

test("empty and one-character local parts use the safe fallback", () => {
  assert.equal(defaultProfileDisplayName("@example.com"), "Coach");
  assert.equal(defaultProfileDisplayName("x@example.com"), "Coach");
});
