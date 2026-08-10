import { notFound } from "next/navigation";
import NuzlockeGuideAreaBrowser from "../../../components/NuzlockeGuideAreaBrowser";
import NuzlockeGuideGameSelect from "../../../components/NuzlockeGuideGameSelect";
import guideCatalog from "../../../lib/nuzlockeGameGuides.json";
import { summarizeNuzlockeGuideArea } from "../../../lib/nuzlockeGuidePresentation";

const guidesBySlug = Object.fromEntries(guideCatalog.games.map((guide) => [guide.slug, guide]));
const METHOD_LABELS = {
  "gift-egg": "Gift Egg",
  "good-rod": "Good Rod",
  "in-game-trade": "In-game trade",
  "old-rod": "Old Rod",
  "super-rod": "Super Rod",
  pokeflute: "Poké Flute",
  "tera-raid": "Tera Raid",
  "event-tera-raid": "Event Tera Raid",
  "pokemon-ranger": "Pokémon Ranger",
};
const titleCase = (value) => String(value).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const methodLabel = (method) => METHOD_LABELS[method] || titleCase(method);

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
  const relatedGuides = guideCatalog.games.filter((item) => item.slug !== guide.slug && item.family === guide.family);
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
        about: guide.displayName,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Nuzlocke Guides", item: "https://www.draftcentral.gg/nuzlocke/guides" },
          { "@type": "ListItem", position: 3, name: `${guide.displayName} guide`, item: `https://www.draftcentral.gg/nuzlocke/${guide.slug}` },
        ],
      },
    ],
  };

  return <main className="seo-article-shell nuzlocke-game-guide">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <nav className="public-page-nav">
      <a className="quiet-button" href="/nuzlocke/guides">← Nuzlocke Guides</a>
      <a className="quiet-button" href="/nuzlocke">Nuzlocke Draft</a>
      <a className="quiet-button" href="/pokemon">Pokédex</a>
    </nav>
    <article>
      <header>
        <span className="eyebrow">ROUTE-BY-ROUTE ENCOUNTER GUIDE</span>
        <h1>{guide.displayName} Nuzlocke guide</h1>
        <p className="seo-article-intro">{guide.description}</p>
        <p className="guide-byline">Catalog reviewed by the <a href="/about#editorial-standards">DraftCenter Editorial Team</a> · Generation {guide.generation} · {guide.family}</p>
        <NuzlockeGuideGameSelect games={guideCatalog.games.map(({ slug, displayName }) => ({ slug, displayName }))} currentSlug={guide.slug} />
      </header>

      <section>
        <h2>What you can plan with this guide</h2>
        <div className="nuzlocke-guide-metrics">
          <article><strong>{guide.counts.locations}</strong><span>catch areas</span></article>
          <article><strong>{guide.counts.pokemon}</strong><span>Pokémon and forms</span></article>
          <article><strong>{guide.counts.methods}</strong><span>ways to find them</span></article>
          <article><strong>{guide.starters.length}</strong><span>starter choices</span></article>
        </div>
        <p>Open any route or area below to see every reviewed Pokémon available there. Each encounter shows its method beside the Pokémon name, so walking, fishing, surfing, gifts, raids, and other options are easy to compare in one list.</p>
      </section>

      <section>
        <h2>Supported {guide.displayName} starters</h2>
        <p>Starter inclusion is optional in the generator. When enabled, the seed chooses one of these starters repeatably.</p>
        <div className="pokemon-tags nuzlocke-guide-tags">{guide.starters.map((starter) => <a key={starter.pokemonId} href={`/pokemon/${starter.profileSlug}`}>{starter.name}</a>)}</div>
      </section>

      {guide.conditions.length > 0 && <section>
        <h2>Choices that change your encounters</h2>
        <p>Time, story progress, special features, and other game rules can change what is eligible. The generator uses these player-facing choices:</p>
        <div className="nuzlocke-guide-mechanics">{guide.conditions.map((condition) => <article key={condition.id}><h3>{condition.label}</h3><p>{condition.options.join(" · ")}</p></article>)}</div>
      </section>}

      <section>
        <h2>Ways to find Pokémon</h2>
        <p>These encounter methods appear beside Pokémon names in the route lists below.</p>
        <div className="pokemon-tags nuzlocke-guide-tags">{guide.methods.map((method) => <span key={method}>{methodLabel(method)}</span>)}</div>
      </section>

      <section>
        <h2>All {guide.displayName} encounter areas</h2>
        <p>Each route or area is one possible Nuzlocke catch location. The page shows representative Pokémon and every available method immediately; open an area to load its complete reviewed encounter pool.</p>
        <NuzlockeGuideAreaBrowser gameSlug={guide.slug} areas={guide.areas.map((area) => summarizeNuzlockeGuideArea(area))} />
      </section>

      <section>
        <h2>Clauses and team rules</h2>
        <div className="guide-launch-checklist"><ul><li>Build a compact team or request one encounter from every eligible area.</li><li>Include a starter, keep one Pokémon per evolutionary family, or exclude legendary Pokémon.</li><li>Choose route-first or encounter-pool selection with equal or authentic in-game weighting.</li><li>Filter a themed run by type, Pokédex color, or evolution stage.</li></ul></div>
      </section>

      <aside className="guide-direct-answer nuzlocke-guide-cta">
        <span className="eyebrow">READY TO BUILD</span>
        <h2>Open a preconfigured {guide.displayName} run</h2>
        <p>Start with a repeatable six-slot setup, then adjust any rule using the guide above.</p>
        <form className="nuzlocke-guide-launch-form" action="/nuzlocke" method="get">
          <input type="hidden" name="game" value={guide.gameKey} />
          <input type="hidden" name="seed" value={`${guide.slug}-guide`} />
          <input type="hidden" name="size" value="6" />
          <input type="hidden" name="mode" value="route-random" />
          <input type="hidden" name="weighting" value="equal" />
          <input type="hidden" name="starter" value="include" />
          <button className="primary-button" type="submit">Build a {guide.displayName} run</button>
        </form>
      </aside>

      <aside className="seo-next-step">
        <h2>Continue your Nuzlocke research</h2>
        <div className="pokemon-tags nuzlocke-guide-tags">
          <a href="/nuzlocke/guides">Browse all Nuzlocke guides</a>
          <a href="/nuzlocke">Open the Nuzlocke Draft</a>
          <a href="/pokemon">Research Pokémon profiles</a>
          {relatedGuides.map((item) => <a key={item.slug} href={`/nuzlocke/${item.slug}`}>{item.displayName} guide</a>)}
        </div>
      </aside>
    </article>
  </main>;
}
