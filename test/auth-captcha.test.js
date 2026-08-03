import test from "node:test";
import assert from "node:assert/strict";

import { authCaptchaRequired, authCaptchaTokenOptions } from "../src/lib/authCaptcha.js";

test("Turnstile protects every unauthenticated credential action", () => {
  for (const mode of ["sign_in", "sign_up", "forgot_password"]) {
    assert.equal(authCaptchaRequired("site-key", mode), true, mode);
  }
});

test("Turnstile does not block an authenticated password replacement", () => {
  assert.equal(authCaptchaRequired("site-key", "reset_password"), false);
});

test("auth remains usable before a Turnstile key is configured", () => {
  assert.equal(authCaptchaRequired("", "sign_in"), false);
  assert.equal(authCaptchaRequired("   ", "sign_up"), false);
});

test("only a non-empty Turnstile token is sent to Supabase", () => {
  assert.deepEqual(authCaptchaTokenOptions(" token-value "), { captchaToken: "token-value" });
  assert.deepEqual(authCaptchaTokenOptions(""), {});
  assert.deepEqual(authCaptchaTokenOptions(undefined), {});
});
