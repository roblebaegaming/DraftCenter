import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "Pick 10 Pokémon Worlds VGC players and six Pokémon for the winning team on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <SocialPreviewImage
      eyebrow="2026 POKÉMON WORLDS · VGC"
      title="Pick 10 players + 6 Pokémon"
      description="Two free worldwide predictions. Name Your Champion and compare transparent, non-betting odds."
    />,
    size,
  );
}
