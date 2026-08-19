import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "DraftCenter의 2026 포켓몬 월드 챔피언십 VGC 예측, 우승 확률 및 선수 프로필";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="2026 포켓몬 월드 챔피언십" title="VGC 예측" description="선수 10명과 월드 챔피언 팀의 포켓몬 6마리를 예측하세요." />, size);
}
