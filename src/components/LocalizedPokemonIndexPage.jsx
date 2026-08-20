import DocumentLanguage from "./DocumentLanguage";
import PokemonLanguageSwitch from "./PokemonLanguageSwitch";
import { localizedPokemonSpecies, pokemonCopy, pokemonProfilePath } from "../lib/pokemonI18n";
import { siteLanguage } from "../lib/siteLanguages";

export default function LocalizedPokemonIndexPage({ locale }) {
  const language = siteLanguage(locale);
  const copy = pokemonCopy(language.code);
  const pokemon = localizedPokemonSpecies(language.code);
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
      <header className="explore-hero">
        <span className="eyebrow">DRAFTCENTER POKÉDEX</span>
        <h1>{copy.indexTitle}</h1>
        <p>{copy.indexBody}</p>
        <strong>{copy.species(pokemon.length)}</strong>
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
