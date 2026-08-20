// gpt-image-2 생성 흐름 (fal 대체): 선택 이미지 = 참조(F-04, 최대 16장) → /api/generate → 캔버스 배치
import type { PlacedImage } from "@/types/canvas";

interface RunDeps {
  images: PlacedImage[];
  selectedIds: string[];
  prompt: string;
  size: string;
  quality: string;
  canvasSize: { width: number; height: number };
  viewport: { x: number; y: number; scale: number };
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  toast: (props: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

// 크롭 반영해서 원본 해상도 PNG dataURL로 추출 (generation-handler의 추출 로직 이식)
async function exportImageAsDataUrl(img: PlacedImage): Promise<string> {
  const el = new window.Image();
  el.crossOrigin = "anonymous";
  el.src = img.src;
  await new Promise((resolve, reject) => {
    el.onload = resolve;
    el.onerror = reject;
  });

  const cropX = img.cropX || 0;
  const cropY = img.cropY || 0;
  const cropWidth = img.cropWidth || 1;
  const cropHeight = img.cropHeight || 1;

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth * el.naturalWidth;
  canvas.height = cropHeight * el.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  ctx.drawImage(
    el,
    cropX * el.naturalWidth,
    cropY * el.naturalHeight,
    cropWidth * el.naturalWidth,
    cropHeight * el.naturalHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/png");
}

export const placeholderSrc = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="100%" height="100%" fill="#e5e5e5"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#666" text-anchor="middle" dominant-baseline="middle">생성 중…</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
})();

// 원본 픽셀 크기에 가장 가까운 지원 출력 크기
function pickSize(w: number, h: number): string {
  const ratio = w / h;
  if (ratio > 1.2) return "1536x1024";
  if (ratio < 0.83) return "1024x1536";
  return "1024x1024";
}

// 부분 수정 (F-07): 원본 + 마스크(알파=0=수정영역) → 옆에 결과 배치
export async function runMaskEdit(deps: {
  image: PlacedImage;
  maskDataUrl: string;
  prompt: string;
  quality: string;
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  toast: RunDeps["toast"];
}) {
  const {
    image,
    maskDataUrl,
    prompt,
    quality,
    setImages,
    setSelectedIds,
    setIsGenerating,
    toast,
  } = deps;

  if (!prompt.trim()) {
    toast({
      title: "프롬프트를 입력하세요",
      description: "칠한 부분을 어떻게 바꿀지 프롬프트 창에 적어주세요",
      variant: "destructive",
    });
    return;
  }

  const placeholderId = `generated-${Date.now()}`;
  setImages((prev) => [
    ...prev,
    {
      id: placeholderId,
      src: placeholderSrc,
      x: image.x + image.width + 20,
      y: image.y,
      width: image.width,
      height: image.height,
      rotation: 0,
      isGenerated: true,
    },
  ]);

  setIsGenerating(true);
  try {
    const ref = await exportImageAsDataUrl(image);
    const probe = new window.Image();
    probe.src = ref;
    await new Promise((r) => (probe.onload = r));

    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        size: pickSize(probe.naturalWidth, probe.naturalHeight),
        quality,
        refs: [ref],
        mask: maskDataUrl,
      }),
    });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
    if (!j.images?.length) throw new Error("결과 이미지가 없습니다");

    setImages((prev) =>
      prev.map((img) =>
        img.id === placeholderId ? { ...img, src: j.images[0] } : img,
      ),
    );
    setSelectedIds([placeholderId]);
    window.dispatchEvent(new Event("usage-updated"));
  } catch (error) {
    setImages((prev) => prev.filter((img) => img.id !== placeholderId));
    toast({
      title: "부분 수정 실패",
      description: error instanceof Error ? error.message : "알 수 없는 오류",
      variant: "destructive",
    });
  } finally {
    setIsGenerating(false);
  }
}

export async function runOpenAIGeneration(deps: RunDeps) {
  const {
    images,
    selectedIds,
    prompt,
    size,
    quality,
    canvasSize,
    viewport,
    setImages,
    setSelectedIds,
    setIsGenerating,
    toast,
  } = deps;

  if (!prompt.trim()) {
    toast({ title: "프롬프트를 입력하세요", variant: "destructive" });
    return;
  }

  const selected = images.filter((img) => selectedIds.includes(img.id));
  if (selected.length > 16) {
    toast({
      title: "참조는 최대 16장",
      description: `선택 ${selected.length}장 중 앞 16장만 참조로 씁니다`,
    });
  }
  const refImages = selected.slice(0, 16);

  // 출력 배치 위치·크기
  const [w, h] = size.split("x").map(Number);
  const aspect = w && h ? w / h : 1;
  const dispW = 300;
  const dispH = Math.round(dispW / aspect);
  let x: number, y: number;
  if (refImages.length > 0) {
    const first = refImages[0];
    x = first.x + first.width + 20;
    y = first.y;
  } else {
    x = (canvasSize.width / 2 - viewport.x) / viewport.scale - dispW / 2;
    y = (canvasSize.height / 2 - viewport.y) / viewport.scale - dispH / 2;
  }

  const placeholderId = `generated-${Date.now()}`;
  setImages((prev) => [
    ...prev,
    {
      id: placeholderId,
      src: placeholderSrc,
      x,
      y,
      width: dispW,
      height: dispH,
      rotation: 0,
      isGenerated: true,
    },
  ]);

  setIsGenerating(true);
  try {
    const refs = await Promise.all(refImages.map(exportImageAsDataUrl));
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size, quality, refs }),
    });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
    if (!j.images?.length) throw new Error("결과 이미지가 없습니다");

    setImages((prev) =>
      prev.map((img) =>
        img.id === placeholderId ? { ...img, src: j.images[0] } : img,
      ),
    );
    setSelectedIds([placeholderId]);
    window.dispatchEvent(new Event("usage-updated"));
  } catch (error) {
    setImages((prev) => prev.filter((img) => img.id !== placeholderId));
    toast({
      title: "생성 실패",
      description: error instanceof Error ? error.message : "알 수 없는 오류",
      variant: "destructive",
    });
  } finally {
    setIsGenerating(false);
  }
}
