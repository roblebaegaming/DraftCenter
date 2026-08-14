import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Draft Lab Pokémon team builder and type coverage analysis on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="PUBLIC TEAM BUILDER" title="Draft Lab" description="Build a team, find shared weaknesses and STAB gaps, and review base format legality." />, size);
}
