import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Draft Lab 6- or 10-Pokémon team builder and archetype analysis on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="PUBLIC TEAM BUILDER" title="Draft Lab" description="Build 6- or 10-Pokémon rosters, find coverage gaps, and consider common meta archetypes." />, size);
}
