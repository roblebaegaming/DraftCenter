import NuzlockeLab from "../../components/NuzlockeLab";

export const metadata = {
  title: "Nuzlocke Run Card Generator",
  description: "Build a deterministic Pokémon Nuzlocke Run Card from verified, game-specific encounter data.",
  alternates: { canonical: "/nuzlocke" },
};

export default function NuzlockePage() { return <NuzlockeLab />; }
