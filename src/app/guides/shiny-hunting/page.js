import {
  SHINY_HUNTING_GUIDES,
  SHINY_GUIDE_UPDATED_DATE,
} from "../../../lib/shinyHuntingGuides";

export const metadata = {
  title: "Pokémon Shiny Hunting Guides by Game",
  description: "Compare the best shiny hunting methods, odds, locations, setup, and game-specific warnings for every Pokémon game in DraftCenter's verified catalog.",
  alternates: { canonical: "/guides/shiny-hunting" },
  keywords: ["Pokémon shiny hunting guides", "best shiny hunting method", "shiny odds by game", "where to shiny hunt"],
  openGraph: {
    type: "website",
    title: "Pokémon Shiny Hunting Guides by Game",
    description: "Choose a Pokémon game and get its best shiny method, exact odds context, setup, locations, and common mistakes.",
    url: "/guides/shiny-hunting",
  },
};

const ROMAN_GENERATIONS = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
};

const guidesByGeneration = Object.entries(SHINY_HUNTING_GUIDES.reduce((groups, guide) => {
  const generation = String(guide.generation);
  return { ...groups, [generation]: [...(groups[generation] || []), guide] };
}, {}));

export default function ShinyHuntingGuidesPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: metadata.title,
        description: metadata.description,
        url: "https://www.draftcentral.gg/guides/shiny-hunting",
        dateModified: SHINY_GUIDE_UPDATED_DATE,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: SHINY_HUNTING_GUIDES.length,
          itemListElement: SHINY_HUNTING_GUIDES.map((guide, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: guide.title,
            url: "https://www.draftcentral.gg/guides/shiny-hunting/" + guide.slug,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Guides", item: "https://www.draftcentral.gg/guides" },
          { "@type": "ListItem", position: 3, name: "Shiny Hunting", item: "https://www.draftcentral.gg/guides/shiny-hunting" },
        ],
      },
    ],
  };

  return <main className="seo-article-shell nuzlocke-guides-directory">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <nav className="public-page-nav">
      <a className="quiet-button" href="/guides">← All Guides</a>
      <a className="quiet-button" href="/pokedex-tracker">Shiny Tracker</a>
      <a className="quiet-button" href="/pokemon">Pokédex</a>
    </nav>
    <article>
      <header>
        <span className="eyebrow">GAME-BY-GAME SHINY LIBRARY</span>
        <h1>Pokémon shiny hunting guides</h1>
        <p className="seo-article-intro">Pick a game to see the most efficient legitimate method, the odds that actually apply, where to set up, what can break the hunt, and good version-specific targets. The library follows the same 37 verified game catalogs used by DraftCenter's trackers.</p>
        <p className="guide-byline">{SHINY_HUNTING_GUIDES.length} game guides · Generations I–IX · Reviewed by the <a href="/about#editorial-standards">DraftCenter Editorial Team</a> · Updated August 15, 2026</p>
      </header>

      <aside className="guide-direct-answer">
        <span className="eyebrow">START WITH THE GAME</span>
        <h2>The best shiny method changes dramatically by generation</h2>
        <p>Red, Blue, and Yellow have no native shiny mechanic. Later games range from 1-in-8,192 full-odds hunts to Poké Radar chains, SOS battles, Ultra Wormholes, Dynamax Adventures, outbreaks, and Sparkling Power sandwiches. Open the exact version you are playing before choosing a route.</p>
        <a className="primary-button inline-link-button" href="/pokedex-tracker">Track a shiny Pokédex</a>
      </aside>

      {guidesByGeneration.map(([generation, guides]) => <section key={generation} aria-labelledby={"shiny-generation-" + generation}>
        <span className="eyebrow">GENERATION {ROMAN_GENERATIONS[generation]}</span>
        <h2 id={"shiny-generation-" + generation}>Generation {ROMAN_GENERATIONS[generation]} shiny hunting</h2>
        <div className="nuzlocke-guide-directory-grid">
          {guides.map((guide) => <a key={guide.slug} href={"/guides/shiny-hunting/" + guide.slug}>
            <strong>{guide.title}</strong>
            <span>{guide.methodTitle}</span>
            <small>{guide.baseOdds} · Best: {guide.bestOdds}</small>
          </a>)}
        </div>
      </section>)}

      <section>
        <h2>What every guide checks</h2>
        <div className="nuzlocke-guide-mechanics">
          <article><h3>Odds with context</h3><p>Base rates, Shiny Charm effects, method boosts, and the conditions required before a quoted rate is true.</p></article>
          <article><h3>A repeatable loop</h3><p>Setup and check-by-check instructions that stay within the game's ordinary mechanics.</p></article>
          <article><h3>Good hunting places</h3><p>Locations chosen for spawn density, safe chains, short reset cycles, or game-specific advantages.</p></article>
          <article><h3>Failure points</h3><p>Shiny locks, chain breakers, RNG traps, and commonly repeated advice that no longer works.</p></article>
        </div>
      </section>

      <aside className="seo-next-step">
        <h2>Plan and track the collection</h2>
        <p>Use the matching encounter guide to confirm where a species appears, research its profile, then keep standard and shiny completion separate in the private Pokédex Tracker.</p>
        <div className="pokemon-tags nuzlocke-guide-tags">
          <a href="/pokedex-tracker">Open the shiny Pokédex Tracker</a>
          <a href="/nuzlocke/guides">Browse encounter guides</a>
          <a href="/pokemon">Research Pokémon profiles</a>
          <a href="/about#editorial-standards">Read our editorial standards</a>
        </div>
      </aside>
    </article>
  </main>;
}
