import { ImageResponse } from "next/og";
import PokedexTrackerSocialPreview from "../../components/PokedexTrackerSocialPreview";

export const alt = "Pokédex Tracker for every Pokémon game and Pokémon HOME on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<PokedexTrackerSocialPreview />, size);
}
