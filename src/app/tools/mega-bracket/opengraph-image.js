import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Mega Bracket Full Dex Challenge on DraftCenter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="THE FULL DEX CHALLENGE" title="Mega Bracket" description="1,162 Pokémon and forms. 1,161 choices. One champion." />, size);
}
