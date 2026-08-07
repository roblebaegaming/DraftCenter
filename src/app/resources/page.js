import ResourcesPage from "../../components/ResourcesPage";
export const metadata = {
  title: "Competitive Pokémon Resources",
  description: "Explore competitive Pokémon resources for draft leagues, team building, battle preparation, VGC, strategy, data, and daily Pokémon games.",
  keywords: ["competitive Pokémon resources", "Pokémon draft league resources", "Pokémon team building", "competitive Pokémon tools", "VGC resources"],
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Competitive Pokémon Resources",
    description: "Competitive Pokémon guides, battle tools, team builders, strategy, data, VGC resources, and daily games.",
    url: "/resources",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Competitive Pokémon Resources",
    description: "Competitive Pokémon guides, battle tools, team builders, strategy, data, VGC resources, and daily games.",
  },
};
export default function Page() { return <ResourcesPage />; }
