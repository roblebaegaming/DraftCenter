import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "DraftCenterの2026年ポケモン世界大会VGC予想、優勝確率、選手プロフィール";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="2026年ポケモン世界大会" title="VGC予想" description="選手10人と世界チャンピオンのチームに入るポケモン6匹を予想しよう。" />, size);
}
