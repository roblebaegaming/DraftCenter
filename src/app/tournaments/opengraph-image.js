import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../components/SocialPreviewImage";

export const alt = "DraftCenter Pokémon tournament organizer for auctions, Swiss rounds, and Top Cut playoffs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <SocialPreviewImage
      eyebrow="AUCTION · SWISS · TOP CUT"
      title="Pokémon tournament organizer"
      description="Rehearse privately, run a 4–32 manager auction, preserve winning bids, and carry standings into a playoff bracket."
    />,
    size,
  );
}
