import type {
  Artboard,
  PlacedImage,
  PlacedVideo,
  PlacedText,
  PlacedShape,
  PlacedNote,
} from "@/types/canvas";
import { z } from "zod";
import { openDB } from "idb";
export async function saveStudioExtras(extras: StudioExtras) {
  const db = await openDB("gomgom-studio", 1, {
    upgrade(db) {
      db.createObjectStore("state");
    },
  });
  try {
    await db.put("state", extras, "extras");
  } finally {
    db.close();
  }
}
export async function loadStudioExtras(): Promise<StudioExtras | undefined> {
  const db = await openDB("gomgom-studio", 1, {
    upgrade(db) {
      db.createObjectStore("state");
    },
  });
  try {
    return await db.get("state", "extras");
  } finally {
    db.close();
  }
}

export const eventFields = ["행사명", "일시", "장소", "주최", "문의"] as const;
export type EventField = (typeof eventFields)[number];
export interface StudioExtras {
  event: Record<EventField, string>;
  brand: {
    name: string;
    color: string;
    font: string;
    assets: { id: string; name: string; src: string; role: string }[];
  };
  links: Record<string, EventField>;
  approvedIds: string[];
  settings: {
    prompt: string;
    provider: string;
    model: string;
    size: string;
    quality: string;
  };
}
export function emptyExtras(): StudioExtras {
  return {
    event: { 행사명: "", 일시: "", 장소: "", 주최: "", 문의: "" },
    brand: { name: "예술숲", color: "#173f35", font: "sans-serif", assets: [] },
    links: {},
    approvedIds: [],
    settings: {
      prompt: "",
      provider: "openai",
      model: "",
      size: "1024x1024",
      quality: "high",
    },
  };
}
export interface StudioProject {
  images: PlacedImage[];
  videos: PlacedVideo[];
  texts: PlacedText[];
  shapes: PlacedShape[];
  notes: PlacedNote[];
  artboard: Artboard | null;
  viewport: { x: number; y: number; scale: number };
  extras: StudioExtras;
}
const finite = z.number().finite();
const position = { id: z.string().min(1).max(128), x: finite, y: finite };
const media = z
  .object({
    ...position,
    src: z
      .string()
      .max(300_000_000)
      .refine(
        (s) =>
          /^data:(image\/(png|jpeg|webp|gif)|video\/(mp4|webm));base64,/.test(
            s,
          ),
        "이미지·영상 데이터가 필요해요",
      ),
    width: finite.positive(),
    height: finite.positive(),
    rotation: finite,
  })
  .passthrough();
const schema = z.object({
  format: z.literal("gomgom-project"),
  version: z.literal(1),
  name: z.string().max(200),
  project: z.object({
    images: z.array(media).max(1000),
    videos: z.array(media.extend({ isVideo: z.literal(true) })).max(100),
    texts: z
      .array(
        z
          .object({
            ...position,
            text: z.string().max(50000),
            fontSize: finite.positive(),
            fontFamily: z.string(),
            fill: z.string(),
            rotation: finite,
          })
          .passthrough(),
      )
      .max(5000),
    shapes: z
      .array(
        z
          .object({
            ...position,
            kind: z.enum([
              "rect",
              "ellipse",
              "triangle",
              "star",
              "arrow",
              "line",
            ]),
            width: finite,
            height: finite,
            rotation: finite,
            stroke: z.string(),
            strokeWidth: finite,
            opacity: finite,
          })
          .passthrough(),
      )
      .max(5000),
    notes: z
      .array(
        z
          .object({
            ...position,
            text: z.string(),
            width: finite,
            color: z.string(),
            targetX: finite,
            targetY: finite,
          })
          .passthrough(),
      )
      .max(1000),
    viewport: z.object({
      x: finite,
      y: finite,
      scale: finite.positive().max(100),
    }),
    artboard: z
      .object({
        x: finite,
        y: finite,
        width: finite.positive(),
        height: finite.positive(),
        widthMm: finite.positive(),
        heightMm: finite.positive(),
        dpi: finite.positive(),
        name: z.string(),
      })
      .nullable(),
    extras: z.object({
      event: z.object({
        행사명: z.string(),
        일시: z.string(),
        장소: z.string(),
        주최: z.string(),
        문의: z.string(),
      }),
      brand: z.object({
        name: z.string(),
        color: z.string(),
        font: z.string(),
        assets: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              src: media.shape.src,
              role: z.string(),
            }),
          )
          .max(100),
      }),
      links: z.record(z.enum(eventFields)),
      approvedIds: z.array(z.string()),
      settings: z.object({
        prompt: z.string(),
        provider: z.string(),
        model: z.string(),
        size: z.string(),
        quality: z.string(),
      }),
    }),
  }),
});
export function parseProject(raw: unknown) {
  return schema.parse(raw) as unknown as {
    format: string;
    version: number;
    name: string;
    project: StudioProject;
  };
}
export async function portableProject(project: StudioProject, name: string) {
  const embed = async (src: string) => {
    if (src.startsWith("data:")) return src;
    const r = await fetch(src);
    if (!r.ok) throw new Error("자료 다운로드 실패");
    const b = await r.blob();
    if (b.size > 200 * 1024 * 1024)
      throw new Error("자료 한 개는 200MB 이하여야 해요");
    return await new Promise<string>((resolve, reject) => {
      const f = new FileReader();
      f.onload = () => resolve(String(f.result));
      f.onerror = reject;
      f.readAsDataURL(b);
    });
  };
  const images = await Promise.all(
    project.images.map(async (m) => ({ ...m, src: await embed(m.src) })),
  );
  const videos = await Promise.all(
    project.videos.map(async (m) => ({
      ...m,
      src: await embed(m.src),
      isPlaying: false,
    })),
  );
  const assets = await Promise.all(
    project.extras.brand.assets.map(async (m) => ({
      ...m,
      src: await embed(m.src),
    })),
  );
  return parseProject({
    format: "gomgom-project",
    version: 1,
    name,
    project: {
      ...project,
      images,
      videos,
      extras: { ...project.extras, brand: { ...project.extras.brand, assets } },
    },
  });
}
export function downloadFile(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았어요");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  const headers =
    rows.shift()?.map((s) => s.replace(/^\uFEFF/, "").trim()) || [];
  if (!headers.length || new Set(headers).size !== headers.length)
    throw new Error("CSV 제목 행을 확인해 주세요");
  return rows.map((r) => {
    if (r.length !== headers.length)
      throw new Error("CSV 열 개수가 맞지 않아요");
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}
