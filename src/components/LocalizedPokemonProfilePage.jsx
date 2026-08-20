import { notFound, permanentRedirect } from "next/navigation";
import DocumentLanguage from "./DocumentLanguage";
import PokemonLanguageSwitch from "./PokemonLanguageSwitch";
import { loadLocalizedPokemonPage } from "../lib/localizedPokemonPage";
import { pokemonCopy, pokemonIndexPath, pokemonProfilePath, pokemonStatLabel } from "../lib/pokemonI18n";
import { pokemonRouteSlug } from "../lib/publicPokemonIndex";
import { siteLanguage } from "../lib/siteLanguages";

function formatHeight(decimeters, locale) {
  const meters = Number(decimeters || 0) / 10;
  const totalInches = Math.round(meters * 39.3701);
  const metric = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters);
  return `${metric} m (${Math.floor(totalInches / 12)} ft ${totalInches % 12} in)`;
}
function formatWeight(hectograms, locale) {
  const kilograms = Number(hectograms || 0) / 10;
  const pounds = kilograms * 2.20462;
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return `${formatter.format(kilograms)} kg (${formatter.format(pounds)} lb)`;
}

export default async function LocalizedPokemonProfilePage({ locale, name }) {
  const language = siteLanguage(locale);
  const copy = pokemonCopy(language.code);
  const data = await loadLocalizedPokemonPage(name, language.code);
  if (!data) notFound();
  if (pokemonRouteSlug(name) !== data.pokemon.name) permanentRedirect(pokemonProfilePath(language.code, data.pokemon.name));

  const { pokemon, displayName } = data;
  const artwork = pokemon.sprites?.other?.["official-artwork"]?.front_default || pokemon.sprites?.front_default;
  const baseStatTotal = pokemon.stats.reduce((total, { base_stat }) => total + base_stat, 0);
  const canonicalPath = pokemonProfilePath(language.code, pokemon.name);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: copy.title(displayName), url: `https://www.draftcentral.gg${canonicalPath}`, inLanguage: language.locale, description: copy.description(displayName, data.types.join(" / ")), primaryImageOfPage: artwork ? { "@type": "ImageObject", url: artwork } : undefined },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
        { "@type": "ListItem", position: 2, name: copy.indexTitle, item: `https://www.draftcentral.gg${pokemonIndexPath(language.code)}` },
        { "@type": "ListItem", position: 3, name: displayName, item: `https://www.draftcentral.gg${canonicalPath}` },
      ] },
    ],
  };

  return <div lang={language.documentLanguage}>
    <DocumentLanguage language={language.documentLanguage} />
    <main className="explore-shell localized-pokemon-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <PokemonLanguageSwitch locale={language.code} path={`/pokemon/${pokemon.name}`} label={copy.language} />
      <aside className="translation-beta-note" aria-label={copy.translationBeta.title}>
        <div><strong>{copy.translationBeta.title}</strong><span>{copy.translationBeta.body}</span></div>
        <a href="/support">{copy.translationBeta.action}</a>
      </aside>
      <header className="explore-hero">
        <div className="public-page-nav"><a className="quiet-button" href={pokemonIndexPath(language.code)}>{copy.back}</a><a className="quiet-button" href={`/pokemon/${pokemon.name}`}>{copy.englishProfile}</a></div>
        <span className="eyebrow">DRAFTCENTER POKÉDEX · #{String(pokemon.id).padStart(4, "0")}</span>
        <h1>{displayName}</h1>
        <p>{data.genus} · {copy.generation(data.generation)}</p>
        {data.nameSource === "english-fallback" && <p className="pokemon-translation-note">{copy.fallbackForm}</p>}
      </header>
      <section className="explore-card pokemon-seo-profile">
        <div className="pokemon-title">
          {artwork && <img src={artwork} alt={displayName} />}
          <div>
            <h2>{data.types.join(" / ")}</h2>
            <p>{data.entry || copy.fallbackEntry(displayName)}</p>
            <h3>{copy.abilities}</h3>
            <div className="pokemon-tags">{data.abilities.map((ability) => <span key={`${ability.name}-${ability.isHidden}`}>{ability.name}{ability.isHidden ? ` (${copy.hidden})` : ""}</span>)}</div>
          </div>
        </div>
      </section>
      <section className="explore-card">
        <h2>{copy.stats(displayName)}</h2>
        <div className="pokemon-stats">{pokemon.stats.map(({ base_stat, stat }) => <div key={stat.name}><span>{pokemonStatLabel(stat.name, language.code)}</span><strong>{base_stat}</strong></div>)}<div className="pokemon-bst-total"><span>{copy.total}</span><strong>{baseStatTotal}</strong></div></div>
      </section>
      <section className="explore-card">
        <h2>{copy.measurements(displayName)}</h2>
        <div className="career-record-grid pokemon-measurements">
          <article><strong>{formatHeight(pokemon.height, language.locale)}</strong><span>{copy.height}</span></article>
          <article><strong>{formatWeight(pokemon.weight, language.locale)}</strong><span>{copy.weight}</span></article>
          <article><strong>#{String(pokemon.id).padStart(4, "0")}</strong><span>{copy.nationalDex}</span></article>
          <article><strong>{copy.generation(data.generation)}</strong><span>{copy.introduced}</span></article>
        </div>
      </section>
      <section className="explore-card">
        <h2>{copy.draftTitle}</h2>
        <p>{copy.draftBody}</p>
        <a className="primary-button inline-link-button" href={`/pokemon/${pokemon.name}`}>{copy.openEnglish}</a>
      </section>
      <section className="explore-card pokemon-profile-sources">
        <h2>{copy.sources}</h2>
        <p>{copy.sourceBody}</p>
        <p><a href="https://pokeapi.co/" rel="noreferrer">PokéAPI</a> · <code>{"5064f1d72746b3a6a931616dae3fb6445c556d4f"}</code></p>
      </section>
    </main>
  </div>;
}
