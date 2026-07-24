import "./globals.css";
import SiteLegalFooter from "../components/SiteLegalFooter";

export const metadata = {
  title: "DraftCenter",
  description: "Pokémon Draft League",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}<SiteLegalFooter /></body>
    </html>
  );
}
