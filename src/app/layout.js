import "./globals.css";
import SiteLegalFooter from "../components/SiteLegalFooter";
import SiteQuickLinks from "../components/SiteQuickLinks";

export const metadata = {
  title: "DraftCenter",
  description: "Pokémon Draft League",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning><SiteQuickLinks />{children}<SiteLegalFooter /></body>
    </html>
  );
}
