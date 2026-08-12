import PokemonCalendar from "../../components/PokemonCalendar";

export const metadata = {
  title: "Calendar",
  description: "Your private Pokémon drafts, league matchups, reminders, and maintained VGC event schedule.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PokemonCalendar />;
}
