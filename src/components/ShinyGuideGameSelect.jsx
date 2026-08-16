"use client";

import { useRouter } from "next/navigation";

export default function ShinyGuideGameSelect({ games, currentSlug }) {
  const router = useRouter();
  return <label className="nuzlocke-guide-game-select">
    <span>Choose another shiny hunting guide</span>
    <select value={currentSlug} onChange={(event) => router.push("/guides/shiny-hunting/" + event.target.value)}>
      {games.map((game) => <option key={game.slug} value={game.slug}>{game.displayName}</option>)}
    </select>
  </label>;
}
