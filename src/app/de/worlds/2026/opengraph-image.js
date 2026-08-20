import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "Wähle 10 VGC-Spieler und sechs Pokémon für das Siegerteam der Pokémon-Weltmeisterschaft 2026 bei DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="POKÉMON-WM 2026" title="10 Spieler + 6 Pokémon" description="Zwei kostenlose weltweite Tippspiele. Bestimme deinen Champion und vergleiche nicht-wettbezogene Siegchancen." />, size);
}
