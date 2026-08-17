export const TEAM_SHEET_LANGUAGES = Object.freeze([
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "it", label: "IT" },
  { code: "de", label: "DE" },
  { code: "es", label: "ES" },
  { code: "ja-hrkt", label: "JP" },
  { code: "ko", label: "KO" },
]);

const POKEAPI_SLUG_OVERRIDES = Object.freeze({
  Basculegion: "basculegion-male",
  "Basculegion-Female": "basculegion-female",
  "Calyrex-Shadow Rider": "calyrex-shadow",
  "Calyrex-Ice Rider": "calyrex-ice",
  Indeedee: "indeedee-male",
  Urshifu: "urshifu-single-strike",
  "Primal Groudon": "groudon-primal",
  "Primal Kyogre": "kyogre-primal",
  "Mega Absol": "absol-mega-z",
  "Mega Garchomp": "garchomp-mega-z",
  "Mega Lucario": "lucario-mega-z",
});

export function teamSheetTranslationKey(kind, value) {
  return `${kind}:${String(value || "").trim().toLowerCase()}`;
}

export function pokeApiResourceSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[♀]/g, "-f")
    .replace(/[♂]/g, "-m")
    .replace(/[.'’:%(),]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export function pokemonApiSlugsForTeamSheet(name) {
  if (POKEAPI_SLUG_OVERRIDES[name]) return [POKEAPI_SLUG_OVERRIDES[name]];
  let value = String(name || "").toLowerCase().trim();
  const regionalPatterns = [
    [/^alolan (.+)/, "$1-alola"],
    [/^galarian (.+)/, "$1-galar"],
    [/^hisuian (.+)/, "$1-hisui"],
    [/^paldean tauros \(water\)$/, "tauros-paldea-aqua-breed"],
    [/^paldean tauros \(fire\)$/, "tauros-paldea-blaze-breed"],
    [/^paldean tauros$/, "tauros-paldea-combat-breed"],
    [/^paldean (.+)/, "$1-paldea"],
  ];
  for (const [pattern, replacement] of regionalPatterns) {
    if (pattern.test(value)) {
      value = value.replace(pattern, replacement);
      break;
    }
  }
  if (/^mega /.test(value)) {
    value = value.replace(/^mega /, "");
    if (/ x$/.test(value)) value = value.replace(/ x$/, "") + "-mega-x";
    else if (/ y$/.test(value)) value = value.replace(/ y$/, "") + "-mega-y";
    else value += "-mega";
  }
  return [pokeApiResourceSlug(value)];
}

export function localizedNamesFromPokeApi(resource, fallback = "") {
  const names = Array.isArray(resource?.names) ? resource.names : [];
  return Object.fromEntries(TEAM_SHEET_LANGUAGES.map(({ code }) => {
    const localized = names.find((entry) => entry?.language?.name === code)?.name;
    return [code, String(localized || fallback || "").trim()];
  }));
}

export function mergeLocalizedNames(primary, fallback, englishFallback = "") {
  return Object.fromEntries(TEAM_SHEET_LANGUAGES.map(({ code }) => [
    code,
    String(primary?.[code] || fallback?.[code] || englishFallback || "").trim(),
  ]));
}

export function teamSheetTranslationTargets(teamSets) {
  const unique = new Map();
  const add = (kind, value) => {
    const clean = String(value || "").trim();
    if (!clean) return;
    const key = teamSheetTranslationKey(kind, clean);
    if (!unique.has(key)) unique.set(key, { key, kind, value: clean });
  };

  for (const set of Array.isArray(teamSets) ? teamSets : []) {
    add("pokemon", set?.name);
    add("type", set?.tera_type);
    add("ability", set?.ability);
    add("item", set?.item);
    for (const move of Array.isArray(set?.moves) ? set.moves : []) add("move", move);
  }
  return [...unique.values()];
}
