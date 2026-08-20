export const SITE_LANGUAGES = Object.freeze([
  Object.freeze({ code: "en", pathPrefix: "", nativeLabel: "English", documentLanguage: "en", locale: "en-US", pokeApiLanguage: "en", openGraphLocale: "en_US" }),
  Object.freeze({ code: "it", pathPrefix: "/it", nativeLabel: "Italiano", documentLanguage: "it", locale: "it-IT", pokeApiLanguage: "it", openGraphLocale: "it_IT" }),
  Object.freeze({ code: "es", pathPrefix: "/es", nativeLabel: "Español", documentLanguage: "es", locale: "es-ES", pokeApiLanguage: "es", openGraphLocale: "es_ES" }),
  Object.freeze({ code: "fr", pathPrefix: "/fr", nativeLabel: "Français", documentLanguage: "fr", locale: "fr-FR", pokeApiLanguage: "fr", openGraphLocale: "fr_FR" }),
  Object.freeze({ code: "de", pathPrefix: "/de", nativeLabel: "Deutsch", documentLanguage: "de", locale: "de-DE", pokeApiLanguage: "de", openGraphLocale: "de_DE" }),
  Object.freeze({ code: "ja", pathPrefix: "/ja", nativeLabel: "日本語", documentLanguage: "ja", locale: "ja-JP", pokeApiLanguage: "ja-hrkt", openGraphLocale: "ja_JP" }),
  Object.freeze({ code: "ko", pathPrefix: "/ko", nativeLabel: "한국어", documentLanguage: "ko", locale: "ko-KR", pokeApiLanguage: "ko", openGraphLocale: "ko_KR" }),
]);

const LANGUAGE_BY_CODE = new Map(SITE_LANGUAGES.map((language) => [language.code, language]));

export function normalizeSiteLocale(locale = "en") {
  const code = String(locale || "en").trim().toLowerCase().split("-")[0];
  return LANGUAGE_BY_CODE.has(code) ? code : "en";
}
export function siteLanguage(locale = "en") {
  return LANGUAGE_BY_CODE.get(normalizeSiteLocale(locale));
}
export function localizedSitePath(locale, path = "/") {
  const language = siteLanguage(locale);
  const suffix = String(path || "/").startsWith("/") ? String(path || "/") : `/${path}`;
  return `${language.pathPrefix}${suffix}` || "/";
}

export function localizedSiteAlternates(path) {
  return Object.fromEntries([
    ...SITE_LANGUAGES.map(({ code }) => [code, localizedSitePath(code, path)]),
    ["x-default", localizedSitePath("en", path)],
  ]);
}
