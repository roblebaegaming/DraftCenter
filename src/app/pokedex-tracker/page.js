import PokedexTrackerPage from "../../components/PokedexTrackerPage";
import "./pokedex-tracker.css";

export const metadata = {
  title: "Pokédex Tracker for Every Pokémon Game and HOME",
  description: "Create private Pokédex checklists for every supported Pokémon game and Pokémon HOME, with separate standard and shiny progress saved to your account.",
  alternates: { canonical: "/pokedex-tracker" },
  keywords: ["Pokédex tracker", "Pokémon checklist", "shiny Pokédex tracker", "Pokémon HOME Pokédex tracker", "living dex tracker"],
  openGraph: {
    type: "website",
    title: "Pokédex Tracker for Every Pokémon Game and HOME",
    description: "Track standard and shiny Pokédex progress across every supported game and Pokémon HOME.",
    url: "/pokedex-tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokédex Tracker for Every Pokémon Game and HOME",
    description: "Track standard and shiny Pokédex progress across every supported game and Pokémon HOME.",
  },
};

const questions = [
  {
    question: "Which Pokémon games can I track?",
    answer: "DraftCenter offers a separate checklist for every verified main-series game catalog, plus one Pokémon HOME National Pokédex assembled from those reviewed catalogs.",
  },
  {
    question: "Can I track shiny Pokémon separately?",
    answer: "Yes. Every collection has an independent standard checklist, and you can add a shiny checklist at creation or later without changing standard progress.",
  },
  {
    question: "Is my Pokédex progress public?",
    answer: "No. Tracker names and entries are private account data. They are loaded and changed only through account-scoped database functions and are deleted with the account.",
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
      <h2 id="dex-tracker-guide-title">One private checklist for every Pokédex journey</h2>
      <p>Choose any supported game or build a Pokémon HOME National Pokédex, then mark each species as registered. Create separate collections for different saves or living-dex projects, search by name or Pokédex number, and filter the gallery to registered or missing Pokémon.</p>
      <div className="dex-tracker-seo-grid">
        <article>
          <h3>Game-specific Pokédex checklists</h3>
          <p>Each game tracker comes from DraftCenter’s verified catalog for that exact version. Pokémon HOME uses the canonical National Pokédex species found across the complete verified catalog set.</p>
        </article>
        <article>
          <h3>Independent shiny progress</h3>
          <p>Add a shiny checklist when you create a tracker or whenever a hunt begins. Standard and shiny catches are stored separately, so neither checklist can overwrite the other.</p>
        </article>
        <article>
          <h3>Private account persistence</h3>
          <p>Progress saves automatically to your DraftCenter account and stays separate from leagues, drafts, Trainer Dex discoveries, and Nuzlocke runs. No personal tracker is published as a search page.</p>
        </article>
      </div>
      <section className="dex-tracker-faq" aria-labelledby="dex-tracker-faq-title">
        <h2 id="dex-tracker-faq-title">Pokédex Tracker questions</h2>
        {questions.map(({ question, answer }) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}
      </section>
      <aside className="dex-tracker-next-step">
        <h2>Research before you check it off</h2>
        <p>Use DraftCenter’s public Pokédex for species profiles, forms, types, abilities, stats, measurements, and versioned move pools. Nuzlocke guides remain a separate route-by-route encounter tool.</p>
        <div><a href="/pokemon">Explore the Pokédex</a><a href="/nuzlocke/guides">Browse Nuzlocke guides</a><a href="/#member-access">Create a free account</a></div>
      </aside>
    </section>
  </div>;
}
