import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Replayable Pokémon Mega Brackets on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="YOUR BRACKET, YOUR RULES" title="Mega Bracket" description="Full Dex, type, generation, and Mega Evolution fields. Pick a favorite—or vote for the worst." />, size);
}
