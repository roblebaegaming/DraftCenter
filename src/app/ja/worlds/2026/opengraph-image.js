import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "DraftCenterで2026年ポケモン世界大会のVGC選手10人と優勝チームのポケモン6匹を予想";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="2026年ポケモン世界大会" title="選手10人＋ポケモン6匹" description="2つの無料世界予想。優勝選手を選び、賭けではない優勝確率を比較しよう。" />, size);
}
