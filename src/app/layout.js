import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import SiteLegalFooter from "../components/SiteLegalFooter";
import SiteQuickLinks from "../components/SiteQuickLinks";
import SignupAttributionCapture from "../components/SignupAttributionCapture";

export const metadata = {
  metadataBase: new URL("https://www.draftcentral.gg"),
  title: { default: "DraftCenter — Pokémon Draft League Manager", template: "%s | DraftCenter" },
  description: "Run a complete Pokémon draft league in one connected commissioner and manager workspace, from setup and drafting through results, playoffs, and archives.",
  applicationName: "DraftCenter",
  verification: { google: "WZBav7uPyWIoNs0PV95rujlY570GWua1aQnbnAraGWE" },
  keywords: ["Pokémon draft league", "Pokémon team builder", "Pokémon draft", "draft league manager", "Pokémon community"],
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: "DraftCenter — Pokémon Draft League Manager",
    description: "Run a complete Pokémon draft league in one connected commissioner and manager workspace.",
    url: "https://www.draftcentral.gg",
  },
  twitter: {
    card: "summary_large_image",
    title: "DraftCenter — Pokémon Draft League Manager",
    description: "Run a complete Pokémon draft league in one connected commissioner and manager workspace.",
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
        description: "A Pokémon draft league manager that connects setup, drafting, schedules, results, standings, playoffs, preparation, and season archives.",
      },
      {
        "@type": "Organization",
        "@id": "https://www.draftcentral.gg/#organization",
        name: "DraftCenter",
        url: "https://www.draftcentral.gg/",
        logo: "https://www.draftcentral.gg/draftcenter-logo.png",
        description: "DraftCenter helps commissioners and managers run complete Pokémon draft league seasons in one connected workspace.",
        publishingPrinciples: "https://www.draftcentral.gg/about#editorial-standards",
      },
    ],
  };
  return (
    <html lang="en">
      <body suppressHydrationWarning><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><SignupAttributionCapture /><SiteQuickLinks />{children}<SiteLegalFooter /><Analytics /></body>
    </html>
  );
}
