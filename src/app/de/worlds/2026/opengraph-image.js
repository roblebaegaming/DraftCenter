import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "VGC-Tipps, Champion-Siegchancen und Spielerprofile zur Pokémon-Weltmeisterschaft 2026 bei DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="POKÉMON-WM 2026" title="VGC-Tipps" description="Wähle 10 Spieler und sechs Pokémon für das Team des Weltmeisters." />, size);
}
