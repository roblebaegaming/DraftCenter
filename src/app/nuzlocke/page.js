import NuzlockeLab from "../../components/NuzlockeLab";

export const metadata = {
  title: "Pokémon Nuzlocke Team Generator by Game",
  description: "Build, save, and download a repeatable Pokémon Nuzlocke Draft with one Pokémon per route or area, game-specific rules, themes, and verified encounter odds.",
  alternates: { canonical: "/nuzlocke" },
  keywords: ["Pokémon Nuzlocke generator", "Nuzlocke encounter generator", "one Pokémon per area", "themed Nuzlocke", "Nuzlocke randomizer seed"],
  openGraph: {
    type: "website",
    title: "Pokémon Nuzlocke Team Generator by Game",
    description: "Generate a repeatable Nuzlocke team from verified, game-specific encounter data.",
    url: "/nuzlocke",
  },
};

export default function NuzlockePage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "DraftCenter Pokémon Nuzlocke Generator",
        url: "https://www.draftcentral.gg/nuzlocke",
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        description: "A repeatable Nuzlocke team generator using verified, game-specific Pokémon encounters.",
        featureList: ["Game-specific encounters", "Saved teams and downloadable Run Cards", "Shareable repeatable runs", "One Pokémon per eligible route or area", "Type, color, and evolution-stage themes", "Route-first and encounter-pool random modes", "Species clause"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Nuzlocke Draft", item: "https://www.draftcentral.gg/nuzlocke" },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <NuzlockeLab />
    <section className="explore-card nuzlocke-seo-guide" aria-labelledby="nuzlocke-guide-title">
      <span className="eyebrow">HOW IT WORKS</span>
      <h2 id="nuzlocke-guide-title">A repeatable Nuzlocke encounter generator</h2>
      <p>Choose a verified Pokémon game, name your run, and keep its randomizer seed to reproduce the same encounters. Select a team size of up to 20 or draft one Pokémon from every eligible route or area, then save its setup and generated team in your browser, download a readable Run Card, or share its exact rules by link.</p>
      <div className="pokemon-detail-grid">
        <section>
          <h3>Use game-specific encounter data</h3>
          <p>Nuzlocke teams are built only from catalogs that DraftCenter has independently reviewed. Results keep the encounter area, method, level range, conditions, and form together instead of treating every Pokémon in a regional Pokédex as a route encounter.</p>
        </section>
        <section>
          <h3>Set your Nuzlocke clauses</h3>
          <p>Include a starter, apply an evolutionary-family clause, filter methods and game-specific conditions, or build a themed run by Pokémon type, official Pokédex color, or evolution stage. Equal weighting gives every eligible encounter the same chance; authentic weighting uses the reviewed in-game rates.</p>
        </section>
      </div>
      <aside className="seo-next-step">
        <h2>Research your Nuzlocke team</h2>
        <p>Every generated Pokémon links to its DraftCenter profile for typing, abilities, base stats, forms, measurements, and versioned moves.</p>
        <div className="pokemon-tags"><a href="/pokemon">Explore the Pokédex</a><a href="/pokemon/generations">Browse Pokémon by generation</a><a href="/resources">Open Pokémon resources</a></div>
      </aside>
      <section className="nuzlocke-guide-index" aria-labelledby="nuzlocke-game-guides-title">
        <span className="eyebrow">GAME-SPECIFIC GUIDES</span>
        <h2 id="nuzlocke-game-guides-title">Research every route before you draft</h2>
        <p>Browse the complete Nuzlocke guide library by generation and game. Each guide lists every reviewed route or area, then shows each Pokémon with its encounter method and level range in one compact list.</p>
        <a className="primary-button inline-link-button" href="/nuzlocke/guides">Browse all Nuzlocke guides</a>
      </section>
    </section>
  </>;
}
