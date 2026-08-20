import { POKEDEX_LANGUAGES } from "../lib/pokemonI18n";
import { localizedSitePath } from "../lib/siteLanguages";

export default function PokemonLanguageSwitch({ locale = "en", path = "/pokemon", label = "Language" }) {
  return <nav className="site-language-switch" aria-label={label}>
    <span>{label}</span>
    <div>{POKEDEX_LANGUAGES.map((language) => language.code === locale
      ? <strong aria-current="page" lang={language.documentLanguage} key={language.code}>{language.nativeLabel}</strong>
      : <a href={localizedSitePath(language.code, path)} hrefLang={language.code} lang={language.documentLanguage} key={language.code}>{language.nativeLabel}</a>)}</div>
  </nav>;
}
