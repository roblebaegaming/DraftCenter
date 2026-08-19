import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "Pronostici, probabilità del Campione e profili VGC per i Mondiali Pokémon 2026 su DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="MONDIALI POKÉMON 2026" title="Pronostici VGC" description="Scegli 10 giocatori, confronta le probabilità del Campione e scopri i profili della classifica." />, size);
}
