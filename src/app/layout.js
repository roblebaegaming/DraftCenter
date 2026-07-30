import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import SiteLegalFooter from "../components/SiteLegalFooter";
import SiteQuickLinks from "../components/SiteQuickLinks";

export const metadata = {
  metadataBase: new URL("https://www.draftcentral.gg"),
  title: { default: "DraftCenter — Pokémon Draft League Platform", template: "%s | DraftCenter" },
  description: "Run Pokémon draft leagues, explore community draft data, share teams by regulation, and follow public leagues on DraftCenter.",
  applicationName: "DraftCenter",
  verification: { google: "WZBav7uPyWIoNs0PV95rujlY570GWua1aQnbnAraGWE" },
  keywords: ["Pokémon draft league", "Pokémon team builder", "Pokémon draft", "draft league manager", "Pokémon community"],
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: "DraftCenter — Pokémon Draft League Platform",
    description: "Run drafts, manage leagues, explore community data, and share Pokémon teams.",
    url: "https://www.draftcentral.gg",
    images: [{ url: "/draftcenter-logo.png", width: 512, height: 512, alt: "DraftCenter logo" }],
  },
  twitter: {
    card: "summary",
    title: "DraftCenter — Pokémon Draft League Platform",
    description: "Run drafts, manage leagues, explore community data, and share Pokémon teams.",
    images: ["/draftcenter-logo.png"],
  },
};

export default function RootLayout({ children }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://www.draftcentral.gg/#website",
        name: "DraftCenter",
        alternateName: "Draft Central",
        url: "https://www.draftcentral.gg/",
        description: "A community platform for running Pokémon draft leagues, exploring draft data, and sharing teams.",
      },
      {
        "@type": "Organization",
        "@id": "https://www.draftcentral.gg/#organization",
        name: "DraftCenter",
        url: "https://www.draftcentral.gg/",
        logo: "https://www.draftcentral.gg/draftcenter-logo.png",
      },
      {
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/#application",
        name: "DraftCenter",
        url: "https://www.draftcentral.gg/",
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        description: "Create and manage Pokémon draft leagues, run drafts, track seasons, and explore community draft data.",
        publisher: { "@id": "https://www.draftcentral.gg/#organization" },
      },
    ],
  };
  return (
    <html lang="en">
      <body suppressHydrationWarning><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><SiteQuickLinks />{children}<SiteLegalFooter /><Analytics /></body>
    </html>
  );
}
