import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "Choisissez 10 joueurs VGC et six Pokémon pour l’équipe gagnante des Worlds Pokémon 2026 sur DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="WORLDS POKÉMON 2026" title="10 joueurs + 6 Pokémon" description="Deux compétitions mondiales gratuites. Désignez votre Champion et comparez des chances sans lien avec les paris." />, size);
}
