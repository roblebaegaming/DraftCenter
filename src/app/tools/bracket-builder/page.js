import PublicBracketBuilder from "../../../components/PublicBracketBuilder";
import "./bracket-builder.css";

const title = "Free Bracket Maker — Build and Download a Tournament Bracket";
const description = "Make a private 4, 8, 16, or 32-competitor tournament bracket, customize its colors and style, choose winners, and download a high-resolution PNG.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/tools/bracket-builder" },
  keywords: ["free bracket maker", "tournament bracket generator", "downloadable bracket", "single elimination bracket", "custom bracket builder"],
  openGraph: { type: "website", title, description, url: "/tools/bracket-builder", images: ["/draftcenter-logo.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/draftcenter-logo.png"] },
};

export default function PublicBracketBuilderPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/tools/bracket-builder#app",
        name: "DraftCenter Bracket Studio",
        applicationCategory: "DesignApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript; no account required",
        isAccessibleForFree: true,
        url: "https://www.draftcentral.gg/tools/bracket-builder",
        description,
        featureList: ["4, 8, 16, and 32-competitor single-elimination brackets", "Bulk competitor entry", "Click-to-advance winners", "Color, font, and matchup shape options", "Private local draft recovery", "High-resolution PNG download"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Bracket Studio", item: "https://www.draftcentral.gg/tools/bracket-builder" },
        ],
      },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><PublicBracketBuilder /></>;
}
