import PokedexTrackerPage from "../../components/PokedexTrackerPage";
import "./pokedex-tracker.css";

export const metadata = {
  title: "Pokédex Tracker for Every Pokémon Game and HOME",
  description: "Track each Pokémon game and DLC Pokédex in its own numbered order, link progress to a National Dex, find Pokémon by game, and plan collection boxes.",
  alternates: { canonical: "/pokedex-tracker" },
  manifest: "/pokedex-tracker/manifest.webmanifest",
  keywords: ["Pokédex tracker", "Pokémon checklist", "shiny Pokédex tracker", "Pokémon HOME Pokédex tracker", "living dex tracker"],
  openGraph: {
    type: "website",
    title: "Pokédex Tracker for Every Pokémon Game and HOME",
    description: "Track game and DLC Pokédexes in their original numbering, link them to a National Dex, search locations, and organize collection boxes.",
    url: "/pokedex-tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokédex Tracker for Every Pokémon Game and HOME",
    description: "Track game and DLC Pokédexes in their original numbering, link them to a National Dex, search locations, and organize collection boxes.",
  },
};

const questions = [
  {
    question: "Which Pokémon games can I track?",
    answer: "DraftCenter offers a checklist for every supported main-series game. Games with multiple Pokédexes include separate regional or DLC sections, such as Paldea, Kitakami, and Blueberry.",
  },
  {
    question: "Can I track shiny Pokémon separately?",
    answer: "Yes. Every collection has an independent standard checklist, and you can add a shiny checklist at creation or later without changing standard progress.",
  },
  {
    question: "Can I save a Pokémon’s ball, ribbons, or notes?",
    answer: "Yes. Each standard or shiny entry can optionally record a supported Poké Ball, game-appropriate ribbons, and a private note. These details remain saved even if you later uncheck the catch.",
  },
  {
    question: "Can I record individual Pokémon and where they are stored?",
    answer: "Yes. Collection inventory stores private records for individual Pokémon, game saves, Pokémon HOME, cartridges, other locations, and box positions.",
  },
  {
    question: "Does game progress count toward my National Dex?",
    answer: "Yes. A Pokémon checked off in one of your game trackers also counts in your Pokémon HOME National Dex. You can still check Pokémon directly in the National Dex too.",
  },
  {
    question: "Is my Pokédex progress public?",
    answer: "No. Tracker names, entries, Poké Balls, ribbons, and notes are private account data. They are loaded and changed only through account-scoped database functions and are deleted with the account.",
  },
];

export default function PokedexTrackerRoute() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/pokedex-tracker#app",
        name: "DraftCenter Pokédex Tracker",
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript and a free DraftCenter account",
        isAccessibleForFree: true,
        url: "https://www.draftcentral.gg/pokedex-tracker",
        description: metadata.description,
        featureList: [
          "Multiple saved Pokédex collections",
          "Every verified main-series game catalog",
          "Pokémon HOME National Pokédex",
          "Independent standard and shiny checklists",
          "Optional Poké Ball, ribbon, and note details for every entry",
          "Private individual Pokémon and storage-location inventory",
          "Separate regional and DLC Pokédex sections with original game numbering",
          "Game progress linked to the Pokémon HOME National Dex",
          "Pokémon game and encounter search",
          "Game-aware collection box layouts in Pokédex order",
          "Spreadsheet imports and readable workbook or CSV downloads",
          "Search, completion filters, progress rings, and responsive galleries",
          "Private cross-device account saving",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: questions.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pokédex Tracker", item: "https://www.draftcentral.gg/pokedex-tracker" },
        ],
      },
    ],
  };

  return <div className="dex-tracker-route">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <PokedexTrackerPage />
    <section className="dex-tracker-seo" aria-labelledby="dex-tracker-guide-title">
      <span className="dex-kicker">HOW THE TRACKER WORKS</span>
      <h2 id="dex-tracker-guide-title">Track each game in the order it uses</h2>
      <p>Choose a game, open the regional or DLC dex you are working on, and check off Pokémon by their number in that dex. Your game progress can also fill the matching entries in a National Dex.</p>
      <div className="dex-tracker-seo-grid">
        <article>
          <h3>Game-specific Pokédex checklists</h3>
          <p>Each game uses its own Pokédex numbers. Scarlet and Violet include Paldea, Kitakami, and Blueberry; Sword and Shield include Galar, the Isle of Armor, and the Crown Tundra.</p>
        </article>
        <article>
          <h3>Independent shiny progress</h3>
          <p>Add a shiny checklist when you create a tracker or whenever a hunt begins. Standard and shiny catches are stored separately, so neither checklist can overwrite the other.</p>
        </article>
        <article>
          <h3>Search and boxes</h3>
          <p>Look up where a Pokémon appears in supported games, then use the box layout to arrange the selected dex in number order. Individual records can still hold private notes, storage locations, balls, and ribbons.</p>
        </article>
      </div>
      <section className="dex-tracker-faq" aria-labelledby="dex-tracker-faq-title">
        <h2 id="dex-tracker-faq-title">Pokédex Tracker questions</h2>
        {questions.map(({ question, answer }) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}
      </section>
      <aside className="dex-tracker-next-step">
        <h2>Looking for a specific Pokémon?</h2>
        <p>Use Find inside the tracker to check game locations and Pokédex numbers. DraftCenter’s public Pokédex also has species profiles, forms, types, abilities, stats, measurements, and move lists.</p>
        <div><a href="/pokemon">Explore the Pokédex</a><a href="/nuzlocke/guides">Browse Nuzlocke guides</a><a href="/#member-access">Create a free account</a></div>
      </aside>
    </section>
  </div>;
}
