const CAPTCHA_PROTECTED_AUTH_MODES = new Set(["sign_in", "sign_up", "forgot_password"]);

export function authCaptchaRequired(siteKey, mode) {
  return Boolean(String(siteKey || "").trim()) && CAPTCHA_PROTECTED_AUTH_MODES.has(mode);
}

export function authCaptchaTokenOptions(token) {
  const captchaToken = String(token || "").trim();
  return captchaToken ? { captchaToken } : {};
}
