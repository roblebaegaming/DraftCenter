import AuthGate from "../components/AuthGate";

export const metadata = {
  title: "Pokémon Draft League Platform",
  description: "Create and manage Pokémon draft leagues, run snake and auction drafts, track seasons, and explore community teams and statistics.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <AuthGate />;
}
