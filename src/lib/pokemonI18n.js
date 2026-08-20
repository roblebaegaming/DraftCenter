import pokemonLocalizationCatalog from "../../data/pokemon/pokemon-localizations.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json" with { type: "json" };
import { pokemonProfileSlugForSpecies } from "./publicPokemonIndex.js";
import { SITE_LANGUAGES, localizedSiteAlternates, localizedSitePath, normalizeSiteLocale, siteLanguage } from "./siteLanguages.js";

const COPY = {
  en: {
    language: "Language", indexTitle: "Pokémon Pokédex in English", indexBody: "Browse every Pokémon species using its official English name. Open a profile for localized Pokédex facts, abilities, types, stats, and measurements.", generation: (number) => `Generation ${number}`, species: (count) => `${count} species`, back: "← English Pokédex", englishProfile: "Full English profile", abilities: "Abilities", hidden: "Hidden", stats: (name) => `${name} base stats`, total: "Base stat total", measurements: (name) => `${name} Pokédex measurements`, height: "Height", weight: "Weight", nationalDex: "National Pokédex", introduced: "Introduced", draftTitle: "DraftCenter analysis", draftBody: "This first multilingual phase covers official Pokémon names and core Pokédex facts. Competitive results, community statistics, move research, and draft analysis remain on the complete English profile for now.", openEnglish: "Open the complete English profile", sources: "Sources and translation status", sourceBody: "Pokémon names and core Pokédex facts come from DraftCenter’s pinned PokéAPI catalog. Page text is localized separately so a language update never changes Pokémon identity or bracket results.", fallbackForm: "This form does not yet have a reviewed name in this language, so its English form name is shown temporarily.", fallbackEntry: (name) => `Explore ${name} and its core Pokédex profile.`, type: "type", title: (name) => `${name} Pokédex, Stats and Abilities`, description: (name, types) => `${name} Pokédex profile in English: ${types} typing, abilities, base stats, measurements, and official Pokémon data.`, notFound: "Pokémon not found",
  },
  it: {
    language: "Lingua", indexTitle: "Pokédex Pokémon in italiano", indexBody: "Consulta tutte le specie Pokémon con il loro nome ufficiale in italiano. Apri un profilo per dati Pokédex, abilità, tipi, statistiche e misure localizzati.", generation: (number) => `Generazione ${number}`, species: (count) => `${count} specie`, back: "← Pokédex in italiano", englishProfile: "Profilo completo in inglese", abilities: "Abilità", hidden: "Nascosta", stats: (name) => `Statistiche base di ${name}`, total: "Totale statistiche base", measurements: (name) => `Misure Pokédex di ${name}`, height: "Altezza", weight: "Peso", nationalDex: "Pokédex Nazionale", introduced: "Debutto", draftTitle: "Analisi DraftCenter", draftBody: "Questa prima fase multilingue copre i nomi ufficiali dei Pokémon e i dati Pokédex principali. Risultati competitivi, statistiche della community, mosse e analisi draft restano per ora nel profilo completo in inglese.", openEnglish: "Apri il profilo completo in inglese", sources: "Fonti e stato della traduzione", sourceBody: "I nomi dei Pokémon e i dati Pokédex principali provengono dal catalogo PokéAPI fissato da DraftCenter. Il testo della pagina è localizzato separatamente, così un aggiornamento linguistico non modifica l’identità del Pokémon o i risultati dei tabelloni.", fallbackForm: "Questa forma non ha ancora un nome verificato in italiano; temporaneamente viene mostrato il nome inglese.", fallbackEntry: (name) => `Scopri ${name} e il suo profilo Pokédex principale.`, type: "tipo", title: (name) => `${name}: Pokédex, statistiche e abilità`, description: (name, types) => `Profilo Pokédex di ${name} in italiano: tipo ${types}, abilità, statistiche base, misure e dati Pokémon ufficiali.`, notFound: "Pokémon non trovato",
  },
  es: {
    language: "Idioma", indexTitle: "Pokédex Pokémon en español", indexBody: "Consulta todas las especies Pokémon con su nombre oficial en español. Abre un perfil para ver datos de la Pokédex, habilidades, tipos, puntos de base, altura y peso.", generation: (number) => `Generación ${number}`, species: (count) => `${count} especies`, back: "← Pokédex en español", englishProfile: "Perfil completo en inglés", abilities: "Habilidades", hidden: "Oculta", stats: (name) => `Puntos de base de ${name}`, total: "Total de puntos de base", measurements: (name) => `Altura y peso de ${name}`, height: "Altura", weight: "Peso", nationalDex: "Pokédex Nacional", introduced: "Debut", draftTitle: "Análisis de DraftCenter", draftBody: "Esta primera fase multilingüe incluye los nombres oficiales de los Pokémon y los datos principales de la Pokédex. Los resultados competitivos, las estadísticas de la comunidad, los movimientos y el análisis de draft siguen por ahora en el perfil completo en inglés.", openEnglish: "Abrir el perfil completo en inglés", sources: "Fuentes y estado de la traducción", sourceBody: "Los nombres de los Pokémon y los datos principales de la Pokédex proceden de la versión fijada del catálogo de PokéAPI de DraftCenter. El texto de la página se localiza por separado para que una actualización de idioma nunca cambie la identidad del Pokémon ni los resultados de los cuadros.", fallbackForm: "Esta forma todavía no tiene un nombre revisado en español, así que se muestra temporalmente su nombre en inglés.", fallbackEntry: (name) => `Descubre a ${name} y su perfil principal de la Pokédex.`, type: "tipo", title: (name) => `${name}: Pokédex, puntos de base y habilidades`, description: (name, types) => `Perfil de la Pokédex de ${name} en español: tipo ${types}, habilidades, puntos de base, altura, peso y datos Pokémon oficiales.`, notFound: "Pokémon no encontrado",
  },
  fr: {
    language: "Langue", indexTitle: "Pokédex Pokémon en français", indexBody: "Parcourez toutes les espèces de Pokémon avec leur nom officiel en français. Ouvrez un profil pour consulter les informations du Pokédex, les talents, les types, les stats de base, la taille et le poids.", generation: (number) => `Génération ${number}`, species: (count) => `${count} espèces`, back: "← Pokédex en français", englishProfile: "Profil complet en anglais", abilities: "Talents", hidden: "Caché", stats: (name) => `Stats de base de ${name}`, total: "Total des stats de base", measurements: (name) => `Taille et poids de ${name}`, height: "Taille", weight: "Poids", nationalDex: "Pokédex National", introduced: "Première apparition", draftTitle: "Analyse DraftCenter", draftBody: "Cette première phase multilingue couvre les noms officiels des Pokémon et les informations essentielles du Pokédex. Les résultats compétitifs, les statistiques de la communauté, les capacités et l’analyse de draft restent pour le moment sur le profil complet en anglais.", openEnglish: "Ouvrir le profil complet en anglais", sources: "Sources et état de la traduction", sourceBody: "Les noms des Pokémon et les informations essentielles du Pokédex proviennent de la version fixée du catalogue PokéAPI de DraftCenter. Le texte de la page est localisé séparément afin qu’une mise à jour linguistique ne modifie jamais l’identité d’un Pokémon ni les résultats d’un tableau.", fallbackForm: "Cette forme ne possède pas encore de nom vérifié en français ; son nom anglais est donc affiché temporairement.", fallbackEntry: (name) => `Découvrez ${name} et son profil Pokédex essentiel.`, type: "type", title: (name) => `${name} : Pokédex, stats de base et talents`, description: (name, types) => `Profil Pokédex de ${name} en français : type ${types}, talents, stats de base, taille, poids et données Pokémon officielles.`, notFound: "Pokémon introuvable",
  },
  de: {
    language: "Sprache", indexTitle: "Pokémon-Pokédex auf Deutsch", indexBody: "Durchsuche alle Pokémon-Arten mit ihrem offiziellen deutschen Namen. Öffne ein Profil für lokalisierte Pokédex-Daten, Fähigkeiten, Typen, Statuswerte und Maße.", generation: (number) => `Generation ${number}`, species: (count) => `${count} Arten`, back: "← Deutscher Pokédex", englishProfile: "Vollständiges englisches Profil", abilities: "Fähigkeiten", hidden: "Versteckt", stats: (name) => `${name}: Basiswerte`, total: "Summe der Basiswerte", measurements: (name) => `${name}: Pokédex-Maße`, height: "Größe", weight: "Gewicht", nationalDex: "Nationaler Pokédex", introduced: "Eingeführt", draftTitle: "DraftCenter-Analyse", draftBody: "Diese erste mehrsprachige Phase umfasst offizielle Pokémon-Namen und grundlegende Pokédex-Daten. Turnierergebnisse, Community-Statistiken, Attacken und Draft-Analysen bleiben vorerst im vollständigen englischen Profil.", openEnglish: "Vollständiges englisches Profil öffnen", sources: "Quellen und Übersetzungsstatus", sourceBody: "Pokémon-Namen und grundlegende Pokédex-Daten stammen aus dem festgeschriebenen PokéAPI-Katalog von DraftCenter. Seitentexte werden separat lokalisiert, damit ein Sprachupdate niemals Pokémon-Identitäten oder Bracket-Ergebnisse verändert.", fallbackForm: "Für diese Form gibt es noch keinen geprüften deutschen Namen. Vorübergehend wird daher der englische Formname angezeigt.", fallbackEntry: (name) => `Entdecke ${name} und sein grundlegendes Pokédex-Profil.`, type: "Typ", title: (name) => `${name}: Pokédex, Statuswerte und Fähigkeiten`, description: (name, types) => `${name}-Pokédex-Profil auf Deutsch: Typ ${types}, Fähigkeiten, Basiswerte, Maße und offizielle Pokémon-Daten.`, notFound: "Pokémon nicht gefunden",
  },
  ja: {
    language: "言語", indexTitle: "日本語のポケモン図鑑", indexBody: "すべてのポケモンを公式の日本語名で確認できます。プロフィールでは、図鑑情報、特性、タイプ、種族値、高さ、重さを日本語で閲覧できます。", generation: (number) => `第${number}世代`, species: (count) => `${count}種`, back: "← 日本語のポケモン図鑑", englishProfile: "英語の完全プロフィール", abilities: "特性", hidden: "隠れ特性", stats: (name) => `${name}の種族値`, total: "種族値合計", measurements: (name) => `${name}の図鑑データ`, height: "高さ", weight: "重さ", nationalDex: "全国図鑑", introduced: "初登場", draftTitle: "DraftCenterの分析", draftBody: "多言語化の第1段階では、ポケモンの公式名と基本的な図鑑情報に対応します。大会成績、コミュニティ統計、わざ、ドラフト分析は、現時点では英語の完全プロフィールで提供します。", openEnglish: "英語の完全プロフィールを開く", sources: "情報源と翻訳状況", sourceBody: "ポケモン名と基本図鑑情報は、DraftCenterが固定したPokéAPIカタログに基づいています。言語更新によってポケモンの識別情報やトーナメント表の結果が変わらないよう、ページ文言は別に管理します。", fallbackForm: "このフォルムには確認済みの日本語名がまだないため、一時的に英語名を表示しています。", fallbackEntry: (name) => `${name}の基本的な図鑑プロフィールを確認できます。`, type: "タイプ", title: (name) => `${name}｜図鑑・種族値・特性`, description: (name, types) => `${name}の日本語図鑑プロフィール。タイプは${types}。特性、種族値、高さ、重さ、公式ポケモンデータを掲載。`, notFound: "ポケモンが見つかりません",
  },
  ko: {
    language: "언어", indexTitle: "한국어 포켓몬 도감", indexBody: "모든 포켓몬 종을 공식 한국어 이름으로 살펴보세요. 프로필에서 도감 정보, 특성, 타입, 종족값, 키와 몸무게를 한국어로 확인할 수 있습니다.", generation: (number) => `제${number}세대`, species: (count) => `${count}종`, back: "← 한국어 포켓몬 도감", englishProfile: "영어 전체 프로필", abilities: "특성", hidden: "숨겨진 특성", stats: (name) => `${name}의 종족값`, total: "종족값 총합", measurements: (name) => `${name} 도감 정보`, height: "키", weight: "몸무게", nationalDex: "전국도감", introduced: "첫 등장", draftTitle: "DraftCenter 분석", draftBody: "다국어 지원의 첫 단계에서는 포켓몬의 공식 이름과 핵심 도감 정보를 제공합니다. 대회 성적, 커뮤니티 통계, 기술 및 드래프트 분석은 현재 영어 전체 프로필에서 확인할 수 있습니다.", openEnglish: "영어 전체 프로필 열기", sources: "출처 및 번역 상태", sourceBody: "포켓몬 이름과 핵심 도감 정보는 DraftCenter가 고정한 PokéAPI 카탈로그를 사용합니다. 언어 업데이트가 포켓몬의 식별 정보나 대진표 결과를 바꾸지 않도록 페이지 문구는 별도로 관리합니다.", fallbackForm: "이 폼은 아직 검토된 한국어 이름이 없어 임시로 영어 이름을 표시합니다.", fallbackEntry: (name) => `${name}의 핵심 도감 프로필을 확인하세요.`, type: "타입", title: (name) => `${name} 도감·종족값·특성`, description: (name, types) => `${name} 한국어 도감 프로필: ${types} 타입, 특성, 종족값, 키, 몸무게 및 공식 포켓몬 데이터.`, notFound: "포켓몬을 찾을 수 없습니다",
  },
};

const TRANSLATION_BETA_COPY = {
  en: { title: "Translation beta", body: "This translation has not yet been reviewed by a native speaker.", action: "Report a correction" },
  it: { title: "Traduzione beta", body: "Questa traduzione non è ancora stata verificata da una persona madrelingua.", action: "Segnala una correzione" },
  es: { title: "Traducción beta", body: "Esta traducción aún no ha sido revisada por una persona nativa.", action: "Enviar una corrección" },
  fr: { title: "Traduction bêta", body: "Cette traduction n’a pas encore été relue par une personne francophone.", action: "Signaler une correction" },
  de: { title: "Übersetzung in der Beta-Phase", body: "Diese Übersetzung wurde noch nicht von Muttersprachlern geprüft.", action: "Korrektur melden" },
  ja: { title: "ベータ版の翻訳", body: "ネイティブスピーカーによる確認はまだ完了していません。", action: "修正点を報告" },
  ko: { title: "번역 베타", body: "아직 원어민 검토가 완료되지 않았습니다.", action: "수정 제안 보내기" },
};

const STAT_LABELS = {
  en: { hp: "HP", attack: "Attack", defense: "Defense", "special-attack": "Special Attack", "special-defense": "Special Defense", speed: "Speed" },
  it: { hp: "PS", attack: "Attacco", defense: "Difesa", "special-attack": "Attacco Speciale", "special-defense": "Difesa Speciale", speed: "Velocità" },
  es: { hp: "PS", attack: "Ataque", defense: "Defensa", "special-attack": "Ataque Especial", "special-defense": "Defensa Especial", speed: "Velocidad" },
  fr: { hp: "PV", attack: "Attaque", defense: "Défense", "special-attack": "Attaque Spéciale", "special-defense": "Défense Spéciale", speed: "Vitesse" },
  de: { hp: "KP", attack: "Angriff", defense: "Verteidigung", "special-attack": "Spezial-Angriff", "special-defense": "Spezial-Verteidigung", speed: "Initiative" },
  ja: { hp: "HP", attack: "こうげき", defense: "ぼうぎょ", "special-attack": "とくこう", "special-defense": "とくぼう", speed: "すばやさ" },
  ko: { hp: "HP", attack: "공격", defense: "방어", "special-attack": "특수공격", "special-defense": "특수방어", speed: "스피드" },
};

export const POKEDEX_LANGUAGES = SITE_LANGUAGES;
export const POKEMON_LOCALIZATION_SOURCE_COMMIT = pokemonLocalizationCatalog.source_commit;
export const POKEMON_LOCALIZATION_COVERAGE = pokemonLocalizationCatalog.coverage;

export function pokemonCopy(locale = "en") {
  const code = normalizeSiteLocale(locale);
  return { ...(COPY[code] || COPY.en), translationBeta: TRANSLATION_BETA_COPY[code] || TRANSLATION_BETA_COPY.en };
}
export function pokemonStatLabel(stat, locale = "en") {
  const code = normalizeSiteLocale(locale);
  return STAT_LABELS[code]?.[stat] || STAT_LABELS.en[stat] || String(stat || "");
}
export function pokemonIndexPath(locale = "en") {
  return localizedSitePath(locale, "/pokemon");
}

export function pokemonProfilePath(locale, profileSlug) {
  return localizedSitePath(locale, `/pokemon/${profileSlug}`);
}

export function pokemonProfileAlternates(profileSlug) {
  return localizedSiteAlternates(`/pokemon/${profileSlug}`);
}

export function localizedPokemonProfileName(profileSlug, locale = "en", fallback = "") {
  const code = normalizeSiteLocale(locale);
  const profile = pokemonLocalizationCatalog.profiles[String(profileSlug || "").toLowerCase()];
  return {
    name: profile?.names?.[code] || profile?.names?.en || fallback,
    source: profile?.name_source?.[code] || "english-fallback",
    species: profile?.species || String(profileSlug || ""),
  };
}

export function localizedPokemonSpeciesName(speciesSlug, locale = "en", fallback = "") {
  const code = normalizeSiteLocale(locale);
  const species = pokemonLocalizationCatalog.species[String(speciesSlug || "").toLowerCase()];
  return species?.names?.[code] || species?.names?.en || fallback;
}

export function pokemonSpeciesLocalization(speciesSlug, locale = "en") {
  const code = normalizeSiteLocale(locale);
  const species = pokemonLocalizationCatalog.species[String(speciesSlug || "").toLowerCase()];
  if (!species) return null;
  return {
    dexNumber: species.id,
    generation: species.generation,
    name: species.names[code] || species.names.en,
    genus: species.genera[code] || species.genera.en || "Pokémon",
  };
}

export function localizedPokemonGenus(speciesSlug, locale = "en") {
  const code = normalizeSiteLocale(locale);
  const species = pokemonLocalizationCatalog.species[String(speciesSlug || "").toLowerCase()];
  return species?.genera?.[code] || species?.genera?.en || "Pokémon";
}

export function localizedPokemonSpecies(locale = "en") {
  const code = normalizeSiteLocale(locale);
  const language = siteLanguage(code);
  const collator = new Intl.Collator(language.locale, { sensitivity: "base" });
  return Object.entries(pokemonLocalizationCatalog.species)
    .map(([speciesSlug, species]) => ({
      speciesSlug,
      profileSlug: pokemonProfileSlugForSpecies(speciesSlug),
      name: species.names[code] || species.names.en,
      generation: species.generation,
      dexNumber: species.id,
    }))
    .sort((left, right) => left.generation - right.generation || collator.compare(left.name, right.name));
}

export function localizedPokeApiName(resource, locale = "en", fallback = "") {
  const language = siteLanguage(locale);
  const names = Array.isArray(resource?.names) ? resource.names : [];
  const localized = names.find((entry) => String(entry?.language?.name || "").toLowerCase() === language.pokeApiLanguage)?.name;
  const english = names.find((entry) => entry?.language?.name === "en")?.name;
  return String(localized || english || fallback || "").trim();
}

export function pokemonIndexMetadata(locale = "en") {
  const language = siteLanguage(locale);
  const copy = pokemonCopy(language.code);
  const canonical = pokemonIndexPath(language.code);
  return {
    title: copy.indexTitle,
    description: copy.indexBody,
    alternates: { canonical, languages: localizedSiteAlternates("/pokemon") },
    openGraph: { type: "website", locale: language.openGraphLocale, url: canonical, title: copy.indexTitle, description: copy.indexBody },
  };
}
