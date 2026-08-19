export const metadata = {
  title: "About DraftCenter and Our Data",
  description: "What DraftCenter is, how it connects complete Pokémon draft league seasons, how its public data is calculated, and how private workflows stay private.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    title: "About DraftCenter and Our Data",
    description: "DraftCenter's complete-season purpose, public data methodology, privacy safeguards, sources, and editorial standards.",
    url: "/about",
  },
};

const REVIEWED_DATE = "August 18, 2026";

export default function AboutPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": "https://www.draftcentral.gg/about#page",
    url: "https://www.draftcentral.gg/about",
    name: "About DraftCenter and Our Data",
    description: "DraftCenter's complete-season purpose, public data methodology, privacy safeguards, sources, and editorial standards.",
    dateModified: "2026-08-18",
    mainEntity: { "@id": "https://www.draftcentral.gg/#organization" },
    publisher: { "@id": "https://www.draftcentral.gg/#organization" },
  };

  return <main className="seo-article-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/guides">Guides</a><a className="quiet-button" href="/pokemon">Pokédex</a></nav>
    <article>
      <header>
        <span className="eyebrow">ABOUT DRAFTCENTER</span>
        <h1>Complete Pokémon draft league seasons, organized in one place.</h1>
        <p className="seo-article-intro">DraftCenter is an independent Pokémon draft-league manager and public reference library. Commissioners can set up, import, draft, schedule, operate, and preserve a season while managers use the same league record for rosters, preparation, results, standings, transactions, and playoffs.</p>
        <p className="guide-byline">Maintained by the DraftCenter product and editorial team · Last reviewed {REVIEWED_DATE}</p>
      </header>

      <aside className="guide-direct-answer">
        <span className="eyebrow">IN SHORT</span>
        <h2>What is DraftCenter?</h2>
        <p>DraftCenter is a free-to-explore Pokémon draft-league manager, public Pokédex, format library, and educational resource. Its primary job is to keep one complete season connected from setup through champion while clearly separating public research from private league and preparation work.</p>
      </aside>

      <section>
        <h2>What DraftCenter helps people do</h2>
        <p>Public visitors can browse Pokémon profiles, supported formats, practical guides, public leagues, standings, schedules, and community trends. Commissioners can start with recommended settings and a five-step launch checklist, move a bounded CSV or XLSX league setup through a preview-and-confirm import, and follow one private next action for each active league.</p>
        <p>Signed-in league members can use role-based tools for drafting, team management, transactions, match reporting, playoffs, communication, preparation, and recovery. For an eligible scheduled matchup, a participating manager can analyze one to five exact public Pokémon Showdown replay URLs, map the players to the scheduled teams, review the supported facts in the normal result editor, and choose whether to save. A replay analysis never writes a league result by itself.</p>
      </section>

      <section id="data-methodology">
        <h2>Pokédex and community-data methodology</h2>
        <p>Core Pokémon facts, official-style artwork references, measurements, abilities, forms, and battle statistics are retrieved from <a href="https://pokeapi.co/" rel="noreferrer">PokéAPI</a> and refreshed daily. DraftCenter's regulation catalogs determine the actual legal pools used by leagues; public profile pages never replace the saved league rules.</p>
        <p>Pokémon Champions Battle Room suggestions keep ladder and open-tournament evidence separate. Current ranked suggestions are provided by the attributed <a href="https://championsbattledata.com/" rel="noreferrer">Pokémon Champions Battle Data</a> source. Tournament suggestions come from an anonymous, pinned aggregate of complete public open team sheets from reviewed <a href="https://play.limitlesstcg.com/" rel="noreferrer">Limitless</a> events. Saved and revealed facts always remain first, and a ranked fallback is labeled when a Pokémon is absent from the tournament sample.</p>
        <p>Community draft rate and average draft position use eligible completed draft pools, including undrafted eligible Pokémon where the displayed definition requires it. Auction averages use completed auction samples. Team win rate uses confirmed match results. Every public percentage is paired with its sample size, and small samples are presented as early evidence rather than proof that a Pokémon caused an outcome.</p>
      </section>

      <section>
        <h2>Privacy and exclusions</h2>
        <p>Public community statistics are aggregate measurements. DraftCenter does not publish private queues, private team notes, account credentials, private league messages, support diagnostics, or personally identifying account records as part of its research pages. Public-league and public-profile information is shown only through the permissions and publication choices supported by the product.</p>
        <p>Spreadsheet manager text remains a planning label rather than an account claim or invitation. Confirmed replay results retain only bounded facts such as canonical replay identity, format, mapped players, winner, supported counts, and Pokémon actually revealed in battle. Raw replay logs are not stored, knockout attribution is not inferred, and unrevealed Pokémon are never claimed as brought to the match.</p>
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
        <div className="pokemon-tags"><a href="/guides">Practical guides</a><a href="/guides/how-to-run-pokemon-draft-league">Commissioner walkthrough</a><a href="/guides/pokemon-draft-manager-vs-spreadsheets">Spreadsheet migration guide</a><a href="/guides/pokemon-showdown-replay-results-draft-league">Showdown replay results</a><a href="/formats">Supported formats</a><a href="/pokemon">Pokémon profiles</a><a href="/leagues">Public leagues</a></div>
      </aside>
    </article>
  </main>;
}
