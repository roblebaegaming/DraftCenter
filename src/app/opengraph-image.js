import { ImageResponse } from "next/og";
import SocialPreviewImage from "../components/SocialPreviewImage";

export const alt = "DraftCenter — run your whole Pokémon draft league in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="POKÉMON DRAFT LEAGUE MANAGER" title="Run your whole league in one place." description="Set up, draft, schedule, play, and preserve a complete Pokémon draft league season." />, size);
}
