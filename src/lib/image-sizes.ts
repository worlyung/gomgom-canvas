// gpt-image-2 크기 규칙 (26-08-20 실측)
//  · 가로·세로 모두 16의 배수
//  · 가장 긴 변 ≤ 3840
//  · 총 픽셀 한도 있음 — 4.36MP(1760×2480)는 통과, 8.7MP(2480×3504)는 거부
export const MAX_EDGE = 3840;
export const MAX_PIXELS = 4_400_000;

export interface SizePreset {
  label: string;
  value: string;
  note?: string;
}

export const SIZE_PRESETS: SizePreset[] = [
  { label: "정사각 1024", value: "1024x1024", note: "빠른 시안" },
  { label: "정사각 2048", value: "2048x2048", note: "고해상" },
  { label: "가로 3:2", value: "1536x1024", note: "기본 가로" },
  { label: "세로 2:3", value: "1024x1536", note: "기본 세로" },
  { label: "A4 세로", value: "1760x2480", note: "포스터·인쇄 210dpi" },
  { label: "A4 가로", value: "2480x1760", note: "인포그래픽·제안서" },
  { label: "와이드 16:9", value: "1920x1088", note: "PPT 슬라이드" },
  { label: "스토리 9:16", value: "1088x1920", note: "인스타·유튜브 쇼츠" },
  { label: "현수막 3:1", value: "2880x960", note: "가로 배너" },
];

/** 사용자가 입력한 크기를 API가 받는 값으로 다듬는다. 문제가 있으면 이유를 돌려준다. */
export function normalizeSize(
  w: number,
  h: number,
): { value: string; adjusted: boolean } | { error: string } {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 256 || h < 256) {
    return { error: "가로·세로 모두 256 이상이어야 합니다" };
  }
  const rw = Math.round(w / 16) * 16;
  const rh = Math.round(h / 16) * 16;
  if (Math.max(rw, rh) > MAX_EDGE) {
    return { error: `가장 긴 변은 ${MAX_EDGE}px 이하여야 합니다` };
  }
  if (rw * rh > MAX_PIXELS) {
    return {
      error: `너무 큽니다 — 전체 픽셀이 약 ${(MAX_PIXELS / 1e6).toFixed(1)}백만 이하여야 합니다 (요청: ${((rw * rh) / 1e6).toFixed(1)}백만)`,
    };
  }
  return { value: `${rw}x${rh}`, adjusted: rw !== w || rh !== h };
}
