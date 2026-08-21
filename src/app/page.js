import AuthGate from "../components/AuthGate";

export const metadata = {
  title: { absolute: "Pokémon Draft Leagues, Daily Brackets & Team Tools | DraftCenter" },
  description: "Draft together, battle together, and run a complete Pokémon draft league—with a free Daily Bracket, community data, and private team tools.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: "Pokémon Draft Leagues, Daily Brackets & Team Tools | DraftCenter",
    description: "Draft together, battle together, and run a complete Pokémon draft league—with a free Daily Bracket, community data, and private team tools.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokémon Draft Leagues, Daily Brackets & Team Tools | DraftCenter",
    description: "Draft together, battle together, and run a complete Pokémon draft league—with a free Daily Bracket, community data, and private team tools.",
  },
};

export default function HomePage() {
  return <AuthGate />;
}
