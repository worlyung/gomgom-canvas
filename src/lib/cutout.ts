// 진짜 오려내기 — 원본 픽셀은 그대로 두고 배경만 투명 (AI 재생성이 아님)
// 실제 처리는 서버(/api/cutout)에서: 모델을 서버가 한 번만 받아 모두가 함께 쓴다.
export async function cutoutBackground(
  imageDataUrl: string,
  onProgress?: (msg: string) => void,
): Promise<string> {
  onProgress?.("배경을 오려내는 중… (처음 한 번은 모델 준비로 오래 걸려요)");
  const resp = await fetch("/api/cutout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUrl }),
  });
  const j = await resp.json();
  if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
  if (!j.image) throw new Error("결과 이미지가 없습니다");
  return j.image;
}
