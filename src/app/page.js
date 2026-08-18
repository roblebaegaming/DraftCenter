import AuthGate from "../components/AuthGate";

export const metadata = {
  title: { absolute: "Run a Complete Pokémon Draft League | DraftCenter" },
  description: "Set up, draft, schedule, play, and preserve a complete Pokémon draft league in one connected commissioner and manager workspace.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: "Run a Complete Pokémon Draft League | DraftCenter",
    description: "Set up, draft, schedule, play, and preserve a complete Pokémon draft league in one connected commissioner and manager workspace.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Run a Complete Pokémon Draft League | DraftCenter",
    description: "Set up, draft, schedule, play, and preserve a complete Pokémon draft league in one connected commissioner and manager workspace.",
  },
};

export default function HomePage() {
  return <AuthGate />;
}
