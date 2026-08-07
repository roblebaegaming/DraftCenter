import { notFound } from "next/navigation";
import guideCatalog from "../../../lib/nuzlockeGameGuides.json";

const guidesBySlug = Object.fromEntries(guideCatalog.games.map((guide) => [guide.slug, guide]));
const METHOD_LABELS = {
  "colosseum-bonus-disc-jpn": "Colosseum Bonus Disc (Japan)",
  "devon-scope": "Devon Scope",
  "feebas-tile-fishing": "Feebas tile fishing",
  "gift-egg": "Gift Egg",
  "gimmighoul-chest": "Gimmighoul Chest",
  "good-rod": "Good Rod",
  "in-game-trade": "In-game trade",
  "league-club-trade": "League Club trade",
  "legendary-snack": "Legendary snack",
  "npc-trade": "NPC trade",
  "old-rod": "Old Rod",
  "pokemon-ranger": "Pokémon Ranger",
  pokeflute: "Poké Flute",
  "super-rod": "Super Rod",
  "tera-raid": "Tera Raid",
  "event-tera-raid": "Event Tera Raid",
};

function titleCase(value) {
  return String(value).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function methodLabel(method) {
  return METHOD_LABELS[method] || titleCase(method);
}

export function generateStaticParams() {
  return guideCatalog.games.map(({ slug }) => ({ game: slug }));
}

export async function generateMetadata({ params }) {
  const { game } = await params;
  const guide = guidesBySlug[game];
  if (!guide) return { title: "Nuzlocke Guide Not Found", robots: { index: false, follow: true } };
  const title = `${guide.displayName} Nuzlocke Guide`;
  return {
    title,
    description: guide.description,
    alternates: { canonical: `/nuzlocke/${guide.slug}` },
    openGraph: { type: "article", title, description: guide.description, url: `/nuzlocke/${guide.slug}` },
  };
}

export default async function NuzlockeGameGuidePage({ params }) {
  const { game } = await params;
  const guide = guidesBySlug[game];
  if (!guide) notFound();
  const relatedGuides = guideCatalog.games.filter((item) => item.slug !== guide.slug);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: `${guide.displayName} Nuzlocke Guide`,
        description: guide.description,
        datePublished: guideCatalog.publishedDate,
        dateModified: guideCatalog.publishedDate,
        author: { "@type": "Organization", name: "DraftCenter Editorial Team", url: "https://www.draftcentral.gg/about#editorial-standards" },
        publisher: { "@id": "https://www.draftcentral.gg/#organization" },
        mainEntityOfPage: `https://www.draftcentral.gg/nuzlocke/${guide.slug}`,
        about: { "@type": "VideoGame", name: guide.displayName },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Nuzlocke Lab", item: "https://www.draftcentral.gg/nuzlocke" },
          { "@type": "ListItem", position: 3, name: `${guide.displayName} guide`, item: `https://www.draftcentral.gg/nuzlocke/${guide.slug}` },
        ],
      },
    ],
  };

  return <main className="seo-article-shell nuzlocke-game-guide">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <nav className="public-page-nav"><a className="quiet-button" href="/nuzlocke">← Nuzlocke Lab</a><a className="quiet-button" href="/pokemon">Pokédex</a><a className="quiet-button" href="/resources">Resources</a></nav>
    <article>
      <header><span className="eyebrow">REVIEWED GAME ENCOUNTER GUIDE</span><h1>{guide.displayName} Nuzlocke guide</h1><p className="seo-article-intro">{guide.description}</p><p className="guide-byline">Catalog reviewed by the <a href="/about#editorial-standards">DraftCenter Editorial Team</a> · Generation {guide.generation} · {guide.family}</p></header>
      <section aria-labelledby="catalog-coverage"><h2 id="catalog-coverage">What the reviewed catalog covers</h2><div className="nuzlocke-guide-metrics"><article><strong>{guide.counts.encounters.toLocaleString("en-US")}</strong><span>encounter rows</span></article><article><strong>{guide.counts.locations.toLocaleString("en-US")}</strong><span>encounter areas</span></article><article><strong>{guide.counts.methods}</strong><span>encounter methods</span></article><article><strong>{guide.starters.length}</strong><span>supported starters</span></article></div><p>Encounter rows keep area, method, level range, chance, form, and special conditions together. They are source records, not a count of unique Pokémon or a promise that every row is available under one set of run rules.</p></section>
      <section aria-labelledby="starter-options"><h2 id="starter-options">Supported {guide.displayName} starters</h2><p>Starter inclusion is optional. When it is on, the randomizer seed deterministically selects one eligible starter and counts it as one team slot, or as an extra result in one-per-area mode.</p><div className="pokemon-tags nuzlocke-guide-tags">{guide.starters.map((starter) => <a key={starter.pokemonId} href={`/pokemon/${starter.profileSlug}`}>{starter.name}</a>)}</div></section>
      <section aria-labelledby="game-conditions"><h2 id="game-conditions">Game-specific encounter controls</h2><p>These controls come directly from the reviewed {guide.displayName} catalog. A selected setting limits eligible source records; it does not rewrite the encounter data.</p><div className="nuzlocke-guide-mechanics">{guide.conditions.map((condition) => <article key={condition.id}><h3>{condition.label}</h3><p>{condition.options.join(" · ")}</p></article>)}</div></section>
      <section aria-labelledby="representative-areas"><h2 id="representative-areas">Representative encounter areas</h2><p>The full generator uses all {guide.counts.locations.toLocaleString("en-US")} reviewed areas. These examples show the mix of routes and special locations present in the catalog.</p><ul className="nuzlocke-guide-area-list">{guide.areas.map((area) => <li key={area.areaKey}>{area.label}</li>)}</ul></section>
      <section aria-labelledby="encounter-methods"><h2 id="encounter-methods">Supported encounter methods</h2><p>The {guide.counts.methods} catalog methods can be used as exact generator filters:</p><div className="pokemon-tags nuzlocke-guide-tags">{guide.methods.map((method) => <span key={method}>{methodLabel(method)}</span>)}</div></section>
      <section aria-labelledby="supported-clauses"><h2 id="supported-clauses">Clauses and team rules supported by DraftCenter</h2><div className="guide-launch-checklist"><ul><li>Build a compact team or request one encounter from every eligible area.</li><li>Include or omit a starter and keep one Pokémon from each evolutionary family.</li><li>Exclude legendary Pokémon or named species before the run is selected.</li><li>Choose route-first or encounter-pool selection with equal or authentic in-game weighting.</li><li>Filter a themed run by type, official Pokédex color, or evolution stage.</li><li>Show a catch as a seeded final evolution available in the same game while preserving its original encounter details.</li></ul></div></section>
      <aside className="guide-direct-answer nuzlocke-guide-cta"><span className="eyebrow">READY TO BUILD</span><h2>Open a preconfigured {guide.displayName} run</h2><p>This link preloads a six-slot, route-first, equal-weight run with starter inclusion, the family clause, and legendary exclusion. Its randomizer seed makes the setup repeatable; you can name it, save the generated team, or download its Run Card.</p><a className="primary-button inline-link-button" href={guide.generatorHref}>Build a {guide.displayName} run</a></aside>
      <aside className="seo-next-step"><h2>Continue your Nuzlocke research</h2><div className="pokemon-tags nuzlocke-guide-tags"><a href="/nuzlocke">Open the full Nuzlocke Lab</a><a href="/pokemon">Research Pokémon profiles</a>{relatedGuides.map((item) => <a key={item.slug} href={`/nuzlocke/${item.slug}`}>{item.displayName} guide</a>)}</div></aside>
    </article>
  </main>;
}
