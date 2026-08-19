import TournamentDirectory from "../../components/TournamentDirectory";
import {
  DOUBLE_ELIMINATION_MAX_ENTRANTS,
  SINGLE_ELIMINATION_MAX_ENTRANTS,
} from "../../lib/tournamentLimits";

const description = `Run Pokémon tournaments with up to ${SINGLE_ELIMINATION_MAX_ENTRANTS} entrants in single elimination or ${DOUBLE_ELIMINATION_MAX_ENTRANTS} in double elimination, or host a 4–32 manager auction with Swiss, Top Cut, and private organizer practice.`;

export const metadata = {
  title: "Pokémon Tournament Organizer & Draft Events",
  description,
  alternates: { canonical: "/tournaments" },
  openGraph: {
    type: "website",
    title: "Pokémon Tournament Organizer & Draft Events",
    description,
    url: "/tournaments",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokémon Tournament Organizer & Draft Events",
    description,
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
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/tournaments#application",
        name: "DraftCenter Pokémon Tournament Organizer",
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        url: "https://www.draftcentral.gg/tournaments",
        description,
        featureList: [`Single elimination for up to ${SINGLE_ELIMINATION_MAX_ENTRANTS} entrants`, `Double elimination for up to ${DOUBLE_ELIMINATION_MAX_ENTRANTS} entrants`, "Shared snake drafts for 4–32 managers", "Shared auctions for 4–32 managers", "Swiss standings and Top Cut playoffs", "Private organizer practice with synthetic bot seats", "Six-Pokémon auction teams and winning-bid recaps", "Authorized team previews on elimination match cards"],
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
