export const metadata = {
  title: "About DraftCenter and Our Data",
  description: "What DraftCenter is, how its Pokémon draft-league data is calculated, which sources it uses, and how its guides are maintained.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    title: "About DraftCenter and Our Data",
    description: "DraftCenter's purpose, public data methodology, sources, privacy safeguards, and editorial standards.",
    url: "/about",
  },
};

const REVIEWED_DATE = "August 4, 2026";

export default function AboutPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": "https://www.draftcentral.gg/about#page",
    url: "https://www.draftcentral.gg/about",
    name: "About DraftCenter and Our Data",
    description: "DraftCenter's purpose, public data methodology, sources, privacy safeguards, and editorial standards.",
    dateModified: "2026-08-04",
    mainEntity: { "@id": "https://www.draftcentral.gg/#organization" },
    publisher: { "@id": "https://www.draftcentral.gg/#organization" },
  };

  return <main className="seo-article-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/guides">Guides</a><a className="quiet-button" href="/pokemon">Pokédex</a></nav>
    <article>
      <header>
        <span className="eyebrow">ABOUT DRAFTCENTER</span>
        <h1>Pokémon draft leagues, organized in one place.</h1>
        <p className="seo-article-intro">DraftCenter is an independent community platform for creating and running Pokémon draft leagues. Commissioners can configure a league and its draft, while coaches can manage teams, schedule matches, report results, make transactions, and preserve a season archive.</p>
        <p className="guide-byline">Maintained by the DraftCenter product and editorial team · Last reviewed {REVIEWED_DATE}</p>
      </header>

      <aside className="guide-direct-answer">
        <span className="eyebrow">IN SHORT</span>
        <h2>What is DraftCenter?</h2>
        <p>DraftCenter is a free-to-explore Pokémon draft-league manager, public Pokédex, format library, and educational resource. It combines practical league tools with clearly labeled community aggregates so coaches and commissioners can research without treating a small sample as a universal ranking.</p>
      </aside>

      <section>
        <h2>What DraftCenter helps people do</h2>
        <p>Public visitors can browse Pokémon profiles, supported formats, practical guides, public leagues, standings, schedules, and community trends. Signed-in league members can use role-based tools for drafting, team management, transactions, match reporting, playoffs, communication, and recovery. Private team and league information remains separate from public editorial pages.</p>
      </section>

      <section id="data-methodology">
        <h2>Pokédex and community-data methodology</h2>
        <p>Core Pokémon facts, official-style artwork references, measurements, abilities, forms, and battle statistics are retrieved from <a href="https://pokeapi.co/" rel="noreferrer">PokéAPI</a> and refreshed daily. DraftCenter's regulation catalogs determine the actual legal pools used by leagues; public profile pages never replace the saved league rules.</p>
        <p>Community draft rate and average draft position use eligible completed draft pools, including undrafted eligible Pokémon where the displayed definition requires it. Auction averages use completed auction samples. Team win rate uses confirmed match results. Every public percentage is paired with its sample size, and small samples are presented as early evidence rather than proof that a Pokémon caused an outcome.</p>
      </section>

      <section>
        <h2>Privacy and exclusions</h2>
        <p>Public community statistics are aggregate measurements. DraftCenter does not publish private queues, private team notes, account credentials, private league messages, support diagnostics, or personally identifying account records as part of its research pages. Public-league and public-profile information is shown only through the permissions and publication choices supported by the product.</p>
      </section>

      <section id="editorial-standards">
        <h2>Editorial standards and corrections</h2>
        <p>DraftCenter guides are written and reviewed against the product's current workflows. They aim to answer a real coach or commissioner question, distinguish software behavior from league judgment, and link to the relevant feature where useful. Material guide changes receive an updated date. Sources, date ranges, eligible formats, exclusions, and sample sizes accompany original data studies.</p>
        <p>If a guide, format description, Pokémon form, or data explanation appears inaccurate, use <a href="/support">Support DraftCenter</a> to report the exact page and correction. Product and legality changes are validated before release through the repository's protected checks.</p>
      </section>

      <section>
        <h2>Independent fan project</h2>
        <p>DraftCenter is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company. Pokémon names, characters, artwork, and trademarks belong to their respective owners.</p>
      </section>

      <aside className="seo-next-step">
        <h2>Explore the public reference library</h2>
        <div className="pokemon-tags"><a href="/guides">Practical guides</a><a href="/formats">Supported formats</a><a href="/pokemon">Pokémon profiles</a><a href="/leagues">Public leagues</a></div>
      </aside>
    </article>
  </main>;
}
