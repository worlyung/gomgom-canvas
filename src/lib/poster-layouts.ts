// 정재훈 / 한국형 레이아웃 구성 도감, CC BY 4.0. Auto-placement adapted separately.
// https://github.com/worlyung/korean-layout-compositions
import catalog from "./composition-catalog.json";
const posterIds = [
  142, 143, 146, 148, 1, 13, 16, 17, 18, 19, 139, 140, 141, 144, 145, 147, 149,
  151, 153, 154, 156, 159, 160, 161,
];
export const POSTER_LAYOUTS = posterIds.map((id) => {
  const item = catalog.find((c) => c.id === id)!;
  return {
    id,
    name: item.name_ko,
    instruction: `${item.desc} 한 장의 포스터에 적용한다. 제목과 필수 정보의 가독성을 지키고 여러 시안을 한 이미지에 모으지 않는다.`,
  };
});
export type PosterLayoutId = number;
export function getPosterLayout(id: number | undefined) {
  return POSTER_LAYOUTS.find((l) => l.id === id);
}
export function posterLayoutForIndex(index: number) {
  return POSTER_LAYOUTS[index % POSTER_LAYOUTS.length];
}
export type LayoutBox = { x: number; y: number; w: number; h: number };
type SourceLayout = {
  image: LayoutBox;
  title: LayoutBox;
  info: LayoutBox;
  fontSize: number;
  frame?: boolean;
};
// Non-overlapping zones on a 1024 x 1536 board; images always use contain.
export const SOURCE_LAYOUTS: Record<number, SourceLayout> = {
  142: {
    title: { x: 72, y: 64, w: 880, h: 440 },
    image: { x: 88, y: 550, w: 848, h: 700 },
    info: { x: 72, y: 1310, w: 880, h: 166 },
    fontSize: 110,
  },
  143: {
    title: { x: 72, y: 64, w: 880, h: 240 },
    image: { x: 88, y: 340, w: 848, h: 900 },
    info: { x: 72, y: 1310, w: 880, h: 166 },
    fontSize: 76,
  },
  146: {
    title: { x: 64, y: 64, w: 530, h: 390 },
    image: { x: 64, y: 500, w: 896, h: 780 },
    info: { x: 650, y: 64, w: 310, h: 390 },
    fontSize: 96,
    frame: true,
  },
  1: {
    title: { x: 64, y: 64, w: 896, h: 300 },
    image: { x: 340, y: 410, w: 620, h: 800 },
    info: { x: 64, y: 1270, w: 896, h: 206 },
    fontSize: 86,
  },
  13: {
    title: { x: 100, y: 110, w: 824, h: 320 },
    image: { x: 460, y: 700, w: 440, h: 480 },
    info: { x: 100, y: 1290, w: 824, h: 186 },
    fontSize: 70,
  },
  16: {
    title: { x: 180, y: 80, w: 664, h: 250 },
    image: { x: 180, y: 380, w: 664, h: 780 },
    info: { x: 180, y: 1260, w: 664, h: 216 },
    fontSize: 80,
  },
  17: {
    title: { x: 550, y: 80, w: 410, h: 450 },
    image: { x: 64, y: 590, w: 670, h: 650 },
    info: { x: 64, y: 1290, w: 896, h: 186 },
    fontSize: 86,
  },
  18: {
    title: { x: 100, y: 1050, w: 824, h: 240 },
    image: { x: 100, y: 64, w: 824, h: 930 },
    info: { x: 100, y: 1340, w: 824, h: 136 },
    fontSize: 80,
  },
  19: {
    title: { x: 64, y: 80, w: 390, h: 640 },
    image: { x: 490, y: 260, w: 470, h: 920 },
    info: { x: 64, y: 1270, w: 896, h: 206 },
    fontSize: 90,
  },
  140: {
    title: { x: 64, y: 1160, w: 896, h: 170 },
    image: { x: 40, y: 40, w: 944, h: 1070 },
    info: { x: 64, y: 1380, w: 896, h: 110 },
    fontSize: 68,
  },
  144: {
    title: { x: 140, y: 140, w: 744, h: 230 },
    image: { x: 140, y: 420, w: 744, h: 750 },
    info: { x: 140, y: 1250, w: 744, h: 180 },
    fontSize: 78,
    frame: true,
  },
  156: {
    title: { x: 700, y: 80, w: 260, h: 620 },
    image: { x: 64, y: 80, w: 590, h: 1130 },
    info: { x: 700, y: 820, w: 260, h: 600 },
    fontSize: 64,
  },
};
export const SOURCE_POSTER_LAYOUTS = POSTER_LAYOUTS.filter(
  (l) => !!SOURCE_LAYOUTS[l.id],
);
export function fitPosterText(
  text: string,
  box: LayoutBox,
  preferred: number,
  measure: (s: string, size: number) => number,
) {
  for (let size = preferred; size >= 14; size -= 2) {
    // Prefer keeping Korean words together, especially in narrow side columns.
    if (
      size > 16 &&
      text.split(/\s+/).some((word) => measure(word, size) > box.w)
    )
      continue;
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const token of paragraph.match(/\S+\s*/g) || []) {
        if (line && measure(line + token.trimEnd(), size) > box.w) {
          lines.push(line.trimEnd());
          line = "";
        }
        for (const char of Array.from(token)) {
          if (line && measure(line + char, size) > box.w) {
            lines.push(line.trimEnd());
            line = "";
          }
          line += char;
        }
      }
      lines.push(line.trimEnd());
    }
    if (lines.length * size * 1.25 <= box.h)
      return { text: lines.join("\n"), fontSize: size };
  }
  return null;
}
