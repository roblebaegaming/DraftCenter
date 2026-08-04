import { notFound } from "next/navigation";
import { GUIDES } from "../../../lib/seoContent";

export function generateStaticParams() { return Object.keys(GUIDES).map((slug) => ({ slug })); }
export async function generateMetadata({ params }) {
  const { slug } = await params; const guide = GUIDES[slug];
  if (!guide) return { title: "Guide Not Found", robots: { index: false, follow: true } };
  return { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${slug}` }, openGraph: { type: "article", title: guide.title, description: guide.description, url: `/guides/${slug}` } };
}
export default async function GuidePage({ params }) {
  const { slug } = await params; const guide = GUIDES[slug]; if (!guide) notFound();
  const schema = { "@context": "https://schema.org", "@graph": [{ "@type": "Article", headline: guide.title, description: guide.description, author: { "@type": "Organization", name: "DraftCenter" }, publisher: { "@id": "https://www.draftcentral.gg/#organization" }, mainEntityOfPage: `https://www.draftcentral.gg/guides/${slug}` }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" }, { "@type": "ListItem", position: 2, name: "Guides", item: "https://www.draftcentral.gg/guides" }, { "@type": "ListItem", position: 3, name: guide.title, item: `https://www.draftcentral.gg/guides/${slug}` }] }] };
  return <main className="seo-article-shell"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><nav className="public-page-nav"><a className="quiet-button" href="/guides">← All guides</a><a className="quiet-button" href="/formats">Formats</a><a className="quiet-button" href="/">DraftCenter Home</a></nav><article><header><span className="eyebrow">POKÉMON DRAFT GUIDE</span><h1>{guide.title}</h1><p className="seo-article-intro">{guide.intro}</p></header>{guide.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}{guide.links?.length ? <aside className="seo-next-step"><h2>Continue your draft-league research</h2><div className="pokemon-tags">{guide.links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div></aside> : null}<aside className="seo-next-step"><h2>Put the guide into practice</h2><p>DraftCenter connects league setup, legal pools, live drafts, schedules, standings, transactions, playoffs, public pages, and community statistics.</p><a className="primary-button inline-link-button" href="/">Create or open a league</a></aside></article></main>;
}
