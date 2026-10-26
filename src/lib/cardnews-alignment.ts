import { CARD_W, CARD_H, type CardText } from "./cardnews";

export type TextBox = CardText & { height: number };
export type AlignAction =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "centerY"
  | "bottom"
  | "gapX"
  | "gapY"
  | "cardX"
  | "cardY";
export interface Guide {
  axis: "x" | "y";
  at: number;
}
export interface Position {
  id: string;
  x: number;
  y: number;
}
export function bounds(boxes: TextBox[]) {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width)),
    bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, right, bottom, width: right - x, height: bottom - y };
}

export function alignBoxes(boxes: TextBox[], action: AlignAction): Position[] {
  const needed = action.startsWith("gap")
    ? 3
    : action.startsWith("card")
      ? 1
      : 2;
  if (boxes.length < needed)
    throw new Error(`${needed}개 이상의 글상자를 선택해 주세요.`);
  const b = bounds(boxes);
  let result: Position[];
  if (action === "gapX" || action === "gapY") {
    const horizontal = action === "gapX",
      pos = horizontal ? "x" : "y",
      size = horizontal ? "width" : "height";
    const sorted = [...boxes].sort((a, b) => a[pos] - b[pos]);
    const last = sorted[sorted.length - 1];
    const gap =
      (last[pos] +
        last[size] -
        sorted[0][pos] -
        sorted.reduce((sum, t) => sum + t[size], 0)) /
      (sorted.length - 1);
    if (gap < 0)
      throw new Error(
        "글상자가 겹쳐 있어요. 양 끝 글상자를 조금 더 벌린 뒤 간격을 맞춰 주세요.",
      );
    let cursor = sorted[0][pos];
    result = sorted.map((t) => {
      const p = { id: t.id, x: t.x, y: t.y, [pos]: cursor };
      cursor += t[size] + gap;
      return p;
    });
  } else {
    result = boxes.map((t) => ({
      id: t.id,
      x:
        action === "left"
          ? b.x
          : action === "centerX"
            ? b.x + (b.width - t.width) / 2
            : action === "right"
              ? b.right - t.width
              : action === "cardX"
                ? t.x + (CARD_W - b.width) / 2 - b.x
                : t.x,
      y:
        action === "top"
          ? b.y
          : action === "centerY"
            ? b.y + (b.height - t.height) / 2
            : action === "bottom"
              ? b.bottom - t.height
              : action === "cardY"
                ? t.y + (CARD_H - b.height) / 2 - b.y
                : t.y,
    }));
  }
  if (result.some((p) => p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 1250))
    throw new Error(
      "선택 범위가 너무 커요. 글상자 크기나 위치를 조절한 뒤 다시 맞춰 주세요.",
    );
  return result;
}

// Move as a group and compare its edges/centre against stationary boxes and the card.
export function snapMove(
  moving: TextBox[],
  stationary: TextBox[],
  dx: number,
  dy: number,
  threshold: number,
  enabled = true,
) {
  const b = bounds(moving);
  const minDX = -Math.min(...moving.map((t) => t.x)),
    maxDX = 1000 - Math.max(...moving.map((t) => t.x));
  const minDY = -Math.min(...moving.map((t) => t.y)),
    maxDY = 1250 - Math.max(...moving.map((t) => t.y));
  dx = Math.max(minDX, Math.min(maxDX, dx));
  dy = Math.max(minDY, Math.min(maxDY, dy));
  const guides: Guide[] = [];
  if (enabled) {
    const targetsX = [
      0,
      CARD_W / 2,
      CARD_W,
      ...stationary.flatMap((t) => [t.x, t.x + t.width / 2, t.x + t.width]),
    ];
    const targetsY = [
      0,
      CARD_H / 2,
      CARD_H,
      ...stationary.flatMap((t) => [t.y, t.y + t.height / 2, t.y + t.height]),
    ];
    const snap = (
      anchors: number[],
      targets: number[],
      delta: number,
      min: number,
      max: number,
      axis: "x" | "y",
    ) => {
      let best = threshold + 1,
        offset = 0,
        at: number | undefined;
      for (const target of targets)
        for (const anchor of anchors) {
          const difference = target - (anchor + delta),
            distance = Math.abs(difference);
          if (
            distance <= threshold &&
            distance < best &&
            delta + difference >= min &&
            delta + difference <= max
          ) {
            best = distance;
            offset = difference;
            at = target;
          }
        }
      if (at !== undefined) guides.push({ axis, at });
      return delta + offset;
    };
    dx = snap(
      [b.x, b.x + b.width / 2, b.right],
      targetsX,
      dx,
      minDX,
      maxDX,
      "x",
    );
    dy = snap(
      [b.y, b.y + b.height / 2, b.bottom],
      targetsY,
      dy,
      minDY,
      maxDY,
      "y",
    );
  }
  return {
    positions: moving.map((t) => ({ id: t.id, x: t.x + dx, y: t.y + dy })),
    guides,
  };
}
