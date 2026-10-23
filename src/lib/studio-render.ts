import type { StudioProject } from "./studio-project";
export function projectBounds(p: StudioProject) {
  if (p.artboard) return p.artboard;
  const ctx = document.createElement("canvas").getContext("2d")!;
  const boxes = [...p.images, ...p.shapes, ...p.texts]
    .filter((e) => !e.hidden)
    .map((e) => {
      let w: number, h: number;
      if ("text" in e) {
        ctx.font = `${e.bold ? "bold " : ""}${e.fontSize}px ${e.fontFamily}`;
        w = Math.max(
          ...e.text.split("\n").map((s) => ctx.measureText(s).width),
        );
        h = e.fontSize * 1.2 * e.text.split("\n").length;
      } else {
        w = e.width;
        h = e.height;
      }
      const rad = (e.rotation * Math.PI) / 180,
        cos = Math.cos(rad),
        sin = Math.sin(rad);
      const corners = [
        [0, 0],
        [w, 0],
        [0, h],
        [w, h],
      ].map(([x, y]) => ({
        x: e.x + x * cos - y * sin,
        y: e.y + x * sin + y * cos,
      }));
      return {
        x: Math.min(...corners.map((c) => c.x)),
        y: Math.min(...corners.map((c) => c.y)),
        right: Math.max(...corners.map((c) => c.x)),
        bottom: Math.max(...corners.map((c) => c.y)),
      };
    });
  if (!boxes.length) throw new Error("출력할 요소가 없어요");
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(1, Math.max(...boxes.map((b) => b.right)) - x),
    height: Math.max(1, Math.max(...boxes.map((b) => b.bottom)) - y),
  };
}
export const formats = [
  { name: "SNS 정사각", w: 1080, h: 1080 },
  { name: "세로 홍보", w: 1080, h: 1920 },
  { name: "LED 가로", w: 1920, h: 1080 },
  { name: "현수막", w: 3000, h: 1000 },
  { name: "A2 포스터", w: 4961, h: 7016 },
];
export function resizeProject(
  p: StudioProject,
  f: (typeof formats)[number],
): StudioProject {
  const b = projectBounds(p),
    scale = Math.min(f.w / b.width, f.h / b.height),
    ox = (f.w - b.width * scale) / 2,
    oy = (f.h - b.height * scale) / 2;
  const pos = <T extends { x: number; y: number }>(e: T) => ({
    ...e,
    x: (e.x - b.x) * scale + ox,
    y: (e.y - b.y) * scale + oy,
  });
  return {
    ...p,
    viewport: { x: 0, y: 0, scale: Math.min(1, 700 / f.w, 600 / f.h) },
    artboard: {
      x: 0,
      y: 0,
      width: f.w,
      height: f.h,
      widthMm: (f.w / 300) * 25.4,
      heightMm: (f.h / 300) * 25.4,
      dpi: 300,
      name: f.name,
    },
    images: p.images.map((e) => ({
      ...pos(e),
      width: e.width * scale,
      height: e.height * scale,
    })),
    videos: p.videos.map((e) => ({
      ...pos(e),
      width: e.width * scale,
      height: e.height * scale,
    })),
    texts: p.texts.map((e) => ({ ...pos(e), fontSize: e.fontSize * scale })),
    shapes: p.shapes.map((e) => ({
      ...pos(e),
      width: e.width * scale,
      height: e.height * scale,
      strokeWidth: e.strokeWidth * scale,
    })),
    notes: p.notes.map((e) => ({
      ...pos(e),
      width: e.width * scale,
      targetX: (e.targetX - b.x) * scale + ox,
      targetY: (e.targetY - b.y) * scale + oy,
    })),
  };
}
const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("이미지를 읽지 못했어요"));
    i.src = src;
  });
export async function renderFormat(
  p: StudioProject,
  w: number,
  h: number,
  event?: Record<string, string>,
) {
  if (p.videos.length)
    throw new Error("영상은 정지 이미지 일괄 출력에서 제외해 주세요");
  if (event)
    p = {
      ...p,
      texts: p.texts.map((t) => ({
        ...t,
        text: p.extras.links[t.id]
          ? (event[p.extras.links[t.id]] ?? t.text)
          : t.text,
      })),
    };
  const visible = [...p.images, ...p.shapes, ...p.texts].filter(
    (e) => !e.hidden,
  );
  if (!visible.length) throw new Error("출력할 요소가 없어요");
  const bounds = projectBounds(p);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / bounds.width, h / bounds.height);
  ctx.translate(
    (w - bounds.width * scale) / 2,
    (h - bounds.height * scale) / 2,
  );
  ctx.scale(scale, scale);
  ctx.translate(-bounds.x, -bounds.y);
  for (const e of visible.sort((a, b) => (a.z || 0) - (b.z || 0))) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(((e.rotation || 0) * Math.PI) / 180);
    if ("src" in e) {
      const i = await loadImage(e.src);
      if (e.cropWidth && e.cropHeight)
        ctx.drawImage(
          i,
          (e.cropX || 0) * i.naturalWidth,
          (e.cropY || 0) * i.naturalHeight,
          e.cropWidth * i.naturalWidth,
          e.cropHeight * i.naturalHeight,
          0,
          0,
          e.width,
          e.height,
        );
      else ctx.drawImage(i, 0, 0, e.width, e.height);
    } else if ("text" in e) {
      ctx.fillStyle = e.fill;
      ctx.font = `${e.bold ? "bold " : ""}${e.fontSize}px ${e.fontFamily}`;
      ctx.textBaseline = "top";
      const text =
        event && p.extras.links[e.id]
          ? (event[p.extras.links[e.id]] ?? e.text)
          : e.text;
      const lines = text.split("\n");
      const max = Math.max(...lines.map((l) => ctx.measureText(l).width));
      lines.forEach((line, n) => {
        const offset =
          e.align === "center"
            ? (max - ctx.measureText(line).width) / 2
            : e.align === "right"
              ? max - ctx.measureText(line).width
              : 0;
        if (e.stroke) {
          ctx.strokeStyle = e.stroke;
          ctx.lineWidth = 2;
          ctx.strokeText(line, offset, n * e.fontSize * 1.2);
        }
        ctx.fillText(line, offset, n * e.fontSize * 1.2);
      });
    } else {
      ctx.globalAlpha = e.opacity;
      ctx.strokeStyle = e.stroke;
      ctx.lineWidth = e.strokeWidth;
      ctx.fillStyle = e.fill || "transparent";
      ctx.beginPath();
      if (e.kind === "ellipse")
        ctx.ellipse(
          e.width / 2,
          e.height / 2,
          e.width / 2,
          e.height / 2,
          0,
          0,
          Math.PI * 2,
        );
      else if (e.kind === "rect") ctx.rect(0, 0, e.width, e.height);
      else if (e.kind === "triangle") {
        ctx.moveTo(e.width / 2, 0);
        ctx.lineTo(e.width, e.height);
        ctx.lineTo(0, e.height);
        ctx.closePath();
      } else if (e.kind === "star") {
        for (let n = 0; n < 10; n++) {
          const a = -Math.PI / 2 + (n * Math.PI) / 5,
            r = n % 2 ? 0.22 : 0.5;
          const x = e.width / 2 + Math.cos(a) * e.width * r,
            y = e.height / 2 + Math.sin(a) * e.height * r;
          if (!n) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        ctx.moveTo(0, 0);
        ctx.lineTo(e.width, e.height);
        if (e.kind === "arrow") {
          const a = Math.atan2(e.height, e.width),
            s = Math.max(10, e.strokeWidth * 3);
          ctx.moveTo(
            e.width - Math.cos(a - 0.5) * s,
            e.height - Math.sin(a - 0.5) * s,
          );
          ctx.lineTo(e.width, e.height);
          ctx.lineTo(
            e.width - Math.cos(a + 0.5) * s,
            e.height - Math.sin(a + 0.5) * s,
          );
        }
      }
      if (e.fill) ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("출력 실패"))),
      "image/png",
    ),
  );
}
export async function preflight(p: StudioProject) {
  const warnings: string[] = [];
  if (!p.artboard)
    warnings.push(
      "작업판이 없어 인쇄 크기·재단 여백을 검사할 수 없어요. 규격 출력은 내용 전체를 맞춰 넣어요.",
    );
  for (const im of p.images.filter((i) => !i.hidden)) {
    try {
      const image = await loadImage(im.src);
      const dpi = p.artboard
        ? (image.naturalWidth / im.width) * p.artboard.dpi
        : 0;
      if (dpi && dpi < 150)
        warnings.push(
          `이미지 ${im.id.slice(0, 6)}: 실효 해상도 약 ${Math.round(dpi)} DPI — 인쇄용으로 부족할 수 있어요`,
        );
    } catch {
      warnings.push("읽을 수 없는 이미지가 있어요");
    }
  }
  for (const t of p.texts.filter((t) => !t.hidden)) {
    if (!document.fonts.check(`${t.fontSize}px "${t.fontFamily}"`))
      warnings.push(`폰트 확인 필요: ${t.fontFamily}`);
    const a = p.artboard;
    if (a) {
      const c = document.createElement("canvas").getContext("2d")!;
      c.font = `${t.fontSize}px ${t.fontFamily}`;
      const width = Math.max(
          ...t.text.split("\n").map((l) => c.measureText(l).width),
        ),
        height = t.fontSize * 1.2 * t.text.split("\n").length;
      if (
        t.x < a.x ||
        t.y < a.y ||
        t.x + width > a.x + a.width ||
        t.y + height > a.y + a.height
      )
        warnings.push(`글자 영역이 작업판 밖에 있어요: ${t.text.slice(0, 25)}`);
      if (t.rotation)
        warnings.push(
          "회전한 글자는 출력 미리보기에서 잘림을 직접 확인해 주세요",
        );
    }
  }
  if (p.videos.length)
    warnings.push(
      "영상이 포함되어 있어요. PNG 출력 대신 영상 파일을 별도로 전달해 주세요",
    );
  return warnings.length
    ? warnings
    : [
        "기본 검사에서 문제를 찾지 못했어요. 인쇄소 재단·색상 규격과 최종 시안은 별도로 확인해 주세요.",
      ];
}
