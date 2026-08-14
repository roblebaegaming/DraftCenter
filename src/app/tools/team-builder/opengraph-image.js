import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Team Lab Pokémon team builder, private notes, and opponent matchup planner on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="TEAM BUILDER & MATCHUP PLANNER" title="Team Lab" description="Build 6- or 10-Pokémon rosters, connect saved teams, keep notes, and plan opponent matchups." />, size);
}
