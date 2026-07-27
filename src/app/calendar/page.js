import PokemonCalendar from "../../components/PokemonCalendar";

export const metadata = {
  title: "Calendar",
  description: "Your private Pokémon drafts, league matchups, tournaments, and deadlines.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PokemonCalendar />;
}
