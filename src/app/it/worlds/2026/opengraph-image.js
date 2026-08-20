import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "Scegli 10 giocatori VGC e sei Pokémon per la squadra vincitrice dei Mondiali Pokémon 2026 su DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="MONDIALI POKÉMON 2026" title="10 giocatori + 6 Pokémon" description="Due pronostici gratuiti e mondiali. Scegli il Campione e confronta probabilità non legate alle scommesse." />, size);
}
