// 캠페인 일괄 생성 — 키비주얼을 먼저 만들고, 나머지는 그것을 참조로 물려 톤을 맞춘다.
// (로바트의 "canvas as context"를 우리 방식으로: 첫 결과가 뒤 작업의 재료가 된다)
import type { PlacedImage } from "@/types/canvas";
import { genFetch, isCancel } from "@/lib/generation-abort";
import { placeholderSrc, slugFromPrompt } from "./openai-handler";

export interface CampaignItem {
  role: string;
  prompt: string;
  size: string;
}

export interface CampaignPlan {
  concept: string;
  palette: string[];
  items: CampaignItem[];
}

interface Deps {
  plan: CampaignPlan;
  quality: string;
  provider: string;
  geminiModel?: string;
  startX: number;
  startY: number;
  setImages: React.Dispatch<React.SetStateAction<PlacedImage[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  setProgressNote: (msg: string) => void;
  toast: (p: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

const GAP = 24;
const ROW_H = 360;

export async function runCampaign(deps: Deps) {
  const {
    plan,
    quality,
    provider,
    geminiModel,
    startX,
    startY,
    setImages,
    setSelectedIds,
    setIsGenerating,
    setProgressNote,
    toast,
  } = deps;

  // 자리표시자를 한 줄로 미리 깔아 어떤 작업이 도는지 보이게 한다
  const ids = plan.items.map((_, i) => `campaign-${Date.now()}-${i}`);
  let cursorX = startX;
  const boxes = plan.items.map((item, i) => {
    const [w, h] = item.size.split("x").map(Number);
    const dispH = ROW_H;
    const dispW = Math.round((dispH * w) / h);
    const box = { x: cursorX, y: startY, width: dispW, height: dispH };
    cursorX += dispW + GAP;
    void i;
    return box;
  });

  setImages((prev) => [
    ...prev,
    ...plan.items.map((_, i) => ({
      id: ids[i],
      src: placeholderSrc,
      x: boxes[i].x,
      y: boxes[i].y,
      width: boxes[i].width,
      height: boxes[i].height,
      rotation: 0,
      isGenerated: true,
    })),
  ]);

  setIsGenerating(true);
  let keyVisual: string | undefined = undefined;
  let done = 0;

  try {
    for (let i = 0; i < plan.items.length; i++) {
      const item = plan.items[i];
      setProgressNote(`${i + 1}/${plan.items.length} · ${item.role}`);

      // 팔레트를 프롬프트에 실어 색을 통일한다
      const paletteLine = plan.palette?.length
        ? ` 색은 이 팔레트를 지켜서: ${plan.palette.join(", ")}.`
        : "";
      const consistency: string =
        keyVisual && i > 0
          ? " 함께 준 이미지의 화풍·색감·분위기를 그대로 이어서 같은 캠페인처럼 보이게."
          : "";

      try {
        const resp = await genFetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: item.prompt + paletteLine + consistency,
            size: item.size,
            quality,
            provider,
            ...(geminiModel && { geminiModel }),
            // 키비주얼(i=0)은 참조 없이, 나머지는 키비주얼을 참조로
            refs: keyVisual && i > 0 ? [keyVisual] : ([] as string[]),
          }),
        });
        const j = await resp.json();
        if (!resp.ok || !j.images?.length) throw new Error(j.error || "생성 실패");

        const src: string = j.images[0];
        if (i === 0) keyVisual = src as string;
        setImages((prev) =>
          prev.map((img) =>
            img.id === ids[i]
              ? { ...img, src, promptHint: `${item.role}-${slugFromPrompt(item.prompt)}` }
              : img,
          ),
        );
        done++;
        window.dispatchEvent(new Event("usage-updated"));
      } catch (e) {
        // 취소면 남은 자리표시자까지 걷어내고 루프를 끊는다
        if (isCancel(e)) {
          setImages((prev) => prev.filter((img) => !ids.slice(i).includes(img.id)));
          toast({ title: "캠페인 생성 취소했습니다", description: `${done}종까지 만들었어요` });
          break;
        }
        setImages((prev) => prev.filter((img) => img.id !== ids[i]));
        toast({
          title: `${item.role} 생성 실패`,
          description: e instanceof Error ? e.message : "알 수 없는 오류",
          variant: "destructive",
        });
      }
    }

    if (done > 0) {
      setSelectedIds(ids.slice(0, done));
      toast({
        title: `캠페인 ${done}종 완성`,
        description: plan.concept,
      });
    }
  } finally {
    setProgressNote("");
    setIsGenerating(false);
  }
}
