// 이 PC 폰트를 브라우저에 불러오기 (P3)
import { openDB } from "idb";

interface ImportedFont {
  family: string;
  name: string;
  data: ArrayBuffer;
}
const fontDB = () =>
  openDB("gomgom-imported-fonts", 1, {
    upgrade(db) {
      db.createObjectStore("fonts", { keyPath: "family" });
    },
  });
export async function importedFonts(): Promise<ImportedFont[]> {
  const db = await fontDB();
  try {
    return await db.getAll("fonts");
  } finally {
    db.close();
  }
}
export async function importFont(file: File): Promise<string> {
  if (!/\.(ttf|otf)$/i.test(file.name))
    throw new Error("TTF 또는 OTF 폰트를 선택해 주세요.");
  if (file.size > 30 * 1024 * 1024)
    throw new Error("폰트 파일은 30MB 이하로 넣어 주세요.");
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const family = `GomgomFont-${hash}`;
  const face = await new FontFace(family, data).load();
  const db = await fontDB();
  try {
    await db.put("fonts", {
      family,
      name: file.name.replace(/\.(ttf|otf)$/i, ""),
      data,
    });
  } finally {
    db.close();
  }
  document.fonts.add(face);
  loading.set(family, Promise.resolve(true));
  document.dispatchEvent(new Event("gomgom-font-loaded"));
  return family;
}
// 목록은 한 번만 받고, 폰트 파일은 실제로 고를 때·글씨가 쓸 때만 내려받는다
export interface LocalFont {
  family: string;
  file: string; // "폴더|파일명" — /api/fonts/file?name= 에 그대로 넘긴다
}

let listPromise: Promise<LocalFont[]> | null = null;
export function listLocalFonts(): Promise<LocalFont[]> {
  if (!listPromise) {
    listPromise = fetch("/api/fonts")
      .then((r) => r.json())
      .then((j) => (j.fonts || []) as LocalFont[])
      .catch(() => []);
  }
  return listPromise;
}

/** 캔버스 fontFamily 값 ↔ PC 폰트 이름 */
export const localFontValue = (family: string) =>
  `'${family.replace(/'/g, "")}', 'Malgun Gothic', sans-serif`;
export function familyFromValue(v: string): string | null {
  const m = v.match(/^'([^']+)'/);
  return m ? m[1] : null;
}

const loading = new Map<string, Promise<boolean>>();

/** PC 폰트면 내려받아 document.fonts 에 넣는다. 구글 폰트 등 목록에 없는 이름이면 아무것도 안 한다 */
export function ensureLocalFont(family: string): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  const cached = loading.get(family);
  if (cached) return cached;
  const p = listLocalFonts().then(async (fonts) => {
    if (family.startsWith("GomgomFont-")) {
      try {
        const saved = (await importedFonts()).find((f) => f.family === family);
        if (!saved) return false;
        document.fonts.add(await new FontFace(family, saved.data).load());
        document.dispatchEvent(new Event("gomgom-font-loaded"));
        return true;
      } catch {
        return false;
      }
    }
    const f = fonts.find((x) => x.family === family);
    if (!f) return false;
    try {
      const face = new FontFace(
        family,
        `url(/api/fonts/file?name=${encodeURIComponent(f.file)})`,
      );
      await face.load();
      document.fonts.add(face);
      return true;
    } catch {
      return false;
    }
  });
  loading.set(family, p);
  return p;
}
