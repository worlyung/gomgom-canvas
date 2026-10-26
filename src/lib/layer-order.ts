// 레이어 순서 — 이미지·영상·도형·글씨를 순서 번호(z) 하나로 다룬다 (포스터 모드 P1)
// z가 없는 옛 항목은 예전 그리기 순서(이미지 → 영상 → 도형 → 글씨) 자리를 그대로 받는다.
// 순서를 한 번이라도 만진 뒤에 새로 생긴 항목(z 없음)은 맨 위로 올라온다.
import type {
  PlacedImage,
  PlacedVideo,
  PlacedShape,
  PlacedText,
} from "@/types/canvas";

export type LayerKind = "image" | "video" | "shape" | "text";
export type LayerItem = PlacedImage | PlacedVideo | PlacedShape | PlacedText;

export interface LayerEntry {
  kind: LayerKind;
  id: string;
  z: number; // 유효 순서 값 (작을수록 아래)
  item: LayerItem;
}

// 옛 보드(z 없음)에서 무리별 자리 — 예전 그리기 순서와 같다
const LEGACY_BASE: Record<LayerKind, number> = {
  image: 0,
  video: 100_000,
  shape: 200_000,
  text: 300_000,
};
// 순서를 만진 뒤 생긴 항목끼리의 순서 (같은 자리면 이미지 < 영상 < 도형 < 글씨)
const NEW_OFFSET: Record<LayerKind, number> = {
  image: 0,
  video: 0.25,
  shape: 0.5,
  text: 0.75,
};

/** 아래 → 위 순서로 정렬된 레이어 목록 */
export function orderLayers(
  images: PlacedImage[],
  videos: PlacedVideo[],
  shapes: PlacedShape[],
  texts: PlacedText[],
): LayerEntry[] {
  const groups: [LayerKind, LayerItem[]][] = [
    ["image", images],
    ["video", videos],
    ["shape", shapes],
    ["text", texts],
  ];
  let anyZ = false;
  let maxZ = -1;
  for (const [, arr] of groups) {
    for (const it of arr) {
      if (typeof it.z === "number") {
        anyZ = true;
        if (it.z > maxZ) maxZ = it.z;
      }
    }
  }

  const out: LayerEntry[] = [];
  for (const [kind, arr] of groups) {
    arr.forEach((item, idx) => {
      let z: number;
      if (typeof item.z === "number") z = item.z;
      else if (!anyZ)
        z = LEGACY_BASE[kind] + idx; // 옛 보드: 예전 순서 그대로
      else z = maxZ + 1 + idx + NEW_OFFSET[kind]; // 새로 생긴 것은 맨 위
      out.push({ kind, id: item.id, z, item });
    });
  }
  return out.sort((a, b) => a.z - b.z);
}

/** 선택한 것들을 옮긴 새 순서(아래 → 위). 선택끼리의 상대 순서는 지킨다 */
export function moveSelected(
  entries: LayerEntry[],
  selectedIds: string[],
  mode: "front" | "back" | "forward" | "backward",
): LayerEntry[] {
  const sel = new Set(selectedIds);
  const list = [...entries];
  if (mode === "front") {
    return [
      ...list.filter((e) => !sel.has(e.id)),
      ...list.filter((e) => sel.has(e.id)),
    ];
  }
  if (mode === "back") {
    return [
      ...list.filter((e) => sel.has(e.id)),
      ...list.filter((e) => !sel.has(e.id)),
    ];
  }
  if (mode === "forward") {
    for (let i = list.length - 2; i >= 0; i--) {
      if (sel.has(list[i].id) && !sel.has(list[i + 1].id)) {
        [list[i], list[i + 1]] = [list[i + 1], list[i]];
      }
    }
  } else {
    for (let i = 1; i < list.length; i++) {
      if (sel.has(list[i].id) && !sel.has(list[i - 1].id)) {
        [list[i], list[i - 1]] = [list[i - 1], list[i]];
      }
    }
  }
  return list;
}

/** 패널 드래그: id를 (아래 → 위 기준) newIndex 자리로. 끝난 뒤 그 항목은 정확히 newIndex에 있다 */
export function moveToIndex(
  entries: LayerEntry[],
  id: string,
  newIndex: number,
): LayerEntry[] {
  const from = entries.findIndex((e) => e.id === id);
  if (from < 0) return entries;
  const list = [...entries];
  const [it] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(newIndex, list.length)), 0, it);
  return list;
}

/** 순서대로 0..N-1 번호를 다시 매긴 표 (id → z). 이걸 각 배열에 써넣으면 순서가 굳는다 */
export function zMap(entries: LayerEntry[]): Map<string, number> {
  return new Map(entries.map((e, i) => [e.id, i]));
}
