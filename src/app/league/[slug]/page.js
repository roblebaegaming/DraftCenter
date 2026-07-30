import PublicLeaguePage from "../../../components/PublicLeaguePage";
import { getPublicLeague } from "../../../lib/supabase/publicServer";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getPublicLeague(slug);
  const league = data?.league;
  if (!league) return {
    title: "Public Pokémon Draft League",
    description: "Follow a public Pokémon draft league on DraftCenter.",
    alternates: { canonical: `/league/${slug}` },
  };
  const description = league.description || `Follow ${league.name} standings, schedule, draft picks, replays, and results on DraftCenter.`;
  return {
    title: `${league.name} — Pokémon Draft League`,
    description,
    alternates: { canonical: `/league/${slug}` },
    openGraph: {
      type: "website",
      title: `${league.name} | DraftCenter`,
      description,
      url: `/league/${slug}`,
      images: league.image_url ? [{ url: league.image_url, alt: league.name }] : undefined,
    },
  };
}

export default async function LeaguePage({ params }) {
  const { slug } = await params;
  const data = await getPublicLeague(slug);
  const league = data?.league;
  const structuredData = league ? {
    "@context": "https://schema.org",
    "@graph": [{
    "@type": "WebPage",
    name: league.name,
    description: league.description || `Public Pokémon draft league on DraftCenter`,
    url: `https://www.draftcentral.gg/league/${slug}`,
    image: league.image_url || "https://www.draftcentral.gg/draftcenter-logo.png",
    isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
    }, {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
        { "@type": "ListItem", position: 2, name: "Public Leagues", item: "https://www.draftcentral.gg/leagues" },
        { "@type": "ListItem", position: 3, name: league.name, item: `https://www.draftcentral.gg/league/${slug}` },
      ],
    }],
  } : null;
  return <>{structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />}<PublicLeaguePage /></>;
}
