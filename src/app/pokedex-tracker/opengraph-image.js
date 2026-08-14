import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../components/SocialPreviewImage";

export const alt = "Pokédex Tracker for every Pokémon game and Pokémon HOME on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="EVERY DEX. ONE ACCOUNT." title="Pokédex Tracker" description="Game-by-game, Pokémon HOME, and shiny checklists with private progress." />, size);
}
