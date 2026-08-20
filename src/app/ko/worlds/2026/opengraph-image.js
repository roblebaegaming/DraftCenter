import { ImageResponse } from "next/og";
import SocialPreviewImage from "../../../../components/SocialPreviewImage";

export const alt = "DraftCenter에서 2026 포켓몬 월드 챔피언십 VGC 선수 10명과 우승 팀의 포켓몬 6마리 예측";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<SocialPreviewImage eyebrow="2026 포켓몬 월드 챔피언십" title="선수 10명 + 포켓몬 6마리" description="두 가지 무료 글로벌 예측. 우승 선수를 고르고 베팅이 아닌 우승 확률을 확인하세요." />, size);
}
