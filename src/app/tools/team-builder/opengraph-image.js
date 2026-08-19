import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Team Lab Pokémon team builder, VGC battle tracker, and private Battle Room on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="TEAM BUILDER & VGC BATTLE TRACKER" title="Team Lab" description="Plan the opponent matchup, keep four active Pokémon visible, tap moves and targets, track open or closed sheets, and export the private battle record." />, size);
}
