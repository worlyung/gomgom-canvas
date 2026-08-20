// 선택 이미지 ZIP 일괄 다운로드 (F-06)
import { zipSync } from "fflate";

export async function downloadImagesAsZip(
  images: { src: string; promptHint?: string }[],
) {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < images.length; i++) {
    const buf = new Uint8Array(await (await fetch(images[i].src)).arrayBuffer());
    const hint = images[i].promptHint || "이미지";
    files[`${String(i + 1).padStart(2, "0")}_${hint}.png`] = buf;
  }
  const blob = new Blob([zipSync(files)], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `canvas-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
