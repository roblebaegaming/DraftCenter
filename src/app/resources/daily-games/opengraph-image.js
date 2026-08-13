import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../components/SocialPreviewImage";

export const alt = "Pokémon Daily Games on DraftCenter, featuring a colorful Connections grid";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage connections eyebrow="FOUR FRESH CHALLENGES EVERY DAY" title="Pokémon Daily Games" description="Solve Connections, vote in the poll, crown a bracket champion, and identify the daily Pokémon." />, size);
}
