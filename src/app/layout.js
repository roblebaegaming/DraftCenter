import "./globals.css";
import SiteLegalFooter from "../components/SiteLegalFooter";
import SiteQuickLinks from "../components/SiteQuickLinks";

export const metadata = {
  metadataBase: new URL("https://draftcentral.gg"),
  title: { default: "DraftCenter — Pokémon Draft League Platform", template: "%s | DraftCenter" },
  description: "Run Pokémon draft leagues, explore community draft data, share teams by regulation, and follow public leagues on DraftCenter.",
  applicationName: "DraftCenter",
  keywords: ["Pokémon draft league", "Pokémon team builder", "Pokémon draft", "draft league manager", "Pokémon community"],
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: "DraftCenter — Pokémon Draft League Platform",
    description: "Run drafts, manage leagues, explore community data, and share Pokémon teams.",
    url: "https://draftcentral.gg",
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
    "@type": "WebApplication",
    name: "DraftCenter",
    url: "https://draftcentral.gg",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    description: "A community platform for running Pokémon draft leagues, exploring draft data, and sharing teams.",
  };
  return (
    <html lang="en">
      <body suppressHydrationWarning><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><SiteQuickLinks />{children}<SiteLegalFooter /></body>
    </html>
  );
}
