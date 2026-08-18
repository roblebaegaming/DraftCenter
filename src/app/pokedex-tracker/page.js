import PokedexTrackerPage from "../../components/PokedexTrackerPage";
import "./pokedex-tracker.css";

export const metadata = {
  title: "Pokédex Tracker for Every Pokémon Game, GO and HOME",
  description: "Track numbered and postgame Pokémon game Pokédexes, Pokémon GO and HOME, then search private collections by form, type, Ball, ribbon, mark, game or save.",
  alternates: { canonical: "/pokedex-tracker" },
  manifest: "/pokedex-tracker/manifest.webmanifest",
  keywords: ["Pokédex tracker", "Pokémon checklist", "shiny Pokédex tracker", "Pokémon GO tracker", "Pokémon HOME Pokédex tracker", "living dex tracker", "Pokémon mark tracker"],
  openGraph: {
    type: "website",
    title: "Pokédex Tracker for Every Pokémon Game, GO and HOME",
    description: "Track numbered and postgame game Pokédexes, GO and HOME, forms, marks, Alphas, hunt targets, and private collection searches.",
    url: "/pokedex-tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokédex Tracker for Every Pokémon Game, GO and HOME",
    description: "Track numbered and postgame game Pokédexes, GO and HOME, forms, marks, Alphas, hunt targets, and private collection searches.",
  },
};

const questions = [
  {
    question: "Which Pokémon games can I track?",
    answer: "DraftCenter offers checklists for every supported main-series game, Pokémon GO, and Pokémon HOME. Official regional or DLC numbering stays intact, while verified postgame encounters outside those sections appear under Other obtainable.",
  },
  {
    question: "Can I track shiny Pokémon separately?",
    answer: "Yes. Every collection has an independent standard checklist, and you can add a shiny checklist at creation or later without changing standard progress.",
  },
  {
    question: "Can I save a Pokémon’s form, Ball, ribbons, marks, or notes?",
    answer: "Yes. Checklist details and individual records can store forms or patterns, a supported Poké Ball, game-appropriate ribbons, marks, Alpha status, and private notes.",
  },
  {
    question: "Can I record individual Pokémon and where they are stored?",
    answer: "Yes. Collection inventory stores private records for individual Pokémon, game saves, Pokémon HOME, cartridges, other locations, and box positions. You can search the whole collection by Pokémon, form, type, game, save, Ball, ribbon, mark, or Alpha status.",
  },
  {
    question: "Can I keep a list of Pokémon I am looking for?",
    answer: "Yes. Private hunt targets can specify a form, pattern, shiny, mark, notes, or an eligible Alpha Pokémon without changing whether that species is already registered.",
  },
  {
    question: "Does game progress count toward my National Dex?",
    answer: "Yes. A Pokémon checked off in one of your game trackers also counts in your Pokémon HOME National Dex. You can still check Pokémon directly in the National Dex too.",
  },
  {
    question: "Is my Pokédex progress public?",
    answer: "No. Tracker names, entries, individual Pokémon, hunt targets, Poké Balls, ribbons, marks, and notes are private account data. They are loaded and changed only through account-scoped database functions and are deleted with the account.",
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
          "Pokémon GO availability checklist",
          "Pokémon HOME National Pokédex",
          "Independent standard and shiny checklists",
          "Verified postgame encounters outside official numbered sections",
          "Persistent collectible forms and patterns",
          "Optional Poké Ball, ribbon, mark, Alpha, and note details",
          "Private hunt targets for forms, shinies, marks, and Alphas",
          "Private individual Pokémon and storage-location inventory",
          "Separate regional and DLC Pokédex sections with original game numbering",
          "Game progress linked to the Pokémon HOME National Dex",
          "Pokémon game and encounter search",
          "Game-aware collection box layouts in Pokédex order",
          "Collection-wide search by species, type, game, save, Ball, ribbon, mark, or Alpha status",
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
      <p>Choose a game, Pokémon GO, or HOME, then check off Pokémon in the official numbered order. Verified postgame species outside that numbered Pokédex have their own Other obtainable section, and game progress can also fill matching National Dex entries.</p>
      <div className="dex-tracker-seo-grid">
        <article>
          <h3>Game-specific Pokédex checklists</h3>
          <p>Each official regional or DLC section keeps its own Pokédex numbers. Directly obtainable postgame species that are not numbered there remain visible separately with their National Dex number.</p>
        </article>
        <article>
          <h3>Independent shiny progress</h3>
          <p>Add a shiny checklist when you create a tracker or whenever a hunt begins. Standard and shiny catches are stored separately, so neither checklist can overwrite the other.</p>
        </article>
        <article>
          <h3>Search, hunts, and forms</h3>
          <p>Search the whole private collection by species, type, game, save, Ball, ribbon, mark, or Alpha status. Individual records and hunt targets can also name forms and patterns such as Vivillon or Furfrou.</p>
        </article>
      </div>
      <section className="dex-tracker-faq" aria-labelledby="dex-tracker-faq-title">
        <h2 id="dex-tracker-faq-title">Pokédex Tracker questions</h2>
        {questions.map(({ question, answer }) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}
      </section>
      <aside className="dex-tracker-next-step">
        <h2>Looking for a specific Pokémon?</h2>
        <p>Use Find for game locations, or save a private Looking for target with a form, shiny, mark, or eligible Alpha requirement. DraftCenter’s public Pokédex also has species profiles, types, abilities, stats, measurements, and move lists.</p>
        <div><a href="/pokemon">Explore the Pokédex</a><a href="/nuzlocke/guides">Browse Nuzlocke guides</a><a href="/#member-access">Create a free account</a></div>
      </aside>
    </section>
  </div>;
}
