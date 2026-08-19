import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "Pronósticos, probabilidades del Campeón y perfiles VGC para el Mundial Pokémon 2026 en DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="MUNDIAL POKÉMON 2026" title="Pronósticos VGC" description="Elige 10 jugadores, compara las probabilidades del Campeón y descubre los perfiles de la clasificación." />, size);
}
