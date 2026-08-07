"use client";
import { useRouter } from "next/navigation";
export default function NuzlockeGuideGameSelect({ games, currentSlug }) { const router = useRouter(); return <label className="nuzlocke-guide-game-select"><span>Choose another game guide</span><select value={currentSlug} onChange={(event) => router.push(`/nuzlocke/${event.target.value}`)}>{games.map((game) => <option key={game.slug} value={game.slug}>{game.displayName}</option>)}</select></label>; }
