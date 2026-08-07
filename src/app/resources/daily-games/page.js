import DailyGamesResourcesPage from "../../../components/DailyGamesResourcesPage";

export const metadata = {
  title: "Pokémon Daily Games",
  description: "Play DraftCenter's Daily Three and discover independent Pokémon grids, guessing games, and type-matchup quizzes.",
  alternates: { canonical: "/resources/daily-games" },
};

export default function DailyGamesPage() {
  return <DailyGamesResourcesPage />;
}
