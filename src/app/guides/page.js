import { GUIDES } from "../../lib/seoContent";

export const metadata = {
  title: "Pokémon Draft League Guides",
  description: "Practical Pokémon draft league guides for commissioners and coaches: formats, snake and auction drafts, tier lists, seasons, and playoffs.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return <main className="resources-shell"><nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/formats">Formats</a><a className="quiet-button" href="/resources">Resources</a></nav><header className="resources-hero"><span className="eyebrow">DRAFTCENTER GUIDES</span><h1>Learn Pokémon draft leagues.</h1><p>Original, practical guides built from the same workflows DraftCenter supports for commissioners, coaches, and spectators.</p></header><section className="resource-grid">{Object.entries(GUIDES).map(([slug, guide]) => <a key={slug} href={`/guides/${slug}`}><strong>{guide.title}</strong><p>{guide.description}</p><span>Read guide →</span></a>)}</section></main>;
}
