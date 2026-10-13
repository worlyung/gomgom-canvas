// 이 PC 폰트를 브라우저에 불러오기 (P3)
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
