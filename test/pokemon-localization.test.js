import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  POKEDEX_LANGUAGES,
  POKEMON_LOCALIZATION_COVERAGE,
  localizedPokeApiName,
  localizedPokemonProfileName,
  localizedPokemonResource,
  localizedPokemonResourceName,
  localizedPokemonResourceOptions,
  localizedPokemonSpecies,
  pokemonDirectoryCopy,
  pokemonIndexMetadata,
  pokemonCopy,
  pokemonProfileAlternates,
  pokemonProfilePath,
} from "../src/lib/pokemonI18n.js";
import { SITE_LANGUAGES, localizedSitePath } from "../src/lib/siteLanguages.js";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the site language registry is shared by Worlds and the Pokédex", () => {
  assert.deepEqual(SITE_LANGUAGES.map(({ code }) => code), ["en", "it", "es", "fr", "de", "ja", "ko"]);
  assert.deepEqual(POKEDEX_LANGUAGES.map(({ code }) => code), SITE_LANGUAGES.map(({ code }) => code));
  assert.equal(localizedSitePath("fr", "/pokemon"), "/fr/pokemon");
  assert.equal(localizedSitePath("en", "/pokemon"), "/pokemon");
  assert.match(source("src/lib/worlds2026I18n.js"), /SITE_LANGUAGES/);
});

test("all 1,025 species have official names in every first-wave language", () => {
  for (const { code } of POKEDEX_LANGUAGES) {
    const entries = localizedPokemonSpecies(code);
    assert.equal(entries.length, 1025);
    assert.ok(entries.every(({ name, profileSlug, generation }) => name && profileSlug && generation >= 1 && generation <= 9));
    assert.equal(POKEMON_LOCALIZATION_COVERAGE[code].species_localized, 1025);
  }
  assert.equal(localizedPokemonProfileName("bulbasaur", "fr").name, "Bulbizarre");
  assert.equal(localizedPokemonProfileName("charizard", "de").name, "Glurak");
  assert.equal(localizedPokemonProfileName("pikachu", "ja").name, "ピカチュウ");
  assert.equal(localizedPokemonProfileName("pikachu", "ko").name, "피카츄");
});

test("Mega form-name gaps remain explicit before the multilingual bracket", () => {
  assert.equal(POKEMON_LOCALIZATION_COVERAGE.fr.mega_profiles_localized, 97);
  assert.equal(POKEMON_LOCALIZATION_COVERAGE.de.mega_profiles_localized, 48);
  assert.equal(POKEMON_LOCALIZATION_COVERAGE.it.mega_profiles_localized, 93);
  assert.equal(POKEMON_LOCALIZATION_COVERAGE.es.mega_profiles_localized, 80);
  assert.equal(POKEMON_LOCALIZATION_COVERAGE.ja.mega_profiles_localized, 97);
  assert.equal(POKEMON_LOCALIZATION_COVERAGE.ko.mega_profiles_localized, 0);
  assert.deepEqual(localizedPokemonProfileName("charizard-mega-x", "fr"), {
    name: "Méga-Dracaufeu X",
    source: "localized-form",
    species: "charizard",
  });
  assert.deepEqual(localizedPokemonProfileName("charizard-mega-x", "es"), {
    name: "Mega-Charizard X",
    source: "official-pokemon",
    species: "charizard",
  });
  assert.deepEqual(localizedPokemonProfileName("charizard-mega-x", "it"), {
    name: "MegaCharizard X",
    source: "official-pokemon",
    species: "charizard",
  });
  assert.deepEqual(localizedPokemonProfileName("tatsugiri-curly-mega", "ja"), {
    name: "メガシャリタツ（そったすがた）",
    source: "official-pokemon",
    species: "tatsugiri",
  });
  assert.deepEqual(localizedPokemonProfileName("clefable-mega", "es"), {
    name: "Mega-Clefable",
    source: "official-pokemon",
    species: "clefable",
  });
  assert.equal(localizedPokemonProfileName("victreebel-mega", "es").source, "english-fallback");
  assert.equal(localizedPokemonProfileName("eelektross-mega", "it").source, "english-fallback");
});

test("official Mega name overrides retain first-party source evidence", () => {
  const catalog = JSON.parse(source("data/pokemon/pokemon-mega-official-names-2026-08-21.json"));
  assert.deepEqual(catalog.profile_source_revision_parts, ["5064f1d7", "2746b3a6", "a931616d", "ae3fb644", "5c556d4f"]);
  assert.equal(catalog.sources["official-mega-es"].url, "https://mega.pokemon.com/es-es/");
  assert.equal(catalog.sources["official-mega-it"].url, "https://mega.pokemon.com/it-it/");
  assert.equal(catalog.sources["official-mega-de"].url, "https://mega.pokemon.com/de-de/");
  assert.equal(catalog.sources["official-pokedex-ja"].homepage, "https://zukan.pokemon.co.jp/");
  assert.equal(catalog.sources["official-pokedex-es"].homepage, "https://www.pokemon.com/es/pokedex");
  assert.equal(catalog.sources["official-pokedex-it"].homepage, "https://www.pokemon.com/it/pokedex");
  assert.equal(Object.values(catalog.profiles).filter((entry) => entry.ja).length, 97);
  assert.equal(Object.values(catalog.profiles).filter((entry) => entry.it).length, 93);
  assert.equal(Object.values(catalog.profiles).filter((entry) => entry.es).length, 80);
  assert.equal(Object.values(catalog.profiles).filter((entry) => entry.de).length, 48);
});

test("localized Pokédex routes publish reciprocal metadata without translating stable slugs", () => {
  const expectedCodes = ["en", "it", "es", "fr", "de", "ja", "ko"];
  const metadata = pokemonIndexMetadata("fr");
  assert.equal(metadata.alternates.canonical, "/fr/pokemon");
  assert.deepEqual(Object.keys(metadata.alternates.languages), [...expectedCodes, "x-default"]);
  assert.equal(pokemonProfilePath("fr", "charizard"), "/fr/pokemon/charizard");
  assert.equal(pokemonProfileAlternates("charizard").fr, "/fr/pokemon/charizard");
  assert.equal(pokemonProfileAlternates("charizard").ja, "/ja/pokemon/charizard");

  for (const code of expectedCodes.filter((code) => code !== "en")) {
    const index = source(`src/app/${code}/pokemon/page.js`);
    const profile = source(`src/app/${code}/pokemon/[name]/page.js`);
    assert.match(index, new RegExp(`locale=["']${code}["']`));
    assert.match(profile, new RegExp(`locale=["']${code}["']`));
    assert.match(profile, new RegExp(`localizedPokemonPageMetadata\\(name, ["']${code}["']\\)`));
  }
});

test("core Pokédex resource names use the selected PokéAPI language", () => {
  const resource = { names: [
    { language: { name: "en" }, name: "Fire" },
    { language: { name: "fr" }, name: "Feu" },
    { language: { name: "ja-hrkt" }, name: "ほのお" },
  ] };
  assert.equal(localizedPokeApiName(resource, "fr"), "Feu");
  assert.equal(localizedPokeApiName(resource, "ja"), "ほのお");
  assert.equal(localizedPokeApiName(resource, "ko"), "Fire");
  assert.equal(localizedPokemonResourceName("types", "fire", "fr"), "Feu");
  assert.equal(localizedPokemonResourceName("abilities", "levitate", "es"), "Levitación");
  assert.equal(localizedPokemonResourceName("moves", "thunderbolt", "de"), "Donnerblitz");
  assert.equal(localizedPokemonResourceName("versions", "red", "ja"), "赤");
  assert.equal(localizedPokemonResource("moves", "thunderbolt", "ko").source, "localized");
  const battleTypes = ["bug", "dark", "dragon", "electric", "fairy", "fighting", "fire", "flying", "ghost", "grass", "ground", "ice", "normal", "poison", "psychic", "rock", "steel", "water"];
  for (const { code } of POKEDEX_LANGUAGES) {
    assert.equal(localizedPokemonResourceOptions("types", code, battleTypes).length, 18);
  }
});

test("the localized directory keeps stable filters while presenting official names", () => {
  const charizard = localizedPokemonSpecies("fr").find((entry) => entry.speciesSlug === "charizard");
  assert.deepEqual(charizard.typeSlugs, ["fire", "flying"]);
  assert.deepEqual(charizard.types, ["Feu", "Vol"]);
  assert.deepEqual(charizard.abilitySlugs, ["blaze", "solar-power"]);
  assert.deepEqual(charizard.abilities, ["Brasier", "Force Soleil"]);
  assert.ok(charizard.aliases.includes("Charizard"));
  assert.ok(charizard.aliases.includes("Dracaufeu"));

  const directory = source("src/components/LocalizedPokemonDirectory.jsx");
  assert.match(directory, /entry\[ALIASES\]/);
  assert.match(directory, /entry\[TYPE_SLUGS\]/);
  assert.match(directory, /entry\[ABILITY_SLUGS\]/);
  assert.match(directory, /localizedPath\(locale, entry\[PROFILE_SLUG\]\)/);
});

test("localized Pokédex interface terms follow official Spanish and French vocabulary", () => {
  const english = pokemonCopy("en");
  const spanish = pokemonCopy("es");
  const french = pokemonCopy("fr");
  assert.match(english.sourceBody, /PokéAPI and reviewed official Pokémon sources/);
  assert.equal(spanish.stats("Charizard"), "Puntos de base de Charizard");
  assert.equal(spanish.measurements("Charizard"), "Altura y peso de Charizard");
  assert.match(spanish.title("Charizard"), /puntos de base/);
  assert.equal(french.stats("Dracaufeu"), "Stats de base de Dracaufeu");
  assert.equal(french.measurements("Dracaufeu"), "Taille et poids de Dracaufeu");
  assert.match(french.title("Dracaufeu"), /stats de base et talents/);
  assert.equal(pokemonDirectoryCopy("fr").singular.pokemon, "1 Pokémon trouvé");
  assert.equal(pokemonDirectoryCopy("fr").singular.moves, "1 capacité");
});

test("every first-wave language implements the complete Pokédex copy contract", () => {
  const expectedKeys = Object.keys(pokemonCopy("en")).sort();
  for (const locale of ["it", "es", "fr", "de", "ja", "ko"]) {
    const copy = pokemonCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), expectedKeys, `${locale} copy keys`);
    for (const [key, value] of Object.entries(copy)) {
      if (typeof value === "string") {
        assert.ok(value.trim().length > 0, `${locale}.${key} is not empty`);
        assert.doesNotMatch(value, /\b(?:TODO|TBD|FIXME)\b/i, `${locale}.${key} has no placeholder`);
      }
    }
  }
});

test("localized release pages disclose translation beta status and accept corrections", () => {
  for (const locale of ["it", "es", "fr", "de", "ja", "ko"]) {
    const beta = pokemonCopy(locale).translationBeta;
    assert.ok(beta.title && beta.body && beta.action, `${locale} translation beta copy`);
  }
  const index = source("src/components/LocalizedPokemonIndexPage.jsx");
  const profile = source("src/components/LocalizedPokemonProfilePage.jsx");
  const worlds = source("src/components/WorldsPickSixteen.jsx");
  const frenchWorlds = source("src/app/fr/worlds/2026/page.js");
  assert.match(index, /translation-beta-note[\s\S]+href="\/support"/);
  assert.match(profile, /translation-beta-note[\s\S]+href="\/support"/);
  assert.match(worlds, /translationBeta[\s\S]+translation-beta-note[\s\S]+href="\/support"/);
  assert.match(frenchWorlds, /title: "Traduction bêta"[\s\S]+action: "Signaler une correction"/);
});

test("the first localized Pokédex phase is discoverable and keeps English analysis available", () => {
  const englishIndex = source("src/app/pokemon/page.js");
  const englishProfile = source("src/app/pokemon/[name]/page.js");
  const directory = source("src/components/PokemonDirectory.jsx");
  const index = source("src/components/LocalizedPokemonIndexPage.jsx");
  const profile = source("src/components/LocalizedPokemonProfilePage.jsx");
  const moves = source("src/components/LocalizedPokemonMoveList.jsx");
  const sitemap = source("src/app/sitemap.js");
  assert.match(englishIndex, /pokemonIndexMetadata\("en"\)/);
  assert.match(englishProfile, /pokemonProfileAlternates\(data\.pokemon\.name\)/);
  assert.match(englishProfile, /<PokemonLanguageSwitch locale="en" path=\{`\/pokemon\/\$\{pokemon\.name\}`\}/);
  assert.match(directory, /<PokemonLanguageSwitch locale="en" label="Language"/);
  assert.match(index, /localizedPokemonSpecies/);
  assert.match(index, /PokemonLanguageSwitch/);
  assert.match(index, /LocalizedPokemonDirectory/);
  assert.match(profile, /loadLocalizedPokemonPage/);
  assert.match(profile, /LocalizedPokemonMoveList/);
  assert.match(profile, /data\.entries/);
  assert.match(profile, /copy\.draftBody/);
  assert.match(profile, /href={`\/pokemon\/\$\{pokemon\.name\}`}/);
  assert.match(sitemap, /POKEDEX_LANGUAGES/);
  assert.match(sitemap, /pokemonProfilePath/);
  assert.match(sitemap, /localizedPokemonIndexRoutes/);
  assert.match(moves, /english-fallback/);
});

test("language controls and localized content expose keyboard and assistive-language semantics", () => {
  const switcher = source("src/components/PokemonLanguageSwitch.jsx");
  const documentLanguage = source("src/components/DocumentLanguage.jsx");
  const worlds = source("src/components/WorldsPickSixteen.jsx");
  const profile = source("src/components/LocalizedPokemonProfilePage.jsx");
  const index = source("src/components/LocalizedPokemonIndexPage.jsx");
  const css = source("src/app/globals.css");
  const nextConfig = source("next.config.mjs");

  assert.match(switcher, /<nav className="site-language-switch" aria-label=\{label\}>/);
  assert.match(switcher, /aria-current="page"/);
  assert.match(switcher, /hrefLang=\{language\.code\}/);
  assert.match(switcher, /lang=\{language\.documentLanguage\}/);
  assert.doesNotMatch(switcher, /onClick|role="button"/);
  assert.match(index, /<div lang=\{language\.documentLanguage\}>/);
  assert.match(profile, /<div lang=\{language\.documentLanguage\}>/);
  assert.match(index, /<DocumentLanguage language=\{language\.documentLanguage\}/);
  assert.match(profile, /<DocumentLanguage language=\{language\.documentLanguage\}/);
  assert.match(documentLanguage, /document\.documentElement\.lang = language/);
  assert.match(profile, /<img src=\{artwork\} alt=\{displayName\}/);
  assert.match(worlds, /aria-current="page" lang=\{details\.documentLanguage\}/);
  assert.match(worlds, /hrefLang=\{language\} lang=\{details\.documentLanguage\}/);
  assert.match(worlds, /<nav aria-label=\{copy\.guide\.title\}>/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]+\.site-language-switch/);
  assert.match(nextConfig, /source: "\/fr\/:path\*"[\s\S]+Content-Language", value: "fr-FR"/);
});
