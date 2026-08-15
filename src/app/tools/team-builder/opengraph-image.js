import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Team Lab Pokémon team builder, weekly matchup planner, and private Battle Mode on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="TEAM BUILDER & BATTLE NOTEBOOK" title="Team Lab" description="Build weekly teams, plan each opponent matchup, and track revealed moves in private closed- or open-sheet Battle Mode." />, size);
}
