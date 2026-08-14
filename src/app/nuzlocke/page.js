import NuzlockeLab from "../../components/NuzlockeLab";

export const metadata = {
  title: "Pokémon Nuzlocke Run Tracker and Team Generator",
  description: "Build and track a Pokémon Nuzlocke run with verified encounters by game, named-location statuses, species-clause warnings, milestones, level caps, notes, and private saves.",
  alternates: { canonical: "/nuzlocke" },
  keywords: ["Pokémon Nuzlocke tracker", "Nuzlocke run tracker", "Pokémon Nuzlocke generator", "Nuzlocke encounter tracker", "Nuzlocke team builder"],
  openGraph: {
    type: "website",
    title: "Pokémon Nuzlocke Run Tracker and Team Generator",
    description: "Build a location-by-location Nuzlocke run, then track catches, losses, milestones, and notes.",
    url: "/nuzlocke",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokémon Nuzlocke Run Tracker and Team Generator",
    description: "Build a location-by-location Nuzlocke run, then track catches, losses, milestones, and notes.",
  },
};

export default function NuzlockePage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://www.draftcentral.gg/nuzlocke#page",
        name: "DraftCenter Pokémon Nuzlocke Run Tracker",
        url: "https://www.draftcentral.gg/nuzlocke",
        isAccessibleForFree: true,
        description: "A Nuzlocke run tracker and team generator using verified, game-specific Pokémon encounters.",
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Nuzlocke Run Tracker", item: "https://www.draftcentral.gg/nuzlocke" },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <NuzlockeLab />
    <section className="explore-card nuzlocke-seo-guide" aria-labelledby="nuzlocke-guide-title">
      <span className="eyebrow">HOW IT WORKS</span>
      <h2 id="nuzlocke-guide-title">A game-specific Nuzlocke run tracker</h2>
      <p>Choose a verified Pokémon game and build a run from its reviewed encounters. Track each named location as caught, active, boxed, missed, or deceased; floors and subareas share one slot while keeping their exact encounter details. Add nicknames, notes, badges, bosses, and optional level caps, then save the full tracker privately in My Teams or download a progress card.</p>
      <div className="pokemon-detail-grid">
        <section>
          <h3>Use game-specific encounter data</h3>
          <p>Nuzlocke teams are built only from catalogs that DraftCenter has independently reviewed. Results keep the encounter area, method, level range, conditions, and form together instead of treating every Pokémon in a regional Pokédex as a route encounter.</p>
        </section>
        <section>
          <h3>Track your rules and progress</h3>
          <p>Automatic species-family checks flag duplicate caught families while missed encounters remain available under common dupes-clause play. Add only the milestones and level caps your rules use. Browser autosave keeps recent progress on this device, while signed-in saves remain private and available across devices.</p>
        </section>
      </div>
      <aside className="seo-next-step">
        <h2>Research and recreate your run</h2>
        <p>Every generated Pokémon links to its DraftCenter profile for typing, abilities, base stats, forms, measurements, and versioned moves. Recreation links repeat the generated location plan without exposing private tracker progress.</p>
        <div className="pokemon-tags"><a href="/pokemon">Explore the Pokédex</a><a href="/pokemon/generations">Browse Pokémon by generation</a><a href="/resources">Open Pokémon resources</a></div>
      </aside>
      <section className="nuzlocke-guide-index" aria-labelledby="nuzlocke-game-guides-title">
        <span className="eyebrow">GAME-SPECIFIC GUIDES</span>
        <h2 id="nuzlocke-game-guides-title">Research every route before you draft</h2>
        <p>Browse the complete Nuzlocke guide library by generation and game. Each guide lists every reviewed route or area, then shows each Pokémon with its encounter method and level range in one compact list.</p>
        <div className="pokemon-tags"><a href="/nuzlocke/fire-red">Pokémon FireRed guide</a><a href="/nuzlocke/platinum">Pokémon Platinum guide</a><a href="/nuzlocke/legends-arceus">Pokémon Legends: Arceus guide</a><a href="/nuzlocke/scarlet">Pokémon Scarlet guide</a></div>
        <a className="primary-button inline-link-button" href="/nuzlocke/guides">Browse all Nuzlocke guides</a>
      </section>
    </section>
  </>;
}
