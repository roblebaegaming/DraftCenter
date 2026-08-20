import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  POKEDEX_LANGUAGES,
  POKEMON_LOCALIZATION_COVERAGE,
  localizedPokeApiName,
  localizedPokemonProfileName,
  localizedPokemonSpecies,
  pokemonIndexMetadata,
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
  for (const code of ["it", "es", "ja", "ko"]) {
    assert.equal(POKEMON_LOCALIZATION_COVERAGE[code].mega_profiles_localized, 0);
  }
  assert.deepEqual(localizedPokemonProfileName("charizard-mega-x", "fr"), {
    name: "Méga-Dracaufeu X",
    source: "localized-form",
    species: "charizard",
  });
  assert.equal(localizedPokemonProfileName("charizard-mega-x", "es").source, "english-fallback");
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
});

test("the first localized Pokédex phase is discoverable and keeps English analysis available", () => {
  const englishIndex = source("src/app/pokemon/page.js");
  const englishProfile = source("src/app/pokemon/[name]/page.js");
  const directory = source("src/components/PokemonDirectory.jsx");
  const index = source("src/components/LocalizedPokemonIndexPage.jsx");
  const profile = source("src/components/LocalizedPokemonProfilePage.jsx");
  const sitemap = source("src/app/sitemap.js");
  assert.match(englishIndex, /pokemonIndexMetadata\("en"\)/);
  assert.match(englishProfile, /pokemonProfileAlternates\(data\.pokemon\.name\)/);
  assert.match(englishProfile, /<PokemonLanguageSwitch locale="en" path=\{`\/pokemon\/\$\{pokemon\.name\}`\}/);
  assert.match(directory, /<PokemonLanguageSwitch locale="en" label="Language"/);
  assert.match(index, /localizedPokemonSpecies/);
  assert.match(index, /PokemonLanguageSwitch/);
  assert.match(profile, /loadLocalizedPokemonPage/);
  assert.match(profile, /copy\.draftBody/);
  assert.match(profile, /href={`\/pokemon\/\$\{pokemon\.name\}`}/);
  assert.match(sitemap, /POKEDEX_LANGUAGES/);
  assert.match(sitemap, /pokemonProfilePath/);
  assert.match(sitemap, /localizedPokemonIndexRoutes/);
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
