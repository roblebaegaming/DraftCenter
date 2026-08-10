import { getPokemonProfilesForSpeciesTrait, pokemonColorLabel, pokemonEggGroupLabel } from "../lib/pokemonSpeciesTraits";
import { pokemonDisplayName } from "../lib/publicPokemonIndex";

const TRAIT_PAGE_CONFIG = {
  color: {
    hubPath: "/pokemon/colors",
    detailPath: "/pokemon/color",
    hubLabel: "colors",
    eyebrow: "POKÉMON COLOR INDEX",
    heading: (label) => `${label} Pokémon by Pokédex color`,
    summary: (label, count) => `Browse ${count} Pokémon profiles classified as ${label.toLowerCase()} in the Pokédex. Color is a broad species-level category and may not describe every marking or alternate appearance.`,
    optionSummary: () => "Pokédex color profiles",
    queryKey: "color",
  },
  shape: {
    hubPath: "/pokemon/shapes",
    detailPath: "/pokemon/shape",
    hubLabel: "shapes",
    eyebrow: "POKÉMON SHAPE INDEX",
    heading: (label) => `${label}-shape Pokémon`,
    summary: (label, count, option) => `Browse ${count} Pokémon profiles in the ${label.toLowerCase()} Pokédex shape category. ${option.description}`,
    optionSummary: (option) => option.description,
    queryKey: "shape",
  },
  "egg-group": {
    hubPath: "/pokemon/egg-groups",
    detailPath: "/pokemon/egg-group",
    hubLabel: "Egg Groups",
    eyebrow: "POKÉMON EGG GROUP INDEX",
    heading: (label) => `${label} Egg Group Pokémon`,
    summary: (label, count) => `Browse ${count} Pokémon profiles in the ${label} Egg Group. Pokémon can belong to one or two Egg Groups, so dual-group species appear in both relevant indexes.`,
    optionSummary: () => "Pokémon breeding category",
    queryKey: "eggGroup",
  },
};

function traitLabel(kind, option) {
  if (kind === "color") return pokemonColorLabel(option.id);
  if (kind === "egg-group") return pokemonEggGroupLabel(option.id);
  return option.label;
}

function TraitNavigation({ currentHub }) {
  const links = [
    ["/pokemon/a-z", "Browse A–Z"],
    ["/pokemon/types", "Types"],
    ["/pokemon/generations", "Generations"],
    ["/pokemon/colors", "Colors"],
    ["/pokemon/egg-groups", "Egg Groups"],
    ["/pokemon/shapes", "Shapes"],
  ];
  return <div className="public-page-nav">
    <a className="quiet-button" href="/pokemon">← Pokédex</a>
    {links.filter(([href]) => href !== currentHub).map(([href, label]) => <a className="quiet-button" href={href} key={href}>{label}</a>)}
  </div>;
}

export function PokemonTraitHub({ kind, options, title, introduction }) {
  const config = TRAIT_PAGE_CONFIG[kind];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: title, url: `https://www.draftcentral.gg${config.hubPath}`, description: introduction },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pokédex", item: "https://www.draftcentral.gg/pokemon" },
          { "@type": "ListItem", position: 3, name: title, item: `https://www.draftcentral.gg${config.hubPath}` },
        ],
      },
    ],
  };

  return <main className="explore-shell pokemon-index-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <header className="explore-hero">
      <TraitNavigation currentHub={config.hubPath} />
      <span className="eyebrow">DRAFTCENTER POKÉDEX</span>
      <h1>{title}</h1>
      <p>{introduction}</p>
    </header>
    <section className="explore-card">
      <div className="pokemon-index-hub-grid">{options.map((option) => <a href={`${config.detailPath}/${option.id}`} key={option.id}><strong>{traitLabel(kind, option)}</strong><span>{config.optionSummary(option)}</span></a>)}</div>
    </section>
    <section className="explore-card pokemon-trait-explainer">
      <h2>How these Pokédex categories work</h2>
      {kind === "color" && <p>Pokédex color is a broad classification assigned to a species. It is useful for discovery, but a Pokémon can have multiple visible colors and alternate appearances may look different.</p>}
      {kind === "shape" && <p>Pokédex shape groups species by a simplified body outline, such as quadruped, humanoid, wings, or tentacles. Forms of the same species share the species classification.</p>}
      {kind === "egg-group" && <p>Egg Groups are breeding categories. A species may belong to one group or two, while the Undiscovered category covers Pokémon that do not use ordinary Egg Group breeding rules.</p>}
      <p>Open a category to see matching profiles, then use the interactive Pokédex to combine it with type, generation, ability, and other filters.</p>
    </section>
  </main>;
}

export function PokemonTraitDetail({ kind, option }) {
  const config = TRAIT_PAGE_CONFIG[kind];
  const label = traitLabel(kind, option);
  const pokemon = getPokemonProfilesForSpeciesTrait(kind, option.id);
  const heading = config.heading(label);
  const summary = config.summary(label, pokemon.length, option);
  const canonical = `${config.detailPath}/${option.id}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: heading, url: `https://www.draftcentral.gg${canonical}`, description: summary, mainEntity: { "@type": "ItemList", numberOfItems: pokemon.length } },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pokédex", item: "https://www.draftcentral.gg/pokemon" },
          { "@type": "ListItem", position: 3, name: config.hubLabel, item: `https://www.draftcentral.gg${config.hubPath}` },
          { "@type": "ListItem", position: 4, name: label, item: `https://www.draftcentral.gg${canonical}` },
        ],
      },
    ],
  };

  return <main className="explore-shell pokemon-index-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <header className="explore-hero">
      <TraitNavigation currentHub={config.hubPath} />
      <span className="eyebrow">{config.eyebrow}</span>
      <h1>{heading}</h1>
      <p>{summary}</p>
      <div className="explore-actions"><a className="primary-button" href={`/pokemon?${config.queryKey}=${encodeURIComponent(option.id)}`}>Search {label} Pokémon in the Pokédex</a><a className="quiet-button" href={config.hubPath}>View all {config.hubLabel}</a></div>
    </header>
    <section className="explore-card">
      <h2>{label} Pokémon profiles</h2>
      <div className="pokemon-profile-link-grid">{pokemon.map((name) => <a href={`/pokemon/${name}`} key={name}>{pokemonDisplayName(name)}</a>)}</div>
    </section>
    <section className="explore-card pokemon-trait-explainer">
      <h2>Research this category</h2>
      <p>These links use species-level Pokédex classifications from the pinned PokéAPI catalog. Open a profile for base stats, abilities, measurements, forms, draft data, and competitive results.</p>
      <p>Use the interactive Pokédex to combine {label} with type, generation, another species trait, or an ability search.</p>
      <p>Category membership is a discovery aid, not a prediction of battle role or league value. Compare the complete profile and your league&apos;s regulation before choosing between species that share this trait.</p>
    </section>
  </main>;
}

export function pokemonTraitMetadata(kind, option) {
  const config = TRAIT_PAGE_CONFIG[kind];
  const label = traitLabel(kind, option);
  const count = getPokemonProfilesForSpeciesTrait(kind, option.id).length;
  const heading = config.heading(label);
  return {
    title: heading,
    description: config.summary(label, count, option),
    alternates: { canonical: `${config.detailPath}/${option.id}` },
    openGraph: {
      type: "website",
      title: `${heading} | DraftCenter`,
      description: config.summary(label, count, option),
      url: `${config.detailPath}/${option.id}`,
    },
  };
}
