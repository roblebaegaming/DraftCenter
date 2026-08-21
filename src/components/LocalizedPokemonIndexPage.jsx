import DocumentLanguage from "./DocumentLanguage";
import LocalizedPokemonDirectory from "./LocalizedPokemonDirectory";
import PokemonLanguageSwitch from "./PokemonLanguageSwitch";
import {
  localizedPokemonResourceOptions,
  localizedPokemonSpecies,
  pokemonCopy,
  pokemonDirectoryCopy,
  pokemonProfilePath,
} from "../lib/pokemonI18n";
import { siteLanguage } from "../lib/siteLanguages";

export default function LocalizedPokemonIndexPage({ locale }) {
  const language = siteLanguage(locale);
  const copy = pokemonCopy(language.code);
  const directoryCopy = pokemonDirectoryCopy(language.code);
  const pokemon = localizedPokemonSpecies(language.code);
  const typeOptions = localizedPokemonResourceOptions("types", language.code, pokemon.flatMap((entry) => entry.typeSlugs));
  const abilityOptions = localizedPokemonResourceOptions("abilities", language.code, pokemon.flatMap((entry) => entry.abilitySlugs));
  const directoryPokemon = pokemon.map((entry) => [
    entry.dexNumber,
    entry.profileSlug,
    entry.name,
    entry.aliases,
    entry.generation,
    entry.typeSlugs,
    entry.abilitySlugs,
  ]);
  const directoryLabels = {
    title: directoryCopy.title,
    body: directoryCopy.body,
    search: directoryCopy.search,
    searchPlaceholder: directoryCopy.searchPlaceholder,
    type: directoryCopy.type,
    allTypes: directoryCopy.allTypes,
    generation: directoryCopy.generation,
    allGenerations: directoryCopy.allGenerations,
    ability: directoryCopy.ability,
    allAbilities: directoryCopy.allAbilities,
    sort: directoryCopy.sort,
    sortName: directoryCopy.sortName,
    sortNumber: directoryCopy.sortNumber,
    matches: directoryCopy.matches("{count}"),
    matchesOne: directoryCopy.singular.pokemon,
    clear: directoryCopy.clear,
    empty: directoryCopy.empty,
    open: directoryCopy.open("{name}"),
    more: directoryCopy.more,
    generationPattern: copy.generation("{number}"),
    englishFallback: directoryCopy.englishFallback,
  };
  const generations = pokemon.reduce((groups, entry) => {
    (groups[entry.generation] ||= []).push(entry);
    return groups;
  }, {});
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.indexTitle,
    url: `https://www.draftcentral.gg${language.pathPrefix}/pokemon`,
    inLanguage: language.locale,
    description: copy.indexBody,
    mainEntity: { "@type": "ItemList", numberOfItems: pokemon.length },
  };

  return <div lang={language.documentLanguage}>
    <DocumentLanguage language={language.documentLanguage} />
    <main className="explore-shell pokemon-index-page localized-pokemon-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <PokemonLanguageSwitch locale={language.code} label={copy.language} />
      <aside className="translation-beta-note" aria-label={copy.translationBeta.title}>
        <div><strong>{copy.translationBeta.title}</strong><span>{copy.translationBeta.body}</span></div>
        <a href="/support">{copy.translationBeta.action}</a>
      </aside>
      <header className="explore-hero">
        <span className="eyebrow">DRAFTCENTER POKÉDEX</span>
        <h1>{copy.indexTitle}</h1>
        <p>{copy.indexBody}</p>
        <strong>{copy.species(pokemon.length)}</strong>
      </header>
      <LocalizedPokemonDirectory locale={language.code} languageLocale={language.locale} pokemon={directoryPokemon} typeOptions={typeOptions} abilityOptions={abilityOptions} labels={directoryLabels} />
      <header className="localized-pokemon-index-heading">
        <h2>{directoryCopy.allProfiles}</h2>
        <p>{directoryCopy.allProfilesBody}</p>
      </header>
      <div className="pokemon-index-sections">
        {Object.entries(generations).map(([generation, entries]) => <section className="explore-card" key={generation}>
          <h2>{copy.generation(generation)}</h2>
          <div className="pokemon-profile-link-grid">{entries.map((entry) => <a href={pokemonProfilePath(language.code, entry.profileSlug)} key={entry.speciesSlug}><span>#{String(entry.dexNumber).padStart(4, "0")}</span><strong>{entry.name}</strong></a>)}</div>
        </section>)}
      </div>
    </main>
  </div>;
}
