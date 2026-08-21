// 캔버스 ↔ 서버 보드 주고받기
import type {
  PlacedImage,
  PlacedNote,
  PlacedShape,
  PlacedText,
} from "@/types/canvas";

export interface BoardState {
  images: Omit<PlacedImage, "src">[] & { src?: string }[];
  texts: PlacedText[];
  shapes: PlacedShape[];
  notes: PlacedNote[];
  viewport: { x: number; y: number; scale: number };
}

export interface SaveArgs {
  boardId: string;
  name: string;
  myName: string;
  knownUpdatedAt?: string;
  images: PlacedImage[];
  texts: PlacedText[];
  shapes: PlacedShape[];
  notes: PlacedNote[];
  viewport: { x: number; y: number; scale: number };
  onProgress?: (msg: string) => void;
}

/** 이미지는 한 장씩 올리고(이미 있는 건 건너뜀), 나머지 상태는 JSON 한 번에 */
export async function saveBoard(a: SaveArgs) {
  // 서버가 이미 갖고 있는 이미지 확인
  let have: string[] = [];
  try {
    const r = await fetch(`/api/boards/${a.boardId}?manifest=1`);
    if (r.ok) have = (await r.json()).imageIds || [];
  } catch {}
  const haveSet = new Set(have);

  const missing = a.images.filter((i) => !haveSet.has(i.id));
  for (let i = 0; i < missing.length; i++) {
    a.onProgress?.(`이미지 올리는 중 ${i + 1}/${missing.length}`);
    const res = await fetch(`/api/boards/${a.boardId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId: missing[i].id, dataUrl: missing[i].src }),
    });
    if (!res.ok) {
      throw new Error(`이미지 저장 실패 (${missing[i].id})`);
    }
  }

  a.onProgress?.("상태 저장 중");
  const state = {
    // 이미지 데이터는 빼고 위치·크기만 (본체는 서버 파일로 따로 저장됨)
    images: a.images.map(({ src, ...rest }) => {
      void src;
      return rest;
    }),
    texts: a.texts,
    shapes: a.shapes,
    notes: a.notes,
    viewport: a.viewport,
  };
  const resp = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: a.boardId,
      name: a.name,
      state,
      updatedBy: a.myName,
      knownUpdatedAt: a.knownUpdatedAt,
      keepImageIds: a.images.map((i) => i.id),
    }),
  });
  const j = await resp.json();
  if (resp.status === 409) {
    const err = new Error(j.message || "다른 사람이 먼저 저장했습니다");
    (err as Error & { conflict?: boolean }).conflict = true;
    throw err;
  }
  if (!resp.ok) throw new Error(j.error || "저장 실패");
  return j.meta as { updatedAt: string; name: string; id: string };
}

export async function loadBoard(boardId: string) {
  const resp = await fetch(`/api/boards/${boardId}`);
  const j = await resp.json();
  if (!resp.ok) throw new Error(j.error || "불러오기 실패");

  const images: PlacedImage[] = (j.state?.images || [])
    .map((im: Omit<PlacedImage, "src">) => ({
      ...im,
      src: j.images?.[im.id],
    }))
    .filter((im: PlacedImage) => !!im.src);

  return {
    meta: j.meta,
    images,
    texts: (j.state?.texts || []) as PlacedText[],
    shapes: (j.state?.shapes || []) as PlacedShape[],
    notes: (j.state?.notes || []) as PlacedNote[],
    viewport: j.state?.viewport || { x: 0, y: 0, scale: 1 },
  };
}
