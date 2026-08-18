import AuthGate from "../components/AuthGate";

export const metadata = {
  title: "Run a Complete Pokémon Draft League",
  description: "Set up, draft, schedule, play, and preserve a complete Pokémon draft league in one connected commissioner and manager workspace.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <AuthGate />;
}
