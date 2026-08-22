const ADSENSE_ACCOUNT_PATTERN = /^ca-pub-\d{16}$/;
const GOOGLE_SELLER_DOMAIN = "google.com";
const GOOGLE_CERTIFICATION_AUTHORITY_ID = "f08c47fec0942fa0";

export function normalizeAdsenseAccount(value) {
  const account = String(value || "").trim();
  return ADSENSE_ACCOUNT_PATTERN.test(account) ? account : "";
}

export function getAdsenseAccount(env = process.env) {
  return normalizeAdsenseAccount(env.GOOGLE_ADSENSE_ACCOUNT);
}

export function getAdsenseMetadata(env = process.env) {
  const account = getAdsenseAccount(env);
  return account ? { "google-adsense-account": account } : {};
}

export function getAdsTxt(env = process.env) {
  const account = getAdsenseAccount(env);
  if (!account) return "";
  const publisherId = account.replace(/^ca-/, "");
  return `${GOOGLE_SELLER_DOMAIN}, ${publisherId}, DIRECT, ${GOOGLE_CERTIFICATION_AUTHORITY_ID}\n`;
}
