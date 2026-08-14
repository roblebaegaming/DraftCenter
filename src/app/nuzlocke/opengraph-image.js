import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../components/SocialPreviewImage";

export const alt = "Pokémon Nuzlocke Run Tracker on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="GAME-SPECIFIC RUN TRACKER" title="Track your Nuzlocke" description="Plan verified encounters, then record catches, losses, milestones, level caps, and notes." />, size);
}
