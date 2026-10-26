// gpt-image-2 생성 흐름 (fal 대체): 선택 이미지 = 참조(F-04, 최대 16장) → /api/generate → 캔버스 배치
import React from "react";
import { genFetch, isCancel } from "@/lib/generation-abort";
import { normalizeSize, sizeForAspect } from "@/lib/image-sizes";
import { loadOutputImage } from "@/lib/canvas-output";
import type { PlacedImage } from "@/types/canvas";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";

// 프롬프트 앞부분으로 파일명용 요약 만들기 (예: "가을-밤-국악과-만나다")
export function slugFromPrompt(prompt: string): string {
  const words = prompt
    .replace(/[^\w가-힣a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join("-");
  return words.slice(0, 24) || "이미지";
}

// 실패 토스트의 "다시 시도" 버튼
function retryAction(fn: () => void): ToastActionElement {
  return React.createElement(
    ToastAction,
    { altText: "다시 시도", onClick: fn },
    "다시 시도",
  ) as unknown as ToastActionElement;
}

interface RunDeps {
  n?: number;
  workspaceLeft?: number;
  workspaceRight?: number;
  workspaceBottom?: number;
  setViewport?: (viewport: {x:number; y:number; scale:number}) => void;
  images: PlacedImage[];
  selectedIds: string[];
  prompt: string;
  size: string;
  quality: string;
  transparent?: boolean; // 투명 배경 PNG
  provider?: string; // openai | gemini | grok
  geminiModel?: string;
  openaiModel?: string;
  canvasSize: { width: number; height: number };
  viewport: { x: number; y: number; scale: number };
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  toast: (props: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
    action?: ToastActionElement;
  }) => void;
}

// 생성 이력 (F-10) — localStorage 기록, history-panel이 구독
export interface HistoryEntry {
  model?: string;
  provider?: string;
  referenceIds?: string[];
  resultIds?: string[];
  ts: string;
  kind: string; // 생성 | 부분수정 | 글자수정 | 사이즈 전개 | 카드뉴스
  prompt: string;
  size: string;
  quality: string;
  refs: number;
}
const HISTORY_KEY = "gomgom-gen-history";
export function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}
function recordHistory(entry: Omit<HistoryEntry, "ts">) {
  try {
    const list = [{ ...entry, ts: new Date().toISOString() }, ...readHistory()];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
    window.dispatchEvent(new Event("history-updated"));
  } catch {}
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
  const exact = normalizeSize(w, h);
  return "value" in exact ? exact.value : sizeForAspect(w, h);
}

// 사이즈 전개 (아웃페인팅): 원본을 목표 비율 캔버스에 넣고 빈 영역만 이어 그리기
export async function runExpand(deps: {
  image: PlacedImage;
  target: string; // "1536x1024" | "1024x1536" | "1024x1024"
  quality: string;
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  toast: RunDeps["toast"];
}) {
  const { image, target, quality, setImages, setSelectedIds, setIsGenerating, toast } = deps;
  const [tw, th] = target.split("x").map(Number);

  const dispH = image.height;
  const dispW = Math.round((dispH * tw) / th);
  const placeholderId = `generated-${Date.now()}`;
  setImages((prev) => [
    ...prev,
    {
      id: placeholderId,
      src: placeholderSrc,
      x: image.x + image.width + 20,
      y: image.y,
      width: dispW,
      height: dispH,
      rotation: 0,
      isGenerated: true,
    },
  ]);

  setIsGenerating(true);
  try {
    const src = await exportImageAsDataUrl(image);
    const el = new window.Image();
    el.src = src;
    await new Promise((r) => (el.onload = r));

    // 원본을 목표 캔버스에 contain 배치, 나머지는 투명(=채울 영역)
    const scale = Math.min(tw / el.naturalWidth, th / el.naturalHeight);
    const dw = el.naturalWidth * scale;
    const dh = el.naturalHeight * scale;
    const dx = (tw - dw) / 2;
    const dy = (th - dh) / 2;

    const padded = document.createElement("canvas");
    padded.width = tw;
    padded.height = th;
    padded.getContext("2d")!.drawImage(el, dx, dy, dw, dh);

    const mask = document.createElement("canvas");
    mask.width = tw;
    mask.height = th;
    const mctx = mask.getContext("2d")!;
    mctx.fillStyle = "#fff"; // 불투명 = 보존(원본 영역)
    mctx.fillRect(dx, dy, dw, dh);

    const prompt =
      "투명한 빈 영역을 원본 그림과 자연스럽게 이어지는 배경으로 채워서 화면을 확장해줘. 원본 영역의 그림·글자·구도는 그대로 유지.";
    const resp = await genFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        size: target,
        quality,
        refs: [padded.toDataURL("image/png")],
        mask: mask.toDataURL("image/png"),
      }),
    });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
    if (!j.images?.length) throw new Error("결과 이미지가 없습니다");

    setImages((prev) =>
      prev.map((img) =>
        img.id === placeholderId
          ? { ...img, src: j.images[0], promptHint: `${image.promptHint || "이미지"}-전개`, generation: {prompt: `사이즈 전개 → ${target}`, provider: "openai", model: j.model || "gpt-image-2", size: target, quality, referenceIds: [image.id], createdAt: new Date().toISOString()} }
          : img,
      ),
    );
    setSelectedIds([placeholderId]);
    recordHistory({ kind: "사이즈 전개", prompt: `→ ${target}`, size: target, quality, refs: 1 });
    window.dispatchEvent(new Event("usage-updated"));
  } catch (error) {
    setImages((prev) => prev.filter((img) => img.id !== placeholderId));
    if (isCancel(error)) {
      toast({ title: "사이즈 전개 취소했습니다" });
      return;
    }
    toast({
      title: "사이즈 전개 실패",
      description: error instanceof Error ? error.message : "알 수 없는 오류",
      variant: "destructive",
      action: retryAction(() => runExpand(deps)),
    });
  } finally {
    setIsGenerating(false);
  }
}

// 기본 배경 제거: OpenAI 이미지 편집으로 투명 PNG 생성.
export async function runRemoveBackground(deps: {
  image: PlacedImage;
  quality: string;
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  toast: RunDeps["toast"];
}) {
  const { image, quality, setImages, setSelectedIds, setIsGenerating, toast } =
    deps;

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
    const size = pickSize(probe.naturalWidth, probe.naturalHeight);

    const prompt =
      "배경을 완전히 제거하고 주요 피사체만 남겨줘. 투명 배경. 피사체의 모양·색·질감·디테일은 원본 그대로 유지하고, 그림자나 배경 조각을 남기지 마.";
    const resp = await genFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        size,
        quality,
        refs: [ref],
        transparent: true,
        provider: "openai",
        openaiModel: "gpt-image-2.5-sunburst",
      }),
    });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
    if (!j.images?.length) throw new Error("결과 이미지가 없습니다");

    setImages((prev) =>
      prev.map((img) =>
        img.id === placeholderId
          ? {
              ...img,
              src: j.images[0],
              promptHint: `${image.promptHint || "이미지"}-누끼`,
              generation: {prompt: "배경 제거 (투명 PNG)", provider: "openai", model: j.model || "gpt-image-2", size, quality, referenceIds: [image.id], createdAt: new Date().toISOString()},
            }
          : img,
      ),
    );
    setSelectedIds([placeholderId]);
    recordHistory({
      kind: "배경 제거",
      prompt: "배경 제거 (투명 PNG)",
      size,
      quality,
      refs: 1,
    });
    window.dispatchEvent(new Event("usage-updated"));
  } catch (error) {
    setImages((prev) => prev.filter((img) => img.id !== placeholderId));
    if (isCancel(error)) {
      toast({ title: "배경 제거 취소했습니다" });
      return;
    }
    toast({
      title: "배경 제거 실패",
      description: error instanceof Error ? error.message : "알 수 없는 오류",
      variant: "destructive",
      action: retryAction(() => runRemoveBackground(deps)),
    });
  } finally {
    setIsGenerating(false);
  }
}

// 오려내기: 원본 픽셀 보존 + 배경만 투명 (로컬 모델, API 비용 없음)
export async function runCutout(deps: {
  image: PlacedImage;
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  setProgressNote?: (msg: string) => void;
  toast: RunDeps["toast"];
}) {
  const {
    image,
    setImages,
    setSelectedIds,
    setIsGenerating,
    setProgressNote,
    toast,
  } = deps;

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
    const src = await exportImageAsDataUrl(image);
    const { cutoutBackground } = await import("@/lib/cutout");
    const cut = await cutoutBackground(src, (msg) => setProgressNote?.(msg));

    setImages((prev) =>
      prev.map((img) =>
        img.id === placeholderId
          ? {
              ...img,
              src: cut,
              promptHint: `${image.promptHint || "이미지"}-오려냄`,
              generation: {prompt: "배경 오려내기 (원본 보존)", provider: "local", model: "cutout", size: "원본", quality: "-", referenceIds: [image.id], createdAt: new Date().toISOString()},
            }
          : img,
      ),
    );
    setSelectedIds([placeholderId]);
    recordHistory({
      kind: "오려내기",
      prompt: "배경 오려내기 (원본 보존·로컬 처리)",
      size: "원본",
      quality: "-",
      refs: 1,
    });
  } catch (error) {
    setImages((prev) => prev.filter((img) => img.id !== placeholderId));
    if (isCancel(error)) {
      toast({ title: "오려내기 취소했습니다" });
      return;
    }
    toast({
      title: "오려내기 실패",
      description: error instanceof Error ? error.message : "알 수 없는 오류",
      variant: "destructive",
      action: retryAction(() => runCutout(deps)),
    });
  } finally {
    setProgressNote?.("");
    setIsGenerating(false);
  }
}

// 카드뉴스 모드: 표지를 참조로 페이지들을 같은 스타일로 순차 생성
export async function runCardnews(deps: {
  cover: PlacedImage;
  lines: string[]; // 한 줄 = 한 페이지 내용
  quality: string;
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  toast: RunDeps["toast"];
}) {
  const { cover, lines, quality, setImages, setSelectedIds, setIsGenerating, toast } = deps;

  const coverSrc = await exportImageAsDataUrl(cover);
  const probe = new window.Image();
  probe.src = coverSrc;
  await new Promise((r) => (probe.onload = r));
  const size = pickSize(probe.naturalWidth, probe.naturalHeight);

  // 자리표시자를 표지 오른쪽에 한 줄로 미리 배치
  const ids = lines.map((_, i) => `generated-${Date.now()}-${i}`);
  setImages((prev) => [
    ...prev,
    ...lines.map((_, i) => ({
      id: ids[i],
      src: placeholderSrc,
      x: cover.x + (cover.width + 20) * (i + 1),
      y: cover.y,
      width: cover.width,
      height: cover.height,
      rotation: 0,
      isGenerated: true,
    })),
  ]);

  setIsGenerating(true);
  let ok = 0;
  try {
    for (let i = 0; i < lines.length; i++) {
      const prompt = `이 표지와 같은 디자인 시스템(배색·서체 느낌·레이아웃 톤)을 유지한 카드뉴스의 ${i + 2}번째 내용 페이지를 만들어줘. 표지 복제가 아니라 내용 페이지다. 이 페이지에 담을 내용: ${lines[i]}`;
      try {
        const resp = await genFetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, size, quality, refs: [coverSrc] }),
        });
        const j = await resp.json();
        if (!resp.ok || !j.images?.length) throw new Error(j.error || "생성 실패");
        setImages((prev) =>
          prev.map((img) =>
            img.id === ids[i]
              ? { ...img, src: j.images[0], promptHint: slugFromPrompt(lines[i]) }
              : img,
          ),
        );
        ok++;
        window.dispatchEvent(new Event("usage-updated"));
      } catch (e) {
        // 취소면 남은 자리표시자까지 걷어내고 루프를 끊는다
        if (isCancel(e)) {
          setImages((prev) => prev.filter((img) => !ids.slice(i).includes(img.id)));
          toast({ title: "카드뉴스 생성 취소했습니다", description: `${ok}페이지까지 만들었어요` });
          break;
        }
        setImages((prev) => prev.filter((img) => img.id !== ids[i]));
        toast({
          title: `${i + 2}페이지 생성 실패`,
          description: e instanceof Error ? e.message : "알 수 없는 오류",
          variant: "destructive",
        });
      }
    }
    if (ok > 0) {
      setSelectedIds(ids.slice(0, ok));
      recordHistory({
        kind: "카드뉴스",
        prompt: lines.join(" / "),
        size,
        quality,
        refs: 1,
      });
      toast({ title: `카드뉴스 ${ok}페이지 완성`, description: "표지 스타일을 유지해 생성했어요" });
    }
  } finally {
    setIsGenerating(false);
  }
}

// 부분 수정 (F-07): 원본 + 마스크(알파=0=수정영역) → 옆에 결과 배치
export async function runMaskEdit(deps: {
  image: PlacedImage;
  maskDataUrl: string;
  prompt: string;
  quality: string;
  historyKind?: string;
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
    const editSize = pickSize(probe.naturalWidth, probe.naturalHeight);

    const resp = await genFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        size: editSize,
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
        img.id === placeholderId
          ? { ...img, src: j.images[0], promptHint: slugFromPrompt(prompt), generation: {prompt, provider: "openai", model: j.model || "gpt-image-2", size: editSize, quality, referenceIds: [image.id], createdAt: new Date().toISOString()} }
          : img,
      ),
    );
    setSelectedIds([placeholderId]);
    recordHistory({
      kind: deps.historyKind || "부분수정",
      prompt,
      size: editSize,
      quality,
      refs: 1,
    });
    window.dispatchEvent(new Event("usage-updated"));
  } catch (error) {
    setImages((prev) => prev.filter((img) => img.id !== placeholderId));
    if (isCancel(error)) {
      toast({ title: "부분 수정 취소했습니다" });
      return;
    }
    toast({
      title: "부분 수정 실패",
      description: error instanceof Error ? error.message : "알 수 없는 오류",
      variant: "destructive",
      action: retryAction(() => runMaskEdit(deps)),
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
    transparent,
    provider,
    geminiModel,
    openaiModel,
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
    x = ((canvasSize.width + (deps.workspaceLeft || 0)) / 2 - viewport.x) / viewport.scale - dispW / 2;
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
    const resp = await genFetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        size,
        quality,
        n: deps.n || 1,
        refs,
        ...(transparent && { transparent: true }),
        ...(provider && { provider }),
        ...(geminiModel && { geminiModel }),
        ...(openaiModel && { openaiModel }),
      }),
    });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
    if (!j.images?.length) throw new Error("결과 이미지가 없습니다");

    // P4 요소 뽑기: 투명으로 시켰는데 배경이 채워져 왔으면 로컬 오려내기로 보정 (무료)
    const generated: PlacedImage[] = [];
    for (let index = 0; index < j.images.length; index++) {
    let src: string = j.images[index];
    if (transparent) {
      const { hasTransparentEdge } = await import("@/lib/alpha-check");
      if (!(await hasTransparentEdge(src))) {
        try {
          const { cutoutBackground } = await import("@/lib/cutout");
          src = await cutoutBackground(src);
          toast({ title: "배경이 남아 있어 자동으로 오려냈어요" });
        } catch {
          toast({ title: "배경이 남아 왔어요", description: "「✏️ 이 이미지 수정 ▸ 오려내기」로 직접 오려낼 수 있어요" });
        }
      }
    }

    const actual = await loadOutputImage(src);
    generated.push({id: index === 0 ? placeholderId : `${placeholderId}-${index}`, src,
      x: x + index * (dispW + 24), y, width:dispW, height:dispW * actual.naturalHeight / actual.naturalWidth,
      rotation:0, isGenerated:true, promptHint:slugFromPrompt(prompt),generation:{prompt,provider:deps.provider||"openai",model:j.model||(deps.provider==="gemini"?deps.geminiModel||"gemini":deps.provider==="grok"?"grok-imagine-image-2.0":deps.openaiModel||"gpt-image-2"),size,quality,referenceIds:selectedIds.slice(0,16),createdAt:new Date().toISOString()}});
    }
    setImages(prev => [...prev.filter(img => img.id !== placeholderId), ...generated]);
    setSelectedIds(generated.map(img => img.id));
    if (deps.setViewport) {
      const left = deps.workspaceLeft || 0;
      const availableWidth = canvasSize.width-left-(deps.workspaceRight || 0);
      const availableHeight = canvasSize.height-160-(deps.workspaceBottom || 60);
      const width = generated.length * (dispW + 24) - 24;
      const height = Math.max(...generated.map(img => img.height));
      const scale = Math.min(viewport.scale, Math.max(.1, (availableWidth-60)/width), Math.max(.1,(availableHeight-30)/height));
      deps.setViewport({scale, x:left+(availableWidth-width*scale)/2-x*scale,y:160+(availableHeight-height*scale)/2-y*scale});
    }
    recordHistory({ kind: "생성", prompt, size, quality, refs: refs.length,model:generated[0]?.generation?.model,provider:deps.provider||"openai",referenceIds:selectedIds.slice(0,16),resultIds:generated.map(i=>i.id) });
    window.dispatchEvent(new Event("usage-updated"));
  } catch (error) {
    setImages((prev) => prev.filter((img) => img.id !== placeholderId));
    if (isCancel(error)) {
      toast({ title: "생성 취소했습니다" });
      return;
    }
    toast({
      title: "생성 실패",
      description: error instanceof Error ? error.message : "알 수 없는 오류",
      variant: "destructive",
      action: retryAction(() => runOpenAIGeneration(deps)),
    });
  } finally {
    setIsGenerating(false);
  }
}
