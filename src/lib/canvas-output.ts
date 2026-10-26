import type { PlacedImage } from "@/types/canvas";

export const MAX_EXPORT_PIXELS = 60_000_000;
export function checkExportSize(width: number, height: number) {
  if (
    !Number.isFinite(width * height) ||
    width <= 0 ||
    height <= 0 ||
    Math.max(width, height) > 16384 ||
    width * height > MAX_EXPORT_PIXELS
  ) {
    throw new Error(
      "출력이 너무 커요. 6천만 픽셀·긴 변 16,384px 이하로 판 크기를 줄여 주세요.",
    );
  }
}

export async function loadOutputImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  const ready = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("이미지를 읽지 못했어요. 다시 불러와 주세요."));
  });
  image.src = src;
  return ready;
}

/** Render the selected image independently of its world position, preserving its crop. */
export async function renderSelectedImage(
  image: PlacedImage,
  width: number,
  height: number,
  mode: "contain" | "cover",
) {
  checkExportSize(width, height);
  const source = await loadOutputImage(image.src);
  const sw = source.naturalWidth * (image.cropWidth ?? 1),
    sh = source.naturalHeight * (image.cropHeight ?? 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const angle = (image.rotation * Math.PI) / 180;
  const bw = Math.abs(sw * Math.cos(angle)) + Math.abs(sh * Math.sin(angle));
  const bh = Math.abs(sw * Math.sin(angle)) + Math.abs(sh * Math.cos(angle));
  const scale =
    mode === "cover"
      ? Math.max(width / bw, height / bh)
      : Math.min(width / bw, height / bh);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);
  ctx.drawImage(
    source,
    (image.cropX ?? 0) * source.naturalWidth,
    (image.cropY ?? 0) * source.naturalHeight,
    sw,
    sh,
    (-sw * scale) / 2,
    (-sh * scale) / 2,
    sw * scale,
    sh * scale,
  );
  return canvas.toDataURL("image/png");
}

/** Insert a PNG pHYs chunk without re-encoding pixels. */
export async function pngWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = new Uint8Array(21),
    view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  const ppm = Math.round(dpi / 0.0254);
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.slice(4, 17)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts: Uint8Array[] = [bytes.slice(0, 33), chunk];
  for (let at = 33; at < bytes.length; ) {
    const length = new DataView(bytes.buffer).getUint32(at),
      end = at + length + 12;
    if (String.fromCharCode(...bytes.slice(at + 4, at + 8)) !== "pHYs")
      parts.push(bytes.slice(at, end));
    at = end;
  }
  return new Blob(parts, { type: "image/png" });
}
