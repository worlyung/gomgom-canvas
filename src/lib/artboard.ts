// 포스터 판(아트보드) 계산 (P2) — 인쇄 규격 → 300dpi 픽셀, 판 만들기, 화면 맞춤
import type { Artboard } from "@/types/canvas";

export const DEFAULT_DPI = 300;

// 국내 인쇄물에서 자주 쓰는 규격 (mm, 세로 기준)
export const PAPER_PRESETS: {
  id: string;
  label: string;
  w: number;
  h: number;
}[] = [
  { id: "A4", label: "A4 (210×297)", w: 210, h: 297 },
  { id: "A3", label: "A3 (297×420)", w: 297, h: 420 },
  { id: "A2", label: "A2 (420×594)", w: 420, h: 594 },
  { id: "A1", label: "A1 (594×841)", w: 594, h: 841 },
  { id: "B3", label: "B3 (364×515)", w: 364, h: 515 },
  { id: "B2", label: "B2 (515×728)", w: 515, h: 728 },
  { id: "B1", label: "B1 (728×1030)", w: 728, h: 1030 },
  { id: "custom", label: "직접 입력 (mm)", w: 0, h: 0 },
];

export const mmToPx = (mm: number, dpi = DEFAULT_DPI) =>
  Math.round((mm / 25.4) * dpi);

/** 현재 화면 중앙에 판을 놓는다. (cx, cy)는 월드 좌표 */
export function makeArtboard(
  cx: number,
  cy: number,
  widthMm: number,
  heightMm: number,
  name: string,
  dpi = DEFAULT_DPI,
): Artboard {
  const width = mmToPx(widthMm, dpi);
  const height = mmToPx(heightMm, dpi);
  return {
    x: Math.round(cx - width / 2),
    y: Math.round(cy - height / 2),
    width,
    height,
    widthMm,
    heightMm,
    dpi,
    name,
  };
}

/** 판이 화면에 꽉 차게 보이는 viewport (여유 8%) */
export function fitArtboard(
  ab: Artboard,
  canvasW: number,
  canvasH: number,
): { x: number; y: number; scale: number } {
  const scale = Math.min(canvasW / ab.width, canvasH / ab.height) * 0.92;
  return {
    scale,
    x: canvasW / 2 - (ab.x + ab.width / 2) * scale,
    y: canvasH / 2 - (ab.y + ab.height / 2) * scale,
  };
}

/** 파일 이름용: 포스터_A2세로_4961x7016.png */
export function artboardFileName(ab: Artboard) {
  const n = ab.name.replace(/\s+/g, "");
  return `포스터_${n}_${ab.width}x${ab.height}.png`;
}
