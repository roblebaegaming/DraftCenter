import TournamentDirectory from "../../components/TournamentDirectory";
import {
  DOUBLE_ELIMINATION_MAX_ENTRANTS,
  SINGLE_ELIMINATION_MAX_ENTRANTS,
} from "../../lib/tournamentLimits";

const description = `Run Pokémon tournaments with up to ${SINGLE_ELIMINATION_MAX_ENTRANTS} entrants in single elimination, ${DOUBLE_ELIMINATION_MAX_ENTRANTS} in double elimination, or 16 in a shared draft with Swiss rounds and a top cut.`;

export const metadata = {
  title: "Pokémon Tournament Organizer & Draft Events",
  description,
  alternates: { canonical: "/tournaments" },
  openGraph: {
    type: "website",
    title: "Pokémon Tournament Organizer & Draft Events",
    description,
    url: "/tournaments",
    images: [{ url: "/draftcenter-logo.png", width: 512, height: 512, alt: "DraftCenter Pokémon tournaments" }],
  },
  twitter: {
    card: "summary",
    title: "Pokémon Tournament Organizer & Draft Events",
    description,
    images: ["/draftcenter-logo.png"],
  },
};

export default function Page() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://www.draftcentral.gg/tournaments#page",
        url: "https://www.draftcentral.gg/tournaments",
        name: "Pokémon Tournament Organizer & Draft Events",
        description,
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Tournaments", item: "https://www.draftcentral.gg/tournaments" },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <TournamentDirectory />
  </>;
}
