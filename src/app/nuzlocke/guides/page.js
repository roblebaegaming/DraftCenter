import guideCatalog from "../../../lib/nuzlockeGameGuides.json";

export const metadata = {
  title: "Pokémon Nuzlocke Guides by Game",
  description: "Browse complete route-by-route Pokémon Nuzlocke encounter guides for every supported main-series game, with Pokémon, encounter methods, levels, and game-specific rules.",
  alternates: { canonical: "/nuzlocke/guides" },
  keywords: ["Pokémon Nuzlocke guides", "Nuzlocke route encounters", "Pokémon encounter guide", "Nuzlocke encounters by game"],
  openGraph: {
    type: "website",
    title: "Pokémon Nuzlocke Guides by Game",
    description: "Choose a game and explore every reviewed Nuzlocke route, encounter, method, and level.",
    url: "/nuzlocke/guides",
  },
};

const guidesByGeneration = Object.entries(guideCatalog.games.reduce((groups, game) => {
  const generation = String(game.generation);
  return { ...groups, [generation]: [...(groups[generation] || []), game] };
}, {}));

export default function NuzlockeGuidesPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Pokémon Nuzlocke Guides by Game",
        description: metadata.description,
        url: "https://www.draftcentral.gg/nuzlocke/guides",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: guideCatalog.games.length,
          itemListElement: guideCatalog.games.map((game, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `${game.displayName} Nuzlocke Guide`,
            url: `https://www.draftcentral.gg/nuzlocke/${game.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Nuzlocke Guides", item: "https://www.draftcentral.gg/nuzlocke/guides" },
        ],
      },
    ],
  };

  return <main className="seo-article-shell nuzlocke-guides-directory">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <nav className="public-page-nav">
      <a className="quiet-button" href="/nuzlocke">← Nuzlocke Draft</a>
      <a className="quiet-button" href="/pokemon">Pokédex</a>
      <a className="quiet-button" href="/resources">Resources</a>
    </nav>
    <article>
      <header>
        <span className="eyebrow">GAME-SPECIFIC ENCOUNTER LIBRARY</span>
        <h1>Pokémon Nuzlocke Guides</h1>
        <p className="seo-article-intro">Choose a main-series game to plan your run with a complete, reviewed route-by-route encounter guide. Open any route once to see every available Pokémon, its encounter method, and its level range.</p>
        <p className="guide-byline">{guideCatalog.games.length} game guides · Generations I–IX · Reviewed by the <a href="/about#editorial-standards">DraftCenter Editorial Team</a></p>
      </header>

      <aside className="guide-direct-answer">
        <span className="eyebrow">HOW TO USE THESE GUIDES</span>
        <h2>Find the route, compare every encounter, then build your run</h2>
        <p>Each guide keeps encounters tied to the correct game, route or area, method, level range, conditions, and form. After researching a game, open the Nuzlocke Draft to generate a compact team or one Pokémon for every eligible route.</p>
        <a className="primary-button inline-link-button" href="/nuzlocke">Build a Nuzlocke Draft</a>
      </aside>

      {guidesByGeneration.map(([generation, games]) => <section key={generation} aria-labelledby={`nuzlocke-generation-${generation}`}>
        <span className="eyebrow">GENERATION {generation}</span>
        <h2 id={`nuzlocke-generation-${generation}`}>{games.map((game) => game.family).filter((family, index, families) => families.indexOf(family) === index).join(" and ")}</h2>
        <div className="nuzlocke-guide-directory-grid">{games.map((game) => <a key={game.slug} href={`/nuzlocke/${game.slug}`}>
          <strong>{game.displayName} Nuzlocke guide</strong>
          <span>{game.counts.locations} routes and areas · {game.counts.pokemon} Pokémon and forms</span>
          <small>{game.counts.methods} encounter methods</small>
        </a>)}</div>
      </section>)}

      <aside className="seo-next-step">
        <h2>More Nuzlocke planning tools</h2>
        <p>Generate a repeatable run, research a Pokémon’s typing and moves, or review how DraftCenter sources its encounter catalogs.</p>
        <div className="pokemon-tags nuzlocke-guide-tags"><a href="/nuzlocke">Open the Nuzlocke Draft</a><a href="/pokemon">Explore the Pokédex</a><a href="/about#data-methodology">Read the data methodology</a></div>
      </aside>
    </article>
  </main>;
}
