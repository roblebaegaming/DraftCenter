import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "2026 Pokémon Worlds VGC predictions, champion odds, and community profiles on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <SocialPreviewImage
      eyebrow="2026 POKÉMON WORLDS · VGC"
      title="Pick 10, odds, and profiles"
      description="Choose your field, name Your Champion, compare transparent non-betting odds, and open community leaderboard profiles."
    />,
    size,
  );
}
