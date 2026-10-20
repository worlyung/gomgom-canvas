// Editable browser adaptation of the carousel layout ideas in chegom/ig-cardnews.
// Attribution and MIT notice: public/licenses/ig-cardnews.txt
import type { PlacedImage, PlacedShape, PlacedText } from "@/types/canvas";
import { ensureLocalFont, localFontValue } from "./local-fonts";

export const CARD_W = 1080;
export const CARD_H = 1350;
export const CARD_FONT = '"Malgun Gothic", sans-serif';
export const CARD_LAYOUTS = {
  cover: "표지", photo_story: "사진과 이야기", points: "번호 목록",
  caution: "안내 사항", prompt: "정보 박스", outro: "마무리", brandcard: "브랜드 카드",
} as const;
export type CardLayout = keyof typeof CARD_LAYOUTS;
export interface CardText {
  id: string; role: string; text: string; x: number; y: number; width: number;
  size: number; color: string; bold: boolean; align?: "left" | "center" | "right"; fontFamily?: string;
}
export interface NewsCard {
  id: string; layout: CardLayout; background: string; photo?: string;
  focalX: number; focalY: number; zoom: number; shade: number; accent: string;
  texts: CardText[];
}
export interface CardDeck { version: 1; name: string; cards: NewsCard[] }
export const cardId = () => crypto.randomUUID();

export function makeCard(layout: CardLayout = "cover", source?: NewsCard): NewsCard {
  const text = (role: string, value: string, y: number, size: number, bold = false): CardText => ({
    id: cardId(), role, text: source?.texts.find(t => t.role === role)?.text ?? value,
    x: 80, y, width: 920, size, color: "#ffffff", bold, fontFamily: source?.texts.find(t=>t.role===role)?.fontFamily,
  });
  const texts = [text("브랜드", "GOMGOM STUDIO", 68, 27, true)];
  if (layout === "cover") texts.push(text("제목", "우리의 이야기가\n시작되는 곳", 670, 88, true), text("본문", "행사명과 소개 문구를 적어 주세요", 960, 36));
  else if (layout === "outro") texts.push(text("제목", "함께 만나요", 550, 86, true), text("본문", "날짜 · 장소\n참여 방법과 문의처를 알려 주세요", 780, 38));
  else if (layout === "brandcard") texts.push(text("제목", "기억에 남을\n하루를 만듭니다", 430, 84, true), text("본문", "브랜드의 이야기를 담아 주세요", 780, 38));
  else {
    texts.push(text("제목", layout === "points" ? "이렇게 즐겨 보세요" : layout === "caution" ? "방문 전 확인해 주세요" : "오늘의 이야기", 560, 66, true));
    texts.push(text("본문", layout === "points" ? "01  첫 번째 프로그램\n02  두 번째 프로그램\n03  세 번째 프로그램" : layout === "caution" ? "• 운영 시간\n• 교통과 주차\n• 준비물과 유의 사항" : layout === "prompt" ? "일시와 장소\n신청 방법과 참가 대상\n꼭 알아야 할 정보를 적어 주세요" : "사진에 담긴 이야기를 적어 주세요.\n글씨와 배경은 따로 수정할 수 있어요.", 800, 36));
  }
  return { id: cardId(), layout, background: source?.background || "#203c34", photo: source?.photo,
    focalX: source?.focalX ?? 50, focalY: source?.focalY ?? 50, zoom: source?.zoom ?? 1,
    shade: source?.shade ?? 45, accent: source?.accent || "#d8e6aa", texts };
}

export function newDeck(): CardDeck {
  return { version: 1, name: "새 카드뉴스", cards: [makeCard("cover"), makeCard("photo_story"), makeCard("outro")] };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const photoRect = (iw: number, ih: number, c: NewsCard) => {
  const scale = Math.max(CARD_W / iw, CARD_H / ih) * c.zoom;
  const width = iw * scale, height = ih * scale;
  return { x: (CARD_W - width) * c.focalX / 100, y: (CARD_H - height) * c.focalY / 100, width, height };
};

export const cardFont = (t: CardText) => t.fontFamily ? localFontValue(t.fontFamily) : CARD_FONT;
export async function ensureCardFonts(card: NewsCard): Promise<string[]> {
  const families=[...new Set(card.texts.map(t=>t.fontFamily).filter((f): f is string=>!!f && f!=="Malgun Gothic"))];
  const results=await Promise.all(families.map(async family=>await ensureLocalFont(family)?null:family));
  return results.filter((f): f is string=>f!==null);
}
export function layoutText(ctx: CanvasRenderingContext2D, t: CardText) {
  ctx.font = `${t.bold ? "bold" : "normal"} ${t.size}px ${cardFont(t)}`;
  const lines: string[] = [];
  for (const paragraph of t.text.split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (line && ctx.measureText(line + char).width > t.width) { lines.push(line); line = char; }
      else line += char;
    }
    lines.push(line);
  }
  return { lines, height: lines.length * t.size * 1.35 };
}

export function imageFrom(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => resolve(im); im.onerror = () => reject(new Error("사진을 불러오지 못했어요. 다른 파일을 선택해 주세요.")); im.src = src;
  });
}

export function textLineX(ctx: CanvasRenderingContext2D, t: CardText, line: string) {
  return t.x + (t.width - ctx.measureText(line).width) * (t.align === "center" ? .5 : t.align === "right" ? 1 : 0);
}

export async function normalizePhoto(src: string) {
  const im = await imageFrom(src);
  const ratio = Math.min(1, 2160 / Math.max(im.width, im.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(im.width * ratio)); canvas.height = Math.max(1, Math.round(im.height * ratio));
  canvas.getContext("2d")!.drawImage(im, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .9);
}

export async function readPhoto(file: File) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("JPG, PNG, WebP 사진을 선택해 주세요.");
  if (file.size > 20 * 1024 * 1024) throw new Error("사진은 한 장에 20MB 이하로 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try { return await normalizePhoto(url); } finally { URL.revokeObjectURL(url); }
}

export async function drawCard(canvas: HTMLCanvasElement, card: NewsCard, page: number, total: number) {
  await ensureCardFonts(card);
  // Load before painting so a failed photo never silently exports as a blank background.
  const im = card.photo ? await imageFrom(card.photo) : null;
  paintCard(canvas, card, page, total, im);
}

// The interactive preview reuses its decoded photo on every animation frame.
export function paintCard(canvas: HTMLCanvasElement, card: NewsCard, page: number, total: number, im: HTMLImageElement | null) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.scale(canvas.width / CARD_W, canvas.height / CARD_H);
  ctx.fillStyle = card.background; ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (im) {
    const r = photoRect(im.width, im.height, card); ctx.drawImage(im, r.x, r.y, r.width, r.height);
    ctx.fillStyle = `rgba(0,0,0,${card.shade / 100})`; ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  if (card.layout === "prompt") { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(54, 770, 972, 430); }
  ctx.fillStyle = card.accent; ctx.fillRect(80, 465, 100, 8);
  for (const t of card.texts) {
    const { lines } = layoutText(ctx, t); ctx.fillStyle = t.color; ctx.textBaseline = "top";
    lines.forEach((line, i) => ctx.fillText(line, textLineX(ctx,t,line), t.y + i * t.size * 1.35));
  }
  ctx.font = `24px ${CARD_FONT}`; ctx.fillStyle = card.accent; ctx.fillText(`${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 870, 1270);
  ctx.restore();
}

export function textOverflow(card: NewsCard) {
  const ctx = document.createElement("canvas").getContext("2d")!;
  return card.texts.some(t => t.x + t.width > CARD_W || t.y + layoutText(ctx, t).height > 1230);
}

export async function cardPng(card: NewsCard, page: number, total: number) {
  const canvas = document.createElement("canvas"); canvas.width = CARD_W; canvas.height = CARD_H;
  await drawCard(canvas, card, page, total);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("이미지 저장에 실패했어요.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

// Import a card as separate native canvas layers, never a flattened finished image.
export async function cardLayers(card: NewsCard, page: number, total: number, x: number, y: number, z: number) {
  await ensureCardFonts(card);
  const images: PlacedImage[] = [], shapes: PlacedShape[] = [], texts: PlacedText[] = [];
  const rect = (rx: number, ry: number, width: number, height: number, fill: string, opacity = 1) => shapes.push({
    id: cardId(), kind: "rect", x: x + rx, y: y + ry, width, height, fill, stroke: fill, strokeWidth: 0, opacity, rotation: 0, z: z++,
  });
  rect(0, 0, CARD_W, CARD_H, card.background);
  if (card.photo) {
    const im = await imageFrom(card.photo); const r = photoRect(im.width, im.height, card);
    const scale = r.width / im.width;
    images.push({ id: cardId(), src: card.photo, x, y, width: CARD_W, height: CARD_H, rotation: 0, z: z++,
      cropX: -r.x / scale / im.width, cropY: -r.y / scale / im.height,
      cropWidth: CARD_W / scale / im.width, cropHeight: CARD_H / scale / im.height });
    rect(0, 0, CARD_W, CARD_H, "#000000", card.shade / 100);
  }
  if (card.layout === "prompt") rect(54, 770, 972, 430, "#000000", .35);
  rect(80, 465, 100, 8, card.accent);
  const ctx = document.createElement("canvas").getContext("2d")!;
  for (const t of card.texts) {
    // One native text layer per visible line preserves the exact wrapping and line spacing.
    layoutText(ctx, t).lines.forEach((line, i) => texts.push({ id: cardId(), text: line, x: x + textLineX(ctx,t,line), y: y + t.y + i * t.size * 1.35,
      fontSize: t.size, fill: t.color, fontFamily: cardFont(t), bold: t.bold, rotation: 0, z: z++ }));
  }
  texts.push({id: cardId(), text: `${String(page).padStart(2,"0")} / ${String(total).padStart(2,"0")}`, x: x+870, y:y+1270,
    fontSize:24, fill:card.accent, fontFamily:"Malgun Gothic", rotation:0, z:z++});
  return { images, shapes, texts };
}

export function parseDeck(value: unknown): CardDeck {
  const bad = () => { throw new Error("올바른 카드뉴스 작업 파일이 아니에요."); };
  if (!value || typeof value !== "object") return bad();
  const d = value as CardDeck;
  if (d.version !== 1 || typeof d.name !== "string" || !Array.isArray(d.cards) || !d.cards.length || d.cards.length > 20) return bad();
  const color = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v === clamp(v, lo, hi);
  for (const c of d.cards) {
    if (!c || !Object.hasOwn(CARD_LAYOUTS, c.layout) || !color(c.background) || !color(c.accent) || !num(c.shade,0,85) || !num(c.zoom,1,3)
      || !num(c.focalX,0,100) || !num(c.focalY,0,100) || !Array.isArray(c.texts) || c.texts.length > 12) return bad();
    if (c.photo && (typeof c.photo !== "string" || c.photo.length > 12_000_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.photo))) return bad();
    for (const t of c.texts) if (!t || typeof t.text !== "string" || t.text.length > 2000 || typeof t.role !== "string" || typeof t.bold !== "boolean"
      || !color(t.color) || !num(t.x,0,1000) || !num(t.y,0,1250) || !num(t.width,80,1000) || !num(t.size,16,140)
      || (t.align !== undefined && !["left","center","right"].includes(t.align))) return bad();
    for (const t of c.texts) if(t.fontFamily!==undefined && (typeof t.fontFamily!=="string" || !t.fontFamily.trim() || t.fontFamily.length>160 || /['"\\\x00-\x1f]/.test(t.fontFamily))) return bad();
  }
  // Regenerate IDs to prevent duplicate or untrusted identifiers in imported projects.
  return {version:1, name:d.name.slice(0,100), cards:d.cards.map(c => ({...c,id:cardId(),texts:c.texts.map(t=>({...t,id:cardId()}))}))};
}

export function downloadFile(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const safeDeckName = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().slice(0,80) || "카드뉴스";
