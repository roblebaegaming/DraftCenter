import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { authCaptchaEnabled, authCaptchaRequired, authCaptchaTokenOptions } from "../src/lib/authCaptcha.js";

test("Turnstile appears on every unauthenticated credential action", () => {
  for (const mode of ["sign_in", "sign_up", "forgot_password"]) {
    assert.equal(authCaptchaEnabled("site-key", mode), true, mode);
  }
});

test("Turnstile does not block an authenticated password replacement", () => {
  assert.equal(authCaptchaEnabled("site-key", "reset_password"), false);
});

test("auth remains usable before a Turnstile key is configured", () => {
  assert.equal(authCaptchaEnabled("", "sign_in"), false);
  assert.equal(authCaptchaEnabled("   ", "sign_up"), false);
});

test("the rollout switch keeps auth fail-open until live verification", () => {
  assert.equal(authCaptchaRequired("site-key", "sign_in", false), false);
  assert.equal(authCaptchaRequired("site-key", "sign_in", true), true);
  assert.equal(authCaptchaRequired("site-key", "reset_password", true), false);
});

test("only a non-empty Turnstile token is sent to Supabase", () => {
  assert.deepEqual(authCaptchaTokenOptions(" token-value "), { captchaToken: "token-value" });
  assert.deepEqual(authCaptchaTokenOptions(""), {});
  assert.deepEqual(authCaptchaTokenOptions(undefined), {});
});

test("the flexible Turnstile stays inside the narrow account panel", () => {
  const challenge = fs.readFileSync(new URL("../src/components/TurnstileChallenge.jsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(challenge, /className="auth-captcha"/);
  assert.match(challenge, /className="auth-captcha-widget"/);
  assert.match(challenge, /matchMedia\("\(max-width: 360px\)"\)\.matches \? "compact" : "flexible"/);
  assert.match(css, /\.auth-captcha-widget iframe\{width:100%!important;max-width:100%!important\}/);
});
