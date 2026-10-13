// 투명 배경 검사 (P4) — 모델이 "투명"을 무시하고 배경을 채워 보냈는지 가장자리 알파로 판별
// 가장자리 픽셀의 절반 이상이 투명(알파<16)이면 진짜 투명 PNG로 본다
export async function hasTransparentEdge(dataUrl: string): Promise<boolean> {
  const el = new window.Image();
  el.src = dataUrl;
  await new Promise((r, j) => {
    el.onload = r;
    el.onerror = j;
  });
  const c = document.createElement("canvas");
  c.width = el.naturalWidth;
  c.height = el.naturalHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return true; // 판별 불가면 손대지 않는다
  ctx.drawImage(el, 0, 0);
  const { width: w, height: h } = c;
  const step = Math.max(1, Math.floor(Math.max(w, h) / 64));
  let clear = 0;
  let total = 0;
  const probe = (x: number, y: number) => {
    total++;
    if (ctx.getImageData(x, y, 1, 1).data[3] < 16) clear++;
  };
  for (let x = 0; x < w; x += step) {
    probe(x, 0);
    probe(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    probe(0, y);
    probe(w - 1, y);
  }
  return clear / total >= 0.5;
}
