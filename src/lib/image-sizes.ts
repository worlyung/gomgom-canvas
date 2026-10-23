// gpt-image-2 크기 규칙 (26-08-20 실측)
//  · 가로·세로 모두 16의 배수
//  · 가장 긴 변 ≤ 3840
//  · 총 픽셀 한도 있음 — 4.36MP(1760×2480)는 통과, 8.7MP(2480×3504)는 거부
export const MAX_EDGE = 3840;
export const MAX_PIXELS = 4_400_000;
export const MIN_PIXELS = 655_360;

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
  { label: "와이드 16:9", value: "1536x864", note: "PPT 슬라이드" },
  { label: "스토리 9:16", value: "864x1536", note: "인스타·유튜브 쇼츠" },
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
  if (Math.max(rw / rh, rh / rw) > 3) return { error: "가로·세로 비율은 3:1에서 1:3 사이여야 해요" };
  if (rw * rh < MIN_PIXELS) return { error: "너무 작아요 — 전체 픽셀이 655,360 이상이어야 해요" };
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

/** Preserve the aspect as closely as the API's 16px grid permits. */
export function sizeForAspect(w: number, h: number): string {
  const ratio = Math.max(1 / 3, Math.min(3, w / h || 1));
  const height = Math.round(Math.sqrt(1_327_104 / ratio) / 16) * 16;
  const width = Math.round(height * ratio / 16) * 16;
  const result = normalizeSize(width, height);
  return "value" in result ? result.value : "1024x1024";
}

export function promptImageSize(prompt: string): string | null {
  const matches = [...prompt.matchAll(/\b(\d{1,2})\s*[:：]\s*(\d{1,2})\b/g)];
  const sizes = matches.filter(m => +m[1] > 0 && +m[2] > 0 && Math.max(+m[1] / +m[2], +m[2] / +m[1]) <= 3);
  if (!sizes.length) return null;
  const ratios = new Set(sizes.map(m => +m[1] / +m[2]));
  if (ratios.size !== 1) return null;
  const ratio = +sizes[0][1] / +sizes[0][2];
  const exact = { "1": "1024x1024", [16/9]: "1536x864", [9/16]: "864x1536", "1.5": "1536x1024", [2/3]: "1024x1536", "3": "2880x960" };
  return exact[String(ratio) as keyof typeof exact] || sizeForAspect(+sizes[0][1], +sizes[0][2]);
}
