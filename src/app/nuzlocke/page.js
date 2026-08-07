import NuzlockeLab from "../../components/NuzlockeLab";
import nuzlockeGameGuides from "../../lib/nuzlockeGameGuides.json";

export const metadata = {
  title: "Pokémon Nuzlocke Team Generator by Game",
  description: "Build a repeatable Pokémon Nuzlocke team from verified encounters by game, route, method, level, and encounter odds, then share the same rules and result.",
  alternates: { canonical: "/nuzlocke" },
  keywords: ["Pokémon Nuzlocke generator", "Nuzlocke encounter generator", "Pokémon random team generator", "Nuzlocke team code"],
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
        featureList: ["Game-specific encounters", "Shareable Team code results", "Route-first and encounter-pool random modes", "Species clause", "Encounter-method filters"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Nuzlocke Lab", item: "https://www.draftcentral.gg/nuzlocke" },
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
      <p>Choose a verified Pokémon game, a team size, and a Team code. Route-first random gives each eligible location equal priority, while encounter-pool random draws across every eligible encounter entry. Anyone opening a shared team link can use the same setup and reproduce the same team.</p>
      <div className="pokemon-detail-grid">
        <section>
          <h3>Use game-specific encounter data</h3>
          <p>Nuzlocke teams are built only from catalogs that DraftCenter has independently reviewed. Results keep the encounter area, method, level range, conditions, and form together instead of treating every Pokémon in a regional Pokédex as a route encounter.</p>
        </section>
        <section>
          <h3>Set your Nuzlocke clauses</h3>
          <p>Include a starter, apply an evolutionary-family clause, exclude legendary Pokémon or named species, filter encounter methods, and choose equal selection or authentic encounter-odds weighting. If the rules leave too few choices, the generator says so instead of silently relaxing them.</p>
        </section>
      </div>
      <aside className="seo-next-step">
        <h2>Research your Nuzlocke team</h2>
        <p>Every generated Pokémon links to its DraftCenter profile for typing, abilities, base stats, forms, measurements, and versioned moves.</p>
        <div className="pokemon-tags"><a href="/pokemon">Explore the Pokédex</a><a href="/pokemon/generations">Browse Pokémon by generation</a><a href="/resources">Open Pokémon resources</a></div>
      </aside>
      <section className="nuzlocke-guide-index" aria-labelledby="nuzlocke-game-guides-title">
        <span className="eyebrow">GAME-SPECIFIC GUIDES</span>
        <h2 id="nuzlocke-game-guides-title">Start with a reviewed encounter catalog</h2>
        <p>The first four guides publish exact catalog totals, starters, encounter controls, representative areas, and a preconfigured link back into the generator.</p>
        <div>{nuzlockeGameGuides.games.map((game) => <a key={game.slug} href={`/nuzlocke/${game.slug}`}><strong>{game.displayName} Nuzlocke guide</strong><span>{game.counts.locations} areas · {game.counts.methods} methods</span></a>)}</div>
      </section>
    </section>
  </>;
}
