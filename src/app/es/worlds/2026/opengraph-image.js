import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "Elige 10 jugadores VGC y seis Pokémon para el equipo ganador del Mundial Pokémon 2026 en DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="MUNDIAL POKÉMON 2026" title="10 jugadores + 6 Pokémon" description="Dos pronósticos gratuitos y mundiales. Marca a tu campeón y compara probabilidades ajenas a las apuestas." />, size);
}
