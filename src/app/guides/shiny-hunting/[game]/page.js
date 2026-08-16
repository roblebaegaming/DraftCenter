import { notFound } from "next/navigation";
import ShinyGuideGameSelect from "../../../../components/ShinyGuideGameSelect";
import {
  getShinyHuntingGuide,
  SHINY_HUNTING_GUIDES,
  SHINY_GUIDE_PUBLISHED_DATE,
  SHINY_GUIDE_UPDATED_DATE,
} from "../../../../lib/shinyHuntingGuides";

function displayDate(date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T00:00:00.000Z"));
}

export function generateStaticParams() {
  return SHINY_HUNTING_GUIDES.map(({ slug }) => ({ game: slug }));
}

export async function generateMetadata({ params }) {
  const { game } = await params;
  const guide = getShinyHuntingGuide(game);
  if (!guide) return { title: "Shiny Hunting Guide Not Found", robots: { index: false, follow: true } };
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: "/guides/shiny-hunting/" + guide.slug },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: "/guides/shiny-hunting/" + guide.slug,
      publishedTime: SHINY_GUIDE_PUBLISHED_DATE,
      modifiedTime: SHINY_GUIDE_UPDATED_DATE,
    },
  };
}

export default async function ShinyHuntingGameGuidePage({ params }) {
  const { game } = await params;
  const guide = getShinyHuntingGuide(game);
  if (!guide) notFound();
  const relatedGuides = SHINY_HUNTING_GUIDES
    .filter((item) => item.slug !== guide.slug && item.methodFamily === guide.methodFamily)
    .slice(0, 4);
  const pageUrl = "https://www.draftcentral.gg/guides/shiny-hunting/" + guide.slug;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: SHINY_GUIDE_PUBLISHED_DATE,
        dateModified: SHINY_GUIDE_UPDATED_DATE,
        author: { "@type": "Organization", name: "DraftCenter Editorial Team", url: "https://www.draftcentral.gg/about#editorial-standards" },
        publisher: { "@id": "https://www.draftcentral.gg/#organization" },
        mainEntityOfPage: pageUrl,
        about: [guide.displayName, "Shiny Pokémon"],
      },
      {
        "@type": "HowTo",
        name: "How to shiny hunt in " + guide.displayName,
        description: guide.shortAnswer,
        step: guide.steps.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: "Step " + (index + 1),
          text: step,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Shiny Hunting Guides", item: "https://www.draftcentral.gg/guides/shiny-hunting" },
          { "@type": "ListItem", position: 3, name: guide.displayName, item: pageUrl },
        ],
      },
    ],
  };

  return <main className="seo-article-shell nuzlocke-game-guide">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <nav className="public-page-nav">
      <a className="quiet-button" href="/guides/shiny-hunting">← Shiny Hunting Guides</a>
      <a className="quiet-button" href="/pokedex-tracker">Shiny Tracker</a>
      <a className="quiet-button" href={"/nuzlocke/" + guide.slug}>Encounter Guide</a>
    </nav>
    <article>
      <header>
        <span className="eyebrow">GAME-SPECIFIC SHINY GUIDE</span>
        <h1>{guide.title}</h1>
        <p className="seo-article-intro">{guide.description}</p>
        <p className="guide-byline">Written and reviewed by the <a href="/about#editorial-standards">DraftCenter Editorial Team</a> · Generation {guide.generation} · Published {displayDate(SHINY_GUIDE_PUBLISHED_DATE)} · Updated {displayDate(SHINY_GUIDE_UPDATED_DATE)}</p>
        <ShinyGuideGameSelect games={SHINY_HUNTING_GUIDES.map(({ slug, displayName }) => ({ slug, displayName }))} currentSlug={guide.slug} />
      </header>

      <aside className="guide-direct-answer">
        <span className="eyebrow">BEST METHOD</span>
        <h2>{guide.methodTitle}</h2>
        <p>{guide.shortAnswer}</p>
      </aside>

      <section>
        <h2>{guide.displayName} shiny odds at a glance</h2>
        <div className="nuzlocke-guide-metrics shiny-guide-metrics">
          <article><strong>{guide.nativeShinies ? "Yes" : "No"}</strong><span>native shinies</span></article>
          <article><strong>{guide.baseOdds}</strong><span>base rate</span></article>
          <article><strong>{guide.charmOdds}</strong><span>Shiny Charm</span></article>
          <article><strong>{guide.bestOdds}</strong><span>best listed rate</span></article>
        </div>
        <p>Quoted rates apply only under the conditions named here. A better rate changes the probability of each check; it never guarantees a shiny after a fixed number of encounters.</p>
      </section>

      <section>
        <span className="eyebrow">PREPARE THE HUNT</span>
        <h2>Setup for the recommended method</h2>
        <div className="guide-launch-checklist"><ul>{guide.setup.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </section>

      <section>
        <h2>How to shiny hunt in {guide.displayName}</h2>
        <div className="nuzlocke-guide-mechanics">
          {guide.steps.map((step, index) => <article key={step}><h3>{index + 1}. {index === 0 ? "Start the loop" : index === guide.steps.length - 1 ? "Finish safely" : "Create the next check"}</h3><p>{step}</p></article>)}
        </div>
      </section>

      <section>
        <h2>Best places to shiny hunt</h2>
        <div className="nuzlocke-guide-mechanics">
          {guide.locations.map((location) => <article key={location.name}><h3>{location.name}</h3><p>{location.why}</p></article>)}
        </div>
      </section>

      <section>
        <h2>Best {guide.displayName} targets</h2>
        <p>{guide.versionFocus}</p>
        <div className="pokemon-tags nuzlocke-guide-tags">
          {guide.targets.map((target) => <a key={target.name} href={"/pokemon/" + target.profileSlug}>{target.name}</a>)}
        </div>
      </section>

      <section>
        <h2>Other methods worth using</h2>
        <div className="nuzlocke-guide-mechanics">
          {guide.alternatives.map((method) => <article key={method.title}><h3>{method.title}</h3><p>{method.description}</p></article>)}
        </div>
      </section>

      <section>
        <span className="eyebrow">DO NOT LOSE THE HUNT</span>
        <h2>Common mistakes and game-specific warnings</h2>
        <div className="guide-launch-checklist"><ul>{guide.cautions.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </section>

      <section className="guide-source-note">
        <h2>Sources and review notes</h2>
        <p>DraftCenter compares mechanics references and avoids presenting rounded community shorthand as a guarantee. Game updates, language versions, downloadable content, and shiny locks can change which method applies. See our <a href="/about#editorial-standards">editorial standards</a> or report a correction there.</p>
        <div className="pokemon-tags nuzlocke-guide-tags">
          {guide.sources.map(([label, href]) => <a key={href} href={href} target="_blank" rel="noreferrer">{label} ↗</a>)}
        </div>
      </section>

      <aside className="guide-direct-answer nuzlocke-guide-cta">
        <span className="eyebrow">TRACK THE RESULT</span>
        <h2>Build a private shiny checklist</h2>
        <p>DraftCenter's Pokédex Tracker keeps standard and shiny progress separate for each supported game and Pokémon HOME.</p>
        <a className="primary-button inline-link-button" href="/pokedex-tracker">Open the Pokédex Tracker</a>
      </aside>

      <aside className="seo-next-step">
        <h2>Continue researching {guide.displayName}</h2>
        <div className="pokemon-tags nuzlocke-guide-tags">
          <a href={"/nuzlocke/" + guide.slug}>{guide.displayName} encounter guide</a>
          <a href="/guides/shiny-hunting">All shiny hunting guides</a>
          <a href="/pokemon">Explore the Pokédex</a>
          {relatedGuides.map((item) => <a key={item.slug} href={"/guides/shiny-hunting/" + item.slug}>{item.displayName} guide</a>)}
        </div>
      </aside>
    </article>
  </main>;
}
