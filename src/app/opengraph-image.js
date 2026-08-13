import { ImageResponse } from "next/og";
import SocialPreviewImage from "../components/SocialPreviewImage";

export const alt = "DraftCenter — Pokémon draft leagues, daily games, and community data";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="POKÉMON COMMUNITY PLATFORM" title="Draft. Play. Share." description="Run draft leagues, explore Pokémon data, and join fresh community games." />, size);
}
