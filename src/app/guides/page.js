import { GUIDES } from "../../lib/seoContent";

export const metadata = {
  title: "Pokémon Draft League Guides",
  description: "Practical Pokémon guides for league setup, tournament organizing, auction and Swiss play, VGC battle tracking, replay results, standings, and team research.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const entries = [["shiny-hunting", { title: "Pokémon Shiny Hunting Guides by Game", description: "Compare the best methods, odds, locations, setup, and warnings for all 37 games in DraftCenter's verified catalog." }], ...Object.entries(GUIDES)];
  const schema = { "@context": "https://schema.org", "@graph": [{ "@type": "CollectionPage", "@id": "https://www.draftcentral.gg/guides#collection", url: "https://www.draftcentral.gg/guides", name: metadata.title, description: metadata.description, isPartOf: { "@id": "https://www.draftcentral.gg/#website" } }, { "@type": "ItemList", itemListElement: entries.map(([slug, guide], index) => ({ "@type": "ListItem", position: index + 1, name: guide.title, url: `https://www.draftcentral.gg/guides/${slug}` })) }] };
  return <main className="resources-shell"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/formats">Formats</a><a className="quiet-button" href="/resources">Resources</a></nav><header className="resources-hero"><span className="eyebrow">DRAFTCENTER GUIDES</span><h1>Learn Pokémon leagues, tournaments, and battle preparation.</h1><p>Original, practical guides built from the same workflows DraftCenter supports for commissioners, coaches, and spectators—from league setup and spreadsheet migration through auctions, Swiss and Top Cut events, VGC battle tracking, replay-supported results, standings, and playoffs.</p></header><section className="resource-grid" aria-label="Pokémon league, tournament, and battle guides">{entries.map(([slug, guide]) => <a key={slug} href={`/guides/${slug}`}><strong>{guide.title}</strong><p>{guide.description}</p><span>Read guide →</span></a>)}</section></main>;
}
